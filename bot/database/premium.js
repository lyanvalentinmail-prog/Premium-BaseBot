/** Gestión de usuarios Premium (con expiración automática). */
import { all } from './index.js';
import { getUser, updateUser } from './users.js';

/** Añade (o extiende) premium N días. Devuelve la nueva fecha de expiración (ms). */
export const addPremium = (jid, days = 30) => {
  const user = getUser(jid);
  const now = Date.now();
  const base = user.premium && user.premium_expires > now ? user.premium_expires : now;
  const expires = base + days * 86_400_000;
  updateUser(jid, {
    premium: 1,
    premium_start: user.premium_start && user.premium_expires > now ? user.premium_start : now,
    premium_expires: expires,
  });
  return expires;
};

export const removePremium = (jid) => {
  getUser(jid);
  updateUser(jid, { premium: 0, premium_start: 0, premium_expires: 0 });
};

/** Comprueba premium y lo desactiva automáticamente si expiró. */
export const isPremium = (jid) => {
  const user = getUser(jid);
  if (!user.premium) return false;
  if (user.premium_expires && user.premium_expires <= Date.now()) {
    removePremium(jid);
    return false;
  }
  return true;
};

export const premiumInfo = (jid) => {
  const user = getUser(jid);
  const active = isPremium(jid);
  return {
    active,
    start: active ? user.premium_start : 0,
    expires: active ? user.premium_expires : 0,
    remainingMs: active ? Math.max(0, user.premium_expires - Date.now()) : 0,
  };
};

/** Lista de premium activos (limpiando los expirados). */
export const listPremium = () => {
  const rows = all('SELECT jid, premium_start, premium_expires FROM users WHERE premium = 1');
  return rows.filter((row) => {
    if (row.premium_expires && row.premium_expires <= Date.now()) {
      removePremium(row.jid);
      return false;
    }
    return true;
  });
};

export default { addPremium, removePremium, isPremium, premiumInfo, listPremium };
