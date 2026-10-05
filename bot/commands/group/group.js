/**
 * Administración de grupos.
 * Verificaciones: (1) es grupo, (2) el usuario es admin, (3) el bot es admin
 * cuando se modifican participantes. La metadata se refresca en cada ejecución.
 */
import { updateGroup, DEFAULT_WELCOME, DEFAULT_GOODBYE } from '../../database/groups.js';
import { getGroupMetadata, invalidateGroupMetadata } from '../../handler.js';
import { requireOption } from '../../lib/validators.js';
import { UserError } from '../../lib/errors.js';
import { jidToNumber, truncate } from '../../lib/utils.js';

/** Resuelve los usuarios objetivo (menciones, respuesta o número). */
const targets = (ctx) => {
  const list = [...(ctx.mentions || [])];
  if (!list.length && ctx.quoted?.sender) list.push(ctx.quoted.sender);
  if (!list.length) {
    const numbers = ctx.args.filter((arg) => /^\+?\d{6,15}$/.test(arg));
    list.push(...numbers.map((number) => `${number.replace(/\D/g, '')}@s.whatsapp.net`));
  }
  return [...new Set(list)];
};

const toggleCommand = ({ name, aliases = [], field, label, description }) => ({
  name,
  aliases,
  category: 'group',
  args: '<on/off>',
  description,
  admin: true,
  groupOnly: true,
  skipArgCheck: true,
  async execute(ctx) {
    const current = ctx.group?.[field];
    if (!ctx.args[0]) {
      await ctx.reply(`${label} está *${current ? 'activado' : 'desactivado'}*.\n\nUso: ${ctx.prefix}${name} <on/off>`);
      return;
    }
    const value = requireOption(ctx.args[0], ['on', 'off'], { name: 'Opción' });
    updateGroup(ctx.chat, { [field]: value === 'on' ? 1 : 0 });
    await ctx.reply(`✅ ${label} ${value === 'on' ? 'activado' : 'desactivado'}.`);
  },
});

const welcome = toggleCommand({
  name: 'welcome',
  aliases: ['bienvenida'],
  field: 'welcome',
  label: 'El mensaje de bienvenida',
  description: 'Activa o desactiva la bienvenida',
});

const goodbye = toggleCommand({
  name: 'goodbye',
  aliases: ['despedida'],
  field: 'goodbye',
  label: 'El mensaje de despedida',
  description: 'Activa o desactiva la despedida',
});

const setwelcome = {
  name: 'setwelcome',
  category: 'group',
  args: '<texto>',
  description: 'Define el mensaje de bienvenida (@user, @group, @count)',
  admin: true,
  groupOnly: true,
  example: 'setwelcome ¡Bienvenido @user a @group!',
  async execute(ctx) {
    updateGroup(ctx.chat, { welcome_text: truncate(ctx.text, 1000), welcome: 1 });
    await ctx.reply(`✅ Mensaje de bienvenida actualizado:\n\n${truncate(ctx.text, 500)}`);
  },
};

const setgoodbye = {
  name: 'setgoodbye',
  category: 'group',
  args: '<texto>',
  description: 'Define el mensaje de despedida (@user, @group, @count)',
  admin: true,
  groupOnly: true,
  async execute(ctx) {
    updateGroup(ctx.chat, { goodbye_text: truncate(ctx.text, 1000), goodbye: 1 });
    await ctx.reply(`✅ Mensaje de despedida actualizado:\n\n${truncate(ctx.text, 500)}`);
  },
};

const resetwelcome = {
  name: 'resetwelcome',
  category: 'group',
  description: 'Restaura los mensajes de bienvenida/despedida por defecto',
  admin: true,
  groupOnly: true,
  async execute(ctx) {
    updateGroup(ctx.chat, { welcome_text: DEFAULT_WELCOME, goodbye_text: DEFAULT_GOODBYE });
    await ctx.reply('✅ Mensajes restaurados a los valores por defecto.');
  },
};

const antilink = {
  name: 'antilink',
  category: 'group',
  args: '<on/off/all>',
  description: 'Bloquea enlaces (on = invitaciones, all = cualquier enlace)',
  admin: true,
  groupOnly: true,
  skipArgCheck: true,
  async execute(ctx) {
    if (!ctx.args[0]) {
      const state = ctx.group?.antilink === 2 ? 'all' : ctx.group?.antilink ? 'on' : 'off';
      await ctx.reply(`🔗 Antilink está en *${state}*.\n\nUso: ${ctx.prefix}antilink <on/off/all>`);
      return;
    }
    const value = requireOption(ctx.args[0], ['on', 'off', 'all'], { name: 'Opción' });
    updateGroup(ctx.chat, { antilink: value === 'all' ? 2 : value === 'on' ? 1 : 0 });
    await ctx.reply(
      value === 'off'
        ? '✅ Antilink desactivado.'
        : `✅ Antilink activado (${value === 'all' ? 'cualquier enlace' : 'invitaciones de WhatsApp'}).\n_Necesito ser administrador para borrar los mensajes._`,
    );
  },
};

const participantAction = ({ name, aliases = [], action, verb, description }) => ({
  name,
  aliases,
  category: 'group',
  args: '<@usuario>',
  description,
  admin: true,
  botAdmin: true,
  groupOnly: true,
  skipArgCheck: true,
  async execute(ctx) {
    const list = targets(ctx);
    if (!list.length) throw new UserError(`❌ Menciona a un usuario.\n\nUso:\n${ctx.prefix}${name} <@usuario>`);
    const metadata = await getGroupMetadata(ctx.sock, ctx.chat, { force: true });
    const botNumber = jidToNumber(ctx.sock.user?.id || '');
    const filtered = list.filter((jid) => jidToNumber(jid) !== botNumber);
    if (!filtered.length) throw new UserError('❌ No puedo aplicar esa acción sobre mí mismo.');

    const owners = (metadata?.participants || []).filter((p) => p.admin === 'superadmin').map((p) => p.id);
    if (action === 'remove' && filtered.some((jid) => owners.includes(jid))) {
      throw new UserError('❌ No puedo expulsar al creador del grupo.');
    }

    await ctx.sock.groupParticipantsUpdate(ctx.chat, filtered, action);
    invalidateGroupMetadata(ctx.chat);
    await ctx.reply({
      text: `✅ ${verb}: ${filtered.map((jid) => `@${jidToNumber(jid)}`).join(', ')}`,
      mentions: filtered,
    });
  },
});

const kick = participantAction({
  name: 'kick',
  aliases: ['expulsar'],
  action: 'remove',
  verb: 'Expulsado(s)',
  description: 'Expulsa a un usuario del grupo',
});

const promote = participantAction({
  name: 'promote',
  aliases: ['daradmin'],
  action: 'promote',
  verb: 'Promovido(s) a admin',
  description: 'Da administrador a un usuario',
});

const demote = participantAction({
  name: 'demote',
  aliases: ['quitaradmin'],
  action: 'demote',
  verb: 'Degradado(s)',
  description: 'Quita el administrador a un usuario',
});

const tagall = {
  name: 'tagall',
  aliases: ['todos'],
  category: 'group',
  args: '[mensaje]',
  description: 'Menciona a todos los miembros',
  admin: true,
  groupOnly: true,
  cooldown: 30,
  async execute(ctx) {
    const metadata = await getGroupMetadata(ctx.sock, ctx.chat, { force: true });
    if (!metadata) throw new UserError('⚠️ No se pudo obtener la información del grupo.');
    const participants = metadata.participants.map((p) => p.id);
    await ctx.send({
      text: [
        `📢 *AVISO PARA TODOS* (${participants.length})`,
        ctx.text ? `\n${truncate(ctx.text, 800)}\n` : '',
        ...participants.map((jid) => `• @${jidToNumber(jid)}`),
      ].join('\n'),
      mentions: participants,
    });
  },
};

const grouplink = {
  name: 'grouplink',
  aliases: ['linkgrupo'],
  category: 'group',
  description: 'Obtiene el enlace de invitación del grupo',
  admin: true,
  botAdmin: true,
  groupOnly: true,
  async execute(ctx) {
    const code = await ctx.sock.groupInviteCode(ctx.chat);
    await ctx.reply(`🔗 *Enlace del grupo:*\nhttps://chat.whatsapp.com/${code}`);
  },
};

const groupMode = {
  name: 'groupmode',
  aliases: ['cerrargrupo', 'abrirgrupo'],
  category: 'group',
  args: '<abrir/cerrar>',
  description: 'Abre o cierra el grupo (solo admins pueden escribir)',
  admin: true,
  botAdmin: true,
  groupOnly: true,
  async execute(ctx) {
    const value = requireOption(ctx.args[0], ['abrir', 'cerrar'], { name: 'Opción' });
    await ctx.sock.groupSettingUpdate(ctx.chat, value === 'cerrar' ? 'announcement' : 'not_announcement');
    await ctx.reply(value === 'cerrar' ? '🔒 Grupo cerrado: solo los administradores pueden escribir.' : '🔓 Grupo abierto: todos pueden escribir.');
  },
};

export default [welcome, goodbye, setwelcome, setgoodbye, resetwelcome, antilink, kick, promote, demote, tagall, grouplink, groupMode];
