/** Generadores gráficos locales (Jimp): logos, banners, carteles y marcas de agua. */
import { Jimp } from 'jimp';
import { gradientImage, drawCenteredText, parseColor, getFont } from '../../lib/imageMaker.js';
import { loadImage, stickerToImage } from '../../lib/media.js';
import { requestBuffer } from '../../lib/apiClient.js';
import { UserError } from '../../lib/errors.js';
import { pickRandom, truncate, jidToNumber } from '../../lib/utils.js';

const PALETTES = [
  ['#ff6b6b', '#556270'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
  ['#f093fb', '#f5576c'],
];

const logo = {
  name: 'logo',
  category: 'maker',
  args: '<texto>',
  description: 'Crea un logo con degradado',
  example: 'logo Mi Marca',
  cooldown: 8,
  async execute(ctx) {
    const [a, b] = pickRandom(PALETTES);
    const image = gradientImage(800, 800, parseColor(a), parseColor(b), true);
    await drawCenteredText(image, truncate(ctx.text.toUpperCase(), 40), { white: true });
    await ctx.sendImage(await image.getBuffer('image/png'), `✎ Logo: *${truncate(ctx.text, 60)}*`);
  },
};

const textlogo = {
  name: 'textlogo',
  category: 'maker',
  args: '<texto>',
  description: 'Logo de texto sobre fondo oscuro',
  cooldown: 8,
  async execute(ctx) {
    const image = new Jimp({ width: 1000, height: 500, color: parseColor('#111827') });
    await drawCenteredText(image, truncate(ctx.text, 40), { white: true });
    await ctx.sendImage(await image.getBuffer('image/png'), `✎ ${truncate(ctx.text, 60)}`);
  },
};

const banner = {
  name: 'banner',
  category: 'maker',
  args: '<texto>',
  description: 'Crea un banner horizontal',
  cooldown: 8,
  async execute(ctx) {
    const [a, b] = pickRandom(PALETTES);
    const image = gradientImage(1280, 420, parseColor(a), parseColor(b));
    await drawCenteredText(image, truncate(ctx.text, 50), { white: true });
    await ctx.sendImage(await image.getBuffer('image/png'), `✎ Banner: *${truncate(ctx.text, 60)}*`);
  },
};

const poster = {
  name: 'poster',
  aliases: ['cartel'],
  category: 'maker',
  args: '<texto>',
  description: 'Cartel vertical con el texto indicado',
  cooldown: 8,
  async execute(ctx) {
    const [a, b] = pickRandom(PALETTES);
    const image = gradientImage(800, 1200, parseColor(a), parseColor(b), true);
    const overlay = new Jimp({ width: 720, height: 1120, color: 0x00000066 });
    image.composite(overlay, 40, 40);
    await drawCenteredText(image, truncate(ctx.text.toUpperCase(), 60), { white: true, y: 480 });
    await ctx.sendImage(await image.getBuffer('image/png'), `✎ Cartel: *${truncate(ctx.text, 60)}*`);
  },
};

const neon = {
  name: 'neon',
  category: 'maker',
  args: '<texto>',
  description: 'Texto con efecto neón',
  cooldown: 8,
  async execute(ctx) {
    const text = truncate(ctx.text.toUpperCase(), 30);
    const base = new Jimp({ width: 1000, height: 500, color: parseColor('#05010f') });
    const glow = new Jimp({ width: 1000, height: 500, color: 0x00000000 });
    await drawCenteredText(glow, text, { white: true });
    const colored = glow.clone();
    colored.color([{ apply: 'mix', params: ['#00e5ff', 70] }]);
    const blurred = colored.clone().blur(12);
    base.composite(blurred, 0, 0);
    base.composite(colored, 0, 0);
    await ctx.sendImage(await base.getBuffer('image/png'), `✨ Neón: *${truncate(ctx.text, 60)}*`);
  },
};

const quoteimg = {
  name: 'quoteimg',
  aliases: ['frasefoto'],
  category: 'maker',
  args: '<frase>',
  description: 'Convierte una frase en imagen',
  cooldown: 8,
  async execute(ctx) {
    const text = ctx.text || ctx.quoted?.text;
    if (!text) throw new UserError(`❌ Escribe la frase.\n\nUso:\n${ctx.prefix}quoteimg <frase>`);
    const image = new Jimp({ width: 1000, height: 1000, color: parseColor('#0f172a') });
    const font = await getFont('SANS_32_WHITE');
    image.print({ font, x: 80, y: 300, text: `“${truncate(text, 280)}”`, maxWidth: 840 });
    const small = await getFont('SANS_16_WHITE');
    image.print({ font: small, x: 80, y: 880, text: `— ${ctx.pushName}`, maxWidth: 840 });
    await ctx.sendImage(await image.getBuffer('image/png'), '❝ Frase generada');
  },
};

const gradient = {
  name: 'gradient',
  aliases: ['degradado'],
  category: 'maker',
  args: '<color1> <color2>',
  description: 'Genera un degradado entre dos colores',
  example: 'gradient #ff0000 #0000ff',
  cooldown: 5,
  async execute(ctx) {
    const image = gradientImage(1000, 600, parseColor(ctx.args[0]), parseColor(ctx.args[1]));
    await ctx.sendImage(await image.getBuffer('image/png'), `🎨 ${ctx.args[0]} → ${ctx.args[1]}`);
  },
};

const avatar = {
  name: 'avatar',
  aliases: ['pfp', 'foto'],
  category: 'maker',
  args: '[@usuario]',
  description: 'Obtiene la foto de perfil de un usuario',
  cooldown: 8,
  async execute(ctx) {
    const target = ctx.targetJid({ fallbackSelf: true }) || ctx.sender;
    let url = null;
    try {
      url = await ctx.sock.profilePictureUrl(target, 'image');
    } catch {
      url = null;
    }
    if (!url) throw new UserError('❌ Ese usuario no tiene foto de perfil pública.');
    const { buffer } = await requestBuffer(url, { maxBytes: 8 * 1024 * 1024 });
    await ctx.reply({ image: buffer, caption: `🖼️ Foto de perfil de @${jidToNumber(target)}`, mentions: [target] });
  },
};

const watermark = {
  name: 'watermark',
  aliases: ['marcaagua'],
  category: 'maker',
  args: '<texto>',
  description: 'Añade una marca de agua a una imagen',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    const text = ctx.text;
    if (!text) throw new UserError(`❌ Escribe el texto.\n\nUso:\n${ctx.prefix}watermark <texto>`);
    const source = ctx.mediaMessage(['image', 'sticker']);
    if (!source) throw new UserError('❌ Envía o responde a una imagen.');
    let buffer = await ctx.downloadMedia(['image', 'sticker']);
    if (source.mediaType === 'sticker') buffer = await stickerToImage(buffer);
    const image = await loadImage(buffer);
    const font = await getFont(image.bitmap.width > 700 ? 'SANS_32_WHITE' : 'SANS_16_WHITE');
    image.print({
      font,
      x: 20,
      y: image.bitmap.height - (image.bitmap.width > 700 ? 60 : 36),
      text: truncate(text, 60),
      maxWidth: image.bitmap.width - 40,
    });
    await ctx.sendImage(await image.getBuffer('image/png'), '💧 Marca de agua aplicada');
  },
};

export default [logo, textlogo, banner, poster, neon, quoteimg, gradient, avatar, watermark];
