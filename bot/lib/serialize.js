/**
 * Normaliza los mensajes crudos de Baileys en un objeto `m` manejable.
 */
import { getContentType, jidNormalizedUser } from 'baileys';

const unwrap = (message) => {
  if (!message) return null;
  let content = message;
  for (let i = 0; i < 5; i += 1) {
    const type = getContentType(content);
    if (type === 'ephemeralMessage') content = content.ephemeralMessage.message;
    else if (type === 'viewOnceMessage') content = content.viewOnceMessage.message;
    else if (type === 'viewOnceMessageV2') content = content.viewOnceMessageV2.message;
    else if (type === 'viewOnceMessageV2Extension') content = content.viewOnceMessageV2Extension.message;
    else if (type === 'documentWithCaptionMessage') content = content.documentWithCaptionMessage.message;
    else break;
  }
  return content;
};

export const MEDIA_TYPES = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  stickerMessage: 'sticker',
  documentMessage: 'document',
};

/** Tipo de media de un contenido ('image' | 'video' | ... | null). */
export const mediaTypeOf = (content) => {
  const type = getContentType(content || {});
  return MEDIA_TYPES[type] || null;
};

/** Extrae el texto de cualquier tipo de mensaje. */
export const extractText = (content) => {
  if (!content) return '';
  const type = getContentType(content);
  const node = content[type];
  if (type === 'conversation') return content.conversation || '';
  if (type === 'extendedTextMessage') return node?.text || '';
  if (['imageMessage', 'videoMessage', 'documentMessage'].includes(type)) return node?.caption || '';
  if (type === 'buttonsResponseMessage') return node?.selectedButtonId || node?.selectedDisplayText || '';
  if (type === 'listResponseMessage') {
    return node?.singleSelectReply?.selectedRowId || node?.title || '';
  }
  if (type === 'templateButtonReplyMessage') return node?.selectedId || node?.selectedDisplayText || '';
  if (type === 'interactiveResponseMessage') {
    try {
      const params = JSON.parse(node?.nativeFlowResponseMessage?.paramsJson || '{}');
      return params.id || params.selectedId || params.selectedRowId || '';
    } catch {
      return '';
    }
  }
  if (type === 'reactionMessage') return node?.text || '';
  if (type === 'pollCreationMessage' || type === 'pollCreationMessageV3') return node?.name || '';
  return '';
};

/** Serializa un mensaje de Baileys. */
export const serialize = (raw, sock) => {
  if (!raw?.message) return null;
  const content = unwrap(raw.message);
  if (!content) return null;

  const key = raw.key || {};
  const chat = key.remoteJid;
  const isGroup = String(chat || '').endsWith('@g.us');
  const botJid = jidNormalizedUser(sock?.user?.id || '');

  // WhatsApp puede identificar al remitente con un LID (@lid) en lugar de su
  // número. Baileys adjunta el JID real en senderPn/participantPn: se prefiere
  // ese valor para que los permisos (owner, admin, baneos) sigan funcionando.
  const normalize = (jid) => (jid ? jidNormalizedUser(jid) : '');
  const senderPrimary = isGroup
    ? normalize(key.participantPn || key.participant || raw.participant || '')
    : key.fromMe
      ? botJid
      : normalize(key.senderPn || chat || '');
  const senderAlt = isGroup
    ? normalize(key.participantLid || (key.participantPn ? key.participant : '') || '')
    : key.fromMe
      ? normalize(sock?.user?.lid || '')
      : normalize(key.senderLid || (key.senderPn ? chat : '') || '');
  const sender = senderPrimary || senderAlt;

  const type = getContentType(content);
  const node = content[type] || {};
  const contextInfo = node?.contextInfo || content?.extendedTextMessage?.contextInfo || {};

  const quotedMessage = unwrap(contextInfo?.quotedMessage);
  let quoted = null;
  if (quotedMessage) {
    const quotedType = getContentType(quotedMessage);
    const participant = jidNormalizedUser(contextInfo.participant || '');
    quoted = {
      type: quotedType,
      mediaType: mediaTypeOf(quotedMessage),
      hasMedia: Boolean(mediaTypeOf(quotedMessage)),
      text: extractText(quotedMessage),
      sender: participant,
      message: quotedMessage,
      content: quotedMessage[quotedType] || {},
      // Objeto compatible con downloadMediaMessage
      raw: {
        key: {
          remoteJid: chat,
          id: contextInfo.stanzaId,
          participant,
          fromMe: participant === botJid,
        },
        message: quotedMessage,
      },
    };
  }

  const mediaType = mediaTypeOf(content);

  return {
    key,
    id: key.id,
    raw,
    chat,
    isGroup,
    fromMe: Boolean(key.fromMe),
    sender,
    // Identidad alternativa (LID o número) del mismo remitente, si WhatsApp la envía.
    senderAlt: senderAlt && senderAlt !== sender ? senderAlt : null,
    pushName: raw.pushName || '',
    timestamp: Number(raw.messageTimestamp) || Math.floor(Date.now() / 1000),
    type,
    message: content,
    content: node,
    mediaType,
    hasMedia: Boolean(mediaType),
    text: extractText(content),
    mentions: contextInfo?.mentionedJid || [],
    contextInfo,
    quoted,
    isBaileysMessage: true,
  };
};

export default serialize;
