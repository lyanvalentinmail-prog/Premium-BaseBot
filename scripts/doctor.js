#!/usr/bin/env node
/**
 * npm run doctor
 *
 * Diagnóstico EN VIVO: se conecta con la sesión existente y muestra, para cada
 * mensaje que llega, por qué se ejecuta (o por qué no) un comando.
 * No ejecuta los comandos: solo traza el recorrido del mensaje.
 *
 * Privacidad: del texto solo se muestran los primeros 12 caracteres y los
 * códigos de los 3 primeros (para detectar prefijos o caracteres invisibles).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { paths, activePrefixes, ownerNumbers } from '../bot/config.js';
import { initDatabase } from '../bot/database/index.js';
import { loadCommands, resolveCommand, totalCommands } from '../bot/lib/commandLoader.js';
import { serialize } from '../bot/lib/serialize.js';
import { isOwnerJid, canUseInPrivateMode } from '../bot/lib/permissions.js';
import { isBanned } from '../bot/database/users.js';
import { isCommandBlocked, getMode } from '../bot/database/settings.js';
import { startConnection, shouldProcessUpsert } from '../bot/connection.js';
import { jidToNumber } from '../bot/lib/utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);
const mask = (number) => (number ? `${number.slice(0, 4)}${'*'.repeat(Math.max(0, number.length - 6))}${number.slice(-2)}` : '—');

const preview = (text) => {
  if (!text) return '(vacío)';
  const codes = [...text.slice(0, 3)].map((char) => char.charCodeAt(0)).join(',');
  return `${JSON.stringify(text.slice(0, 12))} · códigos: [${codes}] · longitud: ${text.length}`;
};

const main = async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  console.log('\n╭──「 🩺 DIAGNÓSTICO EN VIVO 」\n');
  line('Versión', `${pkg.name} v${pkg.version}`);
  line('Node', process.version);
  line('Prefijos activos', activePrefixes.map((p) => JSON.stringify(p)).join(' '));
  line('Modo (config)', config.mode);
  line('Owner(s)', ownerNumbers.map(mask).join(', ') || '⚠️ sin configurar');
  line('Sesión', paths.sessions);
  line(
    'Archivos de sesión',
    fs.existsSync(paths.sessions) ? `${fs.readdirSync(paths.sessions).length}` : '⚠️ no existe',
  );

  await initDatabase();
  const { total, failed } = await loadCommands();
  line('Comandos cargados', `${total}${failed ? ` (⚠️ ${failed} con error)` : ''}`);
  line('Modo (base de datos)', getMode());
  console.log('\n╰────────────────────⬣\n');
  console.log('⏳ Conectando… cuando esté listo, escribe un comando (por ejemplo .ping)');
  console.log('   desde el mismo chat donde esperas la respuesta.\n');

  const sock = await startConnection({
    onReady: async () => {
      console.log('\n✅ Conectado. Escribe ahora un comando y observa la traza.\n');
      console.log(`   JID del bot: ${sock?.user?.id || '—'}`);
      if (sock?.user?.lid) console.log(`   LID del bot: ${sock.user.lid}`);
      console.log('');
    },
  });

  let received = 0;

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    for (const raw of messages) {
      received += 1;
      console.log('─'.repeat(52));
      console.log(`📨 upsert #${received}`);
      line('tipo de upsert', type);
      line('fromMe', String(Boolean(raw.key?.fromMe)));
      line('chat', String(raw.key?.remoteJid || '').endsWith('@g.us') ? 'grupo' : 'privado');
      line('contenido', Object.keys(raw.message || {})[0] || '(sin message)');

      const accepted = shouldProcessUpsert(type, raw);
      line('¿se procesa?', accepted ? 'sí' : '❌ NO (tipo o antigüedad)');
      if (!accepted) continue;

      const m = serialize(raw, sock);
      if (!m) {
        line('serialize', '❌ no se pudo interpretar el mensaje');
        continue;
      }
      line('remitente', `${jidToNumber(m.sender)}${m.senderAlt ? ` (alt: ${jidToNumber(m.senderAlt)})` : ''}`);
      line('texto', preview(m.text));

      const text = (m.text || '').trim();
      const prefix = activePrefixes.find((p) => text.startsWith(p));
      line('prefijo detectado', prefix ? JSON.stringify(prefix) : `❌ ninguno (activos: ${activePrefixes.join(' ')})`);
      if (!prefix) continue;

      const [name] = text.slice(prefix.length).trim().split(/\s+/);
      const command = resolveCommand(name);
      line('comando', command ? command.name : `❌ "${name}" no existe`);
      if (!command) continue;

      const owner = isOwnerJid(m.sender) || (m.senderAlt ? isOwnerJid(m.senderAlt) : false) || Boolean(m.key?.fromMe);
      line('¿es owner?', owner ? 'sí' : 'no');
      line('¿baneado?', isBanned(m.sender) ? '❌ sí' : 'no');
      line('¿cmd bloqueado?', isCommandBlocked(command.name) ? '❌ sí' : 'no');
      line('modo privado', getMode() === 'private' ? (canUseInPrivateMode(m.sender) || owner ? 'sí (autorizado)' : '❌ sí (NO autorizado)') : 'no');
      line('resultado', '✅ el bot debería responder a este comando');
    }
  });

  setTimeout(() => {
    if (received === 0) {
      console.log('\n⚠️  No ha llegado ningún mensaje en 90 segundos.');
      console.log('   Si ya has escrito un comando, el dispositivo vinculado no está recibiendo');
      console.log('   los mensajes: cierra la sesión en el móvil (Dispositivos vinculados),');
      console.log('   ejecuta `npm run reset-session -- --yes` y vincula de nuevo.\n');
    }
  }, 90_000).unref?.();
};

main().catch((error) => {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
});
