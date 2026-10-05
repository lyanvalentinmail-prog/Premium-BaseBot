/**
 * Comandos de IA.
 * Toda la comunicación con los proveedores pasa por lib/apiClient.js:
 * aquí no hay fetch ni claves. Si no hay proveedor configurado se devuelve
 * "⚠️ Este servicio no está configurado." sin revelar nombres de secretos.
 */
import { aiComplete, aiImage } from '../../lib/apiClient.js';
import { UserError } from '../../lib/errors.js';
import { truncate } from '../../lib/utils.js';

/** Helper para crear comandos de texto con IA. */
const aiTextCommand = ({ name, aliases = [], args, description, system, premium = false, limit = true, transform, example }) => ({
  name,
  aliases,
  category: 'ai',
  args,
  description,
  premium,
  limit,
  example,
  cooldown: 5,
  async execute(ctx) {
    const prompt = transform ? transform(ctx) : ctx.text;
    if (!prompt?.trim()) {
      throw new UserError(`❌ Falta un argumento obligatorio.\n\nUso:\n${ctx.prefix}${name} ${args}`);
    }
    await ctx.sendTyping();
    const answer = await aiComplete(prompt, { system, maxTokens: 900 });
    await ctx.reply(truncate(answer, 4000));
  },
});

const chat = aiTextCommand({
  name: 'chat',
  aliases: ['ia'],
  args: '<mensaje>',
  description: 'Conversa con la IA',
  system: 'Eres un asistente de WhatsApp amable y conciso. Responde en el idioma del usuario.',
  example: 'chat ¿qué puedo cocinar con arroz y huevos?',
});

const ask = aiTextCommand({
  name: 'ask',
  aliases: ['pregunta'],
  args: '<pregunta>',
  description: 'Pregunta directa a la IA',
  system: 'Responde de forma breve, precisa y verificable. Si no lo sabes, dilo.',
});

const summarize = aiTextCommand({
  name: 'summarize',
  aliases: ['resumir'],
  args: '<texto>',
  description: 'Resume un texto (también funciona citando un mensaje)',
  system: 'Resume el texto en 5 puntos clave como máximo, en el idioma original.',
  transform: (ctx) => ctx.text || ctx.quoted?.text || '',
});

const rewrite = aiTextCommand({
  name: 'rewrite',
  aliases: ['reescribir'],
  args: '<texto>',
  description: 'Reescribe un texto con mejor estilo',
  system: 'Reescribe el texto mejorando claridad y estilo, conservando el significado y el idioma.',
  transform: (ctx) => ctx.text || ctx.quoted?.text || '',
});

const grammar = aiTextCommand({
  name: 'grammar',
  aliases: ['ortografia'],
  args: '<texto>',
  description: 'Corrige ortografía y gramática',
  limit: false,
  system: 'Corrige la ortografía y gramática. Devuelve solo el texto corregido y, debajo, una lista breve de los cambios.',
  transform: (ctx) => ctx.text || ctx.quoted?.text || '',
});

const explain = aiTextCommand({
  name: 'explain',
  aliases: ['explicar'],
  args: '<tema>',
  description: 'Explica un tema de forma sencilla',
  system: 'Explica el tema de forma clara y sencilla, con un ejemplo práctico. Máximo 250 palabras.',
});

const code = aiTextCommand({
  name: 'code',
  aliases: ['codigo'],
  args: '<peticion>',
  description: 'Genera código a partir de una descripción',
  premium: true,
  limit: false,
  system: 'Eres un programador experto. Devuelve código correcto y comentado dentro de un bloque de código, con una explicación breve al final.',
});

const prompt = aiTextCommand({
  name: 'prompt',
  args: '<idea>',
  description: 'Convierte una idea en un prompt detallado para IA de imágenes',
  premium: true,
  limit: false,
  system: 'Convierte la idea del usuario en un prompt detallado en inglés para un generador de imágenes: sujeto, estilo, iluminación, encuadre y calidad.',
});

const translateai = {
  name: 'translateai',
  aliases: ['tria'],
  category: 'ai',
  args: '<idioma> <texto>',
  description: 'Traduce usando IA',
  limit: true,
  example: 'translateai en Hola, ¿cómo estás?',
  cooldown: 5,
  async execute(ctx) {
    const target = ctx.args[0];
    const text = ctx.args.slice(1).join(' ') || ctx.quoted?.text;
    if (!text) throw new UserError(`❌ Falta el texto.\n\nUso:\n${ctx.prefix}translateai <idioma> <texto>`);
    const answer = await aiComplete(text, {
      system: `Traduce el texto del usuario al idioma "${target}". Devuelve únicamente la traducción.`,
      temperature: 0.2,
    });
    await ctx.reply(`🌐 *${target}:*\n${truncate(answer, 3500)}`);
  },
};

const imagine = {
  name: 'imagine',
  aliases: ['imagina', 'dalle'],
  category: 'ai',
  args: '<prompt>',
  description: 'Genera una imagen con IA',
  premium: true,
  cooldown: 20,
  example: 'imagine un gato astronauta estilo acuarela',
  async execute(ctx) {
    await ctx.reply('🎨 Generando la imagen, esto puede tardar un poco…');
    const buffer = await aiImage(ctx.text);
    await ctx.sendImage(buffer, `🎨 *${truncate(ctx.text, 300)}*`);
  },
};

export default [chat, ask, summarize, rewrite, grammar, explain, code, prompt, translateai, imagine];
