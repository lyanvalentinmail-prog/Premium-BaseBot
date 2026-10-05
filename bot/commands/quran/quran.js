/**
 * Corán. Fuente: AlQuran Cloud API (https://alquran.cloud/api), pública y documentada.
 * No se generan ni inventan traducciones: todo el texto procede de la API.
 */
import { requestJson, requestBuffer } from '../../lib/apiClient.js';
import { getSetting, setSetting } from '../../database/settings.js';
import { UserError } from '../../lib/errors.js';
import { requireInteger } from '../../lib/validators.js';
import { truncate, randomInt } from '../../lib/utils.js';

const API = 'https://api.alquran.cloud/v1';
const DEFAULT_TRANSLATION = 'es.garcia';
const AUDIO_EDITION = 'ar.alafasy';
const TAFSIR_EDITION = 'ar.muyassar';

const translationEdition = () => getSetting('quranTranslation', DEFAULT_TRANSLATION);

const quran = {
  name: 'quran',
  category: 'quran',
  description: 'Índice y ayuda del módulo del Corán',
  async execute(ctx) {
    const data = await requestJson(`${API}/meta`, { label: 'alquran' });
    const surahs = data?.data?.surahs?.references || [];
    await ctx.reply(
      [
        '۞ *EL CORÁN*',
        '',
        `📖 Suras ☇ ${surahs.length}`,
        `📜 Aleyas ☇ ${data?.data?.ayahs?.count ?? '—'}`,
        `🧭 Juz ☇ ${Object.keys(data?.data?.juzs?.references || {}).length || 30}`,
        `🌐 Traducción ☇ ${translationEdition()}`,
        '',
        `• ${ctx.prefix}surah <número/nombre>`,
        `• ${ctx.prefix}ayah <sura> <aleya>`,
        `• ${ctx.prefix}tafsir <sura> <aleya>`,
        `• ${ctx.prefix}quransearch <texto>`,
        `• ${ctx.prefix}randomayah`,
        `• ${ctx.prefix}quranaudio <sura> [aleya]`,
        `• ${ctx.prefix}juz <número>`,
        '',
        '_Fuente: alquran.cloud_',
      ].join('\n'),
    );
  },
};

const findSurahNumber = async (input) => {
  if (/^\d+$/.test(input)) {
    const number = Number(input);
    if (number < 1 || number > 114) throw new UserError('❌ El número de sura debe estar entre 1 y 114.');
    return number;
  }
  const meta = await requestJson(`${API}/meta`, { label: 'alquran' });
  const list = meta?.data?.surahs?.references || [];
  const found = list.find(
    (surah) =>
      surah.englishName.toLowerCase().includes(input.toLowerCase()) ||
      surah.name.includes(input) ||
      surah.englishNameTranslation.toLowerCase().includes(input.toLowerCase()),
  );
  if (!found) throw new UserError(`❌ No se encontró la sura *${input}*.`);
  return found.number;
};

const surah = {
  name: 'surah',
  aliases: ['sura'],
  category: 'quran',
  args: '<numero/nombre>',
  description: 'Información y primeras aleyas de una sura',
  example: 'surah 1',
  cooldown: 5,
  async execute(ctx) {
    const number = await findSurahNumber(ctx.text.trim());
    const data = await requestJson(`${API}/surah/${number}/${translationEdition()}`, { label: 'alquran' });
    const info = data?.data;
    if (!info) throw new UserError('❌ No se pudo obtener la sura.');
    const ayahs = info.ayahs.slice(0, 7);
    await ctx.reply(
      [
        `۞ *${info.number}. ${info.englishName}* (${info.name})`,
        `📝 ${info.englishNameTranslation} · ${info.revelationType} · ${info.numberOfAyahs} aleyas`,
        '',
        ...ayahs.map((ayah) => `*${ayah.numberInSurah}.* ${ayah.text}`),
        info.ayahs.length > 7 ? `\n_… y ${info.ayahs.length - 7} aleyas más. Usa ${ctx.prefix}ayah ${info.number} <n>_` : '',
        '',
        `_Traducción: ${translationEdition()} · Fuente: alquran.cloud_`,
      ].filter(Boolean).join('\n'),
    );
  },
};

const ayah = {
  name: 'ayah',
  aliases: ['aleya'],
  category: 'quran',
  args: '<sura> <aleya>',
  description: 'Muestra una aleya concreta (árabe + traducción)',
  example: 'ayah 2 255',
  cooldown: 5,
  async execute(ctx) {
    const surahNumber = await findSurahNumber(ctx.args[0]);
    const ayahNumber = requireInteger(ctx.args[1], { min: 1, max: 300, name: 'número de aleya' });
    const data = await requestJson(
      `${API}/ayah/${surahNumber}:${ayahNumber}/editions/quran-uthmani,${translationEdition()}`,
      { label: 'alquran' },
    );
    const [arabic, translated] = data?.data || [];
    if (!arabic) throw new UserError('❌ No se encontró esa aleya.');
    await ctx.reply(
      [
        `۞ *${arabic.surah.englishName} ${surahNumber}:${ayahNumber}*`,
        '',
        arabic.text,
        '',
        translated?.text ? `📖 ${translated.text}` : '',
        '',
        `_Traducción: ${translationEdition()} · Fuente: alquran.cloud_`,
      ].filter(Boolean).join('\n'),
    );
  },
};

const tafsir = {
  name: 'tafsir',
  category: 'quran',
  args: '<sura> <aleya>',
  description: 'Tafsir (exégesis) de una aleya — edición Al-Muyassar (árabe)',
  example: 'tafsir 1 1',
  cooldown: 5,
  async execute(ctx) {
    const surahNumber = await findSurahNumber(ctx.args[0]);
    const ayahNumber = requireInteger(ctx.args[1], { min: 1, max: 300, name: 'número de aleya' });
    const data = await requestJson(`${API}/ayah/${surahNumber}:${ayahNumber}/${TAFSIR_EDITION}`, { label: 'alquran' });
    const item = data?.data;
    if (!item?.text) throw new UserError('❌ No hay tafsir disponible para esa aleya.');
    await ctx.reply(
      [
        `۞ *TAFSIR ${surahNumber}:${ayahNumber}* (${TAFSIR_EDITION})`,
        '',
        truncate(item.text, 3000),
        '',
        '_Fuente: alquran.cloud_',
      ].join('\n'),
    );
  },
};

const quransearch = {
  name: 'quransearch',
  category: 'quran',
  args: '<texto>',
  description: 'Busca un texto en el Corán',
  example: 'quransearch misericordia',
  cooldown: 8,
  async execute(ctx) {
    const data = await requestJson(
      `${API}/search/${encodeURIComponent(ctx.text)}/all/${translationEdition()}`,
      { label: 'alquran' },
    ).catch(() => null);
    const matches = data?.data?.matches || [];
    if (!matches.length) throw new UserError('❌ No se encontraron resultados.');
    await ctx.reply(
      [
        `🔎 *RESULTADOS PARA "${ctx.text}"* (${data.data.count})`,
        '',
        ...matches.slice(0, 5).map((match) => `*${match.surah.englishName} ${match.surah.number}:${match.numberInSurah}*\n${truncate(match.text, 300)}`),
        '',
        '_Fuente: alquran.cloud_',
      ].join('\n\n'),
    );
  },
};

const randomayah = {
  name: 'randomayah',
  aliases: ['aleyaaleatoria'],
  category: 'quran',
  description: 'Una aleya aleatoria',
  cooldown: 5,
  async execute(ctx) {
    const number = randomInt(1, 6236);
    const data = await requestJson(`${API}/ayah/${number}/editions/quran-uthmani,${translationEdition()}`, { label: 'alquran' });
    const [arabic, translated] = data?.data || [];
    if (!arabic) throw new UserError('❌ No se pudo obtener la aleya.');
    await ctx.reply(
      [
        `۞ *${arabic.surah.englishName} ${arabic.surah.number}:${arabic.numberInSurah}*`,
        '',
        arabic.text,
        '',
        translated?.text || '',
        '',
        '_Fuente: alquran.cloud_',
      ].filter(Boolean).join('\n'),
    );
  },
};

const quranaudio = {
  name: 'quranaudio',
  category: 'quran',
  args: '<sura> [aleya]',
  description: 'Recitación en audio (Mishary Alafasy)',
  example: 'quranaudio 1',
  cooldown: 15,
  async execute(ctx) {
    const surahNumber = await findSurahNumber(ctx.args[0]);
    if (ctx.args[1]) {
      const ayahNumber = requireInteger(ctx.args[1], { min: 1, max: 300, name: 'número de aleya' });
      const data = await requestJson(`${API}/ayah/${surahNumber}:${ayahNumber}/${AUDIO_EDITION}`, { label: 'alquran' });
      const url = data?.data?.audio;
      if (!url) throw new UserError('❌ No hay audio disponible para esa aleya.');
      const { buffer } = await requestBuffer(url, { maxBytes: 20 * 1024 * 1024, label: 'alquran-audio' });
      await ctx.sendAudio(buffer, { mimetype: 'audio/mpeg' });
      return;
    }
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${AUDIO_EDITION}/${surahNumber}.mp3`;
    const { buffer } = await requestBuffer(url, { maxBytes: 60 * 1024 * 1024, label: 'alquran-audio' });
    await ctx.sendAudio(buffer, { mimetype: 'audio/mpeg' });
  },
};

const juz = {
  name: 'juz',
  category: 'quran',
  args: '<numero>',
  description: 'Primeras aleyas de un juz',
  example: 'juz 30',
  cooldown: 8,
  async execute(ctx) {
    const number = requireInteger(ctx.args[0], { min: 1, max: 30, name: 'juz' });
    const data = await requestJson(`${API}/juz/${number}/${translationEdition()}`, { label: 'alquran' });
    const ayahs = data?.data?.ayahs || [];
    if (!ayahs.length) throw new UserError('❌ No se pudo obtener el juz.');
    await ctx.reply(
      [
        `۞ *JUZ ${number}* (${ayahs.length} aleyas)`,
        '',
        ...ayahs.slice(0, 5).map((a) => `*${a.surah.englishName} ${a.surah.number}:${a.numberInSurah}*\n${truncate(a.text, 250)}`),
        '',
        '_Fuente: alquran.cloud_',
      ].join('\n\n'),
    );
  },
};

const quraninfo = {
  name: 'quraninfo',
  category: 'quran',
  description: 'Datos generales del Corán',
  cooldown: 8,
  async execute(ctx) {
    const data = await requestJson(`${API}/meta`, { label: 'alquran' });
    const meta = data?.data;
    await ctx.reply(
      [
        '۞ *DATOS DEL CORÁN*',
        '',
        `📖 Suras ☇ ${meta?.surahs?.count}`,
        `📜 Aleyas ☇ ${meta?.ayahs?.count}`,
        `🧭 Juz ☇ ${Object.keys(meta?.juzs?.references || {}).length}`,
        `📄 Páginas ☇ ${Object.keys(meta?.pages?.references || {}).length}`,
        `🕌 Sajdas ☇ ${meta?.sajdas?.count}`,
        '',
        '_Fuente: alquran.cloud_',
      ].join('\n'),
    );
  },
};

const translation = {
  name: 'translation',
  aliases: ['quranlang'],
  category: 'quran',
  args: '[edicion]',
  description: 'Consulta o cambia la traducción usada (ej. es.garcia, en.sahih)',
  async execute(ctx) {
    if (!ctx.args[0]) {
      const data = await requestJson(`${API}/edition?format=text&type=translation`, { label: 'alquran' });
      const editions = (data?.data || []).filter((e) => ['es', 'en', 'fr', 'id'].includes(e.language)).slice(0, 25);
      await ctx.reply(
        [
          `🌐 *TRADUCCIÓN ACTUAL:* ${translationEdition()}`,
          '',
          '*Algunas ediciones disponibles:*',
          ...editions.map((e) => `• ${e.identifier} — ${e.englishName} (${e.language})`),
          '',
          `Uso: ${ctx.prefix}translation <edicion>`,
        ].join('\n'),
      );
      return;
    }
    const edition = ctx.args[0].toLowerCase();
    const check = await requestJson(`${API}/ayah/1:1/${encodeURIComponent(edition)}`, { label: 'alquran' }).catch(() => null);
    if (!check?.data?.text) throw new UserError('❌ Esa edición no existe o no está disponible.');
    setSetting('quranTranslation', edition);
    await ctx.reply(`✅ Traducción cambiada a *${edition}*.`);
  },
};

export default [quran, surah, ayah, tafsir, quransearch, randomayah, quranaudio, juz, quraninfo, translation];
