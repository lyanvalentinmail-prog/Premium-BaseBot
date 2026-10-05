/**
 * Construcción del menú: caption principal, listado por categorías y
 * mensaje interactivo (botón/lista) con degradación elegante a texto plano.
 */
import fs from 'node:fs';
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from 'baileys';
import config, { paths } from '../config.js';
import { smallcaps, formatUptime, formatNumber } from './utils.js';
import { categoryInfo } from './categories.js';
import { commandsByCategory, totalCommands, findCategory } from './commandLoader.js';
import { getMode } from '../database/settings.js';
import { createLogger } from './logger.js';

const log = createLogger('menu');

/** Símbolos de permiso generados automáticamente desde la metadata. */
export const permissionTags = (command) => {
  const tags = [];
  if (command.premium) tags.push('Ⓟ');
  if (command.limit) tags.push('Ⓛ');
  if (command.owner) tags.push('Ⓞ');
  if (command.admin) tags.push('Ⓐ');
  return tags.join('');
};

export const LEGEND = 'Ⓟ ᴘʀᴇᴍɪᴜᴍ  Ⓛ ʟɪᴍɪᴛ  Ⓞ ᴏᴡɴᴇʀ  Ⓐ ᴀᴅᴍɪɴ';

/** Línea de un comando dentro de una categoría. */
export const commandLine = (command, prefix) => {
  const tags = permissionTags(command);
  const args = command.args ? ` ${smallcaps(command.args)}` : '';
  return `┊ ✿ ${prefix}${smallcaps(command.name)}${args}${tags ? ` ${tags}` : ''}`;
};

/** Bloque de una categoría completa. */
export const renderCategory = (categoryKey, prefix) => {
  const grouped = commandsByCategory();
  const list = grouped.get(categoryKey);
  if (!list?.length) return null;
  const info = categoryInfo(categoryKey);
  const lines = [
    `୨୧ ❏ ${info.icon} ${smallcaps(info.label)}`,
    ...list.map((command) => commandLine(command, prefix)),
    '୨୧',
    '',
    `${smallcaps('total')} : ${list.length} ${smallcaps('comandos')}`,
    LEGEND,
  ];
  return lines.join('\n');
};

/** Todas las categorías, una detrás de otra. */
export const renderAllCategories = (prefix) => {
  const grouped = commandsByCategory();
  const blocks = [];
  for (const [key, list] of grouped) {
    const info = categoryInfo(key);
    blocks.push(
      [
        `୨୧ ❏ ${info.icon} ${smallcaps(info.label)}`,
        ...list.map((command) => commandLine(command, prefix)),
        '୨୧',
      ].join('\n'),
    );
  }
  blocks.push(`\n${smallcaps('total')} : ${totalCommands()} ${smallcaps('comandos')}\n${LEGEND}`);
  return blocks.join('\n\n');
};

/** Índice de categorías con su número de comandos. */
export const renderCategoryIndex = (prefix) => {
  const grouped = commandsByCategory();
  const lines = [`╭──( *${config.name}* )`];
  for (const [key, list] of grouped) {
    const info = categoryInfo(key);
    lines.push(`│ ${info.icon} ${smallcaps(info.label)} ☇ *${list.length}* ‣ ${prefix}menu ${key}`);
  }
  lines.push('╰━━━━━━━━━━━━━━━━━━━⬣');
  lines.push(`\n${smallcaps('usa')} *${prefix}menu <categoria>* ${smallcaps('o')} *${prefix}menu list*`);
  return lines.join('\n');
};

/** Caption del menú principal. */
export const mainMenuCaption = ({ pushName = 'usuario', status = 'Online' } = {}) => {
  const prefix = config.prefix;
  const mode = getMode() === 'public' ? 'PÚBLICO' : 'PRIVADO';
  return [
    `¡Hola, *${pushName}* 🎌`,
    `*${config.name}* está listo para acompañarte durante el día 🎐`,
    '¡Toca el botón de abajo y elige una opción del menú!',
    '',
    `╭──( *${config.name}*)`,
    `║🎌 Nombre del bot ☇ *${config.name}*`,
    `│⛩️ Propietario ☇ *${config.owner.name}*`,
    `║🏮 Versión ☇ *${config.version}*`,
    `│🍡 Modo ☇ *${mode}*`,
    `║🎴 Estado ☇ *${status}*`,
    `│🎐 Tiempo activo ☇ *${formatUptime()}*`,
    `║🍙 Usuario ☇ *${pushName}*`,
    `│🎋 Prefijo ☇ *${prefix}*`,
    `║🗾 Total de comandos ☇ *${formatNumber(totalCommands())}*`,
    '╰━━━━━━━━━━━━━━━━━━━⬣',
  ].join('\n');
};

/** Secciones para la lista interactiva. */
const buildSections = (prefix) => {
  const grouped = commandsByCategory();
  const rows = [...grouped.entries()].map(([key, list]) => {
    const info = categoryInfo(key);
    return {
      header: '',
      title: `${info.icon} ${info.label}`,
      description: `${list.length} comandos · ${info.description}`,
      id: `${prefix}menu ${key}`,
    };
  });
  const sections = [];
  for (let i = 0; i < rows.length; i += 10) {
    sections.push({ title: `Categorías ${i + 1}-${Math.min(i + 10, rows.length)}`, rows: rows.slice(i, i + 10) });
  }
  return sections;
};

/**
 * Envía el menú principal: imagen + caption + lista interactiva.
 * Si el formato interactivo no está soportado, cae a imagen + texto.
 */
export const sendMainMenu = async (sock, jid, { pushName, quoted } = {}) => {
  const caption = mainMenuCaption({ pushName });
  const footer = `${config.name} · ${config.version}`;
  const banner = fs.existsSync(paths.banner) ? fs.readFileSync(paths.banner) : null;

  try {
    const media = banner
      ? await prepareWAMessageMedia({ image: banner }, { upload: sock.waUploadToServer })
      : null;
    const interactive = {
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: caption }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        hasMediaAttachment: Boolean(media),
        ...(media || {}),
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '📚 VER LISTA DE COMANDOS',
              sections: buildSections(config.prefix),
            }),
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: '📜 Todos los comandos', id: `${config.prefix}menu list` }),
          },
        ],
      }),
    };

    const message = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject(interactive),
          },
        },
      },
      { userJid: sock.user?.id, quoted },
    );
    await sock.relayMessage(jid, message.message, { messageId: message.key.id });
    return { interactive: true };
  } catch (error) {
    log.warn({ err: error.message }, 'Menú interactivo no soportado, usando texto plano');
  }

  const fallbackCaption = `${caption}\n\n📚 *VER LISTA DE COMANDOS*\n› ${config.prefix}menu list\n› ${config.prefix}categories\n› ${config.prefix}menu <categoría>`;
  if (banner) {
    await sock.sendMessage(jid, { image: banner, caption: fallbackCaption }, { quoted });
  } else {
    await sock.sendMessage(jid, { text: fallbackCaption }, { quoted });
  }
  return { interactive: false };
};

export { findCategory };

export default {
  mainMenuCaption,
  renderCategory,
  renderAllCategories,
  renderCategoryIndex,
  sendMainMenu,
  permissionTags,
  commandLine,
  LEGEND,
};
