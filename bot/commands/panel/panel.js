/** Panel de control: límites, premium y modo del bot. */
import config from '../../config.js';
import { getLimit } from '../../lib/limits.js';
import { premiumInfo, listPremium } from '../../database/premium.js';
import { getMode, setMode, listBlockedCommands } from '../../database/settings.js';
import { formatDate, formatDuration, formatNumber, jidToNumber } from '../../lib/utils.js';
import { totalCommands } from '../../lib/commandLoader.js';
import { cleanTempDir } from '../../lib/media.js';
import { stats as dbStats, flush } from '../../database/index.js';

const limitCmd = {
  name: 'limit',
  aliases: ['limite'],
  category: 'panel',
  args: '[@usuario]',
  description: 'Consulta el límite diario',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const data = getLimit(target);
    await ctx.reply({
      text: [
        'Ⓛ *LÍMITE DIARIO*',
        '',
        `🙍 @${jidToNumber(target)}`,
        `📊 Restante ☇ ${data.unlimited ? '∞ (owner)' : `${data.remaining}/${data.max}`}`,
        `🔄 Reinicio ☇ ${formatDate(data.resetAt)} (00:00 UTC)`,
        '',
        `Base ☇ ${config.limits.default} · Premium ☇ ${config.limits.premium}`,
      ].join('\n'),
      mentions: [target],
    });
  },
};

const mylimit = {
  name: 'mylimit',
  aliases: ['milimite'],
  category: 'panel',
  description: 'Tu límite diario restante',
  async execute(ctx) {
    const data = getLimit(ctx.sender);
    await ctx.reply(
      data.unlimited
        ? 'Ⓛ Tienes uso *ilimitado* (owner).'
        : `Ⓛ Te quedan *${data.remaining}* de *${data.max}* usos hoy.\n🔄 Se reinicia a las 00:00 UTC.`,
    );
  },
};

const premium = {
  name: 'premium',
  category: 'panel',
  description: 'Información sobre Premium',
  async execute(ctx) {
    const info = premiumInfo(ctx.sender);
    await ctx.reply(
      [
        '💎 *PREMIUM*',
        '',
        info.active
          ? `✅ Tu Premium está activo hasta *${formatDate(info.expires)}* (${formatDuration(info.remainingMs / 1000)} restantes).`
          : '❌ No tienes Premium activo.',
        '',
        '*Ventajas:*',
        `• Límite diario ampliado (${config.limits.premium} en lugar de ${config.limits.default})`,
        '• Acceso a comandos marcados con Ⓟ',
        '• Menor espera entre comandos',
        '',
        `Contacta con el propietario (*${ctx.prefix}ownerinfo*) para obtenerlo.`,
      ].join('\n'),
    );
  },
};

const premiumstatus = {
  name: 'premiumstatus',
  aliases: ['premiuminfo'],
  category: 'panel',
  args: '[@usuario]',
  description: 'Estado Premium de un usuario',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const info = premiumInfo(target);
    await ctx.reply({
      text: [
        '💎 *ESTADO PREMIUM*',
        '',
        `🙍 @${jidToNumber(target)}`,
        `📌 Activo ☇ ${info.active ? 'sí' : 'no'}`,
        info.active ? `📅 Desde ☇ ${formatDate(info.start)}` : null,
        info.active ? `⏳ Expira ☇ ${formatDate(info.expires)}` : null,
      ].filter(Boolean).join('\n'),
      mentions: [target],
    });
  },
};

const premiumlist = {
  name: 'premiumlist',
  aliases: ['listapremium'],
  category: 'panel',
  description: 'Lista de usuarios Premium activos',
  owner: true,
  async execute(ctx) {
    const list = listPremium();
    if (!list.length) {
      await ctx.reply('💎 No hay usuarios Premium activos.');
      return;
    }
    await ctx.reply({
      text: [
        `💎 *PREMIUM ACTIVOS* (${list.length})`,
        '',
        ...list.map((row) => `• @${jidToNumber(row.jid)} — hasta ${formatDate(row.premium_expires)}`),
      ].join('\n'),
      mentions: list.map((row) => row.jid),
    });
  },
};

const publicMode = {
  name: 'public',
  aliases: ['publico'],
  category: 'panel',
  description: 'Activa el modo público',
  owner: true,
  async execute(ctx) {
    setMode('public');
    await ctx.reply('🌍 Modo *PÚBLICO* activado: cualquiera puede usar el bot.');
  },
};

const privateMode = {
  name: 'private',
  aliases: ['privado'],
  category: 'panel',
  description: 'Activa el modo privado',
  owner: true,
  async execute(ctx) {
    setMode('private');
    await ctx.reply('🔒 Modo *PRIVADO* activado: solo el propietario y la whitelist pueden usar el bot.');
  },
};

const panel = {
  name: 'panel',
  aliases: ['dashboard'],
  category: 'panel',
  description: 'Resumen del estado del bot',
  async execute(ctx) {
    const db = dbStats();
    await ctx.reply(
      [
        `⚙️ *PANEL · ${config.name}*`,
        '',
        `🍡 Modo ☇ ${getMode()}`,
        `🗾 Comandos ☇ ${totalCommands()}`,
        `🚧 Bloqueados ☇ ${listBlockedCommands().length || 0}`,
        `👥 Usuarios ☇ ${formatNumber(db.users)}`,
        `💬 Grupos ☇ ${formatNumber(db.groups)}`,
        `💎 Premium ☇ ${formatNumber(db.premium)}`,
        `🚫 Baneados ☇ ${formatNumber(db.banned)}`,
        '',
        `Más: ${ctx.prefix}status · ${ctx.prefix}botinfo`,
      ].join('\n'),
    );
  },
};

const cleantemp = {
  name: 'cleantemp',
  aliases: ['limpiar'],
  category: 'panel',
  description: 'Limpia los archivos temporales',
  owner: true,
  async execute(ctx) {
    const removed = cleanTempDir(0);
    flush();
    await ctx.reply(`🧹 Limpieza completada: *${removed}* archivos temporales eliminados y base de datos guardada.`);
  },
};

export default [limitCmd, mylimit, premium, premiumstatus, premiumlist, publicMode, privateMode, panel, cleantemp];
