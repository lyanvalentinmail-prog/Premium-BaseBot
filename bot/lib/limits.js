/**
 * Límites diarios de uso (comandos marcados con Ⓛ).
 * - Reset diario automático (al cambiar el día UTC del último reset).
 * - Owner: ilimitado.
 * - Premium: PREMIUM_LIMIT, resto: DEFAULT_LIMIT.
 */
import config from '../config.js';
import { getUser, updateUser } from '../database/users.js';
import { isPremium } from '../database/premium.js';
import { isOwnerJid } from './permissions.js';

const dayKey = (timestamp = Date.now()) => new Date(timestamp).toISOString().slice(0, 10);

/** Máximo de límite diario para un usuario. */
export const maxLimitFor = (jid) => {
  if (isOwnerJid(jid)) return Infinity;
  return isPremium(jid) ? config.limits.premium : config.limits.default;
};

/** Devuelve el usuario con el límite reseteado si corresponde. */
export const ensureDailyReset = (jid) => {
  const user = getUser(jid);
  const max = maxLimitFor(jid);
  if (max === Infinity) return user;
  const lastReset = user.limit_reset || 0;
  if (dayKey(lastReset) !== dayKey()) {
    updateUser(jid, { limits: max, limit_reset: Date.now() });
    return getUser(jid);
  }
  // Si el usuario pasó a Premium, se le amplía el tope sin esperar al reset.
  if (user.limits > max) {
    updateUser(jid, { limits: max });
    return getUser(jid);
  }
  return user;
};

export const getLimit = (jid) => {
  const user = ensureDailyReset(jid);
  const max = maxLimitFor(jid);
  return {
    remaining: max === Infinity ? Infinity : user.limits,
    max,
    unlimited: max === Infinity,
    resetAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).getTime(),
  };
};

export const hasLimit = (jid, amount = 1) => {
  const { remaining, unlimited } = getLimit(jid);
  return unlimited || remaining >= amount;
};

/** Consume límite. Devuelve false si no había suficiente. */
export const consumeLimit = (jid, amount = 1) => {
  const { remaining, unlimited } = getLimit(jid);
  if (unlimited) return true;
  if (remaining < amount) return false;
  updateUser(jid, { limits: remaining - amount });
  return true;
};

/** Devuelve límite (por ejemplo si la operación falló por culpa del proveedor). */
export const refundLimit = (jid, amount = 1) => {
  const { remaining, unlimited, max } = getLimit(jid);
  if (unlimited) return;
  updateUser(jid, { limits: Math.min(max, remaining + amount) });
};

export const addLimit = (jid, amount) => {
  const user = getUser(jid);
  updateUser(jid, { limits: Math.max(0, user.limits + amount) });
};

export default { maxLimitFor, ensureDailyReset, getLimit, hasLimit, consumeLimit, refundLimit, addLimit };
