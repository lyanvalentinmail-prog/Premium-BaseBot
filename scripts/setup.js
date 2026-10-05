#!/usr/bin/env node
/**
 * npm run setup
 * - Comprueba la versión de Node
 * - Crea .env desde .env.example (sin sobrescribir)
 * - Crea los directorios necesarios
 * - Inicializa la base de datos
 * - Comprueba FFmpeg y herramientas opcionales
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIN_NODE = 20;

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;

const checkBinary = async (binary, args = ['-version']) => {
  try {
    await execFileAsync(binary, args, { timeout: 10_000 });
    return true;
  } catch (error) {
    return Boolean(error?.stdout || error?.stderr) && error?.code !== 'ENOENT';
  }
};

const main = async () => {
  console.log('\n⚙️  Configurando el bot…\n');

  /* 1. Node */
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE) {
    console.log(red(`✗ Node ${process.version} detectado. Se requiere Node ${MIN_NODE} o superior.`));
    process.exit(1);
  }
  console.log(green(`✓ Node ${process.version}`));

  /* 2. .env */
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (fs.existsSync(envPath)) {
    console.log(yellow('• .env ya existe: no se sobrescribe'));
  } else if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log(green('✓ .env creado a partir de .env.example'));
  } else {
    console.log(red('✗ No se encontró .env.example'));
  }

  /* 3. Directorios */
  const dirs = ['data', 'sessions', 'logs', 'assets/temp', 'assets/sounds'];
  for (const dir of dirs) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  console.log(green(`✓ Directorios listos (${dirs.join(', ')})`));

  /* 4. Base de datos */
  const { initDatabase, closeDatabase, stats } = await import('../bot/database/index.js');
  await initDatabase();
  const dbStats = stats();
  closeDatabase();
  console.log(green(`✓ Base de datos preparada (${dbStats.users} usuarios registrados)`));

  /* 5. Comandos */
  const { loadCommands } = await import('../bot/lib/commandLoader.js');
  const loaded = await loadCommands();
  console.log(green(`✓ ${loaded.total} comandos detectados en ${loaded.files} archivos`));

  /* 6. Binarios opcionales */
  const ffmpeg = await checkBinary('ffmpeg');
  const ffprobe = await checkBinary('ffprobe');
  const ytdlp = await checkBinary('yt-dlp', ['--version']);
  const espeak = await checkBinary('espeak-ng', ['--version']);

  console.log(ffmpeg ? green('✓ FFmpeg disponible') : yellow('• FFmpeg NO disponible (stickers/audio/voz limitados)'));
  if (!ffprobe) console.log(yellow('• ffprobe NO disponible (no se podrá validar la duración de los audios)'));
  console.log(ytdlp ? green('✓ yt-dlp disponible') : yellow('• yt-dlp NO disponible (los comandos de descarga avisarán)'));
  console.log(espeak ? green('✓ espeak-ng disponible (TTS local)') : yellow('• espeak-ng NO disponible (TTS requerirá OPENAI_API_KEY)'));

  /* 7. Resumen */
  const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const botName = /^BOT_NAME=(.*)$/m.exec(env)?.[1]?.trim() || 'Premium BaseBot';
  const ownerNumber = /^OWNER_NUMBER=(.*)$/m.exec(env)?.[1]?.trim();

  console.log(`
╭──「 ✓ CONFIGURACIÓN 」
│
│ 🤖 Bot ☇ ${botName}
│ 📦 Database ☇ Preparada
│ 🎞️ FFmpeg ☇ ${ffmpeg ? 'Disponible' : 'No disponible'}
│ 👑 Owner ☇ ${ownerNumber ? `${ownerNumber.slice(0, 4)}***` : 'SIN CONFIGURAR'}
│
│ Siguiente paso:
│ npm start
│
╰────────────────────⬣
`);

  if (!ownerNumber) {
    console.log(yellow('⚠️  Edita el archivo .env y define OWNER_NUMBER antes de iniciar el bot.\n'));
  }
};

main().catch((error) => {
  console.error(red(`\n✗ Error durante la configuración: ${error.message}\n`));
  process.exit(1);
});
