/**
 * Capa de base de datos.
 *
 * Motor: SQLite a través de `sql.js` (SQLite compilado a WebAssembly).
 * Motivo: `better-sqlite3`/`node-sqlite3` requieren compilación nativa y suelen fallar en
 * Termux/Android. `sql.js` es SQLite real, 100% portable y sin build steps.
 * La base se mantiene en memoria y se persiste en disco (escritura atómica) de forma
 * debounced + flush en el apagado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { paths } from '../config.js';
import { createLogger } from '../lib/logger.js';
import { ensureDir, writeFileAtomic } from '../lib/utils.js';

const require = createRequire(import.meta.url);
const log = createLogger('database');

let SQL = null;
let db = null;
let saveTimer = null;
let dirty = false;
let flushInterval = null;

const MIGRATIONS = [
  // v1 — esquema inicial
  `
  CREATE TABLE IF NOT EXISTS users (
    jid TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    prestige INTEGER DEFAULT 0,
    balance INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    limits INTEGER DEFAULT 0,
    limit_reset INTEGER DEFAULT 0,
    premium INTEGER DEFAULT 0,
    premium_start INTEGER DEFAULT 0,
    premium_expires INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    ban_reason TEXT DEFAULT '',
    last_daily INTEGER DEFAULT 0,
    last_daily_xp INTEGER DEFAULT 0,
    last_xp INTEGER DEFAULT 0,
    commands INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS groups (
    jid TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    welcome INTEGER DEFAULT 0,
    goodbye INTEGER DEFAULT 0,
    welcome_text TEXT DEFAULT '',
    goodbye_text TEXT DEFAULT '',
    antilink INTEGER DEFAULT 0,
    muted INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS rpg (
    jid TEXT PRIMARY KEY,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    atk INTEGER DEFAULT 10,
    def INTEGER DEFAULT 5,
    weapon TEXT DEFAULT '',
    armor TEXT DEFAULT '',
    inventory TEXT DEFAULT '{}',
    quest TEXT DEFAULT '',
    quest_progress INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS inventory (
    jid TEXT NOT NULL,
    item TEXT NOT NULL,
    qty INTEGER DEFAULT 0,
    PRIMARY KEY (jid, item)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS blocked_commands (
    name TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS redeem_codes (
    code TEXT PRIMARY KEY,
    type TEXT DEFAULT 'money',
    amount INTEGER DEFAULT 0,
    uses INTEGER DEFAULT 1,
    used INTEGER DEFAULT 0,
    used_by TEXT DEFAULT '',
    created_at INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_users_xp ON users (xp DESC);
  CREATE INDEX IF NOT EXISTS idx_users_balance ON users (balance DESC);
  `,
];

/** Inicializa la base de datos (idempotente). */
export const initDatabase = async () => {
  if (db) return db;
  ensureDir(paths.data);
  const wasmPath = path.dirname(require.resolve('sql.js'));
  SQL = await initSqlJs({ locateFile: (file) => path.join(wasmPath, file) });

  if (fs.existsSync(paths.database)) {
    const buffer = fs.readFileSync(paths.database);
    try {
      db = new SQL.Database(new Uint8Array(buffer));
      log.info('Base de datos cargada');
    } catch (error) {
      const backup = `${paths.database}.corrupt-${Date.now()}`;
      fs.renameSync(paths.database, backup);
      log.error({ err: error.message, backup }, 'Base de datos corrupta, se creó una nueva');
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    log.info('Base de datos nueva creada');
  }

  migrate();
  flushInterval = setInterval(() => flush(), 20_000);
  flushInterval.unref?.();
  return db;
};

/** Aplica migraciones pendientes usando PRAGMA user_version (nunca borra datos). */
const migrate = () => {
  const current = Number(db.exec('PRAGMA user_version')?.[0]?.values?.[0]?.[0] || 0);
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    db.exec(MIGRATIONS[version]);
    db.run(`PRAGMA user_version = ${version + 1}`);
    log.info({ version: version + 1 }, 'Migración aplicada');
  }
  dirty = true;
  scheduleSave();
};

const ensureReady = () => {
  if (!db) throw new Error('La base de datos no está inicializada. Llama a initDatabase() primero.');
};

const scheduleSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush();
  }, 1500);
  saveTimer.unref?.();
};

/** Persiste la base de datos en disco si hay cambios. */
export const flush = () => {
  if (!db || !dirty) return false;
  try {
    const data = db.export();
    writeFileAtomic(paths.database, Buffer.from(data));
    dirty = false;
    return true;
  } catch (error) {
    log.error({ err: error.message }, 'No se pudo guardar la base de datos');
    return false;
  }
};

/** Ejecuta una sentencia de escritura. */
export const run = (sql, params = []) => {
  ensureReady();
  db.run(sql, params);
  dirty = true;
  scheduleSave();
};

/** Devuelve la primera fila como objeto (o null). */
export const get = (sql, params = []) => {
  ensureReady();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
};

/** Devuelve todas las filas como array de objetos. */
export const all = (sql, params = []) => {
  ensureReady();
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
};

/**
 * Transacción síncrona: si `fn` lanza, se revierte.
 * sql.js es síncrono y monohilo, por lo que esto es realmente atómico dentro del proceso.
 */
export const transaction = (fn) => {
  ensureReady();
  db.run('BEGIN');
  try {
    const result = fn();
    db.run('COMMIT');
    dirty = true;
    scheduleSave();
    return result;
  } catch (error) {
    try {
      db.run('ROLLBACK');
    } catch {
      /* ya revertido */
    }
    throw error;
  }
};

/** Cierra la base guardando los cambios. */
export const closeDatabase = () => {
  if (!db) return;
  flush();
  if (flushInterval) clearInterval(flushInterval);
  if (saveTimer) clearTimeout(saveTimer);
  db.close();
  db = null;
};

/** Estadísticas básicas (para .info / .status). */
export const stats = () => ({
  users: get('SELECT COUNT(*) AS c FROM users')?.c || 0,
  groups: get('SELECT COUNT(*) AS c FROM groups')?.c || 0,
  premium: get('SELECT COUNT(*) AS c FROM users WHERE premium = 1')?.c || 0,
  banned: get('SELECT COUNT(*) AS c FROM users WHERE banned = 1')?.c || 0,
  rpg: get('SELECT COUNT(*) AS c FROM rpg')?.c || 0,
  sizeBytes: fs.existsSync(paths.database) ? fs.statSync(paths.database).size : 0,
});

export default { initDatabase, run, get, all, transaction, flush, closeDatabase, stats };
