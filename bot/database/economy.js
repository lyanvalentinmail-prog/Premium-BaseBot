/**
 * Economía: saldo, inventario y transferencias atómicas.
 * Todas las operaciones de riesgo usan transacciones y comprueban saldo/stock
 * para evitar saldos negativos, doble cobro o duplicación de objetos.
 */
import { all, get, run, transaction } from './index.js';
import { getUser, updateUser } from './users.js';
import { UserError } from '../lib/errors.js';

export const getBalance = (jid) => {
  const user = getUser(jid);
  return { balance: user.balance, bank: user.bank, total: user.balance + user.bank };
};

export const addMoney = (jid, amount) =>
  transaction(() => {
    const user = getUser(jid);
    const value = Math.floor(amount);
    const next = user.balance + value;
    if (next < 0) throw new UserError('❌ Saldo insuficiente.');
    updateUser(jid, { balance: next });
    return next;
  });

export const removeMoney = (jid, amount) => addMoney(jid, -Math.abs(Math.floor(amount)));

export const hasMoney = (jid, amount) => getUser(jid).balance >= Math.floor(amount);

/** Transferencia atómica entre dos usuarios. */
export const transfer = (fromJid, toJid, amount) =>
  transaction(() => {
    const value = Math.floor(amount);
    if (value <= 0) throw new UserError('❌ La cantidad debe ser mayor que 0.');
    const from = getUser(fromJid);
    if (from.balance < value) throw new UserError('❌ No tienes saldo suficiente.');
    const to = getUser(toJid);
    updateUser(fromJid, { balance: from.balance - value });
    updateUser(toJid, { balance: to.balance + value });
    return { from: from.balance - value, to: to.balance + value };
  });

/* ── Inventario ── */

export const getInventory = (jid) => all('SELECT item, qty FROM inventory WHERE jid = ? AND qty > 0', [jid]);

export const getItemQty = (jid, item) =>
  get('SELECT qty FROM inventory WHERE jid = ? AND item = ?', [jid, item])?.qty || 0;

export const addItem = (jid, item, qty = 1) =>
  transaction(() => {
    const current = getItemQty(jid, item);
    const next = current + Math.floor(qty);
    if (next < 0) throw new UserError('❌ No tienes suficientes unidades de ese objeto.');
    run(
      `INSERT INTO inventory (jid, item, qty) VALUES (?, ?, ?)
       ON CONFLICT(jid, item) DO UPDATE SET qty = ?`,
      [jid, item, next, next],
    );
    return next;
  });

export const removeItem = (jid, item, qty = 1) => addItem(jid, item, -Math.abs(Math.floor(qty)));

/** Compra atómica: descuenta dinero y añade objeto en la misma transacción. */
export const buyItem = (jid, item, qty, unitPrice) =>
  transaction(() => {
    const amount = Math.floor(qty) * Math.floor(unitPrice);
    const user = getUser(jid);
    if (user.balance < amount) throw new UserError('❌ No tienes saldo suficiente para esta compra.');
    updateUser(jid, { balance: user.balance - amount });
    const next = getItemQty(jid, item) + Math.floor(qty);
    run(
      `INSERT INTO inventory (jid, item, qty) VALUES (?, ?, ?)
       ON CONFLICT(jid, item) DO UPDATE SET qty = ?`,
      [jid, item, next, next],
    );
    return { spent: amount, qty: next, balance: user.balance - amount };
  });

/** Venta atómica: quita objeto y añade dinero. */
export const sellItem = (jid, item, qty, unitPrice) =>
  transaction(() => {
    const quantity = Math.floor(qty);
    const owned = getItemQty(jid, item);
    if (owned < quantity) throw new UserError('❌ No tienes suficientes unidades de ese objeto.');
    const amount = quantity * Math.floor(unitPrice);
    const user = getUser(jid);
    run('UPDATE inventory SET qty = ? WHERE jid = ? AND item = ?', [owned - quantity, jid, item]);
    updateUser(jid, { balance: user.balance + amount });
    return { earned: amount, qty: owned - quantity, balance: user.balance + amount };
  });

export const topMoney = (limit = 10) =>
  all('SELECT jid, name, balance, bank FROM users ORDER BY (balance + bank) DESC LIMIT ?', [limit]);

/* ── Códigos canjeables ── */

export const createCode = (code, type, amount, uses = 1) => {
  run(
    `INSERT INTO redeem_codes (code, type, amount, uses, used, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(code) DO UPDATE SET type = ?, amount = ?, uses = ?`,
    [code, type, amount, uses, Date.now(), type, amount, uses],
  );
};

export const redeemCode = (jid, code) =>
  transaction(() => {
    const row = get('SELECT * FROM redeem_codes WHERE code = ?', [code]);
    if (!row) throw new UserError('❌ Código inválido.');
    if (row.used >= row.uses) throw new UserError('❌ Ese código ya ha sido canjeado.');
    const usedBy = String(row.used_by || '').split(',').filter(Boolean);
    if (usedBy.includes(jid)) throw new UserError('❌ Ya has canjeado este código.');
    usedBy.push(jid);
    run('UPDATE redeem_codes SET used = ?, used_by = ? WHERE code = ?', [row.used + 1, usedBy.join(','), code]);
    if (row.type === 'money') {
      const user = getUser(jid);
      updateUser(jid, { balance: user.balance + row.amount });
    } else if (row.type === 'limit') {
      const user = getUser(jid);
      updateUser(jid, { limits: user.limits + row.amount });
    }
    return row;
  });

export default {
  getBalance,
  addMoney,
  removeMoney,
  hasMoney,
  transfer,
  getInventory,
  getItemQty,
  addItem,
  removeItem,
  buyItem,
  sellItem,
  topMoney,
  createCode,
  redeemCode,
};
