/**
 * Voz: texto a voz y efectos vocales.
 *
 * TTS: usa OpenAI (si OPENAI_API_KEY está configurada) o el binario local
 * `espeak-ng` (gratuito, instalable en Termux/Linux). Si no hay ninguno,
 * se devuelve un mensaje controlado.
 */
import fs from 'node:fs';
import { aiSpeech, hasProvider } from '../../lib/apiClient.js';
import { toVoiceNote, hasBinary, runFFmpeg, tempFile, cleanup, writeTemp } from '../../lib/media.js';
import { NotConfiguredError, UserError } from '../../lib/errors.js';
import { requireOption } from '../../lib/validators.js';
import { truncate } from '../../lib/utils.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/** Genera audio a partir de texto con el proveedor disponible. */
const synthesize = async (text, { voice, language = 'es' } = {}) => {
  if (hasProvider('openai')) {
    const selected = voice && OPENAI_VOICES.includes(voice) ? voice : 'alloy';
    const mp3 = await aiSpeech(text, { voice: selected });
    return toVoiceNote(mp3);
  }
  if (await hasBinary('espeak-ng', ['--version'])) {
    const output = tempFile('wav');
    try {
      await execFileAsync('espeak-ng', ['-v', language, '-s', '155', '-w', output, text.slice(0, 1200)], { timeout: 60_000 });
      return await toVoiceNote(fs.readFileSync(output));
    } finally {
      cleanup(output);
    }
  }
  throw new NotConfiguredError(
    'Para texto a voz configura *OPENAI_API_KEY* o instala el motor local gratuito:\n' +
      '`pkg install espeak-ng` (Termux) · `sudo apt install espeak-ng` (Linux)',
  );
};

const tts = {
  name: 'tts',
  aliases: ['hablar'],
  category: 'voice',
  args: '<texto> ',
  description: 'Convierte texto en nota de voz',
  example: 'tts Hola, soy un bot',
  cooldown: 10,
  limit: true,
  async execute(ctx) {
    const text = ctx.text || ctx.quoted?.text;
    if (!text) throw new UserError(`❌ Escribe el texto.\n\nUso:\n${ctx.prefix}tts <texto>`);
    const audio = await synthesize(truncate(text, 1000));
    await ctx.sendAudio(audio, { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
  },
};

const say = {
  name: 'say',
  aliases: ['decir'],
  category: 'voice',
  args: '<texto> [voz]',
  description: `Texto a voz eligiendo voz (${OPENAI_VOICES.join(', ')} con OpenAI)`,
  cooldown: 10,
  limit: true,
  async execute(ctx) {
    const last = ctx.args.at(-1)?.toLowerCase();
    const hasVoice = OPENAI_VOICES.includes(last);
    const voice = hasVoice ? last : undefined;
    const text = (hasVoice ? ctx.args.slice(0, -1).join(' ') : ctx.text) || ctx.quoted?.text;
    if (!text) throw new UserError(`❌ Escribe el texto.\n\nUso:\n${ctx.prefix}say <texto> [voz]`);
    const audio = await synthesize(truncate(text, 1000), { voice });
    await ctx.sendAudio(audio, { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
  },
};

/** Efecto sobre una nota de voz/audio citado, devuelto como nota de voz. */
const voiceEffect = ({ name, aliases = [], description, filter }) => ({
  name,
  aliases,
  category: 'voice',
  description,
  acceptsMedia: true,
  cooldown: 10,
  async execute(ctx) {
    const source = ctx.mediaMessage(['audio', 'video']);
    if (!source) throw new UserError('❌ Responde a una nota de voz o audio.');
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    const output = await toVoiceNote(buffer, ['-af', filter]);
    await ctx.sendAudio(output, { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
  },
});

const robotvoice = voiceEffect({
  name: 'robotvoice',
  aliases: ['robot'],
  description: 'Voz robótica',
  filter: 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75',
});

const deepvoice = voiceEffect({
  name: 'deepvoice',
  aliases: ['grave'],
  description: 'Voz grave',
  filter: 'asetrate=44100*0.78,aresample=44100,atempo=1.28',
});

const chipmunk = voiceEffect({
  name: 'chipmunk',
  aliases: ['ardilla'],
  description: 'Voz de ardilla',
  filter: 'asetrate=44100*1.5,aresample=44100,atempo=0.75',
});

const slowvoice = voiceEffect({
  name: 'slowvoice',
  description: 'Voz lenta',
  filter: 'atempo=0.75',
});

const fastvoice = voiceEffect({
  name: 'fastvoice',
  description: 'Voz rápida',
  filter: 'atempo=1.6',
});

const reversevoice = voiceEffect({
  name: 'reversevoice',
  description: 'Voz al revés',
  filter: 'areverse',
});

const FX = {
  robot: 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75',
  grave: 'asetrate=44100*0.78,aresample=44100,atempo=1.28',
  agudo: 'asetrate=44100*1.4,aresample=44100,atempo=0.8',
  eco: 'aecho=0.8:0.9:500:0.3',
  telefono: 'highpass=f=400,lowpass=f=3000',
  cueva: 'aecho=0.9:0.9:1000|1800:0.5|0.3',
};

const voicefx = {
  name: 'voicefx',
  category: 'voice',
  args: '<efecto>',
  description: `Aplica un efecto a una nota de voz (${Object.keys(FX).join(', ')})`,
  acceptsMedia: true,
  cooldown: 10,
  async execute(ctx) {
    const effectName = requireOption(ctx.args[0], Object.keys(FX), { name: 'Efecto' });
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    const output = await toVoiceNote(buffer, ['-af', FX[effectName]]);
    await ctx.sendAudio(output, { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
  },
};

/** Convierte cualquier audio a nota de voz (útil con los sonidos locales). */
const toptt = {
  name: 'toptt',
  aliases: ['tovn'],
  category: 'voice',
  description: 'Convierte un audio en nota de voz',
  acceptsMedia: true,
  cooldown: 8,
  async execute(ctx) {
    const buffer = await ctx.downloadMedia(['audio', 'video']);
    const input = writeTemp(buffer, 'bin');
    const output = tempFile('ogg');
    try {
      await runFFmpeg(['-i', input, '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', output]);
      await ctx.sendAudio(fs.readFileSync(output), { ptt: true, mimetype: 'audio/ogg; codecs=opus' });
    } finally {
      cleanup(input, output);
    }
  },
};

export default [tts, say, robotvoice, deepvoice, chipmunk, slowvoice, fastvoice, reversevoice, voicefx, toptt];
