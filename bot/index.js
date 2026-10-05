/**
 * Punto de entrada del bot.
 * Inicializa directorios, base de datos, comandos y la conexión con WhatsApp.
 */
import process from 'node:process';
import config, { paths, ownerNumbers } from './config.js';
import { createLogger, logger } from './lib/logger.js';
import { ensureDir } from './lib/utils.js';
import { cleanTempDir } from './lib/media.js';
import { initDatabase, closeDatabase, flush } from './database/index.js';
import { loadCommands, totalCommands } from './lib/commandLoader.js';
import { startConnection, closeConnection, setShuttingDown } from './connection.js';

const log = createLogger('bot');

const printBanner = () => {
  console.log(`
╭──「 ${config.name} 」
│
│ 🤖 Bot      ☇ ${config.name} v${config.version}
│ 🎋 Prefijo  ☇ ${config.prefix}
│ 👑 Owner    ☇ ${config.owner.name}${ownerNumbers.length ? '' : '  ⚠️ (OWNER_NUMBER sin configurar)'}
│ 🌐 Modo     ☇ ${config.mode}
│ 🟢 Node     ☇ ${process.version}
│
╰────────────────────⬣
`);
};

const ensureDirectories = () => {
  for (const dir of [paths.data, paths.sessions, paths.temp, paths.sounds, paths.logs]) ensureDir(dir);
};

let shuttingDown = false;

const shutdown = async (signal, code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  setShuttingDown(true);
  log.info({ signal }, 'Apagando el bot…');
  try {
    await closeConnection();
  } catch (error) {
    log.warn({ err: error.message }, 'Error cerrando la conexión');
  }
  try {
    closeDatabase();
  } catch (error) {
    log.warn({ err: error.message }, 'Error cerrando la base de datos');
  }
  cleanTempDir(0);
  log.info('Apagado completado');
  // Da tiempo a vaciar los streams de log.
  setTimeout(() => process.exit(code), 150);
};

const main = async () => {
  printBanner();
  ensureDirectories();

  if (!ownerNumbers.length) {
    log.warn('OWNER_NUMBER no está configurado: los comandos de owner no funcionarán.');
  }

  await initDatabase();
  const { total, failed } = await loadCommands();
  if (failed) log.warn({ failed }, 'Algunos archivos de comandos no se pudieron cargar');
  log.info({ total }, 'Bot inicializado');

  // Limpieza periódica de temporales
  const cleanupTimer = setInterval(() => {
    const removed = cleanTempDir();
    if (removed) log.debug({ removed }, 'Temporales eliminados');
  }, 10 * 60_000);
  cleanupTimer.unref?.();

  await startConnection({
    onReady: async () => {
      log.info({ commands: totalCommands() }, 'Listo para recibir mensajes');
    },
  });
};

/* ── Manejo global de errores: un fallo nunca debe tumbar el proceso ── */
process.on('unhandledRejection', (reason) => {
  logger.error({ module: 'process', err: reason?.message || String(reason) }, 'Promesa rechazada sin manejar');
});

process.on('uncaughtException', (error) => {
  logger.error({ module: 'process', err: error.message, stack: error.stack }, 'Excepción no capturada');
  flush();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

main().catch((error) => {
  log.fatal({ err: error.message, stack: error.stack }, 'No se pudo iniciar el bot');
  shutdown('fatal', 1);
});
