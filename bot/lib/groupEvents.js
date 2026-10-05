/**
 * Eventos de grupo: bienvenida y despedida.
 * Placeholders soportados: @user, @group, @desc, @count
 */
import { getGroup, DEFAULT_WELCOME, DEFAULT_GOODBYE } from '../database/groups.js';
import { jidToNumber } from './utils.js';
import { createLogger } from './logger.js';
import { invalidateGroupMetadata } from '../handler.js';

const log = createLogger('group-events');

const render = (template, { jid, metadata }) =>
  String(template || '')
    .replace(/@user/g, `@${jidToNumber(jid)}`)
    .replace(/@group/g, metadata?.subject || 'el grupo')
    .replace(/@desc/g, metadata?.desc || '')
    .replace(/@count/g, String(metadata?.participants?.length || 0));

export const handleParticipantsUpdate = async (sock, update) => {
  const { id, participants, action } = update;
  invalidateGroupMetadata(id);
  if (!['add', 'remove'].includes(action)) return;

  const group = getGroup(id);
  if (action === 'add' && !group.welcome) return;
  if (action === 'remove' && !group.goodbye) return;

  let metadata = null;
  try {
    metadata = await sock.groupMetadata(id);
  } catch {
    /* seguimos sin metadata */
  }

  for (const jid of participants) {
    const template =
      action === 'add'
        ? group.welcome_text || DEFAULT_WELCOME
        : group.goodbye_text || DEFAULT_GOODBYE;
    try {
      await sock.sendMessage(id, {
        text: render(template, { jid, metadata }),
        mentions: [jid],
      });
    } catch (error) {
      log.warn({ err: error.message, group: id }, 'No se pudo enviar el mensaje de grupo');
    }
  }
};

export default handleParticipantsUpdate;
