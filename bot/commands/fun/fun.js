/** Diversión: generado localmente, sin depender de APIs externas. */
import { pickRandom, seededPercent, jidToNumber, progressBar } from '../../lib/utils.js';
import { jokes, roasts, truths, dares, eightBall } from '../../lib/data/quotes.js';
import { requestBuffer, requestJson } from '../../lib/apiClient.js';
import { UserError, UsageError } from '../../lib/errors.js';

const joke = {
  name: 'joke',
  aliases: ['chiste'],
  category: 'fun',
  description: 'Un chiste aleatorio',
  async execute(ctx) {
    await ctx.reply(`😂 ${pickRandom(jokes)}`);
  },
};

const meme = {
  name: 'meme',
  aliases: ['memes'],
  category: 'fun',
  args: '[tema]',
  description: 'Un meme aleatorio de Reddit (API pública meme-api.com)',
  cooldown: 5,
  async execute(ctx) {
    const topic = ctx.args[0]?.replace(/[^a-zA-Z0-9_]/g, '');
    const url = topic ? `https://meme-api.com/gimme/${topic}` : 'https://meme-api.com/gimme';
    const data = await requestJson(url, { label: 'meme-api' });
    if (!data?.url) throw new UserError('❌ No se encontró ningún meme para ese tema.');
    const { buffer } = await requestBuffer(data.url, { maxBytes: 10 * 1024 * 1024, label: 'meme-image' });
    await ctx.sendImage(buffer, `🎭 *${data.title}*\n📍 r/${data.subreddit} · 👍 ${data.ups ?? 0}`);
  },
};

const ship = {
  name: 'ship',
  aliases: ['amor'],
  category: 'fun',
  args: '<@usuario1> <@usuario2>',
  description: 'Calcula la compatibilidad entre dos personas',
  skipArgCheck: true,
  async execute(ctx) {
    let [a, b] = ctx.mentions;
    if (!a) {
      if (ctx.args.length < 2 && !ctx.quoted) {
        throw new UsageError(`❌ Falta un argumento obligatorio.\n\nUso:\n${ctx.prefix}ship <@usuario1> <@usuario2>`);
      }
      a = ctx.sender;
      b = ctx.quoted?.sender;
    }
    if (!b) b = ctx.sender === a ? ctx.chat : ctx.sender;
    const key = [a, b].sort().join('|');
    const percent = seededPercent(key);
    const verdict =
      percent > 85 ? '💞 ¡Almas gemelas!' : percent > 60 ? '💘 Hay mucha química.' : percent > 35 ? '💛 Podría funcionar.' : '💔 Mejor como amigos.';
    await ctx.reply({
      text: `💗 *SHIP*\n\n@${jidToNumber(a)} ❤️ @${jidToNumber(b)}\n\n${progressBar(percent, 100)}\n${verdict}`,
      mentions: [a, b].filter(Boolean),
    });
  },
};

const rate = {
  name: 'rate',
  aliases: ['puntua'],
  category: 'fun',
  args: '<texto/@usuario>',
  description: 'Puntúa algo o a alguien del 0 al 10',
  skipArgCheck: true,
  async execute(ctx) {
    const target = ctx.mentions[0];
    const subject = target ? `@${jidToNumber(target)}` : ctx.text;
    if (!subject) throw new UsageError(`❌ Falta un argumento obligatorio.\n\nUso:\n${ctx.prefix}rate <texto/@usuario>`);
    const score = (seededPercent(subject.toLowerCase()) / 10).toFixed(1);
    await ctx.reply({ text: `⭐ ${subject} obtiene un *${score}/10*`, mentions: target ? [target] : [] });
  },
};

const eightball = {
  name: '8ball',
  aliases: ['bola8', 'bola'],
  category: 'fun',
  args: '<pregunta>',
  description: 'La bola mágica responde a tu pregunta',
  async execute(ctx) {
    await ctx.reply(`🎱 *Pregunta:* ${ctx.text}\n*Respuesta:* ${pickRandom(eightBall)}`);
  },
};

const dare = {
  name: 'dare',
  aliases: ['reto'],
  category: 'fun',
  args: '[@usuario]',
  description: 'Un reto para ti o para alguien',
  async execute(ctx) {
    const target = ctx.mentions[0];
    await ctx.reply({
      text: `🔥 *RETO* ${target ? `para @${jidToNumber(target)}` : ''}\n\n${pickRandom(dares)}`,
      mentions: target ? [target] : [],
    });
  },
};

const truth = {
  name: 'truth',
  aliases: ['verdad'],
  category: 'fun',
  args: '[@usuario]',
  description: 'Una pregunta de "verdad"',
  async execute(ctx) {
    const target = ctx.mentions[0];
    await ctx.reply({
      text: `💭 *VERDAD* ${target ? `para @${jidToNumber(target)}` : ''}\n\n${pickRandom(truths)}`,
      mentions: target ? [target] : [],
    });
  },
};

const roast = {
  name: 'roast',
  aliases: ['insulta'],
  category: 'fun',
  args: '<@usuario>',
  description: 'Una burla graciosa (sin pasarse)',
  skipArgCheck: true,
  async execute(ctx) {
    const target = ctx.mentions[0] || ctx.quoted?.sender;
    if (!target) throw new UsageError(`❌ Menciona a alguien.\n\nUso:\n${ctx.prefix}roast <@usuario>`);
    await ctx.reply({ text: `🔥 @${jidToNumber(target)}, ${pickRandom(roasts)}`, mentions: [target] });
  },
};

const choose = {
  name: 'choose',
  aliases: ['elige'],
  category: 'fun',
  args: '<a | b | c>',
  description: 'Elige una opción al azar',
  async execute(ctx) {
    const options = ctx.text.split('|').map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new UsageError(`❌ Indica al menos dos opciones separadas por |.\n\nUso:\n${ctx.prefix}choose pizza | sushi | tacos`);
    }
    await ctx.reply(`🤔 Yo elijo: *${pickRandom(options)}*`);
  },
};

const reverse = {
  name: 'reverse',
  aliases: ['alreves'],
  category: 'fun',
  args: '<texto>',
  description: 'Invierte un texto',
  async execute(ctx) {
    await ctx.reply(`🔄 ${[...ctx.text].reverse().join('')}`);
  },
};

export default [joke, meme, ship, rate, eightball, dare, truth, roast, choose, reverse];
