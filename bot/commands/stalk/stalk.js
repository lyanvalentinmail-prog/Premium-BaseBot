/**
 * Consulta de perfiles PÚBLICOS mediante APIs oficiales.
 * No se evaden logins, perfiles privados, CAPTCHAs ni límites de uso:
 * si una plataforma no ofrece una API pública fiable, se devuelve un error controlado.
 */
import { getKey } from '../../config.js';
import { requestJson, hasProvider, requireProvider, twitchAppToken } from '../../lib/apiClient.js';
import { UserError, ProviderError } from '../../lib/errors.js';
import { formatNumber, formatDate, truncate } from '../../lib/utils.js';

const githubstalk = {
  name: 'githubstalk',
  aliases: ['ghstalk'],
  category: 'stalk',
  args: '<usuario>',
  description: 'Perfil público de GitHub',
  example: 'githubstalk torvalds',
  async execute(ctx) {
    const user = encodeURIComponent(ctx.args[0]);
    const token = getKey('GITHUB_TOKEN');
    const data = await requestJson(`https://api.github.com/users/${user}`, {
      headers: { accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      label: 'github',
    });
    const text = [
      `🐙 *GITHUB · ${data.login}*`,
      '',
      `📛 Nombre ☇ ${data.name || '—'}`,
      `📝 Bio ☇ ${truncate(data.bio || '—', 200)}`,
      `📦 Repos públicos ☇ ${formatNumber(data.public_repos)}`,
      `👥 Seguidores ☇ ${formatNumber(data.followers)} · Siguiendo ${formatNumber(data.following)}`,
      `🏢 Empresa ☇ ${data.company || '—'}`,
      `📍 Ubicación ☇ ${data.location || '—'}`,
      `🔗 ${data.html_url}`,
      `📅 Desde ☇ ${formatDate(Date.parse(data.created_at))}`,
    ].join('\n');
    if (data.avatar_url) {
      const { requestBuffer } = await import('../../lib/apiClient.js');
      const { buffer } = await requestBuffer(data.avatar_url, { maxBytes: 5 * 1024 * 1024 });
      await ctx.sendImage(buffer, text);
    } else {
      await ctx.reply(text);
    }
  },
};

const npmstalk = {
  name: 'npmstalk',
  aliases: ['npminfo'],
  category: 'stalk',
  args: '<paquete>',
  description: 'Información pública de un paquete npm',
  example: 'npmstalk express',
  async execute(ctx) {
    const pkg = encodeURIComponent(ctx.args[0]);
    const data = await requestJson(`https://registry.npmjs.org/${pkg}`, { label: 'npm' });
    const latest = data['dist-tags']?.latest;
    const version = data.versions?.[latest] || {};
    const downloads = await requestJson(`https://api.npmjs.org/downloads/point/last-week/${pkg}`, { label: 'npm-downloads' }).catch(() => null);
    await ctx.reply(
      [
        `📦 *NPM · ${data.name}*`,
        '',
        `🏷️ Última versión ☇ ${latest}`,
        `📝 ${truncate(data.description || '—', 250)}`,
        `👤 Autor ☇ ${version.author?.name || data.author?.name || '—'}`,
        `⚖️ Licencia ☇ ${version.license || '—'}`,
        `📥 Descargas (7d) ☇ ${downloads ? formatNumber(downloads.downloads) : '—'}`,
        `📅 Actualizado ☇ ${formatDate(Date.parse(data.time?.modified))}`,
        `🔗 https://www.npmjs.com/package/${data.name}`,
      ].join('\n'),
    );
  },
};

const robloxstalk = {
  name: 'robloxstalk',
  category: 'stalk',
  args: '<usuario>',
  description: 'Perfil público de Roblox',
  example: 'robloxstalk builderman',
  async execute(ctx) {
    const lookup = await requestJson('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usernames: [ctx.args[0]], excludeBannedUsers: false }),
      label: 'roblox',
    });
    const found = lookup?.data?.[0];
    if (!found) throw new UserError('❌ Usuario de Roblox no encontrado.');
    const profile = await requestJson(`https://users.roblox.com/v1/users/${found.id}`, { label: 'roblox' });
    const friends = await requestJson(`https://friends.roblox.com/v1/users/${found.id}/friends/count`, { label: 'roblox' }).catch(() => null);
    await ctx.reply(
      [
        `🎮 *ROBLOX · ${profile.name}*`,
        '',
        `📛 Nombre visible ☇ ${profile.displayName}`,
        `🆔 ID ☇ ${profile.id}`,
        `📝 Descripción ☇ ${truncate(profile.description || '—', 250)}`,
        `👥 Amigos ☇ ${friends ? formatNumber(friends.count) : '—'}`,
        `🚫 Baneado ☇ ${profile.isBanned ? 'sí' : 'no'}`,
        `📅 Creado ☇ ${formatDate(Date.parse(profile.created))}`,
        `🔗 https://www.roblox.com/users/${profile.id}/profile`,
      ].join('\n'),
    );
  },
};

const steamstalk = {
  name: 'steamstalk',
  category: 'stalk',
  args: '<usuario>',
  description: 'Perfil público de Steam (requiere STEAM_API_KEY)',
  example: 'steamstalk gabelogannewell',
  async execute(ctx) {
    const key = requireProvider('steam');
    const input = ctx.args[0];
    let steamId = /^\d{17}$/.test(input) ? input : null;
    if (!steamId) {
      const resolved = await requestJson(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(input)}`,
        { label: 'steam' },
      );
      if (resolved?.response?.success !== 1) throw new UserError('❌ Usuario de Steam no encontrado.');
      steamId = resolved.response.steamid;
    }
    const data = await requestJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${steamId}`,
      { label: 'steam' },
    );
    const player = data?.response?.players?.[0];
    if (!player) throw new UserError('❌ Perfil no encontrado o privado.');
    const states = ['Desconectado', 'Conectado', 'Ocupado', 'Ausente', 'Durmiendo', 'Buscando intercambio', 'Buscando partida'];
    await ctx.reply(
      [
        `🎮 *STEAM · ${player.personaname}*`,
        '',
        `🆔 SteamID ☇ ${player.steamid}`,
        `🟢 Estado ☇ ${states[player.personastate] || '—'}`,
        `🌍 País ☇ ${player.loccountrycode || '—'}`,
        `🎯 Jugando ☇ ${player.gameextrainfo || '—'}`,
        `📅 Creado ☇ ${player.timecreated ? formatDate(player.timecreated) : '—'}`,
        `🔗 ${player.profileurl}`,
      ].join('\n'),
    );
  },
};

const twitchstalk = {
  name: 'twitchstalk',
  category: 'stalk',
  args: '<usuario>',
  description: 'Perfil público de Twitch (requiere TWITCH_CLIENT_ID/SECRET)',
  example: 'twitchstalk ibai',
  async execute(ctx) {
    const token = await twitchAppToken();
    const clientId = getKey('TWITCH_CLIENT_ID');
    const data = await requestJson(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(ctx.args[0])}`, {
      headers: { 'client-id': clientId, authorization: `Bearer ${token}` },
      label: 'twitch',
    });
    const user = data?.data?.[0];
    if (!user) throw new UserError('❌ Canal de Twitch no encontrado.');
    const live = await requestJson(`https://api.twitch.tv/helix/streams?user_id=${user.id}`, {
      headers: { 'client-id': clientId, authorization: `Bearer ${token}` },
      label: 'twitch',
    }).catch(() => null);
    const stream = live?.data?.[0];
    await ctx.reply(
      [
        `🟣 *TWITCH · ${user.display_name}*`,
        '',
        `📝 ${truncate(user.description || '—', 250)}`,
        `👁️ Vistas totales ☇ ${formatNumber(user.view_count || 0)}`,
        `🔴 En directo ☇ ${stream ? `sí — ${stream.title} (${formatNumber(stream.viewer_count)} espectadores)` : 'no'}`,
        `📅 Creado ☇ ${formatDate(Date.parse(user.created_at))}`,
        `🔗 https://twitch.tv/${user.login}`,
      ].join('\n'),
    );
  },
};

const ytstalk = {
  name: 'ytstalk',
  category: 'stalk',
  args: '<canal>',
  description: 'Canal de YouTube (requiere YOUTUBE_API_KEY)',
  example: 'ytstalk @MrBeast',
  async execute(ctx) {
    const key = requireProvider('youtube');
    const query = ctx.text.trim();
    const param = query.startsWith('@')
      ? `forHandle=${encodeURIComponent(query)}`
      : query.startsWith('UC')
        ? `id=${encodeURIComponent(query)}`
        : `forHandle=${encodeURIComponent(`@${query}`)}`;
    const data = await requestJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${param}&key=${encodeURIComponent(key)}`,
      { label: 'youtube' },
    );
    const channel = data?.items?.[0];
    if (!channel) throw new UserError('❌ Canal no encontrado.');
    await ctx.reply(
      [
        `▶️ *YOUTUBE · ${channel.snippet.title}*`,
        '',
        `📝 ${truncate(channel.snippet.description || '—', 250)}`,
        `👥 Suscriptores ☇ ${formatNumber(channel.statistics.subscriberCount || 0)}`,
        `🎞️ Vídeos ☇ ${formatNumber(channel.statistics.videoCount || 0)}`,
        `👁️ Vistas ☇ ${formatNumber(channel.statistics.viewCount || 0)}`,
        `📅 Creado ☇ ${formatDate(Date.parse(channel.snippet.publishedAt))}`,
        `🔗 https://youtube.com/channel/${channel.id}`,
      ].join('\n'),
    );
  },
};

/** Plataformas sin API pública oficial para perfiles: error controlado y documentado. */
const makeUnavailable = (name, platform, reason) => ({
  name,
  category: 'stalk',
  args: '<usuario>',
  description: `Perfil de ${platform} (no disponible: sin API pública oficial)`,
  async execute(ctx) {
    throw new ProviderError(
      [
        `🚧 *${platform}* no dispone de una API pública oficial para consultar perfiles.`,
        '',
        reason,
        '',
        'Este bot no hace scraping ni evade controles de acceso, por lo que la función',
        'queda documentada como *no disponible* hasta que exista una integración legítima.',
      ].join('\n'),
    );
  },
});

const tiktokstalk = makeUnavailable(
  'tiktokstalk',
  'TikTok',
  'Su API oficial (Display API) requiere una app aprobada y el consentimiento OAuth del propio usuario consultado.',
);

const igstalk = makeUnavailable(
  'igstalk',
  'Instagram',
  'La API de Instagram solo permite consultar cuentas propias o profesionales vinculadas con tokens de Meta.',
);

export default [githubstalk, npmstalk, robloxstalk, steamstalk, twitchstalk, ytstalk, tiktokstalk, igstalk];
