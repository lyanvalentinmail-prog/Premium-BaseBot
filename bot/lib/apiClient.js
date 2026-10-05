/**
 * Cliente HTTP central + proveedores externos.
 *
 * - Timeout, límite de tamaño, validación de URL, manejo de status y JSON inválido.
 * - Protección básica anti-SSRF para URLs proporcionadas por usuarios.
 * - Registro de proveedores (OpenAI, Gemini, OpenWeather, remove.bg…) leyendo claves de .env.
 *   Los comandos NO deben hacer fetch con claves directamente: usan este módulo.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import config, { getKey } from '../config.js';
import { createLogger } from './logger.js';
import { NotConfiguredError, ProviderError, UserError } from './errors.js';

const log = createLogger('http');

/* ───────────────────────── Validación de URL / SSRF ───────────────────────── */

const PRIVATE_V4 = [
  [10, 0, 0, 0, 8],
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16],
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [100, 64, 0, 0, 10],
  [192, 0, 0, 0, 24],
  [198, 18, 0, 0, 15],
  [0, 0, 0, 0, 8],
];

const ipv4ToInt = (ip) => ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

export const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4.some(([a, b, c, d, bits]) => {
      const base = ipv4ToInt(`${a}.${b}.${c}.${d}`);
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (base & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('fe80')) return true; // link local
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.replace('::ffff:', ''));
    return false;
  }
  return true;
};

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

/** Valida que una URL sea http(s) y pública. Lanza UserError si no lo es. */
export const assertSafeUrl = async (input, { allowPrivate = false } = {}) => {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    throw new UserError('❌ La URL proporcionada no es válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UserError('❌ Solo se permiten URLs http:// o https://');
  }
  if (allowPrivate) return url;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new UserError('🛡️ Ese destino no está permitido.');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new UserError('🛡️ Ese destino no está permitido.');
    return url;
  }
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UserError('❌ No se pudo resolver el dominio indicado.');
  }
  if (!addresses.length || addresses.some((addr) => isPrivateIp(addr.address))) {
    throw new UserError('🛡️ Ese destino no está permitido.');
  }
  return url;
};

export const isValidUrl = (input) => {
  try {
    const url = new URL(String(input));
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

/* ───────────────────────── Fetch seguro ───────────────────────── */

/**
 * fetch con timeout, cabeceras por defecto y control de errores.
 * @param {string|URL} url
 * @param {object} options
 * @param {boolean} options.userProvided URL enviada por un usuario → validación SSRF.
 */
export const request = async (url, options = {}) => {
  const {
    timeout = config.http.timeout,
    userProvided = false,
    allowPrivate = false,
    retries = 0,
    headers = {},
    ...rest
  } = options;

  const target = userProvided ? (await assertSafeUrl(url, { allowPrivate })).toString() : String(url);

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(target, {
        ...rest,
        redirect: rest.redirect || 'follow',
        headers: {
          'user-agent': config.http.userAgent,
          accept: headers.accept || '*/*',
          ...headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) continue;
    }
  }
  log.warn({ url: String(target).split('?')[0], err: lastError?.message }, 'Fallo de red');
  if (lastError?.name === 'AbortError') {
    throw new ProviderError('⚠️ El servicio externo tardó demasiado en responder.');
  }
  throw new ProviderError();
};

const checkStatus = async (response, label = 'servicio') => {
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  log.warn({ status: response.status, label, body: body.slice(0, 200) }, 'Respuesta HTTP no OK');
  if (response.status === 404) throw new UserError('❌ No se encontraron resultados.');
  if (response.status === 429) throw new ProviderError('⚠️ Demasiadas peticiones al servicio externo. Inténtalo más tarde.');
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('⚠️ El servicio externo rechazó la petición (credenciales o permisos).');
  }
  throw new ProviderError();
};

/** GET/POST que devuelve JSON validado. */
export const requestJson = async (url, options = {}) => {
  const response = await request(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  await checkStatus(response, options.label);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    log.warn({ url: String(url).split('?')[0] }, 'JSON inválido del proveedor');
    throw new ProviderError('⚠️ El servicio externo devolvió una respuesta inválida.');
  }
};

/** Descarga un buffer con límite de tamaño. */
export const requestBuffer = async (url, options = {}) => {
  const maxBytes = options.maxBytes || config.http.maxBytes;
  const response = await request(url, options);
  await checkStatus(response, options.label);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) {
    throw new UserError(`❌ El archivo es demasiado grande (máx. ${Math.floor(maxBytes / 1048576)} MB).`);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) throw new UserError(`❌ El archivo es demasiado grande (máx. ${Math.floor(maxBytes / 1048576)} MB).`);
    chunks.push(Buffer.from(chunk));
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    url: response.url,
  };
};

export const requestText = async (url, options = {}) => {
  const response = await request(url, options);
  await checkStatus(response, options.label);
  return response.text();
};

/* ───────────────────────── Proveedores ───────────────────────── */

/**
 * Registro de proveedores. Añadir uno nuevo = añadir una entrada aquí
 * (y la variable correspondiente en .env.example).
 */
export const PROVIDERS = {
  openai: { env: 'OPENAI_API_KEY', label: 'OpenAI', docs: 'https://platform.openai.com' },
  gemini: { env: 'GEMINI_API_KEY', label: 'Google Gemini', docs: 'https://ai.google.dev' },
  weather: { env: 'WEATHER_API_KEY', label: 'OpenWeatherMap', docs: 'https://openweathermap.org/api' },
  removebg: { env: 'REMOVE_BG_API_KEY', label: 'remove.bg', docs: 'https://www.remove.bg/api' },
  youtube: { env: 'YOUTUBE_API_KEY', label: 'YouTube Data API', docs: 'https://developers.google.com/youtube/v3' },
  google: { env: 'GOOGLE_API_KEY', label: 'Google Custom Search', docs: 'https://developers.google.com/custom-search' },
  googleCx: { env: 'GOOGLE_CSE_ID', label: 'Google CSE ID', docs: 'https://programmablesearchengine.google.com' },
  twitchId: { env: 'TWITCH_CLIENT_ID', label: 'Twitch', docs: 'https://dev.twitch.tv/docs/api' },
  twitchSecret: { env: 'TWITCH_CLIENT_SECRET', label: 'Twitch', docs: 'https://dev.twitch.tv/docs/api' },
  steam: { env: 'STEAM_API_KEY', label: 'Steam Web API', docs: 'https://steamcommunity.com/dev' },
  spotifyId: { env: 'SPOTIFY_CLIENT_ID', label: 'Spotify', docs: 'https://developer.spotify.com' },
  spotifySecret: { env: 'SPOTIFY_CLIENT_SECRET', label: 'Spotify', docs: 'https://developer.spotify.com' },
  libretranslate: { env: 'LIBRETRANSLATE_URL', label: 'LibreTranslate', docs: 'https://libretranslate.com' },
  libretranslateKey: { env: 'LIBRETRANSLATE_API_KEY', label: 'LibreTranslate', docs: 'https://libretranslate.com' },
  github: { env: 'GITHUB_TOKEN', label: 'GitHub', docs: 'https://github.com/settings/tokens' },
};

/** ¿Hay clave configurada para el proveedor? */
export const hasProvider = (name) => Boolean(getKey(PROVIDERS[name]?.env));

/** Obtiene la clave o lanza NotConfiguredError con instrucciones (sin revelar valores). */
export const requireProvider = (name) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new NotConfiguredError();
  const key = getKey(provider.env);
  if (!key) {
    throw new NotConfiguredError(`Configura *${provider.env}* en tu archivo .env (${provider.label}).`);
  }
  return key;
};

/* ── IA: chat de texto (OpenAI o Gemini, lo que esté configurado) ── */

export const aiAvailable = () => hasProvider('openai') || hasProvider('gemini');

/**
 * Completa un prompt de texto con el proveedor disponible.
 * @param {string} prompt
 * @param {{system?:string, maxTokens?:number, temperature?:number, provider?:'openai'|'gemini'}} opts
 */
export const aiComplete = async (prompt, opts = {}) => {
  const provider = opts.provider || (hasProvider('openai') ? 'openai' : hasProvider('gemini') ? 'gemini' : null);
  if (!provider) {
    throw new NotConfiguredError('Configura *OPENAI_API_KEY* o *GEMINI_API_KEY* en tu archivo .env.');
  }
  if (provider === 'openai') {
    const key = requireProvider('openai');
    const data = await requestJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: opts.maxTokens || 800,
        temperature: opts.temperature ?? 0.7,
      }),
      timeout: 60_000,
      label: 'openai',
    });
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError();
    return text;
  }
  const key = requireProvider('gemini');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const data = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.system ? `${opts.system}\n\n${prompt}` : prompt }] }],
        generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens || 800 },
      }),
      timeout: 60_000,
      label: 'gemini',
    },
  );
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  if (!text) throw new ProviderError();
  return text;
};

/** Generación de imágenes (OpenAI Images). Devuelve un Buffer PNG. */
export const aiImage = async (prompt, { size = '1024x1024' } = {}) => {
  const key = requireProvider('openai');
  const data = await requestJson('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      size,
      n: 1,
    }),
    timeout: 120_000,
    label: 'openai-images',
  });
  const item = data?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return (await requestBuffer(item.url, { label: 'openai-images' })).buffer;
  throw new ProviderError();
};

/** Texto a voz vía OpenAI (si está configurado). Devuelve Buffer mp3. */
export const aiSpeech = async (text, { voice = 'alloy' } = {}) => {
  const key = requireProvider('openai');
  const response = await request('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice, input: text }),
    timeout: 90_000,
  });
  await checkStatus(response, 'openai-tts');
  return Buffer.from(await response.arrayBuffer());
};

/** Token de aplicación de Twitch (client credentials). */
let twitchToken = { value: null, expires: 0 };
export const twitchAppToken = async () => {
  const id = requireProvider('twitchId');
  const secret = requireProvider('twitchSecret');
  if (twitchToken.value && twitchToken.expires > Date.now()) return twitchToken.value;
  const data = await requestJson(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
    { method: 'POST', label: 'twitch-auth' },
  );
  twitchToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return twitchToken.value;
};

/** Token de Spotify (client credentials). */
let spotifyToken = { value: null, expires: 0 };
export const spotifyAppToken = async () => {
  const id = requireProvider('spotifyId');
  const secret = requireProvider('spotifySecret');
  if (spotifyToken.value && spotifyToken.expires > Date.now()) return spotifyToken.value;
  const data = await requestJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    label: 'spotify-auth',
  });
  spotifyToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return spotifyToken.value;
};

export default {
  request,
  requestJson,
  requestBuffer,
  requestText,
  assertSafeUrl,
  isValidUrl,
  hasProvider,
  requireProvider,
  aiAvailable,
  aiComplete,
  aiImage,
  aiSpeech,
  PROVIDERS,
};
