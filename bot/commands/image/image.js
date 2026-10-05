/**
 * Edición de imágenes. Procesamiento local con Jimp (sin binarios nativos).
 * `removebg` usa remove.bg (requiere REMOVE_BG_API_KEY).
 */
import { Jimp } from 'jimp';
import { getKey } from '../../config.js';
import { loadImage, stickerToImage } from '../../lib/media.js';
import { request, requireProvider } from '../../lib/apiClient.js';
import { requireInteger, requireNumber } from '../../lib/validators.js';
import { UserError, ProviderError } from '../../lib/errors.js';
import { formatBytes } from '../../lib/utils.js';

/** Obtiene la imagen de entrada (imagen o sticker). */
const inputImage = async (ctx) => {
  const source = ctx.mediaMessage(['image', 'sticker']);
  if (!source) throw new UserError('❌ Envía o responde a una imagen.');
  let buffer = await ctx.downloadMedia(['image', 'sticker']);
  if (source.mediaType === 'sticker') buffer = await stickerToImage(buffer);
  return loadImage(buffer);
};

/** Crea un comando de edición simple. */
const imageCommand = ({ name, aliases = [], args = '', description, example, apply }) => ({
  name,
  aliases,
  category: 'image',
  args,
  description,
  example,
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 8,
  async execute(ctx) {
    const image = await inputImage(ctx);
    const result = (await apply(image, ctx)) || image;
    const buffer = await result.getBuffer('image/png');
    await ctx.sendImage(buffer, `✅ ${description}`);
  },
});

const resize = imageCommand({
  name: 'resize',
  aliases: ['redimensionar'],
  args: '<ancho> [alto]',
  description: 'Redimensiona una imagen',
  example: 'resize 800 600',
  apply: (image, ctx) => {
    if (!ctx.args[0]) throw new UserError(`❌ Indica el ancho.\n\nUso:\n${ctx.prefix}resize <ancho> [alto]`);
    const width = requireInteger(ctx.args[0], { min: 16, max: 4000, name: 'ancho' });
    const height = ctx.args[1] ? requireInteger(ctx.args[1], { min: 16, max: 4000, name: 'alto' }) : undefined;
    image.resize(height ? { w: width, h: height } : { w: width });
    return image;
  },
});

const crop = imageCommand({
  name: 'crop',
  aliases: ['recortar'],
  args: '[x] [y] [ancho] [alto]',
  description: 'Recorta una imagen (sin argumentos recorta al centro en cuadrado)',
  example: 'crop 0 0 500 500',
  apply: (image, ctx) => {
    if (ctx.args.length >= 4) {
      const [x, y, w, h] = ctx.args.slice(0, 4).map((value, index) =>
        requireInteger(value, { min: 0, max: 10000, name: ['x', 'y', 'ancho', 'alto'][index] }));
      if (x + w > image.bitmap.width || y + h > image.bitmap.height) {
        throw new UserError('❌ El recorte se sale de los límites de la imagen.');
      }
      image.crop({ x, y, w, h });
      return image;
    }
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.crop({
      x: Math.floor((image.bitmap.width - size) / 2),
      y: Math.floor((image.bitmap.height - size) / 2),
      w: size,
      h: size,
    });
    return image;
  },
});

const rotate = imageCommand({
  name: 'rotate',
  aliases: ['rotar'],
  args: '[grados]',
  description: 'Rota una imagen',
  example: 'rotate 90',
  apply: (image, ctx) => {
    const degrees = ctx.args[0] ? requireNumber(ctx.args[0], { min: -360, max: 360, name: 'ángulo' }) : 90;
    image.rotate(degrees);
    return image;
  },
});

const blur = imageCommand({
  name: 'blur',
  aliases: ['desenfocar'],
  args: '[intensidad]',
  description: 'Desenfoca una imagen',
  example: 'blur 8',
  apply: (image, ctx) => {
    const level = ctx.args[0] ? requireInteger(ctx.args[0], { min: 1, max: 40, name: 'intensidad' }) : 6;
    image.blur(level);
    return image;
  },
});

const grayscale = imageCommand({
  name: 'grayscale',
  aliases: ['grises', 'bw'],
  description: 'Convierte la imagen a blanco y negro',
  apply: (image) => image.greyscale(),
});

const invert = imageCommand({
  name: 'invert',
  aliases: ['invertir'],
  description: 'Invierte los colores',
  apply: (image) => image.invert(),
});

const pixel = imageCommand({
  name: 'pixel',
  aliases: ['pixelar'],
  args: '[tamaño]',
  description: 'Pixela la imagen',
  example: 'pixel 12',
  apply: (image, ctx) => {
    const size = ctx.args[0] ? requireInteger(ctx.args[0], { min: 2, max: 60, name: 'tamaño' }) : 10;
    image.pixelate(size);
    return image;
  },
});

const compress = {
  name: 'compress',
  aliases: ['comprimir'],
  category: 'image',
  args: '[calidad]',
  description: 'Comprime una imagen en JPEG',
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 8,
  async execute(ctx) {
    const quality = ctx.args[0] ? requireInteger(ctx.args[0], { min: 10, max: 95, name: 'calidad' }) : 55;
    const image = await inputImage(ctx);
    const original = await image.getBuffer('image/png');
    const buffer = await image.getBuffer('image/jpeg', { quality });
    await ctx.sendImage(
      buffer,
      `🗜️ Comprimida al ${quality}%\n${formatBytes(original.length)} → ${formatBytes(buffer.length)}`,
    );
  },
};

const tojpg = {
  name: 'tojpg',
  aliases: ['jpg', 'tojpeg'],
  category: 'image',
  description: 'Convierte una imagen o sticker a JPG',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    const image = await inputImage(ctx);
    const background = new Jimp({ width: image.bitmap.width, height: image.bitmap.height, color: 0xffffffff });
    background.composite(image, 0, 0);
    const buffer = await background.getBuffer('image/jpeg', { quality: 90 });
    await ctx.sendImage(buffer, '✅ Convertida a JPG');
  },
};

const upscale = {
  name: 'upscale',
  aliases: ['ampliar'],
  category: 'image',
  args: '[factor]',
  description: 'Amplía una imagen (escalado bicúbico local, x2 por defecto)',
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 15,
  async execute(ctx) {
    const factor = ctx.args[0] ? requireNumber(ctx.args[0], { min: 1.5, max: 4, name: 'factor' }) : 2;
    const image = await inputImage(ctx);
    if (image.bitmap.width * factor > 4096) throw new UserError('❌ El resultado sería demasiado grande (máx. 4096 px).');
    image.resize({ w: Math.round(image.bitmap.width * factor) });
    const buffer = await image.getBuffer('image/png');
    await ctx.sendImage(buffer, `🔍 Imagen ampliada x${factor}\n_Escalado local: mejora el tamaño, no inventa detalle._`);
  },
};

const removebg = {
  name: 'removebg',
  aliases: ['quitarfondo'],
  category: 'image',
  description: 'Elimina el fondo de una imagen (requiere REMOVE_BG_API_KEY)',
  premium: true,
  acceptsMedia: true,
  cooldown: 20,
  async execute(ctx) {
    requireProvider('removebg');
    const source = ctx.mediaMessage(['image', 'sticker']);
    if (!source) throw new UserError('❌ Envía o responde a una imagen.');
    let buffer = await ctx.downloadMedia(['image', 'sticker']);
    if (source.mediaType === 'sticker') buffer = await stickerToImage(buffer);

    const form = new FormData();
    form.append('image_file', new Blob([buffer]), 'image.png');
    form.append('size', 'auto');
    const response = await request('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': getKey('REMOVE_BG_API_KEY') },
      body: form,
      timeout: 90_000,
    });
    if (!response.ok) {
      if (response.status === 402) throw new ProviderError('⚠️ La cuenta de remove.bg no tiene créditos disponibles.');
      throw new ProviderError('⚠️ remove.bg no pudo procesar la imagen.');
    }
    const result = Buffer.from(await response.arrayBuffer());
    await ctx.sendImage(result, '✂️ Fondo eliminado (remove.bg)');
  },
};

export default [resize, crop, rotate, blur, grayscale, invert, pixel, compress, tojpg, upscale, removebg];
