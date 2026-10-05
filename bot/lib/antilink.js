/**
 * Antilink: detecta enlaces de invitación de WhatsApp (y opcionalmente cualquier enlace)
 * en grupos donde esté activado. Admins y owner están exentos.
 */
import { isGroupAdmin, getAdmins } from './permissions.js';
import { jidToNumber } from './utils.js';
import { createLogger } from './logger.js';

const log = createLogger('antilink');

const INVITE_REGEX = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i;
const ANY_LINK_REGEX = /https?:\/\/\S+|www\.\S+/i;

/**
 * @returns {boolean} true si el mensaje fue gestionado (borrado) y no debe procesarse más.
 */
export const handleAntilink = async ({ sock, m, group, metadata, isOwner }) => {
  if (!group?.antilink || !m.isGroup || m.fromMe) return false;
  const text = m.text || '';
  if (!text) return false;

  const mode = group.antilink === 2 ? 'all' : 'invite';
  const matched = mode === 'all' ? ANY_LINK_REGEX.test(text) : INVITE_REGEX.test(text);
  if (!matched) return false;

  if (isOwner || (metadata && isGroupAdmin(metadata, m.sender))) return false;

  const botNumber = jidToNumber(sock.user?.id || '');
  const botIsAdmin = metadata ? getAdmins(metadata).some((jid) => jidToNumber(jid) === botNumber) : false;

  try {
    if (botIsAdmin) {
      await sock.sendMessage(m.chat, { delete: m.key });
      await sock.sendMessage(m.chat, {
        text: `🔗 @${jidToNumber(m.sender)} los enlaces no están permitidos en este grupo.`,
        mentions: [m.sender],
      });
    } else {
      await sock.sendMessage(m.chat, {
        text: `🔗 Enlace detectado, pero no puedo eliminarlo porque no soy administrador.`,
      });
    }
  } catch (error) {
    log.warn({ err: error.message }, 'No se pudo aplicar antilink');
  }
  return true;
};

export default handleAntilink;
