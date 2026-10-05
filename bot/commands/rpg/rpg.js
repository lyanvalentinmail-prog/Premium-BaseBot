/** Sistema RPG persistente: combate, aventuras, inventario, equipo y misiones. */
import config from '../../config.js';
import {
  getPlayer, updatePlayer, addRpgXp, addGold, changeHp, getRpgInventory,
  addRpgItem, rpgXpNeeded, topPlayers, isRegistered,
} from '../../database/rpg.js';
import { MONSTERS, BOSSES, DUNGEONS, QUESTS, RECIPES, ADVENTURE_EVENTS, itemById } from '../../lib/data/items.js';
import { pickRandom, randomInt, formatNumber, progressBar, checkCooldown, formatDuration, jidToNumber } from '../../lib/utils.js';
import { UserError } from '../../lib/errors.js';

const cooldown = (ctx, key, seconds) => {
  const remaining = checkCooldown(`rpg:${key}:${ctx.sender}`, seconds * 1000);
  if (remaining > 0) {
    throw new UserError(`⏳ Debes esperar *${formatDuration(Math.ceil(remaining / 1000))}* para volver a usar este comando.`);
  }
};

const statsOf = (player) => {
  const weapon = itemById(player.weapon);
  const armor = itemById(player.armor);
  return {
    atk: player.atk + (weapon?.atk || 0),
    def: player.def + (armor?.def || 0),
    weapon,
    armor,
  };
};

const rpg = {
  name: 'rpg',
  aliases: ['perfilrpg'],
  category: 'rpg',
  description: 'Muestra tu perfil de aventurero (te registra la primera vez)',
  async execute(ctx) {
    const isNew = !isRegistered(ctx.sender);
    const player = getPlayer(ctx.sender);
    const { atk, def, weapon, armor } = statsOf(player);
    await ctx.reply(
      [
        isNew ? '🎉 *¡Bienvenido al RPG!* Has creado tu personaje.\n' : '',
        '╭──「 ⚔ AVENTURERO 」',
        `│ 🙍 ☇ ${ctx.pushName}`,
        `│ ★ Nivel ☇ ${player.level}`,
        `│ ✨ XP ☇ ${formatNumber(player.xp)}/${formatNumber(rpgXpNeeded(player.level))}`,
        `│ ${progressBar(player.xp, rpgXpNeeded(player.level))}`,
        `│ ❤️ HP ☇ ${player.hp}/${player.max_hp}`,
        `│ ⚔️ ATK ☇ ${atk}${weapon ? ` (${weapon.emoji} ${weapon.name})` : ''}`,
        `│ 🛡️ DEF ☇ ${def}${armor ? ` (${armor.emoji} ${armor.name})` : ''}`,
        `│ 💰 Oro ☇ ${formatNumber(player.gold)}`,
        `│ 🏆 Victorias ☇ ${player.wins} · Derrotas ${player.losses}`,
        '╰────────────────────⬣',
        '',
        `Comandos: ${ctx.prefix}hunt · ${ctx.prefix}adventure · ${ctx.prefix}dungeon · ${ctx.prefix}boss · ${ctx.prefix}quest`,
      ].filter(Boolean).join('\n'),
    );
  },
};

const hunt = {
  name: 'hunt',
  aliases: ['cazar'],
  category: 'rpg',
  description: 'Caza un monstruo (cooldown 60s)',
  async execute(ctx) {
    cooldown(ctx, 'hunt', 60);
    const player = getPlayer(ctx.sender);
    if (player.hp <= 0) throw new UserError(`💀 Estás derrotado. Usa *${ctx.prefix}heal* para recuperarte.`);
    const pool = MONSTERS.filter((monster) => monster.level <= player.level + 2);
    const monster = pickRandom(pool.length ? pool : [MONSTERS[0]]);
    const { atk, def } = statsOf(player);

    let monsterHp = monster.hp;
    let playerHp = player.hp;
    const log = [];
    for (let round = 1; round <= 10 && monsterHp > 0 && playerHp > 0; round += 1) {
      const damage = Math.max(1, atk + randomInt(-3, 5));
      monsterHp -= damage;
      if (monsterHp <= 0) {
        log.push(`⚔️ Golpe final de ${damage} de daño.`);
        break;
      }
      const taken = Math.max(1, monster.atk - Math.floor(def / 2) + randomInt(-2, 3));
      playerHp -= taken;
      log.push(`⚔️ Le hiciste ${damage} · 🩸 recibiste ${taken}`);
    }

    if (monsterHp <= 0) {
      const xp = addRpgXp(ctx.sender, monster.xp);
      addGold(ctx.sender, monster.gold);
      updatePlayer(ctx.sender, {
        hp: Math.max(1, playerHp),
        wins: player.wins + 1,
        ...(player.quest === 'cazador' ? { quest_progress: player.quest_progress + 1 } : {}),
      });
      await ctx.reply(
        [
          `🏹 *CAZA* — ${monster.emoji} ${monster.name}`,
          '',
          ...log.slice(-4),
          '',
          `🎉 ¡Victoria! +${monster.xp} XP · +${monster.gold} oro`,
          `❤️ HP ☇ ${Math.max(1, playerHp)}/${player.max_hp}`,
          xp.leveledUp ? `🆙 ¡Has subido al nivel *${xp.level}*!` : '',
        ].filter(Boolean).join('\n'),
      );
      return;
    }

    updatePlayer(ctx.sender, { hp: Math.max(0, playerHp), losses: player.losses + 1 });
    await ctx.reply(
      [
        `🏹 *CAZA* — ${monster.emoji} ${monster.name}`,
        '',
        ...log.slice(-4),
        '',
        `💀 Has sido derrotado. Usa *${ctx.prefix}heal*.`,
      ].join('\n'),
    );
  },
};

const adventure = {
  name: 'adventure',
  aliases: ['aventura'],
  category: 'rpg',
  description: 'Sal de aventura y encuentra recursos (cooldown 5 min)',
  async execute(ctx) {
    cooldown(ctx, 'adventure', 300);
    const current = getPlayer(ctx.sender);
    if (current.quest === 'explorador') {
      updatePlayer(ctx.sender, { quest_progress: current.quest_progress + 1 });
    }
    const event = pickRandom(ADVENTURE_EVENTS);
    const gold = randomInt(event.gold[0], event.gold[1]);
    const xp = randomInt(event.xp[0], event.xp[1]);
    addGold(ctx.sender, gold);
    const levelUp = addRpgXp(ctx.sender, xp);
    if (event.item) addRpgItem(ctx.sender, event.item, event.qty);
    await ctx.reply(
      [
        '🧭 *AVENTURA*',
        '',
        event.text,
        '',
        event.item ? `🎁 Obtenido ☇ ${itemById(event.item)?.emoji || ''} ${itemById(event.item)?.name || event.item} x${event.qty}` : null,
        `💰 Oro ☇ +${gold}`,
        `✨ XP ☇ +${xp}`,
        levelUp.leveledUp ? `🆙 ¡Nivel *${levelUp.level}*!` : null,
      ].filter(Boolean).join('\n'),
    );
  },
};

const dungeon = {
  name: 'dungeon',
  aliases: ['mazmorra'],
  category: 'rpg',
  args: '[numero]',
  description: 'Explora una mazmorra (cooldown 10 min)',
  async execute(ctx) {
    const player = getPlayer(ctx.sender);
    const index = ctx.args[0] ? Number(ctx.args[0]) - 1 : null;
    if (index === null) {
      await ctx.reply(
        [
          '🏰 *MAZMORRAS*',
          '',
          ...DUNGEONS.map((d, i) => `${i + 1}. *${d.name}* — nivel mínimo ${d.minLevel}`),
          '',
          `Uso: ${ctx.prefix}dungeon <numero>`,
        ].join('\n'),
      );
      return;
    }
    const selected = DUNGEONS[index];
    if (!selected) throw new UserError('❌ Esa mazmorra no existe.');
    if (player.level < selected.minLevel) throw new UserError(`❌ Necesitas ser nivel *${selected.minLevel}* para entrar.`);
    cooldown(ctx, 'dungeon', 600);
    if (player.hp < player.max_hp * 0.3) throw new UserError(`❌ Tu HP es demasiado bajo. Usa *${ctx.prefix}heal*.`);

    const { def } = statsOf(player);
    const failed = Math.random() < selected.danger - Math.min(0.25, def / 200);
    if (failed) {
      const damage = randomInt(20, 60);
      const hp = changeHp(ctx.sender, -damage);
      updatePlayer(ctx.sender, { losses: player.losses + 1 });
      await ctx.reply(`🏰 *${selected.name}*\n\n💥 Las trampas te vencieron. Perdiste ${damage} HP.\n❤️ HP ☇ ${hp}/${player.max_hp}`);
      return;
    }
    const gold = randomInt(selected.rewardGold[0], selected.rewardGold[1]);
    const xp = randomInt(selected.rewardXp[0], selected.rewardXp[1]);
    addGold(ctx.sender, gold);
    const levelUp = addRpgXp(ctx.sender, xp);
    changeHp(ctx.sender, -randomInt(5, 25));
    updatePlayer(ctx.sender, { wins: player.wins + 1 });
    await ctx.reply(
      [
        `🏰 *${selected.name}*`,
        '',
        '🗝️ ¡Has completado la mazmorra!',
        `💰 Oro ☇ +${gold}`,
        `✨ XP ☇ +${xp}`,
        levelUp.leveledUp ? `🆙 ¡Nivel *${levelUp.level}*!` : null,
      ].filter(Boolean).join('\n'),
    );
  },
};

const boss = {
  name: 'boss',
  aliases: ['jefe'],
  category: 'rpg',
  description: 'Enfréntate a un jefe (cooldown 30 min)',
  async execute(ctx) {
    const player = getPlayer(ctx.sender);
    const available = BOSSES.filter((b) => player.level >= b.level);
    if (!available.length) throw new UserError(`❌ Necesitas ser nivel *${BOSSES[0].level}* para retar a un jefe.`);
    cooldown(ctx, 'boss', 1800);
    const target = available.at(-1);
    const { atk, def } = statsOf(player);

    let bossHp = target.hp;
    let playerHp = player.hp;
    let rounds = 0;
    while (bossHp > 0 && playerHp > 0 && rounds < 30) {
      bossHp -= Math.max(1, atk + randomInt(-4, 8));
      if (bossHp <= 0) break;
      playerHp -= Math.max(1, target.atk - Math.floor(def / 2) + randomInt(-4, 6));
      rounds += 1;
    }

    if (bossHp <= 0) {
      addGold(ctx.sender, target.gold);
      const levelUp = addRpgXp(ctx.sender, target.xp);
      updatePlayer(ctx.sender, { hp: Math.max(1, playerHp), wins: player.wins + 1 });
      addRpgItem(ctx.sender, 'diamante', 1);
      await ctx.reply(
        [
          `${target.emoji} *${target.name}* derrotado en ${rounds} asaltos.`,
          '',
          `💰 +${target.gold} oro · ✨ +${target.xp} XP · 💎 +1 diamante`,
          `❤️ HP ☇ ${Math.max(1, playerHp)}/${player.max_hp}`,
          levelUp.leveledUp ? `🆙 ¡Nivel *${levelUp.level}*!` : null,
        ].filter(Boolean).join('\n'),
      );
      return;
    }
    updatePlayer(ctx.sender, { hp: 0, losses: player.losses + 1 });
    await ctx.reply(`${target.emoji} *${target.name}* te ha derrotado.\nUsa *${ctx.prefix}heal* para recuperarte.`);
  },
};

const fight = {
  name: 'fight',
  aliases: ['pelear', 'duelo'],
  category: 'rpg',
  args: '<@usuario>',
  description: 'Duelo contra otro jugador',
  groupOnly: true,
  skipArgCheck: true,
  async execute(ctx) {
    const rival = ctx.mentions[0] || ctx.quoted?.sender;
    if (!rival) throw new UserError(`❌ Menciona a tu rival.\n\nUso:\n${ctx.prefix}fight <@usuario>`);
    if (rival === ctx.sender) throw new UserError('❌ No puedes pelear contigo mismo.');
    cooldown(ctx, 'fight', 120);

    const a = getPlayer(ctx.sender);
    const b = getPlayer(rival);
    const statsA = statsOf(a);
    const statsB = statsOf(b);
    let hpA = a.hp || 1;
    let hpB = b.hp || 1;
    const log = [];
    for (let round = 1; round <= 8 && hpA > 0 && hpB > 0; round += 1) {
      const dmgA = Math.max(1, statsA.atk - Math.floor(statsB.def / 2) + randomInt(-3, 6));
      hpB -= dmgA;
      if (hpB <= 0) break;
      const dmgB = Math.max(1, statsB.atk - Math.floor(statsA.def / 2) + randomInt(-3, 6));
      hpA -= dmgB;
      log.push(`R${round}: −${dmgA} / −${dmgB}`);
    }
    const winner = hpB <= 0 ? ctx.sender : hpA <= 0 ? rival : hpA >= hpB ? ctx.sender : rival;
    const loser = winner === ctx.sender ? rival : ctx.sender;
    addGold(winner, 150);
    addRpgXp(winner, 80);
    updatePlayer(ctx.sender, { hp: Math.max(0, hpA) });
    updatePlayer(rival, { hp: Math.max(0, hpB) });
    updatePlayer(winner, { wins: getPlayer(winner).wins + 1 });
    updatePlayer(loser, { losses: getPlayer(loser).losses + 1 });

    await ctx.reply({
      text: [
        '⚔️ *DUELO*',
        '',
        `@${jidToNumber(ctx.sender)} (${statsA.atk} ATK) vs @${jidToNumber(rival)} (${statsB.atk} ATK)`,
        '',
        ...log.slice(-5),
        '',
        `🏆 Ganador: @${jidToNumber(winner)} (+150 oro, +80 XP)`,
      ].join('\n'),
      mentions: [ctx.sender, rival],
    });
  },
};

const inventoryRpg = {
  name: 'rpginv',
  aliases: ['rpginventory', 'mochila'],
  category: 'rpg',
  description: 'Inventario del RPG',
  async execute(ctx) {
    const inventory = getRpgInventory(ctx.sender);
    const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
    const player = getPlayer(ctx.sender);
    await ctx.reply(
      [
        '🎒 *INVENTARIO RPG*',
        '',
        entries.length
          ? entries.map(([id, qty]) => `• ${itemById(id)?.emoji || '📦'} ${itemById(id)?.name || id} x${qty}`).join('\n')
          : '_Vacío._',
        '',
        `🗡️ Arma ☇ ${itemById(player.weapon)?.name || 'ninguna'}`,
        `🛡️ Armadura ☇ ${itemById(player.armor)?.name || 'ninguna'}`,
        `💰 Oro ☇ ${formatNumber(player.gold)}`,
      ].join('\n'),
    );
  },
};

const equip = {
  name: 'equip',
  aliases: ['equipar'],
  category: 'rpg',
  args: '<id>',
  description: 'Equipa un arma o armadura de tu inventario',
  example: 'equip espada',
  async execute(ctx) {
    const id = ctx.args[0].toLowerCase();
    const item = itemById(id);
    if (!item || !['weapon', 'armor'].includes(item.type)) {
      throw new UserError('❌ Ese objeto no es equipable. Revisa la tienda con *' + ctx.prefix + 'shop*.');
    }
    const inventory = getRpgInventory(ctx.sender);
    const { getItemQty } = await import('../../database/economy.js');
    if (!(inventory[id] > 0) && getItemQty(ctx.sender, id) <= 0) {
      throw new UserError(`❌ No tienes *${item.name}*. Cómpralo con *${ctx.prefix}buy ${id}*.`);
    }
    updatePlayer(ctx.sender, item.type === 'weapon' ? { weapon: id } : { armor: id });
    await ctx.reply(`✅ Has equipado ${item.emoji} *${item.name}* (${item.type === 'weapon' ? `+${item.atk} ATK` : `+${item.def} DEF`}).`);
  },
};

const heal = {
  name: 'heal',
  aliases: ['curar'],
  category: 'rpg',
  description: 'Usa una poción para recuperar HP',
  async execute(ctx) {
    const player = getPlayer(ctx.sender);
    if (player.hp >= player.max_hp) throw new UserError('❤️ Ya tienes la salud al máximo.');
    const { getItemQty, removeItem } = await import('../../database/economy.js');
    const rpgInventory = getRpgInventory(ctx.sender);

    let healed = 0;
    if (rpgInventory.superpocion > 0) {
      addRpgItem(ctx.sender, 'superpocion', -1);
      healed = 150;
    } else if (rpgInventory.pocion > 0) {
      addRpgItem(ctx.sender, 'pocion', -1);
      healed = 50;
    } else if (getItemQty(ctx.sender, 'superpocion') > 0) {
      removeItem(ctx.sender, 'superpocion', 1);
      healed = 150;
    } else if (getItemQty(ctx.sender, 'pocion') > 0) {
      removeItem(ctx.sender, 'pocion', 1);
      healed = 50;
    } else {
      throw new UserError(`❌ No tienes pociones. Compra una con *${ctx.prefix}buy pocion*.`);
    }
    const hp = changeHp(ctx.sender, healed);
    await ctx.reply(`🧪 Has recuperado *${healed} HP*.\n❤️ HP ☇ ${hp}/${player.max_hp}`);
  },
};

const craft = {
  name: 'craft',
  aliases: ['fabricar'],
  category: 'rpg',
  args: '[receta]',
  description: 'Fabrica objetos con materiales',
  async execute(ctx) {
    if (!ctx.args[0]) {
      await ctx.reply(
        [
          '⚒️ *RECETAS*',
          '',
          ...RECIPES.map((recipe) => {
            const materials = Object.entries(recipe.materials).map(([id, qty]) => `${itemById(id)?.emoji || ''}${qty}`).join(' + ');
            return `• *${recipe.id}* → ${recipe.name} (${materials})`;
          }),
          '',
          `Uso: ${ctx.prefix}craft <receta>`,
        ].join('\n'),
      );
      return;
    }
    const recipe = RECIPES.find((r) => r.id === ctx.args[0].toLowerCase());
    if (!recipe) throw new UserError('❌ Esa receta no existe.');
    const inventory = getRpgInventory(ctx.sender);
    const missing = Object.entries(recipe.materials).filter(([id, qty]) => (inventory[id] || 0) < qty);
    if (missing.length) {
      throw new UserError(
        `❌ Te faltan materiales:\n${missing.map(([id, qty]) => `• ${itemById(id)?.name || id}: ${inventory[id] || 0}/${qty}`).join('\n')}`,
      );
    }
    for (const [id, qty] of Object.entries(recipe.materials)) addRpgItem(ctx.sender, id, -qty);
    addRpgItem(ctx.sender, recipe.id, 1);
    const player = getPlayer(ctx.sender);
    if (player.quest === 'herrero') updatePlayer(ctx.sender, { quest_progress: player.quest_progress + 1 });
    await ctx.reply(`⚒️ ¡Has fabricado ${itemById(recipe.id)?.emoji || ''} *${recipe.name}*!\nEquípalo con *${ctx.prefix}equip ${recipe.id}*`);
  },
};

const quest = {
  name: 'quest',
  aliases: ['mision'],
  category: 'rpg',
  args: '[id]',
  description: 'Acepta o consulta tu misión activa',
  async execute(ctx) {
    const player = getPlayer(ctx.sender);
    if (!ctx.args[0]) {
      const active = QUESTS.find((q) => q.id === player.quest);
      await ctx.reply(
        [
          '📜 *MISIONES*',
          '',
          active
            ? `▶️ Activa: *${active.title}* — ${active.description}\nProgreso: ${player.quest_progress}/${active.target}\nRecompensa: ${active.rewardGold} oro · ${active.rewardXp} XP\n`
            : '_No tienes ninguna misión activa._\n',
          ...QUESTS.map((q) => `• *${q.id}* — ${q.title}: ${q.description}`),
          '',
          `Uso: ${ctx.prefix}quest <id>`,
        ].join('\n'),
      );
      return;
    }
    const selected = QUESTS.find((q) => q.id === ctx.args[0].toLowerCase());
    if (!selected) throw new UserError('❌ Esa misión no existe.');

    if (player.quest === selected.id && player.quest_progress >= selected.target) {
      addGold(ctx.sender, selected.rewardGold);
      addRpgXp(ctx.sender, selected.rewardXp);
      updatePlayer(ctx.sender, { quest: '', quest_progress: 0 });
      await ctx.reply(`🎉 ¡Misión *${selected.title}* completada!\n💰 +${selected.rewardGold} oro · ✨ +${selected.rewardXp} XP`);
      return;
    }
    if (player.quest === selected.id) {
      await ctx.reply(`📜 *${selected.title}*\nProgreso: ${player.quest_progress}/${selected.target}`);
      return;
    }
    updatePlayer(ctx.sender, { quest: selected.id, quest_progress: 0 });
    await ctx.reply(`📜 Has aceptado la misión *${selected.title}*.\n${selected.description}\nProgreso: 0/${selected.target}`);
  },
};

const toprpg = {
  name: 'toprpg',
  aliases: ['rpgtop'],
  category: 'rpg',
  description: 'Ranking de aventureros',
  async execute(ctx) {
    const list = topPlayers(10);
    if (!list.length) throw new UserError('❌ Todavía no hay jugadores registrados.');
    await ctx.reply({
      text: [
        '🏆 *TOP AVENTUREROS*',
        '',
        ...list.map((p, i) => `${i + 1}. @${jidToNumber(p.jid)} — nivel ${p.level} · ${formatNumber(p.gold)} oro`),
      ].join('\n'),
      mentions: list.map((p) => p.jid),
    });
  },
};

export default [rpg, hunt, adventure, dungeon, boss, fight, inventoryRpg, equip, heal, craft, quest, toprpg];
