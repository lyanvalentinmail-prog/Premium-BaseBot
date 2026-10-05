/**
 * Anime y manga.
 * Fuentes: Jikan v4 (API pública no oficial de MyAnimeList, documentada y mantenida)
 * y nekos.best (API pública documentada de imágenes SFW).
 */
import { requestJson, requestBuffer } from '../../lib/apiClient.js';
import { UserError } from '../../lib/errors.js';
import { pickRandom, truncate, formatNumber, stripTags } from '../../lib/utils.js';
import { requireInteger, requireOption } from '../../lib/validators.js';
import { anime as animeQuotes } from '../../lib/data/quotes.js';

const JIKAN = 'https://api.jikan.moe/v4';

const sendAnimeCard = async (ctx, item, type = 'anime') => {
  const title = item.title_english || item.title || item.name;
  const caption = [
    `✿ *${title}*`,
    item.title_japanese ? `🇯🇵 ${item.title_japanese}` : null,
    '',
    item.type ? `📺 Tipo ☇ ${item.type}` : null,
    item.episodes ? `🎞️ Episodios ☇ ${item.episodes}` : null,
    item.chapters ? `📖 Capítulos ☇ ${item.chapters}` : null,
    item.volumes ? `📚 Volúmenes ☇ ${item.volumes}` : null,
    item.status ? `📌 Estado ☇ ${item.status}` : null,
    item.score ? `⭐ Puntuación ☇ ${item.score} (${formatNumber(item.scored_by || 0)} votos)` : null,
    item.rank ? `🏆 Ranking ☇ #${item.rank}` : null,
    item.genres?.length ? `🏷️ Géneros ☇ ${item.genres.map((g) => g.name).join(', ')}` : null,
    item.aired?.string ? `📅 Emisión ☇ ${item.aired.string}` : null,
    item.published?.string ? `📅 Publicación ☇ ${item.published.string}` : null,
    '',
    item.synopsis ? `📝 ${truncate(stripTags(item.synopsis), 700)}` : null,
    '',
    item.url ? `🔗 ${item.url}` : null,
    '_Fuente: Jikan / MyAnimeList_',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const image = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
  if (image) {
    try {
      const { buffer } = await requestBuffer(image, { maxBytes: 8 * 1024 * 1024 });
      await ctx.sendImage(buffer, caption);
      return;
    } catch {
      /* si falla la imagen, enviamos solo texto */
    }
  }
  await ctx.reply(caption);
};

const animeinfo = {
  name: 'animeinfo',
  aliases: ['anime'],
  category: 'anime',
  args: '<nombre>',
  description: 'Información de un anime',
  example: 'animeinfo Steins Gate',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(`${JIKAN}/anime?q=${encodeURIComponent(ctx.text)}&limit=1&sfw=true`, { label: 'jikan' });
    const item = data?.data?.[0];
    if (!item) throw new UserError('❌ No se encontró ese anime.');
    await sendAnimeCard(ctx, item);
  },
};

const mangainfo = {
  name: 'mangainfo',
  aliases: ['manga'],
  category: 'anime',
  args: '<nombre>',
  description: 'Información de un manga',
  example: 'mangainfo Berserk',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(`${JIKAN}/manga?q=${encodeURIComponent(ctx.text)}&limit=1`, { label: 'jikan' });
    const item = data?.data?.[0];
    if (!item) throw new UserError('❌ No se encontró ese manga.');
    await sendAnimeCard(ctx, item, 'manga');
  },
};

const character = {
  name: 'character',
  aliases: ['personaje'],
  category: 'anime',
  args: '<nombre>',
  description: 'Información de un personaje de anime',
  example: 'character Levi Ackerman',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson(`${JIKAN}/characters?q=${encodeURIComponent(ctx.text)}&limit=1`, { label: 'jikan' });
    const item = data?.data?.[0];
    if (!item) throw new UserError('❌ No se encontró ese personaje.');
    const caption = [
      `✿ *${item.name}*`,
      item.name_kanji ? `🇯🇵 ${item.name_kanji}` : null,
      item.nicknames?.length ? `🏷️ Apodos ☇ ${item.nicknames.join(', ')}` : null,
      `❤️ Favoritos ☇ ${formatNumber(item.favorites || 0)}`,
      '',
      item.about ? truncate(stripTags(item.about), 800) : null,
      '',
      `🔗 ${item.url}`,
      '_Fuente: Jikan / MyAnimeList_',
    ].filter(Boolean).join('\n');
    const image = item.images?.jpg?.image_url;
    if (image) {
      const { buffer } = await requestBuffer(image, { maxBytes: 8 * 1024 * 1024 });
      await ctx.sendImage(buffer, caption);
    } else await ctx.reply(caption);
  },
};

const NEKOS_CATEGORIES = ['waifu', 'husbando', 'neko', 'kitsune'];

const nekosCommand = (name, defaultCategory, emoji, label) => ({
  name,
  category: 'anime',
  args: '[categoria]',
  description: `Imagen aleatoria de ${label} (nekos.best)`,
  cooldown: 5,
  async execute(ctx) {
    const requested = ctx.args[0]?.toLowerCase();
    const category = requested ? requireOption(requested, NEKOS_CATEGORIES, { name: 'Categoría' }) : defaultCategory;
    const data = await requestJson(`https://nekos.best/api/v2/${category}`, { label: 'nekos.best' });
    const result = data?.results?.[0];
    if (!result?.url) throw new UserError('❌ No se pudo obtener la imagen.');
    const { buffer } = await requestBuffer(result.url, { maxBytes: 10 * 1024 * 1024 });
    await ctx.sendImage(
      buffer,
      [
        `${emoji} *${category.toUpperCase()}*`,
        result.artist_name ? `🎨 Artista ☇ ${result.artist_name}` : null,
        result.source_url ? `🔗 ${result.source_url}` : null,
        '_Fuente: nekos.best_',
      ].filter(Boolean).join('\n'),
    );
  },
});

const waifu = nekosCommand('waifu', 'waifu', '👧', 'waifus');
const husbando = nekosCommand('husbando', 'husbando', '👦', 'husbandos');
const neko = nekosCommand('neko', 'neko', '🐱', 'nekos');

const animequote = {
  name: 'animequote',
  aliases: ['frasesanime'],
  category: 'anime',
  args: '[anime]',
  description: 'Frase célebre de anime',
  async execute(ctx) {
    const filter = ctx.text.toLowerCase();
    const pool = filter ? animeQuotes.filter((q) => q.anime.toLowerCase().includes(filter)) : animeQuotes;
    if (!pool.length) throw new UserError(`❌ No hay frases registradas de *${ctx.text}*.`);
    const quote = pickRandom(pool);
    await ctx.reply(`✿ _"${quote.text}"_\n\n— *${quote.author}* (${quote.anime})`);
  },
};

const topList = (name, endpoint, emoji, label) => ({
  name,
  category: 'anime',
  args: '[cantidad]',
  description: `Top de ${label} (Jikan)`,
  cooldown: 8,
  async execute(ctx) {
    const limit = ctx.args[0] ? requireInteger(ctx.args[0], { min: 1, max: 25, name: 'cantidad' }) : 10;
    const data = await requestJson(`${JIKAN}/top/${endpoint}?limit=${limit}`, { label: 'jikan' });
    const items = data?.data || [];
    if (!items.length) throw new UserError('❌ No se pudo obtener el ranking.');
    await ctx.reply(
      [
        `${emoji} *TOP ${limit} ${label.toUpperCase()}*`,
        '',
        ...items.map((item, index) => `${index + 1}. *${item.title}* ⭐ ${item.score ?? '—'}`),
        '',
        '_Fuente: Jikan / MyAnimeList_',
      ].join('\n'),
    );
  },
});

const topanime = topList('topanime', 'anime', '🏆', 'anime');
const topmanga = topList('topmanga', 'manga', '📚', 'manga');

const season = {
  name: 'season',
  aliases: ['temporada'],
  category: 'anime',
  args: '[año] [temporada]',
  description: 'Animes de una temporada (winter/spring/summer/fall)',
  example: 'season 2024 spring',
  cooldown: 8,
  async execute(ctx) {
    const now = new Date();
    const year = ctx.args[0] ? requireInteger(ctx.args[0], { min: 1960, max: now.getFullYear() + 1, name: 'año' }) : now.getFullYear();
    const seasons = ['winter', 'spring', 'summer', 'fall'];
    const current = seasons[Math.floor(now.getMonth() / 3)];
    const seasonName = ctx.args[1] ? requireOption(ctx.args[1], seasons, { name: 'Temporada' }) : current;
    const data = await requestJson(`${JIKAN}/seasons/${year}/${seasonName}?limit=15&sfw=true`, { label: 'jikan' });
    const items = data?.data || [];
    if (!items.length) throw new UserError('❌ No hay datos para esa temporada.');
    await ctx.reply(
      [
        `🗓️ *TEMPORADA ${seasonName.toUpperCase()} ${year}*`,
        '',
        ...items.map((item, index) => `${index + 1}. *${item.title}* (${item.type || '—'}) ⭐ ${item.score ?? '—'}`),
        '',
        '_Fuente: Jikan / MyAnimeList_',
      ].join('\n'),
    );
  },
};

export default [animeinfo, mangainfo, character, waifu, husbando, neko, animequote, topanime, topmanga, season];
