#!/usr/bin/env node
/**
 * npm run check
 * Verifica configuración, dependencias, comandos y proveedores configurados
 * sin conectarse a WhatsApp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = (t) => console.log(`\x1b[32m✓\x1b[0m ${t}`);
const warn = (t) => console.log(`\x1b[33m•\x1b[0m ${t}`);
const bad = (t) => console.log(`\x1b[31m✗\x1b[0m ${t}`);

const hasBinary = async (binary, args = ['-version']) => {
  try {
    await execFileAsync(binary, args, { timeout: 10_000 });
    return true;
  } catch (error) {
    return Boolean(error?.stdout || error?.stderr) && error?.code !== 'ENOENT';
  }
};

const main = async () => {
  console.log('\n🔎 Comprobando la instalación…\n');

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok(`Node ${process.version}`);
  else bad(`Node ${process.version} (se requiere >= 20)`);

  if (fs.existsSync(path.join(ROOT, '.env'))) ok('.env encontrado');
  else warn('.env no encontrado — ejecuta `npm run setup`');

  const { default: config, ownerNumbers, paths } = await import('../bot/config.js');
  ok(`Bot: ${config.name} v${config.version} · prefijo "${config.prefix}" · modo ${config.mode}`);
  if (ownerNumbers.length) ok(`OWNER_NUMBER configurado (${ownerNumbers.length})`);
  else bad('OWNER_NUMBER sin configurar: los comandos de owner no funcionarán');

  const { initDatabase, stats, closeDatabase } = await import('../bot/database/index.js');
  await initDatabase();
  const dbStats = stats();
  ok(`Base de datos OK (${dbStats.users} usuarios, ${dbStats.groups} grupos)`);
  closeDatabase();

  const { loadCommands, commandsByCategory, listCommands } = await import('../bot/lib/commandLoader.js');
  const result = await loadCommands();
  if (result.failed) bad(`${result.failed} archivos de comandos con errores`);
  ok(`${result.total} comandos en ${commandsByCategory().size} categorías`);

  const withoutDescription = listCommands().filter((c) => !c.description);
  if (withoutDescription.length) warn(`${withoutDescription.length} comandos sin descripción`);

  for (const [binary, args, label, required] of [
    ['ffmpeg', ['-version'], 'FFmpeg (stickers, audio, voz)', true],
    ['ffprobe', ['-version'], 'ffprobe (duración de audio)', false],
    ['yt-dlp', ['--version'], 'yt-dlp (descargas)', false],
    ['espeak-ng', ['--version'], 'espeak-ng (TTS local)', false],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const available = await hasBinary(binary, args);
    if (available) ok(label);
    else if (required) warn(`${label} no disponible`);
    else warn(`${label} no disponible (opcional)`);
  }

  const { PROVIDERS, hasProvider } = await import('../bot/lib/apiClient.js');
  const configured = Object.entries(PROVIDERS).filter(([key]) => hasProvider(key));
  ok(`Proveedores configurados: ${configured.length ? configured.map(([, p]) => p.env).join(', ') : 'ninguno'}`);

  if (fs.existsSync(paths.banner)) ok('Banner encontrado (assets/banner.jpg)');
  else warn('No hay banner en assets/banner.jpg (el menú se enviará como texto)');

  console.log('\n✅ Comprobación finalizada.\n');
};

main().catch((error) => {
  bad(error.message);
  process.exit(1);
});
