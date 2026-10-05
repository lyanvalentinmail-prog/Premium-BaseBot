/**
 * Descargas de contenido PÚBLICO mediante `yt-dlp` (herramienta externa, opcional).
 *
 * Decisión de diseño: no se usan "APIs" de terceros no oficiales ni endpoints inventados.
 * yt-dlp es un proyecto mantenido y ampliamente usado; si no está instalado, los comandos
 * devuelven un mensaje controlado explicando cómo instalarlo.
 *
 * No se implementa ningún bypass de DRM, paywalls, autenticación, CAPTCHA ni contenido privado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import config, { paths } from '../config.js';
import { hasBinary, tempFile, cleanup } from './media.js';
import { UserError, NotConfiguredError, ProviderError } from './errors.js';
import { assertSafeUrl } from './apiClient.js';
import { createLogger } from './logger.js';

const log = createLogger('downloader');

export const hasYtDlp = () => hasBinary('yt-dlp', ['--version']);

export const requireYtDlp = async () => {
  if (!(await hasYtDlp())) {
    throw new NotConfiguredError(
      [
        'Esta descarga necesita *yt-dlp* instalado en el sistema:',
        '',
        '• Termux ☇ `pkg install python && pip install -U yt-dlp`',
        '• Linux ☇ `sudo apt install yt-dlp` o `pipx install yt-dlp`',
        '',
        'El bot no usa APIs no oficiales ni evade restricciones de las plataformas.',
      ].join('\n'),
    );
  }
};

const run = (args, { timeout = 300_000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new UserError('⚠️ La descarga tardó demasiado y fue cancelada.'));
    }, timeout);
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 8_000_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      log.warn({ code, stderr: stderr.slice(0, 400) }, 'yt-dlp falló');
      if (/private|login|sign in|members-only|not available/i.test(stderr)) {
        reject(new UserError('🔒 Ese contenido no es público o requiere iniciar sesión, no puede descargarse.'));
        return;
      }
      if (/unsupported url/i.test(stderr)) {
        reject(new UserError('❌ Ese enlace no está soportado.'));
        return;
      }
      reject(new ProviderError('⚠️ No se pudo descargar el contenido en este momento.'));
    });
  });

/** Metadatos del contenido (sin descargar). */
export const fetchInfo = async (url) => {
  await requireYtDlp();
  await assertSafeUrl(url);
  const output = await run(['-J', '--no-warnings', '--no-playlist', url], { timeout: 90_000 });
  try {
    const data = JSON.parse(output);
    return data.entries?.[0] || data;
  } catch {
    throw new ProviderError('⚠️ No se pudo leer la información del contenido.');
  }
};

const MAX_BYTES = () => config.media.maxDownloadMb * 1024 * 1024;

/**
 * Descarga audio o vídeo.
 * @returns {{file:string, info:object}} ruta temporal (el llamador debe borrarla)
 */
export const download = async (url, { audio = false, quality = '480' } = {}) => {
  await requireYtDlp();
  await assertSafeUrl(url);
  const info = await fetchInfo(url);

  const estimated = Number(info.filesize || info.filesize_approx || 0);
  if (estimated && estimated > MAX_BYTES()) {
    throw new UserError(`❌ El archivo pesa ${(estimated / 1048576).toFixed(1)} MB y el límite es ${config.media.maxDownloadMb} MB.`);
  }
  if (Number(info.duration || 0) > 3600) {
    throw new UserError('❌ El contenido dura más de 1 hora, demasiado grande para WhatsApp.');
  }

  const target = tempFile(audio ? 'mp3' : 'mp4');
  const template = target.replace(/\.(mp3|mp4)$/, '.%(ext)s');
  const args = audio
    ? ['-x', '--audio-format', 'mp3', '--audio-quality', '5', '-o', template, '--no-playlist', '--no-warnings', url]
    : [
        '-f', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`,
        '--merge-output-format', 'mp4', '-o', template, '--no-playlist', '--no-warnings', url,
      ];

  await run(args);

  // yt-dlp puede cambiar la extensión final: buscamos el archivo generado.
  const base = path.basename(target).replace(/\.(mp3|mp4)$/, '');
  const produced = fs
    .readdirSync(paths.temp)
    .filter((name) => name.startsWith(base))
    .map((name) => path.join(paths.temp, name));
  const file = produced.find((f) => f.endsWith(audio ? '.mp3' : '.mp4')) || produced[0];
  if (!file || !fs.existsSync(file)) throw new ProviderError('⚠️ La descarga no generó ningún archivo.');

  const size = fs.statSync(file).size;
  if (size > MAX_BYTES()) {
    cleanup(produced);
    throw new UserError(`❌ El archivo descargado (${(size / 1048576).toFixed(1)} MB) supera el límite de ${config.media.maxDownloadMb} MB.`);
  }
  return { file, info, extra: produced.filter((f) => f !== file) };
};

export default { hasYtDlp, requireYtDlp, fetchInfo, download };
