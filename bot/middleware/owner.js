/** Middleware: comandos exclusivos del propietario. */
import { MESSAGES } from '../lib/permissions.js';

export const ownerMiddleware = async (ctx, command) => {
  if (!command.owner) return { ok: true };
  if (ctx.isOwner) return { ok: true };
  return { ok: false, message: MESSAGES.owner };
};

export default ownerMiddleware;
