/** Herramientas de utilidad general. */
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { getKey } from '../../config.js';
import { evaluate } from '../../lib/mathEval.js';
import { requestJson, requestText, hasProvider } from '../../lib/apiClient.js';
import { requireUrl, requireOption } from '../../lib/validators.js';
import { UserError, NotConfiguredError, ProviderError } from '../../lib/errors.js';
import { loadImage } from '../../lib/media.js';
import { formatDate, truncate } from '../../lib/utils.js';

const calc = {
  name: 'calc',
  aliases: ['calcular', 'math'],
  category: 'tools',
  args: '<operacion>',
  description: 'Calculadora (+ - * / % ^, sqrt, sin, cos…)',
  example: 'calc (5+3)*2^3',
  async execute(ctx) {
    const result = evaluate(ctx.text);
    await ctx.reply(`🧮 *${ctx.text}* = *${Number(result.toFixed(10))}*`);
  },
};

const qr = {
  name: 'qr',
  aliases: ['qrcode'],
  category: 'tools',
  args: '<texto/url>',
  description: 'Genera un código QR',
  async execute(ctx) {
    const buffer = await QRCode.toBuffer(ctx.text, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
    await ctx.sendImage(buffer, `🔳 QR generado para:\n${truncate(ctx.text, 200)}`);
  },
};

const readqr = {
  name: 'readqr',
  aliases: ['scanqr', 'leerqr'],
  category: 'tools',
  description: 'Lee un código QR de una imagen (adjunta o citada)',
  acceptsMedia: true,
  async execute(ctx) {
    const buffer = await ctx.downloadMedia(['image']);
    const image = await loadImage(buffer);
    const { width, height } = image.bitmap;
    const result = jsQR(new Uint8ClampedArray(image.bitmap.data), width, height);
    if (!result?.data) throw new UserError('❌ No se detectó ningún código QR en la imagen.');
    await ctx.reply(`🔍 *Contenido del QR:*\n${truncate(result.data, 1500)}`);
  },
};

const shorturl = {
  name: 'shorturl',
  aliases: ['acortar', 'short'],
  category: 'tools',
  args: '<url>',
  description: 'Acorta una URL con is.gd',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, shorturl);
    const data = await requestJson(
      `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
      { label: 'is.gd' },
    );
    if (!data?.shorturl) throw new ProviderError('⚠️ No se pudo acortar el enlace.');
    await ctx.reply(`🔗 *URL acortada:*\n${data.shorturl}`);
  },
};

const translate = {
  name: 'translate',
  aliases: ['traducir', 'tr'],
  category: 'tools',
  args: '<idioma> <texto>',
  description: 'Traduce texto (requiere LIBRETRANSLATE_URL)',
  example: 'translate en Hola mundo',
  limit: true,
  async execute(ctx) {
    const target = ctx.args[0].toLowerCase();
    const text = ctx.args.slice(1).join(' ');
    if (!text) throw new UserError(`❌ Falta el texto.\n\nUso:\n${ctx.prefix}translate <idioma> <texto>`);

    const endpoint = getKey('LIBRETRANSLATE_URL');
    if (!endpoint) {
      throw new NotConfiguredError(
        'Configura *LIBRETRANSLATE_URL* (por ejemplo una instancia propia de LibreTranslate) y, si la requiere, *LIBRETRANSLATE_API_KEY*.\n' +
          `Alternativa con IA: *${ctx.prefix}translateai ${target} ${truncate(text, 40)}*`,
      );
    }
    const data = await requestJson(`${endpoint.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target,
        format: 'text',
        ...(getKey('LIBRETRANSLATE_API_KEY') ? { api_key: getKey('LIBRETRANSLATE_API_KEY') } : {}),
      }),
      label: 'libretranslate',
    });
    if (!data?.translatedText) throw new ProviderError();
    await ctx.reply(`🌐 *Traducción (${target}):*\n${data.translatedText}`);
  },
};

const base64 = {
  name: 'base64',
  aliases: ['b64', 'encode64'],
  category: 'tools',
  args: '<texto>',
  description: 'Codifica texto en Base64',
  async execute(ctx) {
    await ctx.reply(`🔐 ${Buffer.from(ctx.text, 'utf8').toString('base64')}`);
  },
};

const decode64 = {
  name: 'decode64',
  aliases: ['unbase64', 'd64'],
  category: 'tools',
  args: '<texto>',
  description: 'Decodifica texto Base64',
  async execute(ctx) {
    const decoded = Buffer.from(ctx.text, 'base64').toString('utf8');
    if (!decoded) throw new UserError('❌ El texto no es Base64 válido.');
    await ctx.reply(`🔓 ${truncate(decoded, 2000)}`);
  },
};

const hash = {
  name: 'hash',
  aliases: ['hashear'],
  category: 'tools',
  args: '<tipo> <texto>',
  description: 'Calcula un hash (md5, sha1, sha256, sha512)',
  example: 'hash sha256 hola',
  async execute(ctx) {
    const type = requireOption(ctx.args[0], ['md5', 'sha1', 'sha256', 'sha512'], { name: 'Algoritmo' });
    const text = ctx.args.slice(1).join(' ');
    if (!text) throw new UserError(`❌ Falta el texto.\n\nUso:\n${ctx.prefix}hash <tipo> <texto>`);
    await ctx.reply(`#️⃣ *${type}*\n\`\`\`${crypto.createHash(type).update(text).digest('hex')}\`\`\``);
  },
};

const timestamp = {
  name: 'timestamp',
  aliases: ['fecha', 'time'],
  category: 'tools',
  args: '[fecha]',
  description: 'Convierte fechas ↔ timestamps',
  example: 'timestamp 2026-01-01',
  async execute(ctx) {
    let date;
    if (!ctx.text) date = new Date();
    else if (/^\d{9,13}$/.test(ctx.text)) date = new Date(Number(ctx.text) * (ctx.text.length <= 10 ? 1000 : 1));
    else date = new Date(ctx.text);
    if (Number.isNaN(date.getTime())) throw new UserError('❌ Fecha no válida. Ejemplos: 2026-01-01, 1735689600');
    const diff = Math.round((date.getTime() - Date.now()) / 1000);
    const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const [value, unit] =
      Math.abs(diff) < 60 ? [diff, 'second']
        : Math.abs(diff) < 3600 ? [Math.round(diff / 60), 'minute']
          : Math.abs(diff) < 86400 ? [Math.round(diff / 3600), 'hour']
            : [Math.round(diff / 86400), 'day'];
    await ctx.reply(
      [
        '🕐 *TIMESTAMP*',
        `• Unix ☇ ${Math.floor(date.getTime() / 1000)}`,
        `• ISO ☇ ${date.toISOString()}`,
        `• Local ☇ ${formatDate(date.getTime())}`,
        `• Relativo ☇ ${relative.format(value, unit)}`,
      ].join('\n'),
    );
  },
};

const WEATHER_CODES = {
  0: '☀️ Despejado', 1: '🌤️ Mayormente despejado', 2: '⛅ Parcialmente nublado', 3: '☁️ Nublado',
  45: '🌫️ Niebla', 48: '🌫️ Niebla con escarcha', 51: '🌦️ Llovizna ligera', 53: '🌦️ Llovizna',
  55: '🌧️ Llovizna intensa', 61: '🌧️ Lluvia ligera', 63: '🌧️ Lluvia', 65: '🌧️ Lluvia intensa',
  71: '🌨️ Nieve ligera', 73: '🌨️ Nieve', 75: '❄️ Nieve intensa', 80: '🌦️ Chubascos',
  81: '🌧️ Chubascos fuertes', 82: '⛈️ Chubascos violentos', 95: '⛈️ Tormenta',
  96: '⛈️ Tormenta con granizo', 99: '⛈️ Tormenta fuerte con granizo',
};

const weather = {
  name: 'weather',
  aliases: ['clima', 'tiempo'],
  category: 'tools',
  args: '<ciudad>',
  description: 'Consultar el clima actual',
  example: 'weather Madrid',
  cooldown: 5,
  async execute(ctx) {
    const city = ctx.text;

    // Proveedor preferente: OpenWeatherMap si hay API key.
    if (hasProvider('weather')) {
      const key = getKey('WEATHER_API_KEY');
      const data = await requestJson(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(key)}&units=metric&lang=es`,
        { label: 'openweather' },
      );
      await ctx.reply(
        [
          `🌤️ *CLIMA EN ${data.name?.toUpperCase()}, ${data.sys?.country}*`,
          '',
          `🌡️ Temperatura ☇ *${Math.round(data.main.temp)}°C* (sensación ${Math.round(data.main.feels_like)}°C)`,
          `📋 Estado ☇ ${data.weather?.[0]?.description}`,
          `💧 Humedad ☇ ${data.main.humidity}%`,
          `🌬️ Viento ☇ ${Math.round((data.wind?.speed || 0) * 3.6)} km/h`,
          `🔽 Presión ☇ ${data.main.pressure} hPa`,
          '',
          '_Fuente: OpenWeatherMap_',
        ].join('\n'),
      );
      return;
    }

    // Alternativa gratuita y sin clave: Open-Meteo.
    const geo = await requestJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`,
      { label: 'open-meteo-geo' },
    );
    const place = geo?.results?.[0];
    if (!place) throw new UserError(`❌ No se encontró la ciudad *${city}*.`);
    const data = await requestJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure&timezone=auto`,
      { label: 'open-meteo' },
    );
    const current = data?.current;
    if (!current) throw new ProviderError();
    await ctx.reply(
      [
        `🌤️ *CLIMA EN ${place.name.toUpperCase()}, ${place.country || ''}*`,
        '',
        `🌡️ Temperatura ☇ *${Math.round(current.temperature_2m)}°C* (sensación ${Math.round(current.apparent_temperature)}°C)`,
        `📋 Estado ☇ ${WEATHER_CODES[current.weather_code] || '—'}`,
        `💧 Humedad ☇ ${current.relative_humidity_2m}%`,
        `🌬️ Viento ☇ ${Math.round(current.wind_speed_10m)} km/h`,
        `🔽 Presión ☇ ${Math.round(current.surface_pressure)} hPa`,
        '',
        '_Fuente: Open-Meteo (sin API key)_',
      ].join('\n'),
    );
  },
};

export default [calc, qr, readqr, shorturl, translate, base64, decode64, hash, timestamp, weather];
