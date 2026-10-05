/**
 * Contexto reutilizable que reciben todos los comandos.
 */
import config from '../config.js';
import { jidToNumber, toJid } from './utils.js';
import { downloadMedia } from './media.js';
import { UserError } from './errors.js';

/**
 * @param {object} params
 * @returns contexto del comando
 */
export const createContext = ({
  sock,
  m,
  prefix = config.prefix,
  commandName = '',
  args = [],
  text = '',
  isOwner = false,
  isAdmin = false,
  isBotAdmin = false,
  isPremium = false,
  groupMetadata = null,
  user = null,
  group = null,
  command = null,
}) => {
  const chat = m.chat;

  const send = (content, options = {}) => sock.sendMessage(chat, content, options);

  const ctx = {
    sock,
    m,
    raw: m.raw,
    command,
    commandName,
    prefix,
    args,
    text,
    query: text,
    sender: m.sender,
    senderNumber: jidToNumber(m.sender),
    pushName: m.pushName || jidToNumber(m.sender),
    chat,
    isGroup: m.isGroup,
    isAdmin,
    isBotAdmin,
    isOwner,
    isPremium,
    groupMetadata,
    user,
    group,
    quoted: m.quoted,
    mentions: m.mentions || [],
    botJid: sock.user?.id,
    config,

    /* ── Envío ── */
    send,
    reply: (content, options = {}) =>
      typeof content === 'string'
        ? sock.sendMessage(chat, { text: content, ...options }, { quoted: m.raw })
        : sock.sendMessage(chat, content, { quoted: m.raw, ...options }),
    replyNoQuote: (text_) => send({ text: text_ }),
    react: async (emoji) => {
      try {
        await sock.sendMessage(chat, { react: { text: emoji, key: m.key } });
      } catch {
        /* reaccionar nunca debe romper un comando */
      }
    },
    sendImage: (image, caption = '', options = {}) =>
      sock.sendMessage(chat, { image, caption, ...options }, { quoted: m.raw }),
    sendVideo: (video, caption = '', options = {}) =>
      sock.sendMessage(chat, { video, caption, ...options }, { quoted: m.raw }),
    sendAudio: (audio, { ptt = false, mimetype = 'audio/mpeg' } = {}) =>
      sock.sendMessage(chat, { audio, ptt, mimetype }, { quoted: m.raw }),
    sendSticker: (sticker) => sock.sendMessage(chat, { sticker }, { quoted: m.raw }),
    sendDocument: (document, fileName, mimetype = 'application/octet-stream', caption = '') =>
      sock.sendMessage(chat, { document, fileName, mimetype, caption }, { quoted: m.raw }),
    sendTyping: async () => {
      try {
        await sock.sendPresenceUpdate('composing', chat);
      } catch {
        /* presencia opcional */
      }
    },

    /* ── Utilidades de entrada ── */

    /** JID objetivo: mención > mensaje citado > número escrito > (opcional) uno mismo. */
    targetJid: ({ allowSelf = true, fallbackSelf = false } = {}) => {
      if (m.mentions?.length) return m.mentions[0];
      if (m.quoted?.sender) return m.quoted.sender;
      const candidate = args.find((arg) => /^[+]?\d[\d\s-]{5,}$/.test(arg));
      if (candidate) return toJid(candidate);
      if (fallbackSelf || (allowSelf && args.length === 0)) return m.sender;
      return null;
    },

    /** Devuelve el mensaje (propio o citado) que contiene media de alguno de los tipos. */
    mediaMessage: (types = ['image']) => {
      const list = Array.isArray(types) ? types : [types];
      if (m.mediaType && list.includes(m.mediaType)) return m;
      if (m.quoted?.mediaType && list.includes(m.quoted.mediaType)) return m.quoted;
      return null;
    },

    /** Descarga la media adjunta/citada del tipo indicado. */
    downloadMedia: async (types = ['image']) => {
      const source = ctx.mediaMessage(types);
      if (!source) throw new UserError('❌ No se encontró contenido multimedia compatible.');
      return downloadMedia(source, sock);
    },

    /** Nombre visible de un participante. */
    nameOf: (jid) => `@${jidToNumber(jid)}`,
  };

  return ctx;
};

export default createContext;
