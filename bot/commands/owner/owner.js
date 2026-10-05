/** Comandos exclusivos del propietario (identificado por OWNER_NUMBER). */
import config from '../../config.js';
import { addPremium, removePremium, premiumInfo } from '../../database/premium.js';
import { banUser, unbanUser, listBanned, allUserJids, getUser } from '../../database/users.js';
import { blockCommand, unblockCommand, listBlockedCommands, addToWhitelist, removeFromWhitelist, getWhitelist } from '../../database/settings.js';
import { allGroups } from '../../database/groups.js';
import { resolveCommand, loadCommands, totalCommands } from '../../lib/commandLoader.js';
import { tailLogs } from '../../lib/logger.js';
import { flush } from '../../database/index.js';
import { requireInteger } from '../../lib/validators.js';
import { UserError } from '../../lib/errors.js';
import { jidToNumber, toJid, formatDate, sleep, truncate, formatNumber } from '../../lib/utils.js';

/** Objetivo: mención, cita o número escrito. */
const resolveTarget = (ctx) => {
  if (ctx.mentions?.length) return ctx.mentions[0];
  if (ctx.quoted?.sender) return ctx.quoted.sender;
  const number = ctx.args.find((arg) => /^\+?\d{6,15}$/.test(arg));
  return number ? toJid(number) : null;
};

const addpremium = {
  name: 'addpremium',
  aliases: ['premiumadd'],
  category: 'owner',
  args: '<@usuario/numero> <dias>',
  description: 'Concede Premium a un usuario',
  owner: true,
  skipArgCheck: true,
  example: 'addpremium 34600000000 30',
  async execute(ctx) {
    const target = resolveTarget(ctx);
    const daysArg = ctx.args.find((arg, index) => /^\d{1,4}$/.test(arg) && (index > 0 || ctx.mentions.length));
    if (!target || !daysArg) {
      throw new UserError(`❌ Faltan argumentos.\n\nUso:\n${ctx.prefix}addpremium <@usuario/numero> <dias>`);
    }
    const days = requireInteger(daysArg, { min: 1, max: 3650, name: 'número de días' });
    const expires = addPremium(target, days);
    await ctx.reply({
      text: `💎 Premium concedido a @${jidToNumber(target)} durante *${days}* días.\n⏳ Expira el ${formatDate(expires)}.`,
      mentions: [target],
    });
    await ctx.sock.sendMessage(target, {
      text: `💎 ¡Enhorabuena! Has recibido *Premium* en ${config.name} durante ${days} días.`,
    }).catch(() => {});
  },
};

const delpremium = {
  name: 'delpremium',
  aliases: ['premiumdel'],
  category: 'owner',
  args: '<@usuario/numero>',
  description: 'Retira el Premium a un usuario',
  owner: true,
  skipArgCheck: true,
  async execute(ctx) {
    const target = resolveTarget(ctx);
    if (!target) throw new UserError(`❌ Indica un usuario.\n\nUso:\n${ctx.prefix}delpremium <@usuario/numero>`);
    if (!premiumInfo(target).active) throw new UserError('❌ Ese usuario no tiene Premium activo.');
    removePremium(target);
    await ctx.reply({ text: `✅ Premium retirado a @${jidToNumber(target)}.`, mentions: [target] });
  },
};

const banuser = {
  name: 'banuser',
  aliases: ['ban'],
  category: 'owner',
  args: '<@usuario/numero> [razon]',
  description: 'Bloquea a un usuario del bot',
  owner: true,
  skipArgCheck: true,
  async execute(ctx) {
    const target = resolveTarget(ctx);
    if (!target) throw new UserError(`❌ Indica un usuario.\n\nUso:\n${ctx.prefix}banuser <@usuario/numero> [razon]`);
    const reason = ctx.args.filter((arg) => !/^\+?\d{6,15}$/.test(arg) && !arg.startsWith('@')).join(' ');
    banUser(target, truncate(reason, 200));
    await ctx.reply({ text: `🚫 @${jidToNumber(target)} ha sido bloqueado.${reason ? `\nMotivo: ${reason}` : ''}`, mentions: [target] });
  },
};

const unbanuser = {
  name: 'unbanuser',
  aliases: ['unban'],
  category: 'owner',
  args: '<@usuario/numero>',
  description: 'Desbloquea a un usuario',
  owner: true,
  skipArgCheck: true,
  async execute(ctx) {
    const target = resolveTarget(ctx);
    if (!target) throw new UserError(`❌ Indica un usuario.\n\nUso:\n${ctx.prefix}unbanuser <@usuario/numero>`);
    unbanUser(target);
    await ctx.reply({ text: `✅ @${jidToNumber(target)} ha sido desbloqueado.`, mentions: [target] });
  },
};

const banlist = {
  name: 'banlist',
  category: 'owner',
  description: 'Lista de usuarios bloqueados',
  owner: true,
  async execute(ctx) {
    const list = listBanned();
    if (!list.length) {
      await ctx.reply('✅ No hay usuarios bloqueados.');
      return;
    }
    await ctx.reply({
      text: [`🚫 *BLOQUEADOS* (${list.length})`, '', ...list.map((row) => `• @${jidToNumber(row.jid)}${row.ban_reason ? ` — ${row.ban_reason}` : ''}`)].join('\n'),
      mentions: list.map((row) => row.jid),
    });
  },
};

const blockcmd = {
  name: 'blockcmd',
  category: 'owner',
  args: '<comando>',
  description: 'Desactiva un comando',
  owner: true,
  async execute(ctx) {
    const command = resolveCommand(ctx.args[0]);
    if (!command) throw new UserError(`❌ No existe el comando *${ctx.args[0]}*.`);
    if (['blockcmd', 'unblockcmd', 'menu'].includes(command.name)) {
      throw new UserError('❌ Ese comando no puede desactivarse.');
    }
    blockCommand(command.name);
    await ctx.reply(`🚧 El comando *${command.name}* ha sido desactivado.`);
  },
};

const unblockcmd = {
  name: 'unblockcmd',
  category: 'owner',
  args: '<comando>',
  description: 'Reactiva un comando desactivado',
  owner: true,
  async execute(ctx) {
    const name = ctx.args[0].toLowerCase();
    if (!listBlockedCommands().includes(name)) throw new UserError(`❌ El comando *${name}* no está desactivado.`);
    unblockCommand(name);
    await ctx.reply(`✅ El comando *${name}* vuelve a estar disponible.`);
  },
};

const blockedlist = {
  name: 'blockedcmds',
  aliases: ['blockedlist'],
  category: 'owner',
  description: 'Lista de comandos desactivados',
  owner: true,
  async execute(ctx) {
    const list = listBlockedCommands();
    await ctx.reply(list.length ? `🚧 *COMANDOS DESACTIVADOS*\n\n${list.map((n) => `• ${n}`).join('\n')}` : '✅ No hay comandos desactivados.');
  },
};

const broadcast = {
  name: 'broadcast',
  aliases: ['bc'],
  category: 'owner',
  args: '<mensaje>',
  description: 'Envía un mensaje a todos los chats conocidos',
  owner: true,
  cooldown: 60,
  async execute(ctx) {
    const groups = allGroups().map((group) => group.jid);
    const users = allUserJids();
    const targetsList = [...new Set([...groups, ...users])];
    await ctx.reply(`📣 Enviando difusión a *${targetsList.length}* chats…`);

    let sent = 0;
    let failed = 0;
    for (const jid of targetsList) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await ctx.sock.sendMessage(jid, { text: `📣 *DIFUSIÓN · ${config.name}*\n\n${ctx.text}` });
        sent += 1;
      } catch {
        failed += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(1200); // evita saturar y reduce el riesgo de bloqueo
    }
    await ctx.reply(`✅ Difusión completada.\n📤 Enviados: ${sent}\n❌ Fallidos: ${failed}`);
  },
};

const logs = {
  name: 'logs',
  category: 'owner',
  args: '[cantidad]',
  description: 'Últimas líneas del log',
  owner: true,
  async execute(ctx) {
    const count = ctx.args[0] ? requireInteger(ctx.args[0], { min: 1, max: 100, name: 'cantidad' }) : 20;
    const lines = tailLogs(count);
    if (!lines.length) throw new UserError('❌ No hay registros disponibles.');
    await ctx.reply(`📋 *ÚLTIMOS ${lines.length} REGISTROS*\n\n\`\`\`${truncate(lines.join('\n'), 3500)}\`\`\``);
  },
};

const reload = {
  name: 'reload',
  aliases: ['recargar'],
  category: 'owner',
  description: 'Recarga los comandos sin reiniciar el bot',
  owner: true,
  async execute(ctx) {
    const result = await loadCommands({ reload: true });
    await ctx.reply(`♻️ Comandos recargados: *${result.total}* (${result.failed} con errores).`);
  },
};

const restart = {
  name: 'restart',
  aliases: ['reiniciar'],
  category: 'owner',
  description: 'Reinicia el proceso del bot',
  owner: true,
  async execute(ctx) {
    await ctx.reply('♻️ Reiniciando… (necesitas un gestor de procesos como pm2 o un bucle de arranque para que vuelva solo)');
    flush();
    setTimeout(() => process.exit(2), 1000);
  },
};

const shutdown = {
  name: 'shutdown',
  aliases: ['apagar'],
  category: 'owner',
  description: 'Apaga el bot de forma limpia',
  owner: true,
  async execute(ctx) {
    await ctx.reply('🛑 Apagando el bot…');
    flush();
    setTimeout(() => process.kill(process.pid, 'SIGTERM'), 800);
  },
};

const whitelist = {
  name: 'whitelist',
  aliases: ['wl'],
  category: 'owner',
  args: '[add/del] [@usuario]',
  description: 'Gestiona la whitelist del modo privado',
  owner: true,
  skipArgCheck: true,
  async execute(ctx) {
    const action = ctx.args[0]?.toLowerCase();
    if (!action) {
      const list = getWhitelist();
      await ctx.reply({
        text: list.length ? `📝 *WHITELIST* (${list.length})\n\n${list.map((jid) => `• @${jidToNumber(jid)}`).join('\n')}` : '📝 La whitelist está vacía.',
        mentions: list,
      });
      return;
    }
    const target = resolveTarget(ctx);
    if (!target) throw new UserError(`❌ Indica un usuario.\n\nUso:\n${ctx.prefix}whitelist add <@usuario>`);
    if (action === 'add') {
      addToWhitelist(target);
      await ctx.reply({ text: `✅ @${jidToNumber(target)} añadido a la whitelist.`, mentions: [target] });
    } else if (['del', 'remove'].includes(action)) {
      removeFromWhitelist(target);
      await ctx.reply({ text: `✅ @${jidToNumber(target)} eliminado de la whitelist.`, mentions: [target] });
    } else {
      throw new UserError('❌ Acción no válida. Usa add o del.');
    }
  },
};

const addmoney = {
  name: 'addmoney',
  aliases: ['dardinero'],
  category: 'owner',
  args: '<@usuario/numero> <cantidad>',
  description: 'Añade saldo a un usuario',
  owner: true,
  skipArgCheck: true,
  async execute(ctx) {
    const target = resolveTarget(ctx);
    const amountArg = ctx.args.find((arg, index) => /^\d+$/.test(arg) && (index > 0 || ctx.mentions.length));
    if (!target || !amountArg) throw new UserError(`❌ Faltan argumentos.\n\nUso:\n${ctx.prefix}addmoney <@usuario/numero> <cantidad>`);
    const amount = requireInteger(amountArg, { min: 1, max: 10_000_000, name: 'cantidad' });
    const { addMoney } = await import('../../database/economy.js');
    addMoney(target, amount);
    await ctx.reply({
      text: `✅ Se han añadido ${formatNumber(amount)} ${config.economy.currency} a @${jidToNumber(target)}.\nSaldo actual: ${formatNumber(getUser(target).balance)}`,
      mentions: [target],
    });
  },
};

const createcode = {
  name: 'createcode',
  aliases: ['crearcodigo'],
  category: 'owner',
  args: '<codigo> <money/limit> <cantidad> [usos]',
  description: 'Crea un código canjeable',
  owner: true,
  example: 'createcode BIENVENIDA money 1000 50',
  async execute(ctx) {
    const [code, type, amountArg, usesArg] = ctx.args;
    if (!code || !['money', 'limit'].includes(type) || !amountArg) {
      throw new UserError(`❌ Uso:\n${ctx.prefix}createcode <codigo> <money/limit> <cantidad> [usos]`);
    }
    const amount = requireInteger(amountArg, { min: 1, max: 1_000_000, name: 'cantidad' });
    const uses = usesArg ? requireInteger(usesArg, { min: 1, max: 10_000, name: 'usos' }) : 1;
    const { createCode } = await import('../../database/economy.js');
    createCode(code.toUpperCase(), type, amount, uses);
    await ctx.reply(`✅ Código *${code.toUpperCase()}* creado (${type}: ${amount}, ${uses} usos).\nCanjear con *${ctx.prefix}redeem ${code.toUpperCase()}*`);
  },
};

const statsOwner = {
  name: 'botstats',
  category: 'owner',
  description: 'Estadísticas internas del bot',
  owner: true,
  async execute(ctx) {
    const { stats } = await import('../../database/index.js');
    const data = stats();
    await ctx.reply(
      [
        '📊 *ESTADÍSTICAS INTERNAS*',
        '',
        `🗾 Comandos cargados ☇ ${totalCommands()}`,
        `👥 Usuarios ☇ ${formatNumber(data.users)}`,
        `💬 Grupos ☇ ${formatNumber(data.groups)}`,
        `💎 Premium ☇ ${formatNumber(data.premium)}`,
        `🚫 Baneados ☇ ${formatNumber(data.banned)}`,
        `⚔ Jugadores RPG ☇ ${formatNumber(data.rpg)}`,
        `🧠 RSS ☇ ${(process.memoryUsage().rss / 1048576).toFixed(1)} MB`,
      ].join('\n'),
    );
  },
};

export default [
  addpremium, delpremium, banuser, unbanuser, banlist, blockcmd, unblockcmd, blockedlist,
  broadcast, logs, reload, restart, shutdown, whitelist, addmoney, createcode, statsOwner,
];
