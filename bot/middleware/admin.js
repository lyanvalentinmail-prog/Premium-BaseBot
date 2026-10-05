/** Middleware: comandos de administradores de grupo (y verificación de bot admin). */
import { MESSAGES } from '../lib/permissions.js';

export const adminMiddleware = async (ctx, command) => {
  if (command.groupOnly && !ctx.isGroup) return { ok: false, message: MESSAGES.group };
  if (command.privateOnly && ctx.isGroup) return { ok: false, message: MESSAGES.private };
  if (command.admin) {
    if (!ctx.isGroup) return { ok: false, message: MESSAGES.group };
    // La metadata se refresca en cada mensaje de grupo (ver handler): no se confía en caché antigua.
    if (!ctx.isAdmin && !ctx.isOwner) return { ok: false, message: MESSAGES.admin };
  }
  if (command.botAdmin) {
    if (!ctx.isGroup) return { ok: false, message: MESSAGES.group };
    if (!ctx.isBotAdmin) return { ok: false, message: MESSAGES.botAdmin };
  }
  return { ok: true };
};

export default adminMiddleware;
