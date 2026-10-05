/**
 * Logging estructurado con pino.
 * - Consola legible (pino pretty-like propio para evitar dependencias extra en Termux).
 * - Archivo rotado simple en logs/bot.log.
 * - Redacción de secretos.
 */
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { paths, config } from '../config.js';

fs.mkdirSync(paths.logs, { recursive: true });

const LOG_FILE = path.join(paths.logs, 'bot.log');
const MAX_LOG_BYTES = 2 * 1024 * 1024;

const rotateIfNeeded = () => {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
  } catch {
    /* el archivo aún no existe */
  }
};
rotateIfNeeded();

const SECRET_PATTERN = /(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{10,}|Bearer\s+[A-Za-z0-9._-]{10,})/g;

/** Elimina posibles secretos de una cadena. */
export const redact = (value) => {
  if (typeof value !== 'string') return value;
  let out = value.replace(SECRET_PATTERN, '[REDACTED]');
  for (const [key, val] of Object.entries(process.env)) {
    if (!val || val.length < 8) continue;
    if (!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)) continue;
    out = out.split(val).join('[REDACTED]');
  }
  return out;
};

const fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

const LEVEL_COLORS = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[41m',
};

const prettyStream = {
  write(line) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      process.stdout.write(redact(line));
      return;
    }
    const level = pino.levels.labels[entry.level] || 'info';
    const color = LEVEL_COLORS[level] || '';
    const time = new Date(entry.time).toLocaleTimeString('es-ES', { hour12: false });
    const scope = entry.module ? `\x1b[35m[${entry.module}]\x1b[0m ` : '';
    const extra = Object.entries(entry)
      .filter(([k]) => !['level', 'time', 'pid', 'hostname', 'msg', 'module'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    process.stdout.write(
      redact(`${color}${level.toUpperCase().padEnd(5)}\x1b[0m \x1b[90m${time}\x1b[0m ${scope}${entry.msg || ''}${extra ? ` \x1b[90m${extra}\x1b[0m` : ''}\n`),
    );
  },
};

const multi = pino.multistream([
  { level: config.logLevel, stream: prettyStream },
  { level: 'info', stream: { write: (line) => fileStream.write(redact(line)) } },
]);

export const logger = pino(
  {
    level: config.logLevel,
    base: undefined,
    redact: {
      paths: [
        'creds',
        'key',
        'keys',
        'apiKey',
        'api_key',
        'token',
        'authorization',
        'password',
        'headers.authorization',
        '*.apiKey',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label, number) => ({ level: number, levelLabel: label }),
    },
    hooks: {
      logMethod(args, method) {
        const [first, ...rest] = args;
        if (typeof first === 'string') return method.apply(this, [redact(first), ...rest]);
        return method.apply(this, args);
      },
    },
  },
  multi,
);

/** Logger con un módulo asociado. */
export const createLogger = (module) => logger.child({ module });

/** Lee las últimas N líneas del log (para el comando .logs). */
export const tailLogs = (lines = 20) => {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    return content.slice(-lines).map((line) => {
      try {
        const entry = JSON.parse(line);
        const time = new Date(entry.time).toISOString().replace('T', ' ').slice(0, 19);
        return `[${(entry.levelLabel || 'info').toUpperCase()}] ${time} ${entry.module ? `(${entry.module}) ` : ''}${entry.msg || ''}`;
      } catch {
        return line;
      }
    });
  } catch {
    return [];
  }
};

export const logFilePath = LOG_FILE;

export default logger;
