/**
 * Utilidades generales (sin dependencias de WhatsApp).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ───────────────────────── Texto ───────────────────────── */

const SMALLCAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'q', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  á: 'ᴀ', é: 'ᴇ', í: 'ɪ', ó: 'ᴏ', ú: 'ᴜ', ñ: 'ɴ',
};

/** Convierte texto a small caps (solo decoración visual). */
export const smallcaps = (text = '') =>
  String(text)
    .split('')
    .map((char) => SMALLCAPS_MAP[char.toLowerCase()] ?? char)
    .join('');

export const capitalize = (text = '') => (text ? text[0].toUpperCase() + text.slice(1) : text);

export const truncate = (text = '', max = 500) => {
  const str = String(text);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

export const stripTags = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/* ───────────────────────── Números y tiempo ───────────────────────── */

export const formatNumber = (n = 0) => Number(n || 0).toLocaleString('es-ES');

export const formatBytes = (bytes = 0) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes) || 0;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

/** Formatea segundos como "1d 2h 3m 4s". */
export const formatDuration = (seconds = 0) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
};

export const formatUptime = () => formatDuration(process.uptime());

export const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(Number(timestamp) > 1e12 ? Number(timestamp) : Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', { timeZone: process.env.TZ || 'UTC' });
};

/** Convierte "1d", "30m", "2h" en milisegundos. */
export const parseDuration = (input) => {
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d|w)?$/i.exec(String(input).trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] || 'd').toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return value * multipliers[unit];
};

/* ───────────────────────── Aleatoriedad ───────────────────────── */

export const randomInt = (min, max) => {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(crypto.randomInt(0, Math.max(1, hi - lo + 1)));
};

export const pickRandom = (arr = []) => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = (arr = []) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** Número pseudo-aleatorio determinista a partir de una semilla (para .ship, .rate...). */
export const seededPercent = (seed) => {
  const hash = crypto.createHash('md5').update(String(seed)).digest();
  return hash.readUInt16BE(0) % 101;
};

export const randomId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

/* ───────────────────────── Colecciones ───────────────────────── */

export const chunk = (arr = [], size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const unique = (arr = []) => [...new Set(arr)];

/* ───────────────────────── Números de teléfono / JIDs ───────────────────────── */

/** Devuelve solo los dígitos de un número de teléfono. */
export const normalizePhone = (input = '') => String(input).replace(/\D/g, '');

/** Convierte número, mención o JID a un JID de usuario de WhatsApp. */
export const toJid = (input = '') => {
  const str = String(input).trim();
  if (!str) return '';
  if (str.includes('@')) {
    const [user, server] = str.split('@');
    const cleanUser = user.split(':')[0];
    return `${cleanUser}@${server.split('/')[0]}`;
  }
  const digits = normalizePhone(str);
  return digits ? `${digits}@s.whatsapp.net` : '';
};

/** Parte numérica de un JID. */
export const jidToNumber = (jid = '') => normalizePhone(String(jid).split('@')[0].split(':')[0]);

/** Formato legible "+34 600 ..." (simplificado). */
export const prettyNumber = (jid = '') => `+${jidToNumber(jid)}`;

/* ───────────────────────── Ficheros ───────────────────────── */

export const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Escritura atómica: escribe un .tmp y renombra. */
export const writeFileAtomic = (file, data) => {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

export const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/* ───────────────────────── Cooldowns en memoria ───────────────────────── */

const cooldowns = new Map();

/**
 * Comprueba y aplica un cooldown.
 * @returns {number} milisegundos restantes (0 = disponible, ya aplicado).
 */
export const checkCooldown = (key, ms) => {
  const now = Date.now();
  const until = cooldowns.get(key) || 0;
  if (until > now) return until - now;
  cooldowns.set(key, now + ms);
  return 0;
};

export const clearCooldown = (key) => cooldowns.delete(key);

setInterval(() => {
  const now = Date.now();
  for (const [key, until] of cooldowns) if (until < now) cooldowns.delete(key);
}, 60_000).unref?.();

/* ───────────────────────── Varios ───────────────────────── */

/** Barra de progreso textual. */
export const progressBar = (current, total, size = 12) => {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)} ${Math.round(ratio * 100)}%`;
};

/** Ejecuta una promesa con timeout. */
export const withTimeout = (promise, ms, message = 'Tiempo de espera agotado') =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

export default {
  sleep,
  smallcaps,
  capitalize,
  truncate,
  stripTags,
  formatNumber,
  formatBytes,
  formatDuration,
  formatUptime,
  formatDate,
  parseDuration,
  randomInt,
  pickRandom,
  shuffle,
  seededPercent,
  randomId,
  chunk,
  unique,
  normalizePhone,
  toJid,
  jidToNumber,
  prettyNumber,
  ensureDir,
  writeFileAtomic,
  readJson,
  checkCooldown,
  clearCooldown,
  progressBar,
  withTimeout,
};
