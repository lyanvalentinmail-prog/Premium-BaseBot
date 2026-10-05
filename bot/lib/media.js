/**
 * Utilidades multimedia: descarga de media de WhatsApp, FFmpeg, ficheros temporales,
 * conversión a sticker (WebP + metadatos EXIF) e imagen con Jimp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { downloadMediaMessage } from 'baileys';
import { Jimp } from 'jimp';
import config, { paths } from '../config.js';
import { createLogger } from './logger.js';
import { UserError } from './errors.js';
import { ensureDir } from './utils.js';

const log = createLogger('media');
const execFileAsync = promisify(execFile);

ensureDir(paths.temp);

/* ───────────────────────── Ficheros temporales ───────────────────────── */

export const tempFile = (ext = 'tmp') =>
  path.join(paths.temp, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext.replace(/^\./, '')}`);

export const writeTemp = (buffer, ext = 'tmp') => {
  const file = tempFile(ext);
  fs.writeFileSync(file, buffer);
  return file;
};

/** Borra ficheros ignorando errores (usar siempre en `finally`). */
export const cleanup = (...files) => {
  for (const file of files.flat()) {
    if (!file) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* ya no existe */
    }
  }
};

/** Elimina temporales antiguos. */
export const cleanTempDir = (maxAgeMinutes = config.media.tempTtlMinutes) => {
  let removed = 0;
  try {
    const limit = Date.now() - maxAgeMinutes * 60_000;
    for (const name of fs.readdirSync(paths.temp)) {
      if (name === '.gitkeep') continue;
      const file = path.join(paths.temp, name);
      try {
        if (fs.statSync(file).mtimeMs < limit) {
          fs.rmSync(file, { force: true, recursive: true });
          removed += 1;
        }
      } catch {
        /* ignorar */
      }
    }
  } catch {
    /* carpeta inexistente */
  }
  return removed;
};

/* ───────────────────────── Binarios externos ───────────────────────── */

const binaryCache = new Map();

/** ¿Está disponible un binario en el PATH? (cacheado) */
export const hasBinary = async (binary, args = ['-version']) => {
  if (binaryCache.has(binary)) return binaryCache.get(binary);
  let available = false;
  try {
    await execFileAsync(binary, args, { timeout: 8000 });
    available = true;
  } catch (error) {
    available = Boolean(error?.stdout || error?.stderr) && error?.code !== 'ENOENT';
  }
  binaryCache.set(binary, available);
  return available;
};

export const hasFFmpeg = () => hasBinary('ffmpeg');
export const hasFFprobe = () => hasBinary('ffprobe');

export const requireFFmpeg = async () => {
  if (!(await hasFFmpeg())) {
    throw new UserError('⚠️ Esta función requiere FFmpeg.\n\nInstálalo con:\n`pkg install ffmpeg` (Termux)\n`sudo apt install ffmpeg` (Linux)');
  }
};

/** Ejecuta FFmpeg con timeout. */
export const runFFmpeg = (args, { timeout = 120_000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new UserError('⚠️ El procesamiento tardó demasiado y fue cancelado.'));
    }, timeout);
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(true);
      log.warn({ code, stderr: stderr.slice(0, 500) }, 'FFmpeg falló');
      reject(new UserError('⚠️ No se pudo procesar el archivo multimedia.'));
    });
  });

/** Metadatos con ffprobe (duración, tamaño…). */
export const probe = async (file) => {
  if (!(await hasFFprobe())) return null;
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate', '-of', 'json', file],
      { timeout: 20_000 },
    );
    const data = JSON.parse(stdout);
    return {
      duration: Number(data?.format?.duration) || 0,
      size: Number(data?.format?.size) || 0,
      bitrate: Number(data?.format?.bit_rate) || 0,
    };
  } catch {
    return null;
  }
};

/** Valida duración máxima de un audio/vídeo. */
export const assertDuration = async (file, maxSeconds = config.media.maxAudioSeconds) => {
  const info = await probe(file);
  if (info?.duration && info.duration > maxSeconds) {
    throw new UserError(`❌ El archivo es demasiado largo (máx. ${Math.floor(maxSeconds / 60)} minutos).`);
  }
  return info;
};

/* ───────────────────────── Descarga desde WhatsApp ───────────────────────── */

/**
 * Descarga el contenido multimedia de un mensaje serializado (o de su cita).
 * @param {object} target objeto con `.raw` (mensaje de Baileys)
 */
export const downloadMedia = async (target, sock) => {
  const source = target?.raw || target;
  if (!source?.message) throw new UserError('❌ No se encontró contenido multimedia.');
  const buffer = await downloadMediaMessage(
    source,
    'buffer',
    {},
    { logger: log, reuploadRequest: sock?.updateMediaMessage },
  );
  const maxBytes = config.media.maxDownloadMb * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new UserError(`❌ El archivo supera el tamaño máximo (${config.media.maxDownloadMb} MB).`);
  }
  return buffer;
};

/* ───────────────────────── Imágenes (Jimp) ───────────────────────── */

export const loadImage = async (buffer) => {
  try {
    return await Jimp.read(buffer);
  } catch {
    throw new UserError('❌ No se pudo leer la imagen.');
  }
};

export const imageToBuffer = async (image, mime = 'image/png') => image.getBuffer(mime);

export { Jimp };

/* ───────────────────────── Stickers (WebP + EXIF) ───────────────────────── */

/** Construye el bloque EXIF con los metadatos del pack. */
const buildExif = (pack, author, emojis = []) => {
  const json = {
    'sticker-pack-id': crypto.randomUUID(),
    'sticker-pack-name': pack,
    'sticker-pack-publisher': author,
    emojis,
  };
  const header = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const payload = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([header, payload]);
  exif.writeUIntLE(payload.length, 14, 4);
  return exif;
};

/** Inserta el chunk EXIF en un WebP (RIFF) sin dependencias nativas. */
export const addStickerMetadata = (webpBuffer, { pack, author, emojis } = {}) => {
  if (webpBuffer.slice(0, 4).toString() !== 'RIFF') return webpBuffer;
  const exif = buildExif(pack || config.sticker.pack, author || config.sticker.author, emojis || []);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('EXIF', 0, 'ascii');
  chunkHeader.writeUInt32LE(exif.length, 4);
  const padding = exif.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);

  // Asegura que el fichero use el contenedor extendido VP8X (necesario para metadatos).
  let body = webpBuffer.slice(12);
  const header = Buffer.from(webpBuffer.slice(0, 12));
  const out = Buffer.concat([header, body, chunkHeader, exif, padding]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
};

/**
 * Convierte imagen/vídeo/gif a sticker WebP con metadatos.
 * @param {Buffer} buffer
 * @param {{animated?:boolean, pack?:string, author?:string, crop?:boolean, circle?:boolean}} options
 */
export const toSticker = async (buffer, options = {}) => {
  await requireFFmpeg();
  const input = writeTemp(buffer, 'bin');
  const output = tempFile('webp');
  try {
    const scale = options.crop
      ? "scale=512:512:force_original_aspect_ratio=increase,crop=512:512"
      : "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=#00000000";
    const args = options.animated
      ? ['-i', input, '-vcodec', 'libwebp', '-vf', `${scale},fps=15`, '-loop', '0', '-ss', '0', '-t', '8',
         '-preset', 'default', '-an', '-vsync', '0', '-compression_level', '6', '-q:v', '50', output]
      : ['-i', input, '-vcodec', 'libwebp', '-vf', scale, '-lossless', '0', '-compression_level', '6',
         '-q:v', '70', '-preset', 'picture', '-an', '-vsync', '0', '-frames:v', '1', output];
    await runFFmpeg(args, { timeout: options.animated ? 180_000 : 60_000 });
    const webp = fs.readFileSync(output);
    if (webp.length > 1024 * 1024) {
      throw new UserError('❌ El sticker resultante es demasiado grande. Prueba con un clip más corto.');
    }
    return addStickerMetadata(webp, options);
  } finally {
    cleanup(input, output);
  }
};

/** WebP (sticker) → PNG. */
export const stickerToImage = async (buffer) => {
  await requireFFmpeg();
  const input = writeTemp(buffer, 'webp');
  const output = tempFile('png');
  try {
    await runFFmpeg(['-i', input, '-frames:v', '1', output], { timeout: 45_000 });
    return fs.readFileSync(output);
  } finally {
    cleanup(input, output);
  }
};

/** WebP animado → MP4 (para enviar como "gif"). */
export const stickerToVideo = async (buffer) => {
  await requireFFmpeg();
  const input = writeTemp(buffer, 'webp');
  const output = tempFile('mp4');
  try {
    await runFFmpeg(
      ['-i', input, '-movflags', 'faststart', '-pix_fmt', 'yuv420p',
       '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15', output],
      { timeout: 90_000 },
    );
    return fs.readFileSync(output);
  } finally {
    cleanup(input, output);
  }
};

/**
 * Aplica un filtro de audio con FFmpeg y devuelve el buffer resultante.
 * @param {Buffer} buffer audio de entrada
 * @param {string[]} filterArgs argumentos de filtro (p.ej. ['-af','atempo=1.3'])
 */
export const processAudio = async (buffer, filterArgs, { format = 'mp3', codec = 'libmp3lame' } = {}) => {
  await requireFFmpeg();
  const input = writeTemp(buffer, 'bin');
  const output = tempFile(format);
  try {
    await assertDuration(input);
    await runFFmpeg(['-i', input, ...filterArgs, '-c:a', codec, output], { timeout: 180_000 });
    return fs.readFileSync(output);
  } finally {
    cleanup(input, output);
  }
};

/** Convierte audio a opus/ogg (nota de voz de WhatsApp). */
export const toVoiceNote = async (buffer, filterArgs = []) => {
  await requireFFmpeg();
  const input = writeTemp(buffer, 'bin');
  const output = tempFile('ogg');
  try {
    await runFFmpeg(
      ['-i', input, ...filterArgs, '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-ar', '48000', '-ac', '1', output],
      { timeout: 180_000 },
    );
    return fs.readFileSync(output);
  } finally {
    cleanup(input, output);
  }
};

export default {
  tempFile,
  writeTemp,
  cleanup,
  cleanTempDir,
  hasBinary,
  hasFFmpeg,
  requireFFmpeg,
  runFFmpeg,
  probe,
  assertDuration,
  downloadMedia,
  loadImage,
  imageToBuffer,
  toSticker,
  stickerToImage,
  stickerToVideo,
  processAudio,
  toVoiceNote,
  addStickerMetadata,
  Jimp,
};
