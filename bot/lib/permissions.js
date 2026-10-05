/** Resolución de permisos: owner, admin, premium, modo privado. */
import { ownerNumbers } from '../config.js';
import { jidToNumber } from './utils.js';
import { isPremium } from '../database/premium.js';
import { getWhitelist, isPublic } from '../database/settings.js';

/** El owner se determina SIEMPRE por número (OWNER_NUMBER), nunca por nombre de perfil. */
export const isOwnerJid = (jid) => {
  const number = jidToNumber(jid);
  if (!number) return false;
  return ownerNumbers.includes(number);
};

/** ¿El JID está en la lista de admins del grupo? */
export const isGroupAdmin = (metadata, jid) => {
  if (!metadata?.participants) return false;
  const number = jidToNumber(jid);
  const participant = metadata.participants.find(
    (p) => p.id === jid || jidToNumber(p.id) === number || jidToNumber(p.jid || '') === number,
  );
  return Boolean(participant && ['admin', 'superadmin'].includes(participant.admin));
};

export const getAdmins = (metadata) =>
  (metadata?.participants || []).filter((p) => ['admin', 'superadmin'].includes(p.admin)).map((p) => p.id);

export const premiumActive = (jid) => isPremium(jid);

/** En modo privado solo responden owner y whitelist. */
export const canUseInPrivateMode = (jid) => isPublic() || isOwnerJid(jid) || getWhitelist().includes(jid);

export const MESSAGES = {
  owner: '👑 Este comando solo está disponible para el propietario.',
  admin: '🛡️ Este comando solo puede ser utilizado por administradores.',
  botAdmin: '🤖 Necesito ser administrador del grupo para ejecutar este comando.',
  premium: '🔒 Este comando es exclusivo para usuarios Premium.',
  group: '👥 Este comando solo funciona en grupos.',
  private: '💬 Este comando solo funciona en el chat privado.',
  banned: '🚫 Estás bloqueado y no puedes usar el bot.',
  limit: '⚠️ Has agotado tu límite diario.',
  blocked: '🚧 Este comando está desactivado temporalmente.',
};

export default { isOwnerJid, isGroupAdmin, getAdmins, premiumActive, canUseInPrivateMode, MESSAGES };
