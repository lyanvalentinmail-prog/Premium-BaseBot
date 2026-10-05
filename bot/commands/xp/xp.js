/** Experiencia, niveles y rankings. */
import config from '../../config.js';
import { getXp, getRank, leaderboard, addXp, doPrestige, PRESTIGE_LEVEL, xpForLevel } from '../../database/xp.js';
import { getUser, updateUser } from '../../database/users.js';
import { all } from '../../database/index.js';
import { addMoney } from '../../database/economy.js';
import { addLimit } from '../../lib/limits.js';
import { formatNumber, progressBar, jidToNumber, formatDuration } from '../../lib/utils.js';
import { UserError } from '../../lib/errors.js';

const xpCmd = {
  name: 'xp',
  aliases: ['exp'],
  category: 'xp',
  args: '[@usuario]',
  description: 'Consulta la experiencia acumulada',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const data = getXp(target);
    await ctx.reply({
      text: [
        '★ *EXPERIENCIA*',
        '',
        `🙍 @${jidToNumber(target)}`,
        `✨ XP actual ☇ ${formatNumber(data.xp)}/${formatNumber(data.needed)}`,
        `📈 XP total ☇ ${formatNumber(data.totalXp)}`,
        `★ Nivel ☇ ${data.level}`,
        `${progressBar(data.xp, data.needed)}`,
      ].join('\n'),
      mentions: [target],
    });
  },
};

const level = {
  name: 'level',
  aliases: ['nivel', 'lvl'],
  category: 'xp',
  args: '[@usuario]',
  description: 'Consulta el nivel',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const data = getXp(target);
    await ctx.reply({
      text: `★ @${jidToNumber(target)} está en el nivel *${data.level}* (prestigio ${data.prestige})\n${progressBar(data.xp, data.needed)}`,
      mentions: [target],
    });
  },
};

const rank = {
  name: 'rank',
  aliases: ['ranking'],
  category: 'xp',
  args: '[@usuario]',
  description: 'Posición en el ranking global',
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    const data = getXp(target);
    await ctx.reply({
      text: `📊 @${jidToNumber(target)} ocupa el puesto *#${getRank(target)}* con nivel ${data.level} (${formatNumber(data.totalXp)} XP totales).`,
      mentions: [target],
    });
  },
};

const leaderboardCmd = {
  name: 'leaderboard',
  aliases: ['lb', 'clasificacion'],
  category: 'xp',
  description: 'Top 10 por nivel',
  async execute(ctx) {
    const list = leaderboard(10);
    if (!list.length) throw new UserError('❌ Todavía no hay datos suficientes.');
    await ctx.reply({
      text: [
        '🏆 *CLASIFICACIÓN GLOBAL*',
        '',
        ...list.map((user, index) => {
          const medal = ['🥇', '🥈', '🥉'][index] || `${index + 1}.`;
          return `${medal} @${jidToNumber(user.jid)} — nivel ${user.level}${user.prestige ? ` ⭐${user.prestige}` : ''} (${formatNumber(user.xp)} XP)`;
        }),
      ].join('\n'),
      mentions: list.map((user) => user.jid),
    });
  },
};

const topxp = {
  name: 'topxp',
  category: 'xp',
  description: 'Top 10 por XP acumulada en el nivel actual',
  async execute(ctx) {
    const list = all('SELECT jid, xp, level FROM users ORDER BY xp DESC LIMIT 10');
    if (!list.length) throw new UserError('❌ Todavía no hay datos suficientes.');
    await ctx.reply({
      text: ['✨ *TOP XP*', '', ...list.map((u, i) => `${i + 1}. @${jidToNumber(u.jid)} — ${formatNumber(u.xp)} XP (nivel ${u.level})`)].join('\n'),
      mentions: list.map((u) => u.jid),
    });
  },
};

const dailyxp = {
  name: 'dailyxp',
  aliases: ['xpdiario'],
  category: 'xp',
  description: 'Reclama tu XP diaria',
  async execute(ctx) {
    const user = getUser(ctx.sender);
    const now = Date.now();
    const elapsed = now - (user.last_daily_xp || 0);
    if (elapsed < 86_400_000) {
      throw new UserError(`⏳ Ya reclamaste tu XP diaria. Vuelve en *${formatDuration((86_400_000 - elapsed) / 1000)}*.`);
    }
    updateUser(ctx.sender, { last_daily_xp: now });
    const result = addXp(ctx.sender, config.xp.dailyAmount);
    await ctx.reply(
      [
        `🎁 Has reclamado *${config.xp.dailyAmount} XP*.`,
        `★ Nivel ☇ ${result.level}`,
        result.leveledUp ? '🆙 ¡Has subido de nivel!' : '',
      ].filter(Boolean).join('\n'),
    );
  },
};

const xpstats = {
  name: 'xpstats',
  category: 'xp',
  description: 'Estadísticas globales de XP',
  async execute(ctx) {
    const row = all('SELECT COUNT(*) AS users, SUM(xp) AS xp, AVG(level) AS avgLevel, MAX(level) AS maxLevel FROM users')[0] || {};
    await ctx.reply(
      [
        '📊 *ESTADÍSTICAS DE XP*',
        '',
        `👥 Usuarios ☇ ${formatNumber(row.users || 0)}`,
        `✨ XP total ☇ ${formatNumber(Math.round(row.xp || 0))}`,
        `★ Nivel medio ☇ ${(row.avgLevel || 0).toFixed(1)}`,
        `🔝 Nivel máximo ☇ ${row.maxLevel || 0}`,
        `⚙️ XP por mensaje ☇ ${config.xp.perMessage} (cooldown ${config.xp.cooldown}s)`,
      ].join('\n'),
    );
  },
};

const progress = {
  name: 'progress',
  aliases: ['progreso'],
  category: 'xp',
  description: 'Tu progreso hacia el siguiente nivel',
  async execute(ctx) {
    const data = getXp(ctx.sender);
    const remaining = data.needed - data.xp;
    const messages = Math.ceil(remaining / Math.max(1, config.xp.perMessage));
    await ctx.reply(
      [
        '📈 *PROGRESO*',
        '',
        `★ Nivel ☇ ${data.level} → ${data.level + 1}`,
        progressBar(data.xp, data.needed, 16),
        `✨ Faltan ☇ ${formatNumber(remaining)} XP (~${formatNumber(messages)} mensajes)`,
        `🎯 Siguiente nivel requiere ☇ ${formatNumber(xpForLevel(data.level))} XP`,
      ].join('\n'),
    );
  },
};

const REWARDS = [
  { level: 5, money: 500, limits: 2 },
  { level: 10, money: 1500, limits: 5 },
  { level: 20, money: 4000, limits: 10 },
  { level: 35, money: 10000, limits: 20 },
  { level: 50, money: 25000, limits: 40 },
];

const rewards = {
  name: 'rewards',
  aliases: ['recompensas'],
  category: 'xp',
  description: 'Reclama recompensas por nivel',
  async execute(ctx) {
    const user = getUser(ctx.sender);
    const settingsKey = `rewards:${ctx.sender}`;
    const { getSetting, setSetting } = await import('../../database/settings.js');
    const claimed = getSetting(settingsKey, []);
    const available = REWARDS.filter((r) => user.level >= r.level && !claimed.includes(r.level));

    if (!available.length) {
      await ctx.reply(
        [
          '🎁 *RECOMPENSAS POR NIVEL*',
          '',
          ...REWARDS.map((r) => `${claimed.includes(r.level) ? '✅' : user.level >= r.level ? '🎁' : '🔒'} Nivel ${r.level} → ${formatNumber(r.money)} ${config.economy.currency} + ${r.limits} límites`),
          '',
          '_No tienes recompensas pendientes por reclamar._',
        ].join('\n'),
      );
      return;
    }

    let money = 0;
    let limits = 0;
    for (const reward of available) {
      money += reward.money;
      limits += reward.limits;
      claimed.push(reward.level);
    }
    addMoney(ctx.sender, money);
    addLimit(ctx.sender, limits);
    setSetting(settingsKey, claimed);
    await ctx.reply(`🎁 ¡Recompensas reclamadas!\n${config.economy.symbol} +${formatNumber(money)} ${config.economy.currency}\nⓁ +${limits} límites`);
  },
};

const prestige = {
  name: 'prestige',
  aliases: ['prestigio'],
  category: 'xp',
  description: `Reinicia tu nivel a cambio de prestigio (nivel ${PRESTIGE_LEVEL}+)`,
  async execute(ctx) {
    const result = doPrestige(ctx.sender);
    if (!result.ok) {
      throw new UserError(`❌ Necesitas ser nivel *${PRESTIGE_LEVEL}* para hacer prestigio (estás en el ${result.level}).`);
    }
    addMoney(ctx.sender, 10000);
    await ctx.reply(`⭐ ¡Has alcanzado el prestigio *${result.prestige}*!\nTu nivel vuelve a 1 y recibes ${config.economy.symbol} 10.000 ${config.economy.currency}.`);
  },
};

export default [xpCmd, level, rank, leaderboardCmd, topxp, dailyxp, xpstats, progress, rewards, prestige];
