/**
 * Configuración central del bot.
 * Todos los valores provienen de variables de entorno (.env) con valores por defecto seguros.
 * Nunca escribas credenciales en este archivo.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(__filename), '..');

dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
};

const int = (value, fallback) => {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value) =>
  String(value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const paths = {
  root: ROOT,
  bot: path.join(ROOT, 'bot'),
  commands: path.join(ROOT, 'bot', 'commands'),
  assets: path.join(ROOT, 'assets'),
  banner: process.env.BANNER_PATH
    ? path.resolve(ROOT, process.env.BANNER_PATH)
    : path.join(ROOT, 'assets', 'banner.jpg'),
  sounds: path.join(ROOT, 'assets', 'sounds'),
  temp: path.join(ROOT, 'assets', 'temp'),
  data: path.resolve(ROOT, process.env.DATA_DIR || 'data'),
  database: path.resolve(ROOT, process.env.DATA_DIR || 'data', process.env.DATABASE_FILE || 'database.db'),
  sessions: path.resolve(ROOT, process.env.SESSION_DIR || 'sessions'),
  logs: path.resolve(ROOT, process.env.LOG_DIR || 'logs'),
};

export const config = {
  name: process.env.BOT_NAME || 'Premium BaseBot',
  version: process.env.BOT_VERSION || '1.0.0',
  prefix: (process.env.PREFIX || '.').trim() || '.',
  // Varios prefijos opcionales: PREFIXES=.,!,#
  prefixes: list(process.env.PREFIXES),
  owner: {
    name: process.env.OWNER_NAME || 'Owner',
    number: String(process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
    numbers: list(process.env.OWNER_NUMBERS).map((n) => n.replace(/\D/g, '')),
  },
  mode: (process.env.BOT_MODE || 'public').toLowerCase() === 'private' ? 'private' : 'public',
  limits: {
    default: int(process.env.DEFAULT_LIMIT, 10),
    premium: int(process.env.PREMIUM_LIMIT, 50),
  },
  xp: {
    perMessage: int(process.env.XP_PER_MESSAGE, 5),
    cooldown: int(process.env.XP_COOLDOWN, 60), // segundos
    dailyAmount: int(process.env.DAILY_XP, 150),
  },
  economy: {
    currency: process.env.CURRENCY_NAME || 'monedas',
    symbol: process.env.CURRENCY_SYMBOL || '🪙',
    daily: int(process.env.DAILY_REWARD, 500),
    startBalance: int(process.env.START_BALANCE, 100),
  },
  sticker: {
    pack: process.env.STICKER_PACK || process.env.BOT_NAME || 'Premium BaseBot',
    author: process.env.STICKER_AUTHOR || process.env.OWNER_NAME || 'Owner',
  },
  media: {
    maxDownloadMb: int(process.env.MAX_MEDIA_MB, 60),
    maxAudioSeconds: int(process.env.MAX_AUDIO_SECONDS, 600),
    tempTtlMinutes: int(process.env.TEMP_TTL_MINUTES, 30),
  },
  http: {
    timeout: int(process.env.HTTP_TIMEOUT_MS, 20000),
    maxBytes: int(process.env.HTTP_MAX_BYTES, 80 * 1024 * 1024),
    userAgent:
      process.env.HTTP_USER_AGENT ||
      `${(process.env.BOT_NAME || 'PremiumBaseBot').replace(/\s+/g, '')}/${process.env.BOT_VERSION || '1.0.0'} (+https://github.com/)`,
  },
  behaviour: {
    autoRead: bool(process.env.AUTO_READ, false),
    autoTyping: bool(process.env.AUTO_TYPING, false),
    selfReply: bool(process.env.SELF_REPLY, true), // responder a comandos enviados por el propio bot/owner
    antiSpamSeconds: Number(process.env.ANTISPAM_SECONDS ?? 2),
    reactOnCommand: bool(process.env.REACT_ON_COMMAND, true),
    // Menú con botón/lista nativa. Está desactivado por defecto porque muchas
    // versiones de WhatsApp descartan el mensaje interactivo sin devolver error
    // (el bot "no responde"). El menú normal con imagen + texto siempre funciona.
    interactiveMenu: bool(process.env.INTERACTIVE_MENU, false),
  },
  connection: {
    pairingNumber: String(process.env.PAIRING_NUMBER || '').replace(/\D/g, ''),
    usePairingCode: bool(process.env.USE_PAIRING_CODE, true),
    maxReconnectAttempts: int(process.env.MAX_RECONNECT_ATTEMPTS, 10),
    browser: process.env.BROWSER_NAME || 'Chrome',
  },
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  nodeEnv: process.env.NODE_ENV || 'development',
  support: process.env.SUPPORT_LINK || '',
};

/** Prefijos activos (PREFIX + PREFIXES). */
export const activePrefixes = [...new Set([config.prefix, ...config.prefixes])].filter(Boolean);

/** Números owner normalizados (solo dígitos). */
export const ownerNumbers = [...new Set([config.owner.number, ...config.owner.numbers])].filter(Boolean);

/** Devuelve una API key del entorno sin exponerla en logs. */
export const getKey = (envName) => {
  const value = process.env[envName];
  return value && String(value).trim() ? String(value).trim() : null;
};

/** ¿Existe el .env? Útil para el script de setup/checks. */
export const envFileExists = () => fs.existsSync(path.join(ROOT, '.env'));

export default config;
