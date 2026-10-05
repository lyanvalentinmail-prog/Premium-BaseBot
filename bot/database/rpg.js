/** Estado persistente del sistema RPG. */
import { all, get, run, transaction } from './index.js';

const now = () => Date.now();

export const getPlayer = (jid) => {
  let player = get('SELECT * FROM rpg WHERE jid = ?', [jid]);
  if (!player) {
    run(
      `INSERT INTO rpg (jid, hp, max_hp, level, xp, gold, atk, def, inventory, created_at, updated_at)
       VALUES (?, 100, 100, 1, 0, 50, 10, 5, '{}', ?, ?)`,
      [jid, now(), now()],
    );
    player = get('SELECT * FROM rpg WHERE jid = ?', [jid]);
  }
  return player;
};

export const isRegistered = (jid) => Boolean(get('SELECT 1 AS x FROM rpg WHERE jid = ?', [jid]));

export const updatePlayer = (jid, fields = {}) => {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const sets = entries.map(([key]) => `${key} = ?`).join(', ');
  run(`UPDATE rpg SET ${sets}, updated_at = ? WHERE jid = ?`, [
    ...entries.map(([, value]) => value),
    now(),
    jid,
  ]);
};

export const getRpgInventory = (jid) => {
  const player = getPlayer(jid);
  try {
    return JSON.parse(player.inventory || '{}');
  } catch {
    return {};
  }
};

export const setRpgInventory = (jid, inventory) =>
  updatePlayer(jid, { inventory: JSON.stringify(inventory) });

export const addRpgItem = (jid, item, qty = 1) =>
  transaction(() => {
    const inventory = getRpgInventory(jid);
    const next = (inventory[item] || 0) + qty;
    if (next <= 0) delete inventory[item];
    else inventory[item] = next;
    setRpgInventory(jid, inventory);
    return Math.max(0, next);
  });

export const hasRpgItem = (jid, item, qty = 1) => (getRpgInventory(jid)[item] || 0) >= qty;

/** Aplica daño/curación respetando límites. */
export const changeHp = (jid, delta) => {
  const player = getPlayer(jid);
  const hp = Math.max(0, Math.min(player.max_hp, player.hp + delta));
  updatePlayer(jid, { hp });
  return hp;
};

/** XP de RPG con subidas de nivel (fórmula propia del RPG). */
export const rpgXpNeeded = (level) => level * 120;

export const addRpgXp = (jid, amount) =>
  transaction(() => {
    const player = getPlayer(jid);
    let xp = player.xp + amount;
    let level = player.level;
    let maxHp = player.max_hp;
    let atk = player.atk;
    let def = player.def;
    let leveledUp = false;
    while (xp >= rpgXpNeeded(level)) {
      xp -= rpgXpNeeded(level);
      level += 1;
      maxHp += 15;
      atk += 3;
      def += 2;
      leveledUp = true;
    }
    updatePlayer(jid, { xp, level, max_hp: maxHp, atk, def, hp: leveledUp ? maxHp : player.hp });
    return { leveledUp, level, xp, needed: rpgXpNeeded(level) };
  });

export const addGold = (jid, amount) =>
  transaction(() => {
    const player = getPlayer(jid);
    const gold = Math.max(0, player.gold + amount);
    updatePlayer(jid, { gold });
    return gold;
  });

export const topPlayers = (limit = 10) =>
  all('SELECT jid, level, xp, gold FROM rpg ORDER BY level DESC, xp DESC LIMIT ?', [limit]);

export default {
  getPlayer,
  isRegistered,
  updatePlayer,
  getRpgInventory,
  setRpgInventory,
  addRpgItem,
  hasRpgItem,
  changeHp,
  addRpgXp,
  addGold,
  rpgXpNeeded,
  topPlayers,
};
