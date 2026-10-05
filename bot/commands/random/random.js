/** Generadores aleatorios (locales y APIs públicas sin clave). */
import { Jimp } from 'jimp';
import { requestJson, requestBuffer } from '../../lib/apiClient.js';
import { pickRandom, randomInt, formatNumber, truncate, stripTags } from '../../lib/utils.js';
import { requireInteger } from '../../lib/validators.js';
import { words, emojis } from '../../lib/data/words.js';
import { facts, general } from '../../lib/data/quotes.js';
import { UserError } from '../../lib/errors.js';

const randomnumber = {
  name: 'randomnumber',
  aliases: ['rnum', 'numero'],
  category: 'random',
  args: '[min] [max]',
  description: 'Número aleatorio entre dos valores',
  example: 'randomnumber 1 100',
  async execute(ctx) {
    const min = ctx.args[0] ? requireInteger(ctx.args[0], { min: -1e9, max: 1e9, name: 'mínimo' }) : 1;
    const max = ctx.args[1] ? requireInteger(ctx.args[1], { min: -1e9, max: 1e9, name: 'máximo' }) : 100;
    if (min >= max) throw new UserError('❌ El mínimo debe ser menor que el máximo.');
    await ctx.reply(`🔢 Número aleatorio entre ${formatNumber(min)} y ${formatNumber(max)}: *${formatNumber(randomInt(min, max))}*`);
  },
};

const randomuser = {
  name: 'randomuser',
  category: 'random',
  description: 'Perfil ficticio aleatorio (randomuser.me)',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson('https://randomuser.me/api/', { label: 'randomuser' });
    const user = data?.results?.[0];
    if (!user) throw new UserError('❌ No se pudo generar el perfil.');
    const caption = [
      '👤 *PERFIL ALEATORIO*',
      '',
      `📛 ${user.name.first} ${user.name.last}`,
      `🚻 ${user.gender === 'male' ? 'Hombre' : 'Mujer'} · ${user.dob.age} años`,
      `📧 ${user.email}`,
      `📍 ${user.location.city}, ${user.location.country}`,
      '',
      '_Datos ficticios generados por randomuser.me_',
    ].join('\n');
    const { buffer } = await requestBuffer(user.picture.large, { maxBytes: 3 * 1024 * 1024 });
    await ctx.sendImage(buffer, caption);
  },
};

const randomcolor = {
  name: 'randomcolor',
  aliases: ['color'],
  category: 'random',
  description: 'Color aleatorio con su muestra',
  async execute(ctx) {
    const r = randomInt(0, 255);
    const g = randomInt(0, 255);
    const b = randomInt(0, 255);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const image = new Jimp({ width: 600, height: 400, color: (r << 24) | (g << 16) | (b << 8) | 255 });
    await ctx.sendImage(
      await image.getBuffer('image/png'),
      `🎨 *COLOR ALEATORIO*\n\nHEX ☇ ${hex.toUpperCase()}\nRGB ☇ ${r}, ${g}, ${b}`,
    );
  },
};

const randomword = {
  name: 'randomword',
  aliases: ['palabraaleatoria'],
  category: 'random',
  description: 'Una palabra aleatoria',
  async execute(ctx) {
    await ctx.reply(`🔤 Palabra aleatoria: *${pickRandom(words)}*`);
  },
};

const randomfact = {
  name: 'randomfact',
  aliases: ['dato'],
  category: 'random',
  description: 'Un dato curioso',
  async execute(ctx) {
    await ctx.reply(`💡 *¿Sabías que…?*\n\n${pickRandom(facts)}`);
  },
};

const randomimage = {
  name: 'randomimage',
  aliases: ['imagenaleatoria'],
  category: 'random',
  description: 'Imagen aleatoria (picsum.photos)',
  cooldown: 5,
  async execute(ctx) {
    const { buffer } = await requestBuffer(`https://picsum.photos/800/600?random=${Date.now()}`, {
      maxBytes: 8 * 1024 * 1024,
      label: 'picsum',
    });
    await ctx.sendImage(buffer, '🖼️ Imagen aleatoria\n_Fuente: picsum.photos_');
  },
};

const randomquote = {
  name: 'randomquote',
  category: 'random',
  description: 'Frase aleatoria',
  async execute(ctx) {
    const quote = pickRandom(general);
    await ctx.reply(`❝ _"${quote.text}"_\n\n— *${quote.author}*`);
  },
};

const randomanime = {
  name: 'randomanime',
  category: 'random',
  description: 'Anime aleatorio (Jikan)',
  cooldown: 8,
  async execute(ctx) {
    const data = await requestJson('https://api.jikan.moe/v4/random/anime?sfw=true', { label: 'jikan' });
    const item = data?.data;
    if (!item) throw new UserError('❌ No se pudo obtener un anime.');
    const caption = [
      `✿ *${item.title}*`,
      `📺 ${item.type || '—'} · ${item.episodes || '?'} eps · ⭐ ${item.score ?? '—'}`,
      '',
      truncate(stripTags(item.synopsis || 'Sin sinopsis.'), 600),
      '',
      `🔗 ${item.url}`,
      '_Fuente: Jikan / MyAnimeList_',
    ].join('\n');
    const image = item.images?.jpg?.large_image_url;
    if (image) {
      const { buffer } = await requestBuffer(image, { maxBytes: 8 * 1024 * 1024 });
      await ctx.sendImage(buffer, caption);
    } else await ctx.reply(caption);
  },
};

const randomcountry = {
  name: 'randomcountry',
  aliases: ['pais'],
  category: 'random',
  description: 'País aleatorio (restcountries.com)',
  cooldown: 5,
  async execute(ctx) {
    const data = await requestJson('https://restcountries.com/v3.1/all?fields=name,capital,region,population,flags,languages,currencies', {
      label: 'restcountries',
    });
    const country = pickRandom(data || []);
    if (!country) throw new UserError('❌ No se pudo obtener el país.');
    const caption = [
      `🌍 *${country.name.common}*`,
      '',
      `🏛️ Capital ☇ ${country.capital?.[0] || '—'}`,
      `🗺️ Región ☇ ${country.region}`,
      `👥 Población ☇ ${formatNumber(country.population)}`,
      `🗣️ Idiomas ☇ ${Object.values(country.languages || {}).join(', ') || '—'}`,
      `💰 Moneda ☇ ${Object.values(country.currencies || {}).map((c) => c.name).join(', ') || '—'}`,
      '',
      '_Fuente: restcountries.com_',
    ].join('\n');
    if (country.flags?.png) {
      const { buffer } = await requestBuffer(country.flags.png, { maxBytes: 3 * 1024 * 1024 });
      await ctx.sendImage(buffer, caption);
    } else await ctx.reply(caption);
  },
};

const randomemoji = {
  name: 'randomemoji',
  category: 'random',
  args: '[cantidad]',
  description: 'Emojis aleatorios',
  async execute(ctx) {
    const count = ctx.args[0] ? requireInteger(ctx.args[0], { min: 1, max: 20, name: 'cantidad' }) : 5;
    await ctx.reply(Array.from({ length: count }, () => pickRandom(emojis)).join(' '));
  },
};

export default [randomnumber, randomuser, randomcolor, randomword, randomfact, randomimage, randomquote, randomanime, randomcountry, randomemoji];
