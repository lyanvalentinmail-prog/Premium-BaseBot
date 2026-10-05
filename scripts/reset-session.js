#!/usr/bin/env node
/**
 * npm run reset-session
 * Borra ÚNICAMENTE los credenciales de la sesión de WhatsApp.
 * No toca la base de datos, el .env ni los assets.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(ROOT, '.env');
let sessionDir = path.join(ROOT, 'sessions');
if (fs.existsSync(envFile)) {
  const match = /^SESSION_DIR=(.*)$/m.exec(fs.readFileSync(envFile, 'utf8'));
  if (match?.[1]?.trim()) sessionDir = path.resolve(ROOT, match[1].trim());
}

const main = async () => {
  if (!fs.existsSync(sessionDir) || !fs.readdirSync(sessionDir).length) {
    console.log('ℹ️  No hay ninguna sesión guardada. Nada que borrar.');
    return;
  }

  const files = fs.readdirSync(sessionDir);
  console.log(`\n⚠️  Se van a borrar ${files.length} archivos de sesión en: ${sessionDir}`);
  console.log('   La base de datos, el .env y los assets NO se tocan.\n');

  if (!process.argv.includes('--yes') && process.stdin.isTTY) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('¿Continuar? (s/N): ');
    rl.close();
    if (!['s', 'si', 'sí', 'y', 'yes'].includes(answer.trim().toLowerCase())) {
      console.log('Cancelado.');
      return;
    }
  }

  fs.rmSync(sessionDir, { recursive: true, force: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  console.log('\n✅ Sesión eliminada. Ejecuta `npm start` para vincular de nuevo con Pairing Code.\n');
};

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
