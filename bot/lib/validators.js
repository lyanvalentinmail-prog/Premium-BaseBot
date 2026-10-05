/**
 * Validación de argumentos.
 * Convención de metadata: `<obligatorio>` y `[opcional]`.
 * Los símbolos son únicamente documentación: el usuario nunca los escribe.
 */
import { UsageError } from './errors.js';
import { isValidUrl } from './apiClient.js';

/** Analiza la cadena `args` de un comando. */
export const parseArgsSpec = (spec = '') => {
  const tokens = String(spec).match(/<[^>]+>|\[[^\]]+\]/g) || [];
  return tokens.map((token) => ({
    raw: token,
    name: token.slice(1, -1),
    required: token.startsWith('<'),
  }));
};

export const requiredArgsCount = (spec = '') => parseArgsSpec(spec).filter((t) => t.required).length;

/** Texto de uso de un comando. */
export const usageText = (command, prefix) =>
  `${prefix}${command.name}${command.args ? ` ${command.args}` : ''}`;

/**
 * Comprueba que se hayan proporcionado los argumentos obligatorios.
 * Los comandos que aceptan media/menciones en lugar de texto pueden fijar
 * `skipArgCheck: true` y validar por su cuenta.
 */
export const validateArgs = (command, ctx) => {
  if (command.skipArgCheck) return;
  const required = requiredArgsCount(command.args || '');
  if (!required) return;
  // Si el comando admite media citada como entrada, no exigimos texto.
  if (command.acceptsMedia && (ctx.quoted?.hasMedia || ctx.m.hasMedia)) return;
  const provided = ctx.args.length + (ctx.mentions?.length && ctx.args.length === 0 ? ctx.mentions.length : 0);
  if (provided < required) {
    throw new UsageError(
      `❌ Falta un argumento obligatorio.\n\nUso:\n${usageText(command, ctx.prefix)}${
        command.example ? `\n\nEjemplo:\n${ctx.prefix}${command.example}` : ''
      }`,
    );
  }
};

/* ───────────────────────── Validadores específicos ───────────────────────── */

export const requireUrl = (value, ctx, command) => {
  if (!value || !isValidUrl(value)) {
    throw new UsageError(
      `❌ Debes indicar una URL válida (http:// o https://).\n\nUso:\n${usageText(command, ctx.prefix)}`,
    );
  }
  return value.trim();
};

export const requireNumber = (value, { min = -Infinity, max = Infinity, name = 'número' } = {}) => {
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number)) throw new UsageError(`❌ "${value}" no es un ${name} válido.`);
  if (number < min || number > max) {
    throw new UsageError(`❌ El ${name} debe estar entre ${min} y ${max}.`);
  }
  return number;
};

export const requireInteger = (value, opts = {}) => {
  const number = requireNumber(value, opts);
  if (!Number.isInteger(number)) throw new UsageError(`❌ Debes indicar un número entero.`);
  return number;
};

/** Devuelve el JID objetivo: mención, respuesta a mensaje o número escrito. */
export const requireMention = (ctx, { allowSelf = true, message } = {}) => {
  const target = ctx.targetJid({ allowSelf });
  if (!target) {
    throw new UsageError(message || '❌ Menciona a un usuario, responde a su mensaje o escribe su número.');
  }
  return target;
};

/** Exige media (adjunta o citada) de alguno de los tipos indicados. */
export const requireMedia = (ctx, types = ['image'], message) => {
  const source = ctx.mediaMessage(types);
  if (!source) {
    const names = { image: 'una imagen', video: 'un vídeo', audio: 'un audio', sticker: 'un sticker', document: 'un documento' };
    const list = types.map((t) => names[t] || t).join(' o ');
    throw new UsageError(message || `❌ Envía o responde a ${list}.`);
  }
  return source;
};

/** Valida que el valor esté dentro de un conjunto de opciones. */
export const requireOption = (value, options, { name = 'opción' } = {}) => {
  const normalized = String(value || '').toLowerCase();
  const match = options.find((option) => String(option).toLowerCase() === normalized);
  if (!match) {
    throw new UsageError(`❌ ${name} inválida. Opciones: ${options.join(', ')}`);
  }
  return match;
};

export default {
  parseArgsSpec,
  requiredArgsCount,
  usageText,
  validateArgs,
  requireUrl,
  requireNumber,
  requireInteger,
  requireMention,
  requireMedia,
  requireOption,
};
