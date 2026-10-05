/**
 * Pruebas automáticas (node --test).
 * Simulan mensajes completos a través del handler sin conectarse a WhatsApp.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Entorno aislado ANTES de importar el bot */
process.env.DATA_DIR = 'data/test';
process.env.LOG_DIR = 'logs/test';
process.env.LOG_LEVEL = 'silent';
process.env.BOT_NAME = 'TestBot';
process.env.PREFIX = '.';
process.env.OWNER_NUMBER = '34600000000';
process.env.OWNER_NAME = 'TestOwner';
process.env.DEFAULT_LIMIT = '3';
process.env.PREMIUM_LIMIT = '10';
process.env.REACT_ON_COMMAND = 'false';
process.env.ANTISPAM_SECONDS = '0';
process.env.NODE_ENV = 'test';

fs.rmSync(path.join(ROOT, 'data/test'), { recursive: true, force: true });

const { createMockSock, makeMessage, OWNER_JID, USER_JID, GROUP_JID } = await import('./helpers/mockSock.js');
const { initDatabase, closeDatabase, flush } = await import('../bot/database/index.js');
const { loadCommands, commands, resolveCommand, totalCommands, commandsByCategory } = await import('../bot/lib/commandLoader.js');
const { handleMessage } = await import('../bot/handler.js');
const { getUser, updateUser, banUser, unbanUser } = await import('../bot/database/users.js');
const { addPremium, isPremium, removePremium } = await import('../bot/database/premium.js');
const { getLimit, consumeLimit, refundLimit } = await import('../bot/lib/limits.js');
const { transfer, addMoney, getBalance, buyItem, getItemQty } = await import('../bot/database/economy.js');
const { blockCommand, unblockCommand, setMode } = await import('../bot/database/settings.js');
const { evaluate } = await import('../bot/lib/mathEval.js');
const { assertSafeUrl, isPrivateIp } = await import('../bot/lib/apiClient.js');
const { mainMenuCaption, renderCategory, permissionTags } = await import('../bot/lib/menu.js');
const { addXp, getXp } = await import('../bot/database/xp.js');
const { clearCooldown } = await import('../bot/lib/utils.js');

await initDatabase();
await loadCommands();

const sock = createMockSock();

/** Envía un mensaje simulado y devuelve el último texto respondido. */
const send = async (text, options = {}) => {
  sock.reset();
  // Los cooldowns son por usuario y comando; en las pruebas se limpian para
  // poder encadenar llamadas sin esperas reales.
  const name = text.replace(/^\S*?([a-zA-ZÀ-ÿ]+).*$/s, '$1');
  const jid = options.from || USER_JID;
  clearCooldown(`${jid}:${name}`);
  for (const command of commands.values()) clearCooldown(`${jid}:${command.name}`);
  await handleMessage(sock, makeMessage(text, options));
  return sock.lastText();
};

test.after(() => {
  closeDatabase();
  fs.rmSync(path.join(ROOT, 'data/test'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'logs/test'), { recursive: true, force: true });
});

/* ───────────────── Carga de comandos ───────────────── */

test('carga automática de comandos', () => {
  assert.ok(totalCommands() > 150, `se esperaban >150 comandos, hay ${totalCommands()}`);
  assert.ok(commandsByCategory().size >= 20);
});

test('todos los comandos tienen metadata válida', () => {
  for (const command of commands.values()) {
    assert.equal(typeof command.name, 'string', 'nombre');
    assert.equal(typeof command.execute, 'function', `${command.name}: execute`);
    assert.ok(command.description, `${command.name}: sin descripción`);
    assert.ok(command.category, `${command.name}: sin categoría`);
  }
});

test('los alias resuelven al comando correcto', () => {
  assert.equal(resolveCommand('p')?.name, 'ping');
  assert.equal(resolveCommand('ayuda')?.name, 'help');
  assert.equal(resolveCommand('s')?.name, 'sticker');
  assert.equal(resolveCommand('comandos')?.name, 'commands');
});

/* ───────────────── Prefijo y ejecución ───────────────── */

test('el prefijo configurado ejecuta comandos', async () => {
  const reply = await send('.ping');
  assert.match(reply, /PONG|Midiendo/);
});

test('un prefijo distinto no ejecuta nada', async () => {
  const reply = await send('!ping');
  assert.equal(reply, '');
});

test('el texto sin prefijo no ejecuta comandos', async () => {
  const reply = await send('ping');
  assert.equal(reply, '');
});

test('comando inexistente no responde', async () => {
  assert.equal(await send('.estecomandonoexiste'), '');
});

/* ───────────────── Argumentos ───────────────── */

test('argumentos obligatorios faltantes muestran el uso', async () => {
  const reply = await send('.weather');
  assert.match(reply, /Falta un argumento obligatorio/);
  assert.match(reply, /\.weather <ciudad>/);
});

test('validación de argumentos opcionales', async () => {
  const reply = await send('.randomnumber');
  assert.match(reply, /Número aleatorio/);
});

test('validación de opciones enumeradas', async () => {
  const reply = await send('.hash sha999 hola');
  assert.match(reply, /Algoritmo inválida|inválida/);
});

test('comando con cálculo local', async () => {
  const reply = await send('.calc (5+3)*2^3');
  assert.match(reply, /64/);
});

/* ───────────────── Permisos ───────────────── */

test('comando de owner rechazado para usuarios normales', async () => {
  const reply = await send('.restart');
  assert.match(reply, /propietario/);
});

test('comando de admin requiere grupo', async () => {
  const reply = await send('.kick @123', { from: USER_JID });
  assert.match(reply, /grupos/);
});

test('comando de admin rechazado para no administradores en grupo', async () => {
  const reply = await send('.kick', { from: USER_JID, chat: GROUP_JID });
  assert.match(reply, /administradores/);
});

test('el owner puede ejecutar comandos de owner', async () => {
  const reply = await send('.blockedcmds', { from: OWNER_JID });
  assert.match(reply, /desactivados/);
});

/* ───────────────── Premium y límites ───────────────── */

test('premium se activa y expira automáticamente', () => {
  const jid = 'test-premium@s.whatsapp.net';
  assert.equal(isPremium(jid), false);
  addPremium(jid, 1);
  assert.equal(isPremium(jid), true);
  updateUser(jid, { premium_expires: Date.now() - 1000 });
  assert.equal(isPremium(jid), false, 'el premium caducado debe desactivarse solo');
  removePremium(jid);
});

test('comando premium bloqueado sin premium', async () => {
  const reply = await send('.code hola mundo');
  assert.match(reply, /Premium/);
});

test('límite diario: consumo, agotamiento y reembolso', () => {
  const jid = 'test-limit@s.whatsapp.net';
  getUser(jid);
  const initial = getLimit(jid);
  assert.equal(initial.max, 3);
  assert.equal(consumeLimit(jid, 1), true);
  assert.equal(getLimit(jid).remaining, 2);
  refundLimit(jid, 1);
  assert.equal(getLimit(jid).remaining, 3);
  assert.equal(consumeLimit(jid, 3), true);
  assert.equal(consumeLimit(jid, 1), false, 'no debe permitir consumir sin saldo de límite');
});

test('el límite premium es mayor', () => {
  const jid = 'test-limit2@s.whatsapp.net';
  getUser(jid);
  addPremium(jid, 10);
  updateUser(jid, { limit_reset: 0 });
  assert.equal(getLimit(jid).max, 10);
  removePremium(jid);
});

test('el owner tiene límite ilimitado', () => {
  assert.equal(getLimit(OWNER_JID).unlimited, true);
});

test('un comando con límite muestra el aviso al agotarse', async () => {
  const jid = USER_JID;
  getUser(jid);
  updateUser(jid, { limits: 0, limit_reset: Date.now() });
  const reply = await send('.lyrics coldplay - yellow', { from: jid });
  assert.match(reply, /límite diario/i);
  updateUser(jid, { limits: 3 });
});

/* ───────────────── Usuarios bloqueados / comandos bloqueados ───────────────── */

test('usuario baneado no puede usar comandos', async () => {
  banUser(USER_JID, 'prueba');
  const reply = await send('.ping', { from: USER_JID });
  assert.match(reply, /bloqueado/);
  unbanUser(USER_JID);
});

test('comando bloqueado responde de forma controlada', async () => {
  blockCommand('joke');
  const reply = await send('.joke', { from: USER_JID });
  assert.match(reply, /desactivado/);
  unblockCommand('joke');
  const after = await send('.joke', { from: USER_JID });
  assert.ok(after.length > 0);
});

/* ───────────────── Modo privado ───────────────── */

test('modo privado ignora a usuarios no autorizados', async () => {
  setMode('private');
  assert.equal(await send('.ping', { from: USER_JID }), '');
  const ownerReply = await send('.ping', { from: OWNER_JID });
  assert.match(ownerReply, /PONG|Midiendo/);
  setMode('public');
});

/* ───────────────── Economía ───────────────── */

test('las transferencias son atómicas y no permiten saldo negativo', () => {
  const a = 'test-eco-a@s.whatsapp.net';
  const b = 'test-eco-b@s.whatsapp.net';
  getUser(a);
  getUser(b);
  addMoney(a, 1000);
  const before = getBalance(a).balance;
  assert.throws(() => transfer(a, b, before + 5000), /saldo suficiente/);
  assert.equal(getBalance(a).balance, before, 'el saldo no debe cambiar si falla');
  const bBefore = getBalance(b).balance;
  transfer(a, b, 300);
  assert.equal(getBalance(a).balance, before - 300);
  assert.equal(getBalance(b).balance, bBefore + 300);
});

test('comprar descuenta dinero y añade objeto en la misma operación', () => {
  const jid = 'test-eco-c@s.whatsapp.net';
  getUser(jid);
  addMoney(jid, 500);
  const before = getBalance(jid).balance;
  const result = buyItem(jid, 'pocion', 2, 150);
  assert.equal(result.spent, 300);
  assert.equal(getItemQty(jid, 'pocion'), 2);
  assert.equal(getBalance(jid).balance, before - 300);
  assert.throws(() => buyItem(jid, 'pocion', 1000, 150), /saldo suficiente/);
  assert.equal(getItemQty(jid, 'pocion'), 2, 'no debe duplicar objetos si falla el pago');
});

/* ───────────────── XP ───────────────── */

test('la XP sube de nivel correctamente', () => {
  const jid = 'test-xp@s.whatsapp.net';
  getUser(jid);
  const before = getXp(jid).level;
  addXp(jid, 100_000);
  assert.ok(getXp(jid).level > before);
});

/* ───────────────── Menú ───────────────── */

test('el menú principal genera datos dinámicos', () => {
  const caption = mainMenuCaption({ pushName: 'Tester' });
  assert.match(caption, /TestBot/);
  assert.match(caption, /Tester/);
  assert.match(caption, /PÚBLICO/);
  assert.match(caption, new RegExp(String(totalCommands())));
});

test('el listado de categoría incluye permisos y total', () => {
  const block = renderCategory('ai', '.');
  assert.match(block, /ᴄʜᴀᴛ/);
  assert.match(block, /Ⓛ/);
  assert.match(block, /Ⓟ/);
  assert.match(block, /ᴛᴏᴛᴀʟ/);
});

test('los símbolos de permiso provienen de la metadata', () => {
  assert.equal(permissionTags({ premium: true, limit: true }), 'ⓅⓁ');
  assert.equal(permissionTags({ owner: true }), 'Ⓞ');
  assert.equal(permissionTags({}), '');
});

test('.menu list y .categories responden', async () => {
  assert.match(await send('.menu list'), /ᴛᴏᴛᴀʟ/);
  assert.match(await send('.categories'), /ᴍᴀɪɴ|MAIN/i);
  assert.match(await send('.menu ai'), /ᴀɪ/);
  assert.match(await send('.menu categoriainexistente'), /no existe/);
});

test('.help describe un comando', async () => {
  const reply = await send('.help weather');
  assert.match(reply, /weather <ciudad>/);
});

/* ───────────────── Seguridad ───────────────── */

test('bloqueo de destinos privados (anti-SSRF)', async () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('10.1.2.3'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  await assert.rejects(() => assertSafeUrl('http://localhost:3000'), /no está permitido/);
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/admin'), /no está permitido/);
  await assert.rejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data'), /no está permitido/);
  await assert.rejects(() => assertSafeUrl('ftp://example.com'), /http/);
});

test('el evaluador matemático no ejecuta código', () => {
  assert.equal(evaluate('2+2*3'), 8);
  assert.equal(evaluate('sqrt(16)'), 4);
  assert.throws(() => evaluate('process.exit(1)'), /desconocida|no permitido/);
  assert.throws(() => evaluate('1/0'), /dividir entre cero/);
});

test('no hay secretos en el repositorio', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const filled = env
    .split('\n')
    .filter((line) => /KEY=|TOKEN=|SECRET=/.test(line) && line.split('=')[1]?.trim());
  assert.equal(filled.length, 0, `.env.example no debe contener valores: ${filled.join(', ')}`);
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const entry of ['.env', 'sessions/', 'node_modules/']) {
    assert.ok(gitignore.includes(entry), `.gitignore debe incluir ${entry}`);
  }
});

/* ───────────────── Persistencia ───────────────── */

test('los datos persisten en disco', async () => {
  const jid = 'test-persist@s.whatsapp.net';
  getUser(jid);
  updateUser(jid, { balance: 4242 });
  assert.equal(flush(), true);
  assert.equal(getUser(jid).balance, 4242);
  assert.ok(fs.existsSync(path.join(ROOT, 'data/test/database.db')));
});

/* ───────────────── Errores ───────────────── */

test('un error en un comando no tumba el proceso', async () => {
  const broken = {
    name: 'comandoroto',
    category: 'main',
    description: 'test',
    async execute() {
      throw new Error('fallo interno simulado');
    },
  };
  commands.set('comandoroto', broken);
  const reply = await send('.comandoroto');
  assert.match(reply, /error inesperado/);
  assert.ok(!reply.includes('fallo interno simulado'), 'no debe filtrar el error interno');
  commands.delete('comandoroto');
});

/* ───────────────── Integridad del repositorio ───────────────── */

test('todos los imports relativos existen y están versionados', async () => {
  const { execSync } = await import('node:child_process');
  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'data', 'logs', 'sessions'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
  };

  const files = walk(ROOT);
  const missing = [];
  const ignored = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'(\.[^']+)'|import\('(\.[^']+)'\)/g)) {
      const target = path.resolve(path.dirname(file), match[1] || match[2]);
      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(ROOT, file)} → ${match[1] || match[2]}`);
        continue;
      }
      // Un fichero importado nunca debe estar excluido por .gitignore.
      const rel = path.relative(ROOT, target);
      const result = execSync(`git check-ignore ${JSON.stringify(rel)} || true`, { cwd: ROOT }).toString().trim();
      if (result) ignored.push(rel);
    }
  }
  assert.deepEqual(missing, [], `imports rotos: ${missing.join(', ')}`);
  assert.deepEqual([...new Set(ignored)], [], `ficheros importados pero ignorados por git: ${ignored.join(', ')}`);
});
