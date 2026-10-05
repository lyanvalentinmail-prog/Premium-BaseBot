/**
 * Efectos y conversión de audio con FFmpeg.
 * Acepta audio o vídeo adjunto/citado. Los temporales se borran siempre (lib/media.js).
 */
import { processAudio } from '../../lib/media.js';
import { requireNumber } from '../../lib/validators.js';
import { UserError } from '../../lib/errors.js';

/** Crea un comando de efecto de audio. */
const effect = ({ name, aliases = [], description, filter, args = '', buildFilter, example }) => ({
  name,
  aliases,
  category: 'audio',
  args,
  description,
  acceptsMedia: true,
  skipArgCheck: true,
  cooldown: 10,
  example,
  async execute(ctx) {
    const source = ctx.mediaMessage(['audio', 'video']);
    if (!source) throw new UserError('❌ Responde a un audio (o vídeo) o envíalo con el comando.');
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    await ctx.reply('🎧 Procesando el audio…');
    const filterArgs = buildFilter ? buildFilter(ctx) : ['-af', filter];
    const output = await processAudio(buffer, filterArgs);
    await ctx.sendAudio(output, { mimetype: 'audio/mpeg' });
  },
});

const bass = effect({
  name: 'bass',
  aliases: ['bajos'],
  description: 'Realza los graves',
  filter: 'equalizer=f=54:width_type=o:width=2:g=18',
});

const nightcore = effect({
  name: 'nightcore',
  description: 'Efecto nightcore (más rápido y agudo)',
  filter: 'asetrate=44100*1.25,aresample=44100,atempo=1.06',
});

const slow = effect({
  name: 'slow',
  aliases: ['lento'],
  description: 'Reproduce el audio más lento',
  filter: 'atempo=0.8',
});

const speed = effect({
  name: 'speed',
  aliases: ['rapido'],
  args: '[velocidad]',
  description: 'Acelera el audio (0.5 - 2.0)',
  example: 'speed 1.5',
  buildFilter: (ctx) => {
    const value = ctx.args[0] ? requireNumber(ctx.args[0], { min: 0.5, max: 2, name: 'velocidad' }) : 1.5;
    return ['-af', `atempo=${value}`];
  },
});

const reverseaudio = effect({
  name: 'reverseaudio',
  aliases: ['audioreverso'],
  description: 'Reproduce el audio al revés',
  filter: 'areverse',
});

const volume = effect({
  name: 'volume',
  aliases: ['volumen'],
  args: '[nivel]',
  description: 'Ajusta el volumen (0.1 - 5.0)',
  example: 'volume 2',
  buildFilter: (ctx) => {
    const value = ctx.args[0] ? requireNumber(ctx.args[0], { min: 0.1, max: 5, name: 'nivel' }) : 2;
    return ['-af', `volume=${value}`];
  },
});

const echo = effect({
  name: 'echo',
  aliases: ['eco'],
  description: 'Añade eco',
  filter: 'aecho=0.8:0.88:60:0.4',
});

const reverb = effect({
  name: 'reverb',
  description: 'Añade reverberación',
  filter: 'aecho=0.8:0.9:40|60|90:0.4|0.3|0.2',
});

const trim = {
  name: 'trim',
  aliases: ['cortar'],
  category: 'audio',
  args: '<inicio> <fin>',
  description: 'Recorta un audio (formato mm:ss o segundos)',
  example: 'trim 0:10 0:40',
  acceptsMedia: true,
  cooldown: 10,
  async execute(ctx) {
    const [start, end] = ctx.args;
    if (!start || !end) throw new UserError(`❌ Indica inicio y fin.\n\nUso:\n${ctx.prefix}trim <inicio> <fin>\nEjemplo: ${ctx.prefix}trim 0:10 0:40`);
    const toSeconds = (value) => {
      if (/^\d+$/.test(value)) return Number(value);
      const parts = value.split(':').map(Number);
      if (parts.some(Number.isNaN)) throw new UserError('❌ Formato de tiempo inválido. Usa mm:ss o segundos.');
      return parts.reduce((acc, part) => acc * 60 + part, 0);
    };
    const from = toSeconds(start);
    const to = toSeconds(end);
    if (to <= from) throw new UserError('❌ El tiempo final debe ser mayor que el inicial.');
    if (to - from > 600) throw new UserError('❌ El recorte no puede superar los 10 minutos.');

    const buffer = await ctx.downloadMedia(['audio', 'video']);
    await ctx.reply('✂️ Recortando…');
    const output = await processAudio(buffer, ['-ss', String(from), '-to', String(to)]);
    await ctx.sendAudio(output, { mimetype: 'audio/mpeg' });
  },
};

const mp3 = {
  name: 'mp3',
  aliases: ['toaudio', 'tomp3'],
  category: 'audio',
  description: 'Convierte un vídeo o nota de voz a MP3',
  acceptsMedia: true,
  cooldown: 10,
  async execute(ctx) {
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    await ctx.reply('🎵 Convirtiendo a MP3…');
    const output = await processAudio(buffer, ['-vn', '-b:a', '128k']);
    await ctx.sendDocument(output, `audio-${Date.now()}.mp3`, 'audio/mpeg', '🎵 Audio convertido');
  },
};

export default [bass, nightcore, slow, speed, reverseaudio, volume, echo, reverb, trim, mp3];
