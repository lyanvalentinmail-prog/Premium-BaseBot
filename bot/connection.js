/**
 * Conexión con WhatsApp (Baileys multi-device).
 * - Pairing Code (por defecto) o QR.
 * - Sesión persistente en sessions/.
 * - Reconexión automática con backoff y límite de intentos (sin bucles infinitos).
 */
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from 'baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import config, { paths } from './config.js';
import { createLogger } from './lib/logger.js';
import { handleMessage, invalidateGroupMetadata } from './handler.js';
import { handleParticipantsUpdate } from './lib/groupEvents.js';
import { ensureDir, normalizePhone, sleep } from './lib/utils.js';

const log = createLogger('connection');

/** Logger silencioso para el ruido interno de Baileys (se mantiene en nivel fatal). */
const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

let reconnectAttempts = 0;
let currentSocket = null;
let shuttingDown = false;

export const getSocket = () => currentSocket;

export const setShuttingDown = (value = true) => {
  shuttingDown = value;
};

/** Pide el número por consola (o lo toma de PAIRING_NUMBER / OWNER_NUMBER). */
const askPhoneNumber = async () => {
  const fromEnv = config.connection.pairingNumber || config.owner.number;
  if (fromEnv) {
    log.info({ number: `${fromEnv.slice(0, 4)}***` }, 'Usando número configurado para el emparejamiento');
    return fromEnv;
  }
  const rl = readline.createInterface({ input, output });
  try {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const answer = await rl.question('\n📱 Número de WhatsApp (con código de país, sin +): ');
      const number = normalizePhone(answer);
      if (number.length >= 8 && number.length <= 15) return number;
      console.log('⚠️  Número inválido. Ejemplo: 549XXXXXXXXXX');
    }
    throw new Error('Número de teléfono no válido tras 3 intentos');
  } finally {
    rl.close();
  }
};

const printPairingCode = (code) => {
  const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
  console.log(`
╭──「 🔗 PAIRING CODE 」
│
│  Código ☇  ${pretty}
│
│  WhatsApp › Dispositivos vinculados ›
│  Vincular dispositivo › Vincular con número
│
╰────────────────────⬣
`);
};

/** Antigüedad máxima (segundos) de un mensaje para seguir procesándolo. */
export const MAX_MESSAGE_AGE_SECONDS = 300;

/**
 * Decide si un mensaje de `messages.upsert` debe procesarse.
 * - 'notify': mensajes nuevos que recibe el bot.
 * - 'append': mensajes que el propio usuario envía desde el teléfono vinculado.
 *   Sin ellos el bot no responde a los comandos escritos desde tu propio número.
 * - Se descartan los mensajes antiguos para no reejecutar comandos al reconectar.
 * @param {string} type
 * @param {object} message
 * @param {number} [now] marca de tiempo en milisegundos
 */
export const shouldProcessUpsert = (type, message, now = Date.now()) => {
  if (!message?.message) return false;

  // Al reconectar, WhatsApp reenvía historial: nunca se reejecutan comandos viejos.
  const timestamp = Number(message.messageTimestamp || 0);
  if (timestamp > 0 && now / 1000 - timestamp > MAX_MESSAGE_AGE_SECONDS) return false;

  if (type === 'notify') return true;
  // 'append' (y cualquier otro tipo que use la versión de WhatsApp en uso):
  // solo se aceptan los mensajes propios y recientes.
  return Boolean(message.key?.fromMe);
};

/**
 * Inicia la conexión.
 * @param {{onReady?: Function}} options
 */
export const startConnection = async (options = {}) => {
  ensureDir(paths.sessions);
  const { state, saveCreds } = await useMultiFileAuthState(paths.sessions);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307],
    isLatest: false,
  }));
  log.info({ version: version.join('.'), isLatest }, 'Versión de WhatsApp Web');

  const usePairing = config.connection.usePairingCode && !state.creds.registered;

  const sock = makeWASocket({
    version,
    logger: baileysLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    browser: Browsers.ubuntu(config.connection.browser),
    markOnlineOnConnect: true,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    getMessage: async () => undefined,
  });

  currentSocket = sock;
  sock.ev.on('creds.update', saveCreds);

  if (usePairing) {
    // Espera breve recomendada antes de solicitar el código.
    await sleep(2000);
    try {
      const number = await askPhoneNumber();
      const code = await sock.requestPairingCode(number);
      printPairingCode(code);
    } catch (error) {
      log.error({ err: error.message }, 'No se pudo solicitar el Pairing Code');
      throw error;
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !usePairing) {
      console.log('\n📷 Escanea este código QR con WhatsApp › Dispositivos vinculados:\n');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'connecting') log.info('Conectando con WhatsApp…');

    if (connection === 'open') {
      reconnectAttempts = 0;
      log.info({ user: sock.user?.id?.split(':')[0] }, '✅ Conectado a WhatsApp');
      console.log(`
╭──「 ✓ ${config.name} 」
│
│ 🤖 Estado ☇ Conectado
│ 🎋 Prefijo ☇ ${config.prefix}
│ 👑 Owner  ☇ ${config.owner.name}
│
│ ¿No responde? ☇ npm run doctor
│
╰────────────────────⬣
`);
      await options.onReady?.(sock);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = Object.entries(DisconnectReason).find(([, value]) => value === statusCode)?.[0] || 'desconocido';
      log.warn({ statusCode, reason }, 'Conexión cerrada');

      if (shuttingDown) return;

      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Sesión cerrada desde el teléfono. Ejecuta: npm run reset-session');
        console.log('\n❌ La sesión ya no es válida. Ejecuta `npm run reset-session` y vuelve a vincular.\n');
        process.exitCode = 1;
        return;
      }

      if (statusCode === DisconnectReason.badSession) {
        log.error('Sesión corrupta. Ejecuta: npm run reset-session');
        process.exitCode = 1;
        return;
      }

      reconnectAttempts += 1;
      if (reconnectAttempts > config.connection.maxReconnectAttempts) {
        log.error({ reconnectAttempts }, 'Se alcanzó el máximo de reintentos de reconexión');
        console.log('\n❌ No se pudo reconectar. Revisa tu conexión y vuelve a iniciar el bot.\n');
        process.exitCode = 1;
        return;
      }

      const delay = Math.min(60_000, 2 ** reconnectAttempts * 1000);
      log.info({ attempt: reconnectAttempts, delay }, 'Reintentando conexión');
      await sleep(delay);
      if (!shuttingDown) await startConnection(options);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const message of messages) {
      if (!shouldProcessUpsert(type, message)) continue;

      if (config.debugMessages) {
        // Diagnóstico sin contenido privado: solo metadatos.
        log.info(
          {
            upsert: type,
            fromMe: Boolean(message.key?.fromMe),
            chat: String(message.key?.remoteJid || '').endsWith('@g.us') ? 'grupo' : 'privado',
            kind: Object.keys(message.message || {})[0] || 'sin-contenido',
          },
          'Mensaje recibido',
        );
      }

      handleMessage(sock, message).catch((error) => {
        log.error({ err: error.message, stack: error.stack }, 'Error no controlado en el handler');
      });
    }
  });

  sock.ev.on('group-participants.update', (update) => {
    handleParticipantsUpdate(sock, update).catch((error) => {
      log.warn({ err: error.message }, 'Error en evento de participantes');
    });
  });

  sock.ev.on('groups.update', (updates) => {
    for (const update of updates) if (update.id) invalidateGroupMetadata(update.id);
  });

  return sock;
};

/** Cierra la conexión de forma limpia. */
export const closeConnection = async () => {
  shuttingDown = true;
  if (!currentSocket) return;
  try {
    await currentSocket.ws?.close();
  } catch {
    /* ya cerrado */
  }
  currentSocket = null;
};

export const sessionExists = () =>
  fs.existsSync(paths.sessions) && fs.readdirSync(paths.sessions).some((f) => f.startsWith('creds'));

export default startConnection;
