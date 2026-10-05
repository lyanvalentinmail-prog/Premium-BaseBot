/**
 * Socket de WhatsApp simulado: permite probar el handler completo
 * (parseo, permisos, límites, comandos) sin conectarse a WhatsApp.
 */
import { randomUUID } from 'node:crypto';

export const BOT_JID = '34611111111@s.whatsapp.net';
export const OWNER_JID = '34600000000@s.whatsapp.net';
export const USER_JID = '34622222222@s.whatsapp.net';
export const GROUP_JID = '120363000000000000@g.us';

export const createMockSock = () => {
  const sent = [];
  return {
    user: { id: `${BOT_JID.split('@')[0]}:1@s.whatsapp.net`, name: 'TestBot' },
    sent,
    lastText: () => {
      for (let i = sent.length - 1; i >= 0; i -= 1) {
        if (typeof sent[i].content?.text === 'string') return sent[i].content.text;
        if (typeof sent[i].content?.caption === 'string') return sent[i].content.caption;
      }
      return '';
    },
    reset: () => sent.splice(0, sent.length),
    async sendMessage(jid, content, options = {}) {
      sent.push({ jid, content, options });
      return { key: { id: randomUUID(), remoteJid: jid, fromMe: true }, message: {} };
    },
    async sendPresenceUpdate() {},
    async relayMessage(jid, message) {
      sent.push({ jid, content: { interactive: true, message } });
      return { key: { id: randomUUID() } };
    },
    async groupMetadata(jid) {
      return {
        id: jid,
        subject: 'Grupo de pruebas',
        creation: Math.floor(Date.now() / 1000),
        desc: 'Descripción de prueba',
        participants: [
          { id: BOT_JID, admin: 'admin' },
          { id: OWNER_JID, admin: 'superadmin' },
          { id: USER_JID, admin: null },
        ],
      };
    },
    async groupParticipantsUpdate() {
      return [];
    },
    async profilePictureUrl() {
      throw new Error('no profile picture');
    },
    waUploadToServer: async () => ({ mediaUrl: 'https://example.invalid/media' }),
    updateMediaMessage: async () => ({}),
    ws: { close: () => {} },
  };
};

/** Construye un mensaje crudo de Baileys con texto. */
export const makeMessage = (text, { from = USER_JID, chat = null, pushName = 'Tester', fromMe = false } = {}) => {
  const remoteJid = chat || from;
  const isGroup = remoteJid.endsWith('@g.us');
  return {
    key: {
      remoteJid,
      fromMe,
      id: randomUUID().replace(/-/g, '').toUpperCase().slice(0, 20),
      ...(isGroup ? { participant: from } : {}),
    },
    pushName,
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: { conversation: text },
  };
};

export default { createMockSock, makeMessage, BOT_JID, OWNER_JID, USER_JID, GROUP_JID };
