/** Búsquedas en Internet mediante APIs oficiales o documentadas. */
import { getKey } from '../../config.js';
import { requestJson, requestBuffer, requireProvider } from '../../lib/apiClient.js';
import { UserError, ProviderError } from '../../lib/errors.js';
import { truncate, formatNumber } from '../../lib/utils.js';

const google = {
  name: 'google',
  category: 'search',
  args: '<consulta>',
  description: 'Búsqueda web (requiere GOOGLE_API_KEY y GOOGLE_CSE_ID)',
  limit: true,
  cooldown: 5,
  async execute(ctx) {
    const key = requireProvider('google');
    const cx = requireProvider('googleCx');
    const data = await requestJson(
      `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(ctx.text)}&num=5&hl=es`,
      { label: 'google-cse' },
    );
    const items = data?.items || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `⌕ *GOOGLE · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((item, i) => `${i + 1}. *${item.title}*\n${truncate(item.snippet || '', 150)}\n🔗 ${item.link}`),
        '',
        '_Fuente: Google Custom Search_',
      ].join('\n\n'),
    );
  },
};

const youtube = {
  name: 'youtube',
  aliases: ['yts', 'ytsearch'],
  category: 'search',
  args: '<consulta>',
  description: 'Busca vídeos en YouTube (requiere YOUTUBE_API_KEY)',
  limit: true,
  cooldown: 5,
  async execute(ctx) {
    const key = requireProvider('youtube');
    const data = await requestJson(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(ctx.text)}&key=${encodeURIComponent(key)}`,
      { label: 'youtube' },
    );
    const items = data?.items || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `▶️ *YOUTUBE · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((item, i) =>
          `${i + 1}. *${item.snippet.title}*\n👤 ${item.snippet.channelTitle}\n🔗 https://youtu.be/${item.id.videoId}`),
        '',
        `_Descarga con ${ctx.prefix}ytmp3 o ${ctx.prefix}ytmp4_`,
      ].join('\n\n'),
    );
  },
};

const wikipedia = {
  name: 'wikipedia',
  aliases: ['wiki'],
  category: 'search',
  args: '<consulta>',
  description: 'Resumen de Wikipedia',
  cooldown: 5,
  async execute(ctx) {
    const search = await requestJson(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(ctx.text)}&format=json&srlimit=1`,
      { label: 'wikipedia' },
    );
    const title = search?.query?.search?.[0]?.title;
    if (!title) throw new UserError('❌ No se encontró ningún artículo.');
    const summary = await requestJson(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { label: 'wikipedia' },
    );
    const caption = [
      `📚 *${summary.title}*`,
      '',
      truncate(summary.extract || 'Sin resumen disponible.', 1200),
      '',
      `🔗 ${summary.content_urls?.desktop?.page || ''}`,
      '_Fuente: Wikipedia_',
    ].join('\n');
    if (summary.thumbnail?.source) {
      const { buffer } = await requestBuffer(summary.thumbnail.source, { maxBytes: 5 * 1024 * 1024 });
      await ctx.sendImage(buffer, caption);
    } else await ctx.reply(caption);
  },
};

const github = {
  name: 'github',
  aliases: ['gh'],
  category: 'search',
  args: '<consulta>',
  description: 'Busca repositorios en GitHub',
  cooldown: 5,
  async execute(ctx) {
    const token = getKey('GITHUB_TOKEN');
    const data = await requestJson(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(ctx.text)}&per_page=5`,
      {
        headers: { accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        label: 'github',
      },
    );
    const items = data?.items || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `🐙 *GITHUB · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((repo, i) =>
          `${i + 1}. *${repo.full_name}* ⭐ ${formatNumber(repo.stargazers_count)}\n${truncate(repo.description || '', 120)}\n🔗 ${repo.html_url}`),
      ].join('\n\n'),
    );
  },
};

const npm = {
  name: 'npm',
  category: 'search',
  args: '<paquete>',
  description: 'Busca paquetes en npm',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(ctx.text)}&size=5`,
      { label: 'npm' },
    );
    const items = data?.objects || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `📦 *NPM · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((entry, i) =>
          `${i + 1}. *${entry.package.name}* v${entry.package.version}\n${truncate(entry.package.description || '', 120)}\n🔗 ${entry.package.links.npm}`),
      ].join('\n\n'),
    );
  },
};

const lyrics = {
  name: 'lyrics',
  aliases: ['letra'],
  category: 'search',
  args: '<artista - cancion>',
  description: 'Letra de una canción (lyrics.ovh)',
  example: 'lyrics coldplay - yellow',
  limit: true,
  cooldown: 8,
  async execute(ctx) {
    const [artist, title] = ctx.text.split('-').map((part) => part.trim());
    if (!artist || !title) {
      throw new UserError(`❌ Formato: *${ctx.prefix}lyrics <artista> - <canción>*`);
    }
    const data = await requestJson(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { label: 'lyrics.ovh', timeout: 25_000 },
    ).catch(() => null);
    if (!data?.lyrics) throw new UserError('❌ No se encontró la letra de esa canción.');
    await ctx.reply(`🎵 *${artist} — ${title}*\n\n${truncate(data.lyrics.trim(), 3500)}\n\n_Fuente: lyrics.ovh_`);
  },
};

const animesearch = {
  name: 'animesearch',
  category: 'search',
  args: '<nombre>',
  description: 'Busca animes por nombre (Jikan)',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(ctx.text)}&limit=5&sfw=true`,
      { label: 'jikan' },
    );
    const items = data?.data || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `✿ *ANIME · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((item, i) => `${i + 1}. *${item.title}* (${item.type || '—'}, ${item.year || '—'}) ⭐ ${item.score ?? '—'}`),
        '',
        `_Detalles: ${ctx.prefix}animeinfo <nombre>_`,
      ].join('\n'),
    );
  },
};

const mangasearch = {
  name: 'mangasearch',
  category: 'search',
  args: '<nombre>',
  description: 'Busca mangas por nombre (Jikan)',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(ctx.text)}&limit=5`, { label: 'jikan' });
    const items = data?.data || [];
    if (!items.length) throw new UserError('❌ Sin resultados.');
    await ctx.reply(
      [
        `📚 *MANGA · ${truncate(ctx.text, 60)}*`,
        '',
        ...items.map((item, i) => `${i + 1}. *${item.title}* (${item.type || '—'}) ⭐ ${item.score ?? '—'}`),
        '',
        `_Detalles: ${ctx.prefix}mangainfo <nombre>_`,
      ].join('\n'),
    );
  },
};

const imagesearch = {
  name: 'imagesearch',
  aliases: ['img', 'imagen'],
  category: 'search',
  args: '<consulta>',
  description: 'Busca imágenes con licencia abierta (Openverse)',
  limit: true,
  cooldown: 8,
  async execute(ctx) {
    const data = await requestJson(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(ctx.text)}&page_size=3&mature=false`,
      { label: 'openverse' },
    );
    const results = data?.results || [];
    if (!results.length) throw new UserError('❌ Sin resultados.');
    for (const item of results.slice(0, 3)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { buffer } = await requestBuffer(item.url, { maxBytes: 8 * 1024 * 1024 });
        // eslint-disable-next-line no-await-in-loop
        await ctx.sendImage(buffer, `🖼️ ${truncate(item.title || ctx.text, 100)}\n⚖️ Licencia: ${item.license} · ${item.source}\n_Fuente: Openverse_`);
      } catch {
        /* una imagen que falla no debe cortar el resto */
      }
    }
  },
};

const pinterest = {
  name: 'pinterestsearch',
  aliases: ['pinsearch'],
  category: 'search',
  args: '<consulta>',
  description: 'Búsqueda en Pinterest (no disponible: sin API pública abierta)',
  async execute(ctx) {
    throw new ProviderError(
      [
        '🚧 *Pinterest* no ofrece una API pública abierta para búsquedas.',
        '',
        'Su API requiere una aplicación aprobada y autenticación OAuth del usuario.',
        'Este bot no hace scraping ni evade controles de acceso.',
        '',
        `Alternativa disponible: *${ctx.prefix}imagesearch <consulta>* (Openverse, licencias abiertas).`,
      ].join('\n'),
    );
  },
};

export default [google, youtube, wikipedia, github, npm, lyrics, animesearch, mangasearch, imagesearch, pinterest];
