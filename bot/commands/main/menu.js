/** Menú principal, listado por categorías y navegación alternativa por texto. */
import config from '../../config.js';
import {
  sendMainMenu,
  renderCategory,
  renderAllCategories,
  renderCategoryIndex,
} from '../../lib/menu.js';
import { findCategory, commandsByCategory, totalCommands } from '../../lib/commandLoader.js';
import { categoryInfo } from '../../lib/categories.js';
import { smallcaps } from '../../lib/utils.js';

const menu = {
  name: 'menu',
  aliases: ['menú', 'm', 'start'],
  category: 'main',
  args: '[categoria]',
  description: 'Muestra el menú principal o una categoría concreta',
  cooldown: 5,
  async execute(ctx) {
    const option = (ctx.args[0] || '').toLowerCase();

    if (!option) {
      await sendMainMenu(ctx.sock, ctx.chat, { pushName: ctx.pushName, quoted: ctx.m.raw });
      return;
    }

    if (['list', 'all', 'todo', 'todos'].includes(option)) {
      await ctx.reply(renderAllCategories(ctx.prefix));
      return;
    }

    const category = findCategory(option);
    if (!category) {
      await ctx.reply(
        `❌ La categoría *${option}* no existe.\n\n${renderCategoryIndex(ctx.prefix)}`,
      );
      return;
    }
    await ctx.reply(renderCategory(category, ctx.prefix));
  },
};

const commandsCmd = {
  name: 'commands',
  aliases: ['comandos', 'cmds'],
  category: 'main',
  args: '[categoria]',
  description: 'Lista todos los comandos disponibles',
  cooldown: 5,
  async execute(ctx) {
    const option = (ctx.args[0] || '').toLowerCase();
    if (!option) {
      await ctx.reply(renderAllCategories(ctx.prefix));
      return;
    }
    const category = findCategory(option);
    if (!category) {
      await ctx.reply(`❌ La categoría *${option}* no existe.\n\n${renderCategoryIndex(ctx.prefix)}`);
      return;
    }
    await ctx.reply(renderCategory(category, ctx.prefix));
  },
};

const categories = {
  name: 'categories',
  aliases: ['categorias', 'cats'],
  category: 'main',
  description: 'Muestra las categorías disponibles',
  async execute(ctx) {
    await ctx.reply(renderCategoryIndex(ctx.prefix));
  },
};

const help = {
  name: 'help',
  aliases: ['ayuda', 'h'],
  category: 'main',
  args: '[comando]',
  description: 'Ayuda general o detalle de un comando',
  async execute(ctx) {
    const query = (ctx.args[0] || '').toLowerCase().replace(ctx.prefix, '');
    if (!query) {
      await ctx.reply(
        [
          `╭──( *${config.name}* )`,
          `│ 🎋 Prefijo ☇ *${ctx.prefix}*`,
          `│ 🗾 Comandos ☇ *${totalCommands()}*`,
          `│ 🗂️ Categorías ☇ *${commandsByCategory().size}*`,
          '╰━━━━━━━━━━━━━━━━━━━⬣',
          '',
          `• *${ctx.prefix}menu* ‣ menú principal`,
          `• *${ctx.prefix}menu <categoría>* ‣ comandos de una categoría`,
          `• *${ctx.prefix}menu list* ‣ todos los comandos`,
          `• *${ctx.prefix}help <comando>* ‣ detalle de un comando`,
          '',
          `${smallcaps('argumentos')}: <obligatorio> [opcional] (no escribas los símbolos)`,
        ].join('\n'),
      );
      return;
    }

    const { resolveCommand } = await import('../../lib/commandLoader.js');
    const command = resolveCommand(query);
    if (!command) {
      await ctx.reply(`❌ No existe el comando *${query}*. Usa *${ctx.prefix}menu list*.`);
      return;
    }
    const info = categoryInfo(command.category);
    const flags = [
      command.premium && 'Premium Ⓟ',
      command.limit && 'Consume límite Ⓛ',
      command.owner && 'Solo owner Ⓞ',
      command.admin && 'Solo admins Ⓐ',
      command.botAdmin && 'Requiere bot admin',
      command.groupOnly && 'Solo grupos',
      command.privateOnly && 'Solo privado',
    ].filter(Boolean);

    await ctx.reply(
      [
        `╭──( *${ctx.prefix}${command.name}* )`,
        `│ 📁 Categoría ☇ ${info.icon} ${info.label}`,
        `│ 📝 Descripción ☇ ${command.description || '—'}`,
        `│ ⌨️ Uso ☇ ${ctx.prefix}${command.name}${command.args ? ` ${command.args}` : ''}`,
        command.example ? `│ 💡 Ejemplo ☇ ${ctx.prefix}${command.example}` : null,
        command.aliases?.length ? `│ 🔁 Alias ☇ ${command.aliases.join(', ')}` : null,
        flags.length ? `│ 🔐 Requisitos ☇ ${flags.join(' · ')}` : null,
        '╰━━━━━━━━━━━━━━━━━━━⬣',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  },
};

export default [menu, commandsCmd, categories, help];
