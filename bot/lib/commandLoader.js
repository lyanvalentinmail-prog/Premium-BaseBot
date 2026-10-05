/**
 * Cargador automático de comandos.
 * Escanea bot/commands/** y registra cada módulo. Un archivo puede exportar:
 *   export default { name, ... }           → un comando
 *   export default [ {...}, {...} ]        → varios comandos
 *   export const commands = [ ... ]        → varios comandos
 * La categoría se deduce de la carpeta si el comando no la declara.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { paths } from '../config.js';
import { createLogger } from './logger.js';
import { CATEGORY_ORDER, categoryInfo } from './categories.js';

const log = createLogger('loader');

/** @type {Map<string, object>} nombre → comando */
export const commands = new Map();
/** @type {Map<string, string>} alias → nombre */
export const aliases = new Map();

const walk = (dir) => {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) entries.push(...walk(full));
    else if (item.isFile() && item.name.endsWith('.js') && !item.name.startsWith('_')) entries.push(full);
  }
  return entries;
};

const validate = (command, file) => {
  const problems = [];
  if (!command || typeof command !== 'object') problems.push('el módulo no exporta un objeto');
  else {
    if (!command.name || typeof command.name !== 'string') problems.push('falta "name"');
    if (typeof command.execute !== 'function') problems.push('falta "execute()"');
  }
  if (problems.length) {
    log.error({ file: path.relative(paths.root, file), problems }, 'Comando inválido, se omite');
    return false;
  }
  return true;
};

const register = (command, file) => {
  const folder = path.relative(paths.commands, path.dirname(file)).split(path.sep)[0] || 'main';
  const normalized = {
    aliases: [],
    category: folder,
    args: '',
    description: '',
    limit: false,
    premium: false,
    owner: false,
    admin: false,
    botAdmin: false,
    groupOnly: false,
    privateOnly: false,
    cooldown: 3,
    hidden: false,
    ...command,
    name: String(command.name).toLowerCase(),
    file,
  };
  normalized.aliases = (normalized.aliases || []).map((alias) => String(alias).toLowerCase());

  if (commands.has(normalized.name)) {
    log.warn({ command: normalized.name, file: path.relative(paths.root, file) }, 'Comando duplicado, se omite');
    return false;
  }
  commands.set(normalized.name, normalized);
  for (const alias of normalized.aliases) {
    if (commands.has(alias) || aliases.has(alias)) {
      log.warn({ alias, command: normalized.name }, 'Alias duplicado, se omite');
      continue;
    }
    aliases.set(alias, normalized.name);
  }
  return true;
};

/** Carga (o recarga) todos los comandos. */
export const loadCommands = async ({ reload = false } = {}) => {
  commands.clear();
  aliases.clear();
  const files = walk(paths.commands);
  let failed = 0;
  for (const file of files) {
    try {
      const url = pathToFileURL(file).href + (reload ? `?t=${Date.now()}` : '');
      const module = await import(url);
      const exported = module.default ?? module.commands ?? module.command;
      const list = Array.isArray(exported) ? exported : [exported];
      for (const item of list) {
        if (validate(item, file)) register(item, file);
      }
    } catch (error) {
      failed += 1;
      log.error({ file: path.relative(paths.root, file), err: error.message }, 'No se pudo cargar el archivo');
    }
  }
  log.info({ commands: commands.size, aliases: aliases.size, files: files.length, failed }, 'Comandos cargados');
  return { total: commands.size, files: files.length, failed };
};

/** Resuelve un comando por nombre o alias. */
export const resolveCommand = (input) => {
  if (!input) return null;
  const key = String(input).toLowerCase();
  if (commands.has(key)) return commands.get(key);
  const aliased = aliases.get(key);
  return aliased ? commands.get(aliased) : null;
};

export const listCommands = ({ includeHidden = false } = {}) =>
  [...commands.values()].filter((command) => includeHidden || !command.hidden);

/** Comandos agrupados por categoría, en el orden definido en categories.js. */
export const commandsByCategory = ({ includeHidden = false } = {}) => {
  const map = new Map();
  for (const command of listCommands({ includeHidden })) {
    if (!map.has(command.category)) map.set(command.category, []);
    map.get(command.category).push(command);
  }
  const sorted = new Map();
  const keys = [...map.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
  for (const key of keys) {
    sorted.set(
      key,
      map.get(key).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return sorted;
};

export const categoryNames = () => [...commandsByCategory().keys()];

export const totalCommands = () => listCommands().length;

export const findCategory = (input) => {
  const key = String(input || '').toLowerCase();
  const names = categoryNames();
  if (names.includes(key)) return key;
  return names.find((name) => categoryInfo(name).label.toLowerCase() === key) || null;
};

export default { loadCommands, resolveCommand, listCommands, commandsByCategory, categoryNames, totalCommands, commands, aliases, findCategory };
