/** Economía: tienda, compras, ventas, inventario, saldo y transferencias. */
import config from '../../config.js';
import { SHOP_ITEMS, itemById } from '../../lib/data/items.js';
import {
  getBalance, addMoney, transfer, getInventory, getItemQty,
  buyItem, sellItem, topMoney, redeemCode, removeItem,
} from '../../database/economy.js';
import { getUser, updateUser } from '../../database/users.js';
import { addLimit } from '../../lib/limits.js';
import { addRpgItem } from '../../database/rpg.js';
import { requireInteger } from '../../lib/validators.js';
import { formatNumber, formatDuration, jidToNumber } from '../../lib/utils.js';
import { UserError } from '../../lib/errors.js';

const renderShop = (prefix) =>
  [
    `♜ *TIENDA* — saldo en ${config.economy.currency}`,
    '',
    ...SHOP_ITEMS.map(
      (item) => `${item.emoji} *${item.id}* — ${item.name}\n   💰 ${formatNumber(item.price)} · 💸 venta ${formatNumber(item.sell)}\n   _${item.description}_`,
    ),
    '',
    `Comprar ☇ ${prefix}buy <id> [cantidad]`,
    `Vender ☇ ${prefix}sell <id> [cantidad]`,
  ].join('\n');

const store = {
  name: 'store',
  aliases: ['tienda'],
  category: 'store',
  description: 'Muestra la tienda',
  async execute(ctx) {
    await ctx.reply(renderShop(ctx.prefix));
  },
};

const shop = {
  name: 'shop',
  category: 'store',
  description: 'Alias de la tienda',
  async execute(ctx) {
    await ctx.reply(renderShop(ctx.prefix));
  },
};

const item = {
  name: 'item',
  aliases: ['objeto'],
  category: 'store',
  args: '<id>',
  description: 'Detalles de un objeto',
  example: 'item espada',
  async execute(ctx) {
    const found = itemById(ctx.args[0]);
    if (!found) throw new UserError(`❌ No existe el objeto *${ctx.args[0]}*. Mira la tienda con *${ctx.prefix}shop*.`);
    await ctx.reply(
      [
        `${found.emoji} *${found.name}* (\`${found.id}\`)`,
        '',
        `📝 ${found.description}`,
        `🏷️ Tipo ☇ ${found.type}`,
        `💰 Precio ☇ ${formatNumber(found.price)}`,
        `💸 Venta ☇ ${formatNumber(found.sell)}`,
        found.atk ? `⚔️ ATK ☇ +${found.atk}` : null,
        found.def ? `🛡️ DEF ☇ +${found.def}` : null,
        '',
        `🧰 Tienes ☇ ${getItemQty(ctx.sender, found.id)}`,
      ].filter(Boolean).join('\n'),
    );
  },
};

const buy = {
  name: 'buy',
  aliases: ['comprar'],
  category: 'store',
  args: '<id> [cantidad]',
  description: 'Compra un objeto de la tienda',
  example: 'buy pocion 2',
  async execute(ctx) {
    const found = itemById(ctx.args[0]);
    if (!found) throw new UserError(`❌ No existe el objeto *${ctx.args[0]}*.`);
    const qty = ctx.args[1] ? requireInteger(ctx.args[1], { min: 1, max: 1000, name: 'cantidad' }) : 1;
    const result = buyItem(ctx.sender, found.id, qty, found.price);
    if (['rpg', 'weapon', 'armor', 'material'].includes(found.type)) addRpgItem(ctx.sender, found.id, qty);
    await ctx.reply(
      [
        `✅ Has comprado ${found.emoji} *${found.name}* x${qty}`,
        `💸 Gastado ☇ ${formatNumber(result.spent)} ${config.economy.currency}`,
        `${config.economy.symbol} Saldo ☇ ${formatNumber(result.balance)}`,
      ].join('\n'),
    );
  },
};

const sell = {
  name: 'sell',
  aliases: ['vender'],
  category: 'store',
  args: '<id> [cantidad]',
  description: 'Vende un objeto de tu inventario',
  example: 'sell madera 3',
  async execute(ctx) {
    const found = itemById(ctx.args[0]);
    if (!found) throw new UserError(`❌ No existe el objeto *${ctx.args[0]}*.`);
    if (!found.sell) throw new UserError('❌ Ese objeto no se puede vender.');
    const qty = ctx.args[1] ? requireInteger(ctx.args[1], { min: 1, max: 1000, name: 'cantidad' }) : 1;
    const result = sellItem(ctx.sender, found.id, qty, found.sell);
    if (['rpg', 'weapon', 'armor', 'material'].includes(found.type)) addRpgItem(ctx.sender, found.id, -qty);
    await ctx.reply(
      [
        `✅ Has vendido ${found.emoji} *${found.name}* x${qty}`,
        `💰 Ganado ☇ ${formatNumber(result.earned)} ${config.economy.currency}`,
        `${config.economy.symbol} Saldo ☇ ${formatNumber(result.balance)}`,
      ].join('\n'),
    );
  },
};

const balance = {
  name: 'balance',
  aliases: ['bal', 'saldo', 'money'],
  category: 'store',
  args: '[@usuario]',
  description: 'Consulta el saldo',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const data = getBalance(target);
    await ctx.reply({
      text: [
        `${config.economy.symbol} *SALDO*`,
        '',
        `🙍 @${jidToNumber(target)}`,
        `💵 Cartera ☇ ${formatNumber(data.balance)} ${config.economy.currency}`,
        `🏦 Banco ☇ ${formatNumber(data.bank)}`,
        `📊 Total ☇ ${formatNumber(data.total)}`,
      ].join('\n'),
      mentions: [target],
    });
  },
};

const inventory = {
  name: 'inventory',
  aliases: ['inv', 'inventario'],
  category: 'store',
  description: 'Tu inventario de objetos',
  async execute(ctx) {
    const items = getInventory(ctx.sender);
    const { balance: money } = getBalance(ctx.sender);
    await ctx.reply(
      [
        '🎒 *INVENTARIO*',
        '',
        items.length
          ? items.map((entry) => {
              const data = itemById(entry.item);
              return `${data?.emoji || '📦'} *${data?.name || entry.item}* x${entry.qty}`;
            }).join('\n')
          : '_Vacío. Compra algo con ' + ctx.prefix + 'shop_',
        '',
        `${config.economy.symbol} Saldo ☇ ${formatNumber(money)} ${config.economy.currency}`,
      ].join('\n'),
    );
  },
};

const daily = {
  name: 'daily',
  aliases: ['diario'],
  category: 'store',
  description: 'Recompensa diaria',
  async execute(ctx) {
    const user = getUser(ctx.sender);
    const elapsed = Date.now() - (user.last_daily || 0);
    if (elapsed < 86_400_000) {
      throw new UserError(`⏳ Ya reclamaste tu recompensa. Vuelve en *${formatDuration((86_400_000 - elapsed) / 1000)}*.`);
    }
    updateUser(ctx.sender, { last_daily: Date.now() });
    const amount = config.economy.daily;
    addMoney(ctx.sender, amount);
    await ctx.reply(`🎁 ¡Recompensa diaria reclamada!\n${config.economy.symbol} +${formatNumber(amount)} ${config.economy.currency}`);
  },
};

const gift = {
  name: 'gift',
  aliases: ['regalar', 'pay'],
  category: 'store',
  args: '<@usuario> <cantidad>',
  description: 'Transfiere dinero a otro usuario',
  example: 'gift @usuario 500',
  skipArgCheck: true,
  async execute(ctx) {
    const target = ctx.mentions[0] || ctx.quoted?.sender;
    const amountArg = ctx.args.find((arg) => /^\d+$/.test(arg));
    if (!target || !amountArg) {
      throw new UserError(`❌ Faltan argumentos.\n\nUso:\n${ctx.prefix}gift <@usuario> <cantidad>`);
    }
    if (target === ctx.sender) throw new UserError('❌ No puedes transferirte dinero a ti mismo.');
    const amount = requireInteger(amountArg, { min: 1, max: 1_000_000, name: 'cantidad' });
    const result = transfer(ctx.sender, target, amount);
    await ctx.reply({
      text: `✅ Has transferido ${config.economy.symbol} *${formatNumber(amount)}* a @${jidToNumber(target)}.\nTu saldo: ${formatNumber(result.from)}`,
      mentions: [target],
    });
  },
};

const topmoney = {
  name: 'topmoney',
  aliases: ['ricos', 'topsaldo'],
  category: 'store',
  description: 'Ranking de usuarios con más dinero',
  async execute(ctx) {
    const list = topMoney(10);
    if (!list.length) throw new UserError('❌ Aún no hay datos.');
    await ctx.reply({
      text: [
        `${config.economy.symbol} *TOP RIQUEZA*`,
        '',
        ...list.map((user, i) => {
          const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
          return `${medal} @${jidToNumber(user.jid)} — ${formatNumber(user.balance + user.bank)}`;
        }),
      ].join('\n'),
      mentions: list.map((user) => user.jid),
    });
  },
};

const redeem = {
  name: 'redeem',
  aliases: ['canjear'],
  category: 'store',
  args: '<codigo>',
  description: 'Canjea un código promocional',
  example: 'redeem BIENVENIDA2026',
  async execute(ctx) {
    const row = redeemCode(ctx.sender, ctx.args[0].toUpperCase());
    if (row.type === 'limit') addLimit(ctx.sender, 0); // el límite ya se sumó en la transacción
    await ctx.reply(
      row.type === 'money'
        ? `🎉 Código canjeado: ${config.economy.symbol} +${formatNumber(row.amount)} ${config.economy.currency}`
        : `🎉 Código canjeado: Ⓛ +${row.amount} límites`,
    );
  },
};

const useItem = {
  name: 'use',
  aliases: ['usar'],
  category: 'store',
  args: '<id>',
  description: 'Usa un objeto consumible (ej. ticket)',
  example: 'use ticket',
  async execute(ctx) {
    const found = itemById(ctx.args[0]);
    if (!found) throw new UserError(`❌ No existe el objeto *${ctx.args[0]}*.`);
    if (found.type !== 'consumable') throw new UserError('❌ Ese objeto no es consumible.');
    if (getItemQty(ctx.sender, found.id) < 1) throw new UserError(`❌ No tienes ${found.name}.`);
    removeItem(ctx.sender, found.id, 1);
    if (found.id === 'ticket') {
      addLimit(ctx.sender, 5);
      await ctx.reply('🎫 Has usado un *Ticket de límite*: Ⓛ +5 usos diarios.');
      return;
    }
    await ctx.reply(`✅ Has usado ${found.emoji} *${found.name}*.`);
  },
};

export default [store, shop, item, buy, sell, balance, inventory, daily, gift, topmoney, redeem, useItem];
