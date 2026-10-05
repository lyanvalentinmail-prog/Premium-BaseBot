/** Creación y conversión de stickers (WebP + metadatos EXIF). */
import config, { getKey } from '../../config.js';
import { toSticker, stickerToImage, stickerToVideo, addStickerMetadata, loadImage } from '../../lib/media.js';
import { requestJson, requestBuffer } from '../../lib/apiClient.js';
import { UserError, NotConfiguredError, ProviderError } from '../../lib/errors.js';
import { formatBytes } from '../../lib/utils.js';

const packFromArgs = (ctx) => {
  const text = ctx.text.trim();
  if (!text) return { pack: config.sticker.pack, author: config.sticker.author };
  const [pack, author] = text.split('|').map((part) => part.trim());
  return { pack: pack || config.sticker.pack, author: author || config.sticker.author };
};

const makeSticker = async (ctx, { crop = false } = {}) => {
  const source = ctx.mediaMessage(['image', 'video', 'sticker']);
  if (!source) throw new UserError('❌ Envía o responde a una imagen, vídeo o sticker.');
  const buffer = await ctx.downloadMedia(['image', 'video', 'sticker']);
  const { pack, author } = packFromArgs(ctx);

  if (source.mediaType === 'sticker') {
    // Reempaquetar: solo cambia la metadata.
    await ctx.sendSticker(addStickerMetadata(buffer, { pack, author }));
    return;
  }
  const animated = source.mediaType === 'video';
  if (animated) {
    const seconds = Number(source.content?.seconds || 0);
    if (seconds > 10) throw new UserError('❌ El vídeo no puede durar más de 10 segundos.');
  }
  const webp = await toSticker(buffer, { animated, pack, author, crop });
  await ctx.sendSticker(webp);
};

const sticker = {
  name: 'sticker',
  aliases: ['s', 'stiker'],
  category: 'sticker',
  args: '[pack | autor]',
  description: 'Convierte imagen/vídeo en sticker',
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 8,
  async execute(ctx) {
    await makeSticker(ctx);
  },
};

const stickercrop = {
  name: 'stickercrop',
  aliases: ['scrop'],
  category: 'sticker',
  description: 'Sticker recortado a cuadrado (sin bordes transparentes)',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    await makeSticker(ctx, { crop: true });
  },
};

const take = {
  name: 'take',
  aliases: ['robar'],
  category: 'sticker',
  args: '<pack | autor>',
  description: 'Cambia el pack/autor de un sticker',
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 8,
  async execute(ctx) {
    const source = ctx.mediaMessage(['sticker']);
    if (!source) throw new UserError('❌ Responde a un sticker.');
    const buffer = await ctx.downloadMedia(['sticker']);
    const { pack, author } = packFromArgs(ctx);
    await ctx.sendSticker(addStickerMetadata(buffer, { pack, author }));
  },
};

const stickerwm = {
  name: 'stickerwm',
  aliases: ['swm'],
  category: 'sticker',
  args: '<pack | autor>',
  description: 'Crea un sticker con pack y autor personalizados',
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 8,
  async execute(ctx) {
    if (!ctx.text.trim()) throw new UserError(`❌ Indica el pack y el autor.\n\nUso:\n${ctx.prefix}stickerwm <pack> | <autor>`);
    await makeSticker(ctx);
  },
};

const toimg = {
  name: 'toimg',
  aliases: ['toimage'],
  category: 'sticker',
  description: 'Convierte un sticker en imagen',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    const source = ctx.mediaMessage(['sticker']);
    if (!source) throw new UserError('❌ Responde a un sticker.');
    const buffer = await ctx.downloadMedia(['sticker']);
    const png = await stickerToImage(buffer);
    await ctx.sendImage(png, '🖼️ Sticker convertido a imagen');
  },
};

const togif = {
  name: 'togif',
  aliases: ['tovideo', 'tomp4'],
  category: 'sticker',
  description: 'Convierte un sticker animado en vídeo',
  acceptsMedia: true,
  cooldown: 10,
  async execute(ctx) {
    const source = ctx.mediaMessage(['sticker']);
    if (!source) throw new UserError('❌ Responde a un sticker animado.');
    if (!source.content?.isAnimated) throw new UserError('❌ Ese sticker no está animado.');
    const buffer = await ctx.downloadMedia(['sticker']);
    const video = await stickerToVideo(buffer);
    await ctx.sock.sendMessage(ctx.chat, { video, gifPlayback: true, caption: '🎞️ Sticker convertido' }, { quoted: ctx.m.raw });
  },
};

const circle = {
  name: 'circle',
  aliases: ['circulo'],
  category: 'sticker',
  description: 'Crea un sticker circular a partir de una imagen',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    const source = ctx.mediaMessage(['image', 'sticker']);
    if (!source) throw new UserError('❌ Envía o responde a una imagen.');
    let buffer = await ctx.downloadMedia(['image', 'sticker']);
    if (source.mediaType === 'sticker') buffer = await stickerToImage(buffer);
    const image = await loadImage(buffer);
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.crop({
      x: Math.floor((image.bitmap.width - size) / 2),
      y: Math.floor((image.bitmap.height - size) / 2),
      w: size,
      h: size,
    });
    image.resize({ w: 512, h: 512 });
    image.circle();
    const webp = await toSticker(await image.getBuffer('image/png'), {
      pack: config.sticker.pack,
      author: config.sticker.author,
    });
    await ctx.sendSticker(webp);
  },
};

const emojimix = {
  name: 'emojimix',
  aliases: ['mixemoji'],
  category: 'sticker',
  args: '<emoji1> <emoji2>',
  description: 'Mezcla dos emojis (Emoji Kitchen vía Tenor, requiere TENOR_API_KEY)',
  example: 'emojimix 😂 🐱',
  cooldown: 10,
  async execute(ctx) {
    const key = getKey('TENOR_API_KEY');
    if (!key) {
      throw new NotConfiguredError('Configura *TENOR_API_KEY* (API oficial de Tenor) para usar Emoji Kitchen.');
    }
    const [first, second] = ctx.text.split(/\s+/).filter(Boolean);
    if (!first || !second) throw new UserError(`❌ Indica dos emojis.\n\nUso:\n${ctx.prefix}emojimix 😂 🐱`);
    const data = await requestJson(
      `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(key)}&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v6&q=${encodeURIComponent(`${first}_${second}`)}`,
      { label: 'tenor' },
    );
    const url = data?.results?.[0]?.media_formats?.png_transparent?.url;
    if (!url) throw new ProviderError('⚠️ Esa combinación de emojis no está disponible.');
    const { buffer } = await requestBuffer(url, { maxBytes: 5 * 1024 * 1024 });
    const webp = await toSticker(buffer, { pack: config.sticker.pack, author: config.sticker.author });
    await ctx.sendSticker(webp);
  },
};

/** Lee el bloque EXIF de un WebP para mostrar la información del pack. */
const readStickerExif = (buffer) => {
  if (buffer.slice(0, 4).toString() !== 'RIFF') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.slice(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const data = buffer.slice(offset + 8, offset + 8 + size);
    if (type === 'EXIF') {
      const start = data.indexOf(Buffer.from('{'));
      if (start >= 0) {
        try {
          return JSON.parse(data.slice(start).toString('utf8'));
        } catch {
          return null;
        }
      }
    }
    offset += 8 + size + (size % 2);
  }
  return null;
};

const stickerinfo = {
  name: 'stickerinfo',
  aliases: ['sinfo'],
  category: 'sticker',
  description: 'Muestra la información de un sticker',
  acceptsMedia: true,
  cooldown: 5,
  async execute(ctx) {
    const source = ctx.mediaMessage(['sticker']);
    if (!source) throw new UserError('❌ Responde a un sticker.');
    const buffer = await ctx.downloadMedia(['sticker']);
    const exif = readStickerExif(buffer);
    await ctx.reply(
      [
        '◩ *INFORMACIÓN DEL STICKER*',
        '',
        `📦 Pack ☇ ${exif?.['sticker-pack-name'] || '—'}`,
        `✍️ Autor ☇ ${exif?.['sticker-pack-publisher'] || '—'}`,
        `🎞️ Animado ☇ ${source.content?.isAnimated ? 'sí' : 'no'}`,
        `📏 Tamaño ☇ ${formatBytes(buffer.length)}`,
        `😀 Emojis ☇ ${(exif?.emojis || []).join(' ') || '—'}`,
      ].join('\n'),
    );
  },
};

export default [sticker, stickercrop, take, stickerwm, toimg, togif, circle, emojimix, stickerinfo];
