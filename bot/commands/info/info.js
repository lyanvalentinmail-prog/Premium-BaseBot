/** Información del bot, usuarios y grupos. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import config, { ownerNumbers, paths } from '../../config.js';
import { formatUptime, formatBytes, formatNumber, formatDate, jidToNumber, truncate } from '../../lib/utils.js';
import { totalCommands, commandsByCategory } from '../../lib/commandLoader.js';
import { stats as dbStats } from '../../database/index.js';
import { getUser } from '../../database/users.js';
import { getXp, getRank } from '../../database/xp.js';
import { premiumInfo } from '../../database/premium.js';
import { getLimit } from '../../lib/limits.js';
import { getAdmins } from '../../lib/permissions.js';
import { UserError } from '../../lib/errors.js';
import { getGroupMetadata } from '../../handler.js';

const botinfo = {
  name: 'botinfo',
  aliases: ['info'],
  category: 'info',
  description: 'Información técnica del bot',
  async execute(ctx) {
    const db = dbStats();
    await ctx.reply(
      [
        `╭──( *${config.name}* )`,
        `│ 🏮 Versión ☇ *${config.version}*`,
        `│ 👑 Owner ☇ *${config.owner.name}*`,
        `│ 🎋 Prefijo ☇ *${ctx.prefix}*`,
        `│ 🗾 Comandos ☇ *${totalCommands()}*`,
        `│ 🗂️ Categorías ☇ *${commandsByCategory().size}*`,
        `│ 👥 Usuarios ☇ *${formatNumber(db.users)}*`,
        `│ 💬 Grupos ☇ *${formatNumber(db.groups)}*`,
        `│ 🎐 Uptime ☇ *${formatUptime()}*`,
        `│ 🧠 RAM ☇ *${formatBytes(process.memoryUsage().rss)}*`,
        `│ 💻 Sistema ☇ *${os.type()} ${os.arch()}*`,
        `│ 🟢 Node ☇ *${process.version}*`,
        `│ 📚 Librería ☇ *Baileys (multi-device)*`,
        '╰━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    );
  },
};

const version = {
  name: 'version',
  aliases: ['ver'],
  category: 'info',
  description: 'Versión del bot y dependencias principales',
  async execute(ctx) {
    let deps = {};
    try {
      deps = JSON.parse(fs.readFileSync(path.join(paths.root, 'package.json'), 'utf8')).dependencies || {};
    } catch {
      /* sin package.json legible */
    }
    await ctx.reply(
      [
        `🏮 *${config.name}* v${config.version}`,
        '',
        '*Dependencias:*',
        ...Object.entries(deps).map(([name, range]) => `• ${name} ${range}`),
        '',
        `🟢 Node ${process.version}`,
      ].join('\n'),
    );
  },
};

const ownerinfo = {
  name: 'ownerinfo',
  aliases: ['owner', 'creador'],
  category: 'info',
  description: 'Información de contacto del propietario',
  async execute(ctx) {
    if (!ownerNumbers.length) {
      await ctx.reply('⚠️ El propietario aún no está configurado (OWNER_NUMBER).');
      return;
    }
    await ctx.sock.sendMessage(
      ctx.chat,
      {
        contacts: {
          displayName: config.owner.name,
          contacts: ownerNumbers.map((number) => ({
            vcard: [
              'BEGIN:VCARD',
              'VERSION:3.0',
              `FN:${config.owner.name}`,
              `TEL;type=CELL;type=VOICE;waid=${number}:+${number}`,
              'END:VCARD',
            ].join('\n'),
          })),
        },
      },
      { quoted: ctx.m.raw },
    );
  },
};

const userInfo = {
  name: 'user',
  aliases: ['usuario', 'userinfo'],
  category: 'info',
  args: '[@usuario]',
  description: 'Información de un usuario registrado',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const user = getUser(target);
    const xp = getXp(target);
    const premium = premiumInfo(target);
    const limit = getLimit(target);
    await ctx.reply({
      text: [
        '╭──「 ⓘ USUARIO 」',
        `│ 🙍 ☇ @${jidToNumber(target)}`,
        `│ 📛 Nombre ☇ ${user.name || '—'}`,
        `│ ★ Nivel ☇ ${xp.level} · XP ${formatNumber(xp.xp)}`,
        `│ 📊 Ranking ☇ #${getRank(target)}`,
        `│ ${config.economy.symbol} Saldo ☇ ${formatNumber(user.balance)}`,
        `│ Ⓛ Límite ☇ ${limit.unlimited ? '∞' : `${limit.remaining}/${limit.max}`}`,
        `│ 💎 Premium ☇ ${premium.active ? 'sí' : 'no'}`,
        `│ 🚫 Baneado ☇ ${user.banned ? `sí (${user.ban_reason || 'sin motivo'})` : 'no'}`,
        `│ 📅 Alta ☇ ${formatDate(user.created_at)}`,
        '╰────────────────────⬣',
      ].join('\n'),
      mentions: [target],
    });
  },
};

const stats = {
  name: 'stats',
  aliases: ['estadisticas'],
  category: 'info',
  args: '[@usuario]',
  description: 'Estadísticas de uso',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const user = getUser(target);
    const db = dbStats();
    await ctx.reply({
      text: [
        '╭──「 📊 ESTADÍSTICAS 」',
        `│ 🙍 ☇ @${jidToNumber(target)}`,
        `│ 💬 Mensajes ☇ ${formatNumber(user.messages)}`,
        `│ ⌨️ Comandos ☇ ${formatNumber(user.commands)}`,
        `│ ★ Nivel ☇ ${user.level} · XP ${formatNumber(user.xp)}`,
        '│',
        '│ *Globales*',
        `│ 👥 Usuarios ☇ ${formatNumber(db.users)}`,
        `│ 💬 Grupos ☇ ${formatNumber(db.groups)}`,
        `│ ⚔ Jugadores RPG ☇ ${formatNumber(db.rpg)}`,
        `│ 💾 Tamaño BD ☇ ${formatBytes(db.sizeBytes)}`,
        '╰────────────────────⬣',
      ].join('\n'),
      mentions: [target],
    });
  },
};

const groupinfo = {
  name: 'groupinfo',
  aliases: ['grupoinfo', 'infogrupo'],
  category: 'info',
  description: 'Información del grupo actual',
  groupOnly: true,
  async execute(ctx) {
    const metadata = ctx.groupMetadata || (await getGroupMetadata(ctx.sock, ctx.chat, { force: true }));
    if (!metadata) throw new UserError('⚠️ No se pudo obtener la información del grupo.');
    const admins = getAdmins(metadata);
    await ctx.reply(
      [
        '╭──「 👥 GRUPO 」',
        `│ 📛 Nombre ☇ ${metadata.subject}`,
        `│ 🆔 ID ☇ ${metadata.id}`,
        `│ 👤 Miembros ☇ ${metadata.participants.length}`,
        `│ 🛡️ Admins ☇ ${admins.length}`,
        `│ 📅 Creado ☇ ${formatDate(metadata.creation)}`,
        `│ 🔒 Solo admins ☇ ${metadata.announce ? 'sí' : 'no'}`,
        `│ 👋 Bienvenida ☇ ${ctx.group?.welcome ? 'on' : 'off'}`,
        `│ 🔗 Antilink ☇ ${ctx.group?.antilink ? 'on' : 'off'}`,
        '╰────────────────────⬣',
        metadata.desc ? `\n📝 *Descripción:*\n${truncate(metadata.desc, 500)}` : '',
      ].join('\n'),
    );
  },
};

const admins = {
  name: 'admins',
  aliases: ['listadmins'],
  category: 'info',
  description: 'Lista los administradores del grupo',
  groupOnly: true,
  async execute(ctx) {
    const metadata = ctx.groupMetadata || (await getGroupMetadata(ctx.sock, ctx.chat, { force: true }));
    if (!metadata) throw new UserError('⚠️ No se pudo obtener la información del grupo.');
    const list = metadata.participants.filter((p) => ['admin', 'superadmin'].includes(p.admin));
    await ctx.reply({
      text: [
        `🛡️ *Administradores de ${metadata.subject}* (${list.length})`,
        '',
        ...list.map((p) => `• @${jidToNumber(p.id)}${p.admin === 'superadmin' ? ' 👑' : ''}`),
      ].join('\n'),
      mentions: list.map((p) => p.id),
    });
  },
};

const changelog = {
  name: 'changelog',
  aliases: ['cambios'],
  category: 'info',
  description: 'Últimos cambios del bot',
  async execute(ctx) {
    const file = path.join(paths.root, 'CHANGELOG.md');
    if (!fs.existsSync(file)) {
      await ctx.reply('📝 No hay archivo CHANGELOG.md en esta instalación.');
      return;
    }
    const content = fs.readFileSync(file, 'utf8');
    await ctx.reply(truncate(content, 3000));
  },
};

export default [botinfo, version, ownerinfo, userInfo, stats, groupinfo, admins, changelog];
