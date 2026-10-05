/** Comandos principales: perfil, estado, ping, reglas, soporte, reporte y ajustes. */
import os from 'node:os';
import config, { ownerNumbers } from '../../config.js';
import { formatUptime, formatBytes, formatNumber, formatDate, jidToNumber, toJid, truncate } from '../../lib/utils.js';
import { totalCommands, commandsByCategory } from '../../lib/commandLoader.js';
import { getLimit } from '../../lib/limits.js';
import { premiumInfo } from '../../database/premium.js';
import { getXp, getRank } from '../../database/xp.js';
import { getUser } from '../../database/users.js';
import { stats as dbStats } from '../../database/index.js';
import { getMode } from '../../database/settings.js';
import { getGroupSettings, setGroupSetting, updateGroup } from '../../database/groups.js';
import { UserError } from '../../lib/errors.js';

const ping = {
  name: 'ping',
  aliases: ['p', 'latencia'],
  category: 'main',
  description: 'Comprueba la latencia y el estado del bot',
  cooldown: 3,
  async execute(ctx) {
    const start = Date.now();
    const sent = await ctx.reply('🏓 Midiendo…');
    const latency = Date.now() - start;
    const text = [
      '╭──「 🏓 PONG 」',
      `│ ⚡ Latencia ☇ *${latency} ms*`,
      `│ 🎐 Uptime ☇ *${formatUptime()}*`,
      `│ 🧠 RAM ☇ *${formatBytes(process.memoryUsage().rss)}*`,
      `│ 🗾 Comandos ☇ *${totalCommands()}*`,
      '╰────────────────────⬣',
    ].join('\n');
    await ctx.sock.sendMessage(ctx.chat, { text, edit: sent.key }).catch(() => ctx.reply(text));
  },
};

const runtime = {
  name: 'runtime',
  aliases: ['uptime', 'activo'],
  category: 'main',
  description: 'Tiempo que lleva el bot encendido',
  async execute(ctx) {
    await ctx.reply(`🎐 *Tiempo activo:* ${formatUptime()}`);
  },
};

const status = {
  name: 'status',
  aliases: ['estado'],
  category: 'main',
  description: 'Estado general del bot',
  async execute(ctx) {
    const db = dbStats();
    await ctx.reply(
      [
        `╭──( *${config.name}* )`,
        `│ 🎴 Estado ☇ *Online*`,
        `│ 🍡 Modo ☇ *${getMode() === 'public' ? 'PÚBLICO' : 'PRIVADO'}*`,
        `│ 🏮 Versión ☇ *${config.version}*`,
        `│ 🎐 Uptime ☇ *${formatUptime()}*`,
        `│ 🗾 Comandos ☇ *${totalCommands()}* en *${commandsByCategory().size}* categorías`,
        `│ 👥 Usuarios ☇ *${formatNumber(db.users)}*`,
        `│ 💬 Grupos ☇ *${formatNumber(db.groups)}*`,
        `│ 💎 Premium ☇ *${formatNumber(db.premium)}*`,
        `│ 🧠 RAM ☇ *${formatBytes(process.memoryUsage().rss)}* / ${formatBytes(os.totalmem())}`,
        `│ 💾 BD ☇ *${formatBytes(db.sizeBytes)}*`,
        `│ 🟢 Node ☇ *${process.version}*`,
        '╰━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    );
  },
};

const profile = {
  name: 'profile',
  aliases: ['perfil', 'me'],
  category: 'main',
  args: '[@usuario]',
  description: 'Muestra tu perfil o el de otro usuario',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const user = getUser(target);
    const xp = getXp(target);
    const limit = getLimit(target);
    const premium = premiumInfo(target);
    const text = [
      '╭──「 👤 PERFIL 」',
      `│ 🙍 Usuario ☇ @${jidToNumber(target)}`,
      `│ 📛 Nombre ☇ ${user.name || '—'}`,
      `│ ★ Nivel ☇ *${xp.level}* (${formatNumber(xp.xp)}/${formatNumber(xp.needed)} XP)`,
      `│ 🏅 Prestigio ☇ *${xp.prestige}*`,
      `│ 📊 Ranking ☇ *#${getRank(target)}*`,
      `│ ${config.economy.symbol} Saldo ☇ *${formatNumber(user.balance)}* ${config.economy.currency}`,
      `│ Ⓛ Límite ☇ *${limit.unlimited ? '∞' : `${limit.remaining}/${limit.max}`}*`,
      `│ 💎 Premium ☇ *${premium.active ? `sí (hasta ${formatDate(premium.expires)})` : 'no'}*`,
      `│ 💬 Mensajes ☇ *${formatNumber(user.messages)}*`,
      `│ ⌨️ Comandos ☇ *${formatNumber(user.commands)}*`,
      `│ 📅 Registrado ☇ ${formatDate(user.created_at)}`,
      '╰────────────────────⬣',
    ].join('\n');
    await ctx.reply({ text, mentions: [target] });
  },
};

const rules = {
  name: 'rules',
  aliases: ['reglas'],
  category: 'main',
  args: '[set <texto>]',
  description: 'Muestra (o define, si eres admin) las reglas del grupo',
  async execute(ctx) {
    if (ctx.args[0]?.toLowerCase() === 'set') {
      if (!ctx.isGroup) throw new UserError('👥 Solo puedes definir reglas en un grupo.');
      if (!ctx.isAdmin && !ctx.isOwner) throw new UserError('🛡️ Solo los administradores pueden cambiar las reglas.');
      const text = ctx.args.slice(1).join(' ').trim();
      if (!text) throw new UserError(`❌ Escribe las reglas.\n\nUso:\n${ctx.prefix}rules set <texto>`);
      setGroupSetting(ctx.chat, 'rules', truncate(text, 2000));
      await ctx.reply('✅ Reglas actualizadas.');
      return;
    }
    const defaultRules = [
      '1. Respeta a todos los miembros.',
      '2. Nada de spam ni enlaces no autorizados.',
      '3. Prohibido el contenido ilegal o NSFW.',
      '4. No abuses de los comandos del bot.',
      '5. Haz caso a los administradores.',
    ].join('\n');
    const custom = ctx.isGroup ? getGroupSettings(ctx.chat).rules : null;
    await ctx.reply(`📜 *REGLAS*\n\n${custom || defaultRules}`);
  },
};

const support = {
  name: 'support',
  aliases: ['soporte'],
  category: 'main',
  description: 'Información de soporte y contacto',
  async execute(ctx) {
    await ctx.reply(
      [
        '╭──「 🛟 SOPORTE 」',
        `│ 👑 Owner ☇ ${config.owner.name}`,
        ownerNumbers.length ? `│ 📞 Contacto ☇ wa.me/${ownerNumbers[0]}` : '│ 📞 Contacto ☇ no configurado',
        config.support ? `│ 🔗 Enlace ☇ ${config.support}` : null,
        `│ 🐛 Reportar ☇ ${ctx.prefix}report <mensaje>`,
        '╰────────────────────⬣',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  },
};

const report = {
  name: 'report',
  aliases: ['reportar', 'bug'],
  category: 'main',
  args: '<mensaje>',
  description: 'Envía un reporte al propietario del bot',
  cooldown: 60,
  async execute(ctx) {
    if (!ownerNumbers.length) throw new UserError('⚠️ El propietario no está configurado, no se puede enviar el reporte.');
    const ownerJid = toJid(ownerNumbers[0]);
    await ctx.sock.sendMessage(ownerJid, {
      text: [
        '📨 *NUEVO REPORTE*',
        `👤 De: @${ctx.senderNumber} (${ctx.pushName})`,
        `💬 Chat: ${ctx.isGroup ? `grupo ${ctx.groupMetadata?.subject || ctx.chat}` : 'privado'}`,
        '',
        truncate(ctx.text, 1500),
      ].join('\n'),
      mentions: [ctx.sender],
    });
    await ctx.reply('✅ Reporte enviado al propietario. ¡Gracias!');
  },
};

const settings = {
  name: 'settings',
  aliases: ['ajustes', 'config'],
  category: 'main',
  args: '[opcion] [on/off]',
  description: 'Consulta o cambia los ajustes del chat',
  async execute(ctx) {
    const [option, value] = ctx.args.map((a) => a?.toLowerCase());

    if (!option) {
      const lines = [
        '╭──「 ⚙️ AJUSTES 」',
        `│ 🍡 Modo del bot ☇ *${getMode()}*`,
        `│ 🎋 Prefijo ☇ *${ctx.prefix}*`,
      ];
      if (ctx.isGroup) {
        lines.push(
          `│ 👋 Bienvenida ☇ *${ctx.group.welcome ? 'on' : 'off'}*`,
          `│ 🚪 Despedida ☇ *${ctx.group.goodbye ? 'on' : 'off'}*`,
          `│ 🔗 Antilink ☇ *${ctx.group.antilink ? (ctx.group.antilink === 2 ? 'all' : 'invite') : 'off'}*`,
        );
      }
      lines.push('╰────────────────────⬣', '', `Uso: ${ctx.prefix}settings <welcome|goodbye|antilink> <on|off>`);
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (!['welcome', 'goodbye', 'antilink'].includes(option)) {
      throw new UserError(`❌ Opción no válida. Opciones: welcome, goodbye, antilink`);
    }
    if (!ctx.isGroup) throw new UserError('👥 Esta opción solo puede configurarse en grupos.');
    if (!ctx.isAdmin && !ctx.isOwner) throw new UserError('🛡️ Solo los administradores pueden cambiar los ajustes.');
    if (!['on', 'off', 'all'].includes(value || '')) {
      throw new UserError(`❌ Indica *on* u *off*.\n\nUso:\n${ctx.prefix}settings ${option} on`);
    }
    const numeric = option === 'antilink' ? (value === 'all' ? 2 : value === 'on' ? 1 : 0) : value === 'on' ? 1 : 0;
    updateGroup(ctx.chat, { [option]: numeric });
    await ctx.reply(`✅ *${option}* ahora está en *${value}*.`);
  },
};

export default [ping, runtime, status, profile, rules, support, report, settings];
