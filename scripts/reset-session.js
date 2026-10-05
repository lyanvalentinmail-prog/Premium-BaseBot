#!/usr/bin/env node
/**
 * npm run reset-session            → pide confirmación
 * npm run reset-session -- --yes   → sin preguntar (ojo: los dos guiones son de npm)
 *
 * Borra ÚNICAMENTE las credenciales de la sesión de WhatsApp.
 * No toca la base de datos, el .env ni los assets.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Nombres de carpeta usados históricamente por bots de Baileys. */
const KNOWN_SESSION_DIRS = ['sessions', 'session', 'auth_info_baileys', 'auth_info'];

/**
 * Lee SESSION_DIR de un .env tolerando comillas, comentarios en línea,
 * espacios y finales de línea de Windows (CRLF), que rompían la lectura anterior.
 * @param {string} content contenido del fichero .env
 * @returns {string|null}
 */
export const parseSessionDir = (content) => {
  const match = /^[ \t]*(?:export[ \t]+)?SESSION_DIR[ \t]*=(.*)$/m.exec(content || '');
  if (!match) return null;
  let value = match[1].replace(/\r/g, '').trim();
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
    value = value.slice(1, -1);
  } else {
    value = value.split('#')[0].trim(); // comentario en línea (solo si no hay comillas)
  }
  return value || null;
};

/**
 * Determina la carpeta de sesión: variable de entorno > .env > carpeta existente
 * conocida > 'sessions' por defecto.
 */
export const resolveSessionDir = (root = ROOT, env = process.env) => {
  if (env.SESSION_DIR?.trim()) return path.resolve(root, env.SESSION_DIR.trim());

  const envFile = path.join(root, '.env');
  if (fs.existsSync(envFile)) {
    try {
      const value = parseSessionDir(fs.readFileSync(envFile, 'utf8'));
      if (value) return path.resolve(root, value);
    } catch {
      // .env ilegible: se continúa con la detección automática
    }
  }

  for (const name of KNOWN_SESSION_DIRS) {
    const candidate = path.join(root, name);
    if (fs.existsSync(candidate) && fs.readdirSync(candidate).some((f) => f.startsWith('creds'))) {
      return candidate;
    }
  }
  return path.join(root, 'sessions');
};

/** Borra el contenido de la carpeta de sesión y la deja vacía. */
export const wipeSessionDir = (dir) => {
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    const target = path.join(dir, entry);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed += 1;
    } catch (error) {
      throw new Error(`No se pudo borrar ${target}: ${error.message}`);
    }
  }
  return removed;
};

const main = async () => {
  const args = process.argv.slice(2);
  const auto = args.some((arg) => ['--yes', '-y', '--force', '-f'].includes(arg));
  const sessionDir = resolveSessionDir();

  if (!fs.existsSync(sessionDir) || !fs.readdirSync(sessionDir).length) {
    console.log(`ℹ️  No hay ninguna sesión guardada en: ${sessionDir}`);
    const otros = KNOWN_SESSION_DIRS
      .map((name) => path.join(ROOT, name))
      .filter((dir) => dir !== sessionDir && fs.existsSync(dir) && fs.readdirSync(dir).length);
    if (otros.length) {
      console.log('\n   Se han encontrado credenciales en otra carpeta:');
      for (const dir of otros) console.log(`   • ${dir}`);
      console.log('\n   Ajusta SESSION_DIR en el .env o ejecútalo así:');
      console.log(`   SESSION_DIR=${path.basename(otros[0])} npm run reset-session -- --yes`);
    }
    return;
  }

  const files = fs.readdirSync(sessionDir);
  console.log(`\n⚠️  Se van a borrar ${files.length} archivos de sesión en: ${sessionDir}`);
  console.log('   La base de datos, el .env y los assets NO se tocan.');
  console.log('   Detén el bot antes de continuar (si está en marcha, volverá a escribir la sesión).\n');

  if (!auto) {
    if (!input.isTTY) {
      console.log('ℹ️  No hay terminal interactiva para confirmar.');
      console.log('   Ejecuta: npm run reset-session -- --yes');
      return;
    }
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('¿Continuar? (s/N): ');
    rl.close();
    if (!['s', 'si', 'sí', 'y', 'yes'].includes(answer.trim().toLowerCase())) {
      console.log('Cancelado.');
      return;
    }
  }

  const removed = wipeSessionDir(sessionDir);
  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(`\n✅ Sesión eliminada (${removed} elementos).`);
  console.log('   Ejecuta `npm start` para vincular de nuevo con Pairing Code.\n');
};

// Solo se ejecuta cuando se invoca directamente (los tests importan las funciones).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  });
}
