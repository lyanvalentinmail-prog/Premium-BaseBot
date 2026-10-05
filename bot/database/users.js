/** Operaciones sobre usuarios. */
import { run, get, all } from './index.js';
import config from '../config.js';

const now = () => Date.now();

/** Obtiene (o crea) el registro de un usuario. */
export const getUser = (jid, name = '') => {
  let user = get('SELECT * FROM users WHERE jid = ?', [jid]);
  if (!user) {
    run(
      `INSERT INTO users (jid, name, balance, limits, limit_reset, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jid, name, config.economy.startBalance, config.limits.default, now(), now(), now()],
    );
    user = get('SELECT * FROM users WHERE jid = ?', [jid]);
  } else if (name && user.name !== name) {
    run('UPDATE users SET name = ?, updated_at = ? WHERE jid = ?', [name, now(), jid]);
    user.name = name;
  }
  return user;
};

export const updateUser = (jid, fields = {}) => {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const sets = entries.map(([key]) => `${key} = ?`).join(', ');
  run(`UPDATE users SET ${sets}, updated_at = ? WHERE jid = ?`, [
    ...entries.map(([, value]) => value),
    now(),
    jid,
  ]);
};

export const userExists = (jid) => Boolean(get('SELECT 1 AS x FROM users WHERE jid = ?', [jid]));

export const countUsers = () => get('SELECT COUNT(*) AS c FROM users')?.c || 0;

export const allUserJids = () => all('SELECT jid FROM users').map((row) => row.jid);

export const incrementStat = (jid, field) => {
  run(`UPDATE users SET ${field} = ${field} + 1, updated_at = ? WHERE jid = ?`, [now(), jid]);
};

/* ── Baneos ── */

export const banUser = (jid, reason = '') => {
  getUser(jid);
  updateUser(jid, { banned: 1, ban_reason: reason });
};

export const unbanUser = (jid) => {
  getUser(jid);
  updateUser(jid, { banned: 0, ban_reason: '' });
};

export const isBanned = (jid) => Boolean(get('SELECT banned FROM users WHERE jid = ?', [jid])?.banned);

export const listBanned = () => all('SELECT jid, ban_reason FROM users WHERE banned = 1');

export default { getUser, updateUser, userExists, countUsers, allUserJids, banUser, unbanUser, isBanned, listBanned, incrementStat };
