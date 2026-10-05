/** Operaciones sobre grupos. */
import { run, get, all } from './index.js';

const now = () => Date.now();

export const DEFAULT_WELCOME = '👋 ¡Bienvenido/a @user a *@group*!\nLee las reglas y disfruta del grupo 🎐';
export const DEFAULT_GOODBYE = '👋 @user ha salido de *@group*. ¡Hasta pronto!';

export const getGroup = (jid, name = '') => {
  let group = get('SELECT * FROM groups WHERE jid = ?', [jid]);
  if (!group) {
    run(
      `INSERT INTO groups (jid, name, welcome_text, goodbye_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jid, name, DEFAULT_WELCOME, DEFAULT_GOODBYE, now(), now()],
    );
    group = get('SELECT * FROM groups WHERE jid = ?', [jid]);
  } else if (name && group.name !== name) {
    run('UPDATE groups SET name = ?, updated_at = ? WHERE jid = ?', [name, now(), jid]);
    group.name = name;
  }
  return group;
};

export const updateGroup = (jid, fields = {}) => {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const sets = entries.map(([key]) => `${key} = ?`).join(', ');
  run(`UPDATE groups SET ${sets}, updated_at = ? WHERE jid = ?`, [
    ...entries.map(([, value]) => value),
    now(),
    jid,
  ]);
};

export const getGroupSettings = (jid) => {
  const group = getGroup(jid);
  try {
    return JSON.parse(group.settings || '{}');
  } catch {
    return {};
  }
};

export const setGroupSetting = (jid, key, value) => {
  const settings = getGroupSettings(jid);
  settings[key] = value;
  updateGroup(jid, { settings: JSON.stringify(settings) });
  return settings;
};

export const allGroups = () => all('SELECT * FROM groups');

export const countGroups = () => get('SELECT COUNT(*) AS c FROM groups')?.c || 0;

export default { getGroup, updateGroup, getGroupSettings, setGroupSetting, allGroups, countGroups, DEFAULT_WELCOME, DEFAULT_GOODBYE };
