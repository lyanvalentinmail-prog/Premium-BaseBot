/** Frases y citas (colección local, sin dependencias externas). */
import * as quotes from '../../lib/data/quotes.js';
import { pickRandom } from '../../lib/utils.js';

const quoteCommand = ({ name, aliases = [], description, collection, emoji }) => ({
  name,
  aliases,
  category: 'quotes',
  description,
  async execute(ctx) {
    const quote = pickRandom(collection);
    await ctx.reply(`${emoji} _"${quote.text}"_\n\n— *${quote.author}*`);
  },
});

const quote = quoteCommand({ name: 'quote', aliases: ['frase'], description: 'Una frase aleatoria', collection: quotes.general, emoji: '❝' });
const lovequote = quoteCommand({ name: 'lovequote', aliases: ['fraseamor'], description: 'Frase de amor', collection: quotes.love, emoji: '💗' });
const sadquote = quoteCommand({ name: 'sadquote', aliases: ['frasetriste'], description: 'Frase triste', collection: quotes.sad, emoji: '💔' });
const motivation = quoteCommand({ name: 'motivation', aliases: ['motivacion'], description: 'Frase motivacional', collection: quotes.motivation, emoji: '🔥' });
const lifequote = quoteCommand({ name: 'lifequote', aliases: ['frasevida'], description: 'Frase sobre la vida', collection: quotes.life, emoji: '🌱' });
const successquote = quoteCommand({ name: 'successquote', aliases: ['fraseexito'], description: 'Frase sobre el éxito', collection: quotes.success, emoji: '🏆' });
const friendquote = quoteCommand({ name: 'friendquote', aliases: ['fraseamistad'], description: 'Frase sobre la amistad', collection: quotes.friendship, emoji: '🤝' });
const wisdom = quoteCommand({ name: 'wisdom', aliases: ['sabiduria'], description: 'Frase de sabiduría', collection: quotes.wisdom, emoji: '🦉' });

const dailyquote = {
  name: 'dailyquote',
  aliases: ['frasedia'],
  category: 'quotes',
  description: 'La frase del día (igual para todos durante 24 h)',
  async execute(ctx) {
    const all = [...quotes.general, ...quotes.motivation, ...quotes.wisdom, ...quotes.life];
    const day = Math.floor(Date.now() / 86_400_000);
    const quote = all[day % all.length];
    await ctx.reply(`📅 *FRASE DEL DÍA*\n\n❝ _"${quote.text}"_\n\n— *${quote.author}*`);
  },
};

export default [quote, lovequote, sadquote, motivation, lifequote, successquote, friendquote, wisdom, dailyquote];
