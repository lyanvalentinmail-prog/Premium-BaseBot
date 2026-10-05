/** Middleware: comandos premium (el owner siempre pasa). */
import { MESSAGES } from '../lib/permissions.js';

export const premiumMiddleware = async (ctx, command) => {
  if (!command.premium) return { ok: true };
  if (ctx.isOwner || ctx.isPremium) return { ok: true };
  return {
    ok: false,
    message: `${MESSAGES.premium}\n\nConsulta *${ctx.prefix}premium* para más información.`,
  };
};

export default premiumMiddleware;
