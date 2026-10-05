/**
 * Descargas de contenido público.
 * Motor: yt-dlp (ver bot/lib/downloader.js). Sin bypass de DRM, paywalls,
 * autenticación, CAPTCHA ni contenido privado.
 */
import fs from 'node:fs';
import { download, fetchInfo } from '../../lib/downloader.js';
import { cleanup } from '../../lib/media.js';
import { requireUrl } from '../../lib/validators.js';
import { requestJson, spotifyAppToken } from '../../lib/apiClient.js';
import { UserError, ProviderError } from '../../lib/errors.js';
import { formatDuration, formatNumber, truncate } from '../../lib/utils.js';

const hostMatches = (url, hosts) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

/** Crea un comando de descarga para una plataforma. */
const downloaderCommand = ({ name, aliases = [], description, hosts, audio = false, args = '<url>', example, platform }) => ({
  name,
  aliases,
  category: 'downloader',
  args,
  description,
  limit: true,
  cooldown: 20,
  example,
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, { name, args });
    if (hosts && !hostMatches(url, hosts)) {
      throw new UserError(`❌ Ese enlace no parece de ${platform}. Dominios admitidos: ${hosts.join(', ')}`);
    }
    const quality = !audio && ctx.args[1] ? String(ctx.args[1]).replace(/\D/g, '') || '480' : '480';
    await ctx.reply(`⏬ Descargando de ${platform}… esto puede tardar.`);

    const { file, info, extra } = await download(url, { audio, quality });
    try {
      const caption = [
        `✅ *${truncate(info.title || 'Contenido', 120)}*`,
        info.uploader ? `👤 ${info.uploader}` : null,
        info.duration ? `⏱️ ${formatDuration(info.duration)}` : null,
        info.view_count ? `👁️ ${formatNumber(info.view_count)} visualizaciones` : null,
      ].filter(Boolean).join('\n');

      const buffer = fs.readFileSync(file);
      if (audio) {
        await ctx.sendAudio(buffer, { mimetype: 'audio/mpeg' });
        await ctx.reply(caption);
      } else {
        await ctx.sendVideo(buffer, caption);
      }
    } finally {
      cleanup(file, extra);
    }
  },
});

const ytmp3 = downloaderCommand({
  name: 'ytmp3',
  aliases: ['ytaudio'],
  description: 'Descarga el audio de un vídeo de YouTube',
  platform: 'YouTube',
  hosts: ['youtube.com', 'youtu.be', 'music.youtube.com'],
  audio: true,
  example: 'ytmp3 https://youtu.be/xxxxxxx',
});

const ytmp4 = downloaderCommand({
  name: 'ytmp4',
  aliases: ['ytvideo'],
  args: '<url> [calidad]',
  description: 'Descarga un vídeo de YouTube (calidad: 360/480/720)',
  platform: 'YouTube',
  hosts: ['youtube.com', 'youtu.be', 'music.youtube.com'],
  example: 'ytmp4 https://youtu.be/xxxxxxx 480',
});

const tiktok = downloaderCommand({
  name: 'tiktok',
  aliases: ['tt'],
  description: 'Descarga un vídeo público de TikTok',
  platform: 'TikTok',
  hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
});

const instagram = downloaderCommand({
  name: 'instagram',
  aliases: ['ig'],
  description: 'Descarga una publicación pública de Instagram',
  platform: 'Instagram',
  hosts: ['instagram.com', 'instagr.am'],
});

const facebook = downloaderCommand({
  name: 'facebook',
  aliases: ['fb'],
  description: 'Descarga un vídeo público de Facebook',
  platform: 'Facebook',
  hosts: ['facebook.com', 'fb.watch', 'm.facebook.com'],
});

const twitter = downloaderCommand({
  name: 'twitter',
  aliases: ['x'],
  description: 'Descarga un vídeo público de X/Twitter',
  platform: 'X (Twitter)',
  hosts: ['twitter.com', 'x.com'],
});

const soundcloud = downloaderCommand({
  name: 'soundcloud',
  aliases: ['sc'],
  description: 'Descarga una pista pública de SoundCloud',
  platform: 'SoundCloud',
  hosts: ['soundcloud.com', 'on.soundcloud.com'],
  audio: true,
});

const pinterest = downloaderCommand({
  name: 'pinterest',
  aliases: ['pin'],
  description: 'Descarga un vídeo/imagen pública de Pinterest',
  platform: 'Pinterest',
  hosts: ['pinterest.com', 'pin.it', 'pinterest.es'],
});

const mediafire = {
  name: 'mediafire',
  aliases: ['mf'],
  category: 'downloader',
  args: '<url>',
  description: 'Descarga un archivo público de MediaFire',
  limit: true,
  cooldown: 20,
  example: 'mediafire https://www.mediafire.com/file/...',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, mediafire);
    if (!hostMatches(url, ['mediafire.com'])) throw new UserError('❌ El enlace debe ser de mediafire.com');

    const { requestText, requestBuffer } = await import('../../lib/apiClient.js');
    const html = await requestText(url, { userProvided: true, headers: { accept: 'text/html' } });
    const direct = /href="(https:\/\/download[^"]+)"/i.exec(html)?.[1];
    const fileName = /<div class="filename">([^<]+)<\/div>/i.exec(html)?.[1]?.trim() || `mediafire-${Date.now()}`;
    if (!direct) {
      throw new ProviderError('⚠️ No se pudo obtener el enlace directo (el archivo puede requerir contraseña o ya no estar disponible).');
    }
    await ctx.reply(`⏬ Descargando *${fileName}*…`);
    const { buffer, contentType } = await requestBuffer(direct, { label: 'mediafire' });
    await ctx.sendDocument(buffer, fileName, contentType, `✅ *${fileName}*`);
  },
};

const spotify = {
  name: 'spotify',
  category: 'downloader',
  args: '<url>',
  description: 'Información de una pista de Spotify (sin descarga: contenido protegido)',
  cooldown: 10,
  example: 'spotify https://open.spotify.com/track/...',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, spotify);
    const id = /track\/([a-zA-Z0-9]+)/.exec(url)?.[1];
    if (!id) throw new UserError('❌ Indica el enlace de una *pista* de Spotify.');
    const token = await spotifyAppToken();
    const track = await requestJson(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { authorization: `Bearer ${token}` },
      label: 'spotify',
    });
    await ctx.reply(
      [
        `🎧 *${track.name}*`,
        `👤 ${track.artists.map((a) => a.name).join(', ')}`,
        `💿 ${track.album?.name} (${track.album?.release_date})`,
        `⏱️ ${formatDuration(Math.round(track.duration_ms / 1000))}`,
        `🔗 ${track.external_urls?.spotify}`,
        '',
        'ℹ️ Spotify protege su catálogo con DRM: este bot *no descarga* audio de Spotify.',
        `Puedes buscar la canción en YouTube con *${ctx.prefix}youtube ${track.name} ${track.artists[0]?.name}*.`,
      ].join('\n'),
    );
  },
};

const mediainfo = {
  name: 'mediainfo',
  aliases: ['dlinfo'],
  category: 'downloader',
  args: '<url>',
  description: 'Información del contenido antes de descargarlo',
  cooldown: 10,
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, mediainfo);
    const info = await fetchInfo(url);
    await ctx.reply(
      [
        `ℹ️ *${truncate(info.title || 'Contenido', 150)}*`,
        info.uploader ? `👤 ${info.uploader}` : null,
        info.duration ? `⏱️ ${formatDuration(info.duration)}` : null,
        info.view_count ? `👁️ ${formatNumber(info.view_count)}` : null,
        info.filesize || info.filesize_approx ? `📦 ~${((info.filesize || info.filesize_approx) / 1048576).toFixed(1)} MB` : null,
        info.extractor_key ? `🔧 Extractor ☇ ${info.extractor_key}` : null,
      ].filter(Boolean).join('\n'),
    );
  },
};

export default [ytmp3, ytmp4, tiktok, instagram, facebook, twitter, soundcloud, pinterest, mediafire, spotify, mediainfo];
