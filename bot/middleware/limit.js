/**
 * Middleware: límite diario.
 * Aquí solo se COMPRUEBA que quede límite; el consumo real lo realiza el handler
 * justo antes de ejecutar la operación costosa (y se reembolsa si el proveedor falla).
 */
import { hasLimit, getLimit } from '../lib/limits.js';
import { MESSAGES } from '../lib/permissions.js';

export const limitMiddleware = async (ctx, command) => {
  if (!command.limit) return { ok: true };
  if (ctx.isOwner) return { ok: true };
  if (hasLimit(ctx.sender, 1)) return { ok: true };
  const { max } = getLimit(ctx.sender);
  return {
    ok: false,
    message: `${MESSAGES.limit}\n\nLímite diario: *${max}*\nSe reinicia a las 00:00 UTC.\nHazte Premium con *${ctx.prefix}premium*`,
  };
};

export default limitMiddleware;
