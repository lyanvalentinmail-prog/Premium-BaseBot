/**
 * Handler de mensajes: parseo, permisos, límites y ejecución de comandos.
 * Mantiene la lógica mínima: cada responsabilidad vive en lib/ o middleware/.
 */
import config, { activePrefixes } from './config.js';
import { createLogger } from './lib/logger.js';
import { serialize } from './lib/serialize.js';
import { createContext } from './lib/context.js';
import { resolveCommand } from './lib/commandLoader.js';
import { validateArgs } from './lib/validators.js';
import { isOwnerJid, isGroupAdmin, MESSAGES } from './lib/permissions.js';
import { consumeLimit, refundLimit } from './lib/limits.js';
import { checkCooldown, jidToNumber } from './lib/utils.js';
import { UserError, ProviderError, NotConfiguredError } from './lib/errors.js';
import { getUser, incrementStat, isBanned } from './database/users.js';
import { getGroup } from './database/groups.js';
import { isPremium } from './database/premium.js';
import { grantActivityXp } from './database/xp.js';
import { canUseInPrivateMode, getAdmins } from './lib/permissions.js';
import { isCommandBlocked } from './database/settings.js';
import ownerMiddleware from './middleware/owner.js';
import adminMiddleware from './middleware/admin.js';
import premiumMiddleware from './middleware/premium.js';
import limitMiddleware from './middleware/limit.js';
import { handleAntilink } from './lib/antilink.js';
import { handleGameInput } from './lib/games.js';

const log = createLogger('handler');

const MIDDLEWARES = [ownerMiddleware, adminMiddleware, premiumMiddleware, limitMiddleware];

/** Caché de metadata de grupo con TTL corto (no se confía en datos antiguos). */
const metadataCache = new Map();
const METADATA_TTL = 60_000;

export const getGroupMetadata = async (sock, jid, { force = false } = {}) => {
  const cached = metadataCache.get(jid);
  if (!force && cached && cached.expires > Date.now()) return cached.data;
  try {
    const data = await sock.groupMetadata(jid);
    metadataCache.set(jid, { data, expires: Date.now() + METADATA_TTL });
    return data;
  } catch (error) {
    log.warn({ jid, err: error.message }, 'No se pudo obtener la metadata del grupo');
    return cached?.data || null;
  }
};

export const invalidateGroupMetadata = (jid) => metadataCache.delete(jid);

/** Detecta el prefijo usado en un texto. */
const detectPrefix = (text) => {
  for (const prefix of activePrefixes) {
    if (text.startsWith(prefix)) return prefix;
  }
  return null;
};

/**
 * Procesa un mensaje entrante.
 * @param {import('baileys').WASocket} sock
 * @param {object} raw mensaje crudo de Baileys
 */
export const handleMessage = async (sock, raw) => {
  const m = serialize(raw, sock);
  if (!m) return;
  if (m.chat === 'status@broadcast') return;
  if (['protocolMessage', 'senderKeyDistributionMessage', 'reactionMessage'].includes(m.type)) return;
  if (!m.sender) return;

  const botNumber = jidToNumber(sock.user?.id || '');
  const isSelf = jidToNumber(m.sender) === botNumber;
  const isOwner = isOwnerJid(m.sender) || isSelf;

  // Mensajes propios: solo se procesan si son comandos (evita bucles de respuesta).
  const rawText = (m.text || '').trim();
  const prefix = detectPrefix(rawText);
  if (m.fromMe && (!config.behaviour.selfReply || !prefix)) return;

  const user = getUser(m.sender, m.pushName);
  const group = m.isGroup ? getGroup(m.chat) : null;

  if (!m.fromMe) {
    incrementStat(m.sender, 'messages');
    grantActivityXp(m.sender);
  }

  // Antilink (solo grupos y si está activado)
  if (m.isGroup) {
    try {
      const metadata = await getGroupMetadata(sock, m.chat);
      const handled = await handleAntilink({ sock, m, group, metadata, isOwner });
      if (handled) return;
    } catch (error) {
      log.warn({ err: error.message }, 'Fallo en antilink');
    }
  }

  // Partidas activas: los mensajes sin prefijo pueden ser jugadas.
  if (!prefix && !m.fromMe) {
    try {
      const handled = await handleGameInput({ sock, m });
      if (handled) return;
    } catch (error) {
      log.warn({ err: error.message }, 'Fallo procesando una jugada');
    }
  }

  if (!prefix) return;

  const withoutPrefix = rawText.slice(prefix.length).trim();
  if (!withoutPrefix) return;
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  const command = resolveCommand(commandName);
  if (!command) return;

  // Usuarios baneados: sin excepciones salvo el owner.
  if (!isOwner && (user.banned || isBanned(m.sender))) {
    await sock.sendMessage(m.chat, { text: MESSAGES.banned }, { quoted: raw });
    return;
  }

  // Modo privado
  if (!canUseInPrivateMode(m.sender) && !isOwner) return;

  // Comandos desactivados por el owner
  if (isCommandBlocked(command.name) && !isOwner) {
    await sock.sendMessage(m.chat, { text: MESSAGES.blocked }, { quoted: raw });
    return;
  }

  // Metadata de grupo fresca para permisos
  let groupMetadata = null;
  let isAdmin = false;
  let isBotAdmin = false;
  if (m.isGroup) {
    groupMetadata = await getGroupMetadata(sock, m.chat, { force: command.admin || command.botAdmin });
    if (groupMetadata) {
      isAdmin = isGroupAdmin(groupMetadata, m.sender);
      isBotAdmin = getAdmins(groupMetadata).some((jid) => jidToNumber(jid) === botNumber);
    }
  }

  const text = args.join(' ');
  const ctx = createContext({
    sock,
    m,
    prefix,
    commandName: command.name,
    args,
    text,
    isOwner,
    isAdmin,
    isBotAdmin,
    isPremium: isPremium(m.sender),
    groupMetadata,
    user,
    group,
    command,
  });

  // Anti-spam / cooldown por comando y usuario
  const cooldownMs = Math.max(command.cooldown ?? 0, config.behaviour.antiSpamSeconds) * 1000;
  if (!isOwner && cooldownMs > 0) {
    const remaining = checkCooldown(`${m.sender}:${command.name}`, cooldownMs);
    if (remaining > 0) {
      if (remaining > 1500) {
        await ctx.react('🕒');
      }
      return;
    }
  }

  // Middlewares de permisos
  for (const middleware of MIDDLEWARES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await middleware(ctx, command);
    if (!result.ok) {
      await ctx.reply(result.message);
      return;
    }
  }

  // Validación de argumentos ANTES de consumir límite
  let limitConsumed = false;
  try {
    validateArgs(command, ctx);

    if (command.limit && !isOwner) {
      if (!consumeLimit(m.sender, 1)) {
        await ctx.reply(MESSAGES.limit);
        return;
      }
      limitConsumed = true;
    }

    if (config.behaviour.autoTyping) await ctx.sendTyping();
    if (config.behaviour.reactOnCommand && command.react !== false) {
      await ctx.react(command.react || '⏳');
    }

    const started = Date.now();
    await command.execute(ctx);
    incrementStat(m.sender, 'commands');

    log.info(
      {
        command: command.name,
        user: jidToNumber(m.sender),
        chat: m.isGroup ? 'group' : 'private',
        ms: Date.now() - started,
      },
      'Comando ejecutado',
    );

    if (config.behaviour.reactOnCommand && command.react !== false) await ctx.react('✅');
  } catch (error) {
    // Si el fallo es del proveedor externo, se devuelve el límite consumido.
    if (limitConsumed && (error instanceof ProviderError || error instanceof NotConfiguredError)) {
      refundLimit(m.sender, 1);
    }
    if (error instanceof UserError) {
      await ctx.reply(error.message).catch(() => {});
      if (config.behaviour.reactOnCommand && command.react !== false) await ctx.react('⚠️');
      return;
    }
    log.error({ command: command.name, err: error.message, stack: error.stack }, 'Error en comando');
    await ctx
      .reply('❌ Ha ocurrido un error inesperado al ejecutar este comando. El incidente ha sido registrado.')
      .catch(() => {});
    if (config.behaviour.reactOnCommand && command.react !== false) await ctx.react('❌');
  }
};

export default handleMessage;
