/**
 * Sonidos locales.
 * Los audios se leen de `assets/sounds/` (coloca ahí tus .mp3/.ogg/.wav).
 * El repositorio no incluye audios con copyright: añade los tuyos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../config.js';
import { runFFmpeg, tempFile, cleanup, probe, writeTemp } from '../../lib/media.js';
import { requireNumber } from '../../lib/validators.js';
import { UserError } from '../../lib/errors.js';
import { formatBytes, formatDuration } from '../../lib/utils.js';

const AUDIO_EXT = ['.mp3', '.ogg', '.wav', '.m4a', '.opus'];

const listSounds = () => {
  try {
    return fs
      .readdirSync(paths.sounds)
      .filter((file) => AUDIO_EXT.includes(path.extname(file).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
};

const sounds = {
  name: 'sounds',
  aliases: ['soundlist', 'listasonidos'],
  category: 'sound',
  description: 'Lista los sonidos disponibles',
  async execute(ctx) {
    const files = listSounds();
    if (!files.length) {
      throw new UserError(
        `📁 No hay sonidos todavía.\n\nAñade archivos de audio en *assets/sounds/* y vuelve a intentarlo.\nLuego úsalos con *${ctx.prefix}sound <nombre>*.`,
      );
    }
    await ctx.reply(
      [
        `♪ *SONIDOS DISPONIBLES* (${files.length})`,
        '',
        ...files.map((file) => `• ${path.basename(file, path.extname(file))}`),
        '',
        `Uso: ${ctx.prefix}sound <nombre>`,
      ].join('\n'),
    );
  },
};

const sound = {
  name: 'sound',
  aliases: ['sonido'],
  category: 'sound',
  args: '<nombre>',
  description: 'Reproduce un sonido de assets/sounds',
  example: 'sound aplausos',
  cooldown: 5,
  async execute(ctx) {
    const files = listSounds();
    if (!files.length) {
      throw new UserError(`📁 No hay sonidos en *assets/sounds/*. Añade tus propios audios para usar este comando.`);
    }
    const query = ctx.text.toLowerCase();
    const match = files.find((file) => path.basename(file, path.extname(file)).toLowerCase() === query)
      || files.find((file) => file.toLowerCase().includes(query));
    if (!match) throw new UserError(`❌ No existe el sonido *${ctx.text}*. Usa *${ctx.prefix}sounds* para ver la lista.`);
    const file = path.join(paths.sounds, match);
    await ctx.sendAudio(fs.readFileSync(file), { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
  },
};

const beep = {
  name: 'beep',
  aliases: ['tono'],
  category: 'sound',
  args: '[frecuencia] [segundos]',
  description: 'Genera un tono con FFmpeg',
  example: 'beep 440 2',
  cooldown: 5,
  async execute(ctx) {
    const frequency = ctx.args[0] ? requireNumber(ctx.args[0], { min: 50, max: 15000, name: 'frecuencia' }) : 440;
    const duration = ctx.args[1] ? requireNumber(ctx.args[1], { min: 0.2, max: 10, name: 'duración' }) : 1;
    const output = tempFile('mp3');
    try {
      await runFFmpeg(['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`, '-c:a', 'libmp3lame', output]);
      await ctx.sendAudio(fs.readFileSync(output), { mimetype: 'audio/mpeg' });
    } finally {
      cleanup(output);
    }
  },
};

const soundinfo = {
  name: 'soundinfo',
  aliases: ['audioinfo'],
  category: 'sound',
  description: 'Información técnica de un audio citado',
  acceptsMedia: true,
  cooldown: 5,
  async execute(ctx) {
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    const file = writeTemp(buffer, 'bin');
    try {
      const info = await probe(file);
      await ctx.reply(
        [
          '♪ *INFORMACIÓN DEL AUDIO*',
          '',
          `📏 Tamaño ☇ ${formatBytes(buffer.length)}`,
          `⏱️ Duración ☇ ${info?.duration ? formatDuration(info.duration) : 'desconocida (ffprobe no disponible)'}`,
          `🎚️ Bitrate ☇ ${info?.bitrate ? `${Math.round(info.bitrate / 1000)} kbps` : '—'}`,
        ].join('\n'),
      );
    } finally {
      cleanup(file);
    }
  },
};

export default [sounds, sound, beep, soundinfo];
