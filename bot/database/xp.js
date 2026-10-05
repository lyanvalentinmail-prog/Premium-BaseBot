/** Sistema de XP y niveles. */
import { all, get, transaction } from './index.js';
import { getUser, updateUser } from './users.js';
import config from '../config.js';

/** XP necesaria para pasar del nivel `level` al siguiente. */
export const xpForLevel = (level) => Math.floor(100 * level ** 1.5);

/** XP total acumulada necesaria para alcanzar `level`. */
export const totalXpForLevel = (level) => {
  let total = 0;
  for (let i = 1; i < level; i += 1) total += xpForLevel(i);
  return total;
};

/**
 * Añade XP a un usuario y procesa subidas de nivel.
 * @returns {{added:number, level:number, leveledUp:boolean, xp:number, needed:number}}
 */
export const addXp = (jid, amount) => {
  const user = getUser(jid);
  let xp = user.xp + Math.max(0, Math.floor(amount));
  let level = user.level || 1;
  let leveledUp = false;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    leveledUp = true;
  }
  updateUser(jid, { xp, level });
  return { added: amount, level, leveledUp, xp, needed: xpForLevel(level) };
};

/**
 * XP por actividad con cooldown anti-farmeo.
 * @returns null si está en cooldown.
 */
export const grantActivityXp = (jid) => {
  const user = getUser(jid);
  const now = Date.now();
  if (now - (user.last_xp || 0) < config.xp.cooldown * 1000) return null;
  updateUser(jid, { last_xp: now });
  return addXp(jid, config.xp.perMessage);
};

export const getXp = (jid) => {
  const user = getUser(jid);
  return {
    xp: user.xp,
    level: user.level,
    prestige: user.prestige,
    needed: xpForLevel(user.level),
    totalXp: totalXpForLevel(user.level) + user.xp,
  };
};

/** Posición en el ranking global por XP total. */
export const getRank = (jid) => {
  const row = get(
    `SELECT COUNT(*) + 1 AS rank FROM users
     WHERE (prestige * 1000000 + level * 10000 + xp) >
           (SELECT prestige * 1000000 + level * 10000 + xp FROM users WHERE jid = ?)`,
    [jid],
  );
  return row?.rank || 1;
};

export const leaderboard = (limit = 10) =>
  all(
    `SELECT jid, name, xp, level, prestige FROM users
     ORDER BY prestige DESC, level DESC, xp DESC LIMIT ?`,
    [limit],
  );

/** Prestigio: reinicia nivel/XP a cambio de +1 prestigio (requiere nivel mínimo). */
export const PRESTIGE_LEVEL = 50;

export const doPrestige = (jid) =>
  transaction(() => {
    const user = getUser(jid);
    if (user.level < PRESTIGE_LEVEL) return { ok: false, level: user.level };
    updateUser(jid, { level: 1, xp: 0, prestige: (user.prestige || 0) + 1 });
    return { ok: true, prestige: (user.prestige || 0) + 1 };
  });

export default { xpForLevel, totalXpForLevel, addXp, grantActivityXp, getXp, getRank, leaderboard, doPrestige, PRESTIGE_LEVEL };
