/**
 * Configuración persistente en runtime (modo público/privado, comandos bloqueados…).
 * Los valores de .env son el punto de partida; lo guardado aquí tiene prioridad.
 */
import { all, get, run } from './index.js';
import config from '../config.js';

export const getSetting = (key, fallback = null) => {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
};

export const setSetting = (key, value) => {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    [key, JSON.stringify(value), JSON.stringify(value)],
  );
  return value;
};

/* ── Modo público / privado ── */

export const getMode = () => getSetting('botMode', config.mode);
export const setMode = (mode) => setSetting('botMode', mode === 'private' ? 'private' : 'public');
export const isPublic = () => getMode() === 'public';

/* ── Comandos bloqueados ── */

export const blockCommand = (name) =>
  run(
    'INSERT INTO blocked_commands (name, created_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
    [name.toLowerCase(), Date.now()],
  );

export const unblockCommand = (name) =>
  run('DELETE FROM blocked_commands WHERE name = ?', [name.toLowerCase()]);

export const isCommandBlocked = (name) =>
  Boolean(get('SELECT 1 AS x FROM blocked_commands WHERE name = ?', [String(name).toLowerCase()]));

export const listBlockedCommands = () => all('SELECT name FROM blocked_commands').map((r) => r.name);

/* ── Whitelist (modo privado) ── */

export const getWhitelist = () => getSetting('whitelist', []);
export const addToWhitelist = (jid) => setSetting('whitelist', [...new Set([...getWhitelist(), jid])]);
export const removeFromWhitelist = (jid) =>
  setSetting('whitelist', getWhitelist().filter((item) => item !== jid));

export default {
  getSetting,
  setSetting,
  getMode,
  setMode,
  isPublic,
  blockCommand,
  unblockCommand,
  isCommandBlocked,
  listBlockedCommands,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
};
