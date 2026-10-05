/**
 * Catálogo de objetos, monstruos, mazmorras, misiones y recetas del RPG/tienda.
 * Datos locales: no dependen de ningún servicio externo.
 */

/**
 * Objetos de la tienda.
 * type: weapon | armor | consumable | material | rpg
 */
export const SHOP_ITEMS = [
  // Armas
  { id: 'daga', name: 'Daga oxidada', emoji: '🗡️', type: 'weapon', price: 500, sell: 150, atk: 5, description: 'Un arma básica para empezar a cazar.' },
  { id: 'espada', name: 'Espada de hierro', emoji: '⚔️', type: 'weapon', price: 2500, sell: 800, atk: 15, description: 'Equilibrada y fiable para cualquier aventurero.' },
  { id: 'hacha', name: 'Hacha de guerra', emoji: '🪓', type: 'weapon', price: 6000, sell: 2000, atk: 28, description: 'Lenta pero devastadora.' },
  { id: 'arco', name: 'Arco largo', emoji: '🏹', type: 'weapon', price: 4500, sell: 1500, atk: 22, description: 'Ataca desde lejos con precisión.' },
  { id: 'baston', name: 'Bastón arcano', emoji: '🪄', type: 'weapon', price: 9000, sell: 3000, atk: 35, description: 'Canaliza magia antigua en cada golpe.' },

  // Armaduras
  { id: 'tunica', name: 'Túnica de tela', emoji: '🥋', type: 'armor', price: 400, sell: 120, def: 4, description: 'Mejor que nada, pero no mucho más.' },
  { id: 'cuero', name: 'Armadura de cuero', emoji: '🧥', type: 'armor', price: 2000, sell: 650, def: 12, description: 'Ligera y cómoda para explorar.' },
  { id: 'cota', name: 'Cota de malla', emoji: '🛡️', type: 'armor', price: 5500, sell: 1800, def: 24, description: 'Protección sólida frente a monstruos.' },
  { id: 'placas', name: 'Armadura de placas', emoji: '🛡️', type: 'armor', price: 10000, sell: 3400, def: 38, description: 'Pesada, resistente y temida.' },

  // Consumibles
  { id: 'pocion', name: 'Poción', emoji: '🧪', type: 'consumable', price: 300, sell: 100, description: 'Restaura 50 HP con *.heal*.' },
  { id: 'superpocion', name: 'Super poción', emoji: '⚗️', type: 'consumable', price: 1200, sell: 400, description: 'Restaura 150 HP con *.heal*.' },
  { id: 'ticket', name: 'Ticket de límite', emoji: '🎫', type: 'consumable', price: 2500, sell: 700, description: 'Úsalo con *.use ticket* para sumar Ⓛ +5 usos diarios.' },

  // Materiales
  { id: 'madera', name: 'Madera', emoji: '🪵', type: 'material', price: 80, sell: 30, description: 'Material básico de fabricación.' },
  { id: 'piedra', name: 'Piedra', emoji: '🪨', type: 'material', price: 100, sell: 40, description: 'Dura y abundante.' },
  { id: 'hierro', name: 'Lingote de hierro', emoji: '🔩', type: 'material', price: 350, sell: 140, description: 'Imprescindible para forjar.' },
  { id: 'cuerda', name: 'Cuerda', emoji: '🪢', type: 'material', price: 120, sell: 45, description: 'Útil para arcos y trampas.' },
  { id: 'cristal', name: 'Cristal mágico', emoji: '🔮', type: 'material', price: 900, sell: 350, description: 'Brilla con energía arcana.' },
  { id: 'diamante', name: 'Diamante', emoji: '💎', type: 'material', price: 5000, sell: 2000, description: 'Rarísimo. Lo sueltan los jefes.' },
];

/** Objetos que solo se obtienen fabricándolos (`.craft`). */
export const CRAFTED_ITEMS = [
  { id: 'espadadiamante', name: 'Espada de diamante', emoji: '💠', type: 'weapon', price: 0, sell: 6000, atk: 55, description: 'Forjada con diamante puro. No se vende en la tienda.' },
  { id: 'arcoelfico', name: 'Arco élfico', emoji: '🎯', type: 'weapon', price: 0, sell: 3500, atk: 40, description: 'Ligero, silencioso y letal.' },
  { id: 'escudorunico', name: 'Escudo rúnico', emoji: '🔰', type: 'armor', price: 0, sell: 4200, def: 50, description: 'Las runas absorben parte del daño.' },
  { id: 'amuleto', name: 'Amuleto de cristal', emoji: '📿', type: 'armor', price: 0, sell: 2600, def: 30, description: 'Protege a quien lo lleva al cuello.' },
];

/** Todos los objetos conocidos (tienda + fabricables). */
export const ALL_ITEMS = [...SHOP_ITEMS, ...CRAFTED_ITEMS];

const ITEM_INDEX = new Map(ALL_ITEMS.map((item) => [item.id, item]));

/** Busca un objeto por su id (sin distinguir mayúsculas). */
export const itemById = (id) => (id ? ITEM_INDEX.get(String(id).toLowerCase().trim()) || null : null);

/** Monstruos de `.hunt` y `.fight`, ordenados por nivel. */
export const MONSTERS = [
  { name: 'Slime', emoji: '🟢', level: 1, hp: 30, atk: 5, xp: 15, gold: 40 },
  { name: 'Rata gigante', emoji: '🐀', level: 1, hp: 40, atk: 7, xp: 20, gold: 55 },
  { name: 'Murciélago', emoji: '🦇', level: 2, hp: 55, atk: 10, xp: 30, gold: 70 },
  { name: 'Goblin', emoji: '👺', level: 3, hp: 75, atk: 14, xp: 45, gold: 110 },
  { name: 'Lobo salvaje', emoji: '🐺', level: 4, hp: 95, atk: 18, xp: 60, gold: 150 },
  { name: 'Esqueleto', emoji: '💀', level: 5, hp: 120, atk: 22, xp: 80, gold: 200 },
  { name: 'Orco', emoji: '👹', level: 7, hp: 160, atk: 28, xp: 110, gold: 280 },
  { name: 'Golem de piedra', emoji: '🗿', level: 9, hp: 220, atk: 32, xp: 150, gold: 380 },
  { name: 'Araña gigante', emoji: '🕷️', level: 11, hp: 240, atk: 38, xp: 190, gold: 460 },
  { name: 'Basilisco', emoji: '🐍', level: 14, hp: 300, atk: 45, xp: 250, gold: 600 },
  { name: 'Quimera', emoji: '🦁', level: 17, hp: 360, atk: 54, xp: 330, gold: 780 },
  { name: 'Espectro', emoji: '👻', level: 20, hp: 420, atk: 62, xp: 420, gold: 950 },
];

/** Jefes de `.boss`, ordenados de menor a mayor nivel requerido. */
export const BOSSES = [
  { name: 'Rey Goblin', emoji: '👑', level: 5, hp: 320, atk: 30, xp: 400, gold: 1200 },
  { name: 'Señor de los Muertos', emoji: '☠️', level: 10, hp: 600, atk: 48, xp: 900, gold: 2600 },
  { name: 'Dragón de Ceniza', emoji: '🐲', level: 18, hp: 1100, atk: 72, xp: 2000, gold: 5500 },
  { name: 'Leviatán Abisal', emoji: '🌊', level: 28, hp: 1800, atk: 95, xp: 3800, gold: 9800 },
  { name: 'Titán Primigenio', emoji: '⚡', level: 40, hp: 2800, atk: 130, xp: 6500, gold: 18000 },
];

/** Mazmorras de `.dungeon`. `danger` = probabilidad base de fallar (0-1). */
export const DUNGEONS = [
  { name: 'Cueva de los Murciélagos', minLevel: 1, danger: 0.2, rewardGold: [150, 400], rewardXp: [40, 90] },
  { name: 'Mina Abandonada', minLevel: 4, danger: 0.28, rewardGold: [400, 900], rewardXp: [90, 180] },
  { name: 'Cripta Silenciosa', minLevel: 8, danger: 0.35, rewardGold: [900, 1800], rewardXp: [180, 350] },
  { name: 'Torre del Hechicero', minLevel: 13, danger: 0.42, rewardGold: [1800, 3600], rewardXp: [350, 650] },
  { name: 'Abismo Eterno', minLevel: 20, danger: 0.5, rewardGold: [3600, 7200], rewardXp: [650, 1200] },
];

/** Misiones de `.quest`. Los ids 'cazador', 'explorador' y 'herrero' avanzan solos. */
export const QUESTS = [
  { id: 'cazador', title: 'Senda del cazador', description: 'Derrota a 5 monstruos con .hunt', target: 5, rewardGold: 1500, rewardXp: 300 },
  { id: 'explorador', title: 'Alma exploradora', description: 'Sal de aventura 3 veces con .adventure', target: 3, rewardGold: 1200, rewardXp: 250 },
  { id: 'herrero', title: 'Aprendiz de herrero', description: 'Fabrica 2 objetos con .craft', target: 2, rewardGold: 2000, rewardXp: 400 },
];

/** Recetas de `.craft`. El id debe coincidir con un objeto fabricable. */
export const RECIPES = [
  { id: 'espadadiamante', name: 'Espada de diamante', materials: { diamante: 2, hierro: 3, madera: 2 } },
  { id: 'arcoelfico', name: 'Arco élfico', materials: { madera: 5, cuerda: 3, cristal: 1 } },
  { id: 'escudorunico', name: 'Escudo rúnico', materials: { hierro: 4, piedra: 4, cristal: 2 } },
  { id: 'amuleto', name: 'Amuleto de cristal', materials: { cristal: 3, cuerda: 1 } },
];

/** Eventos aleatorios de `.adventure`. */
export const ADVENTURE_EVENTS = [
  { text: '🌲 Caminas por un bosque antiguo y encuentras leña aprovechable.', gold: [40, 120], xp: [10, 25], item: 'madera', qty: 2 },
  { text: '⛏️ Picas en una pared de roca y sacas una piedra bien formada.', gold: [50, 140], xp: [12, 28], item: 'piedra', qty: 2 },
  { text: '🏚️ Registras una cabaña abandonada y hallas chatarra de hierro.', gold: [80, 200], xp: [20, 40], item: 'hierro', qty: 1 },
  { text: '🪢 Un pescador te regala una cuerda resistente por ayudarle.', gold: [60, 150], xp: [15, 30], item: 'cuerda', qty: 1 },
  { text: '🔮 Entre las ruinas brilla un cristal cargado de magia.', gold: [120, 320], xp: [35, 70], item: 'cristal', qty: 1 },
  { text: '🧪 Un alquimista agradecido te entrega una poción.', gold: [40, 110], xp: [10, 25], item: 'pocion', qty: 1 },
  { text: '💰 Encuentras una bolsa de monedas enterrada junto a un árbol.', gold: [200, 500], xp: [25, 55] },
  { text: '🗺️ Ayudas a un viajero perdido y te paga por la orientación.', gold: [120, 300], xp: [30, 60] },
  { text: '🏕️ Pasas la noche junto a una hoguera y aprendes de otros aventureros.', gold: [30, 90], xp: [45, 90] },
  { text: '🌊 Cruzas un río helado: pierdes tiempo pero ganas experiencia.', gold: [10, 60], xp: [50, 100] },
  { text: '🦌 Rastreas huellas durante horas sin encontrar nada… casi nada.', gold: [20, 70], xp: [20, 45] },
  { text: '⛈️ Una tormenta te obliga a refugiarte en una cueva con restos de mineral.', gold: [90, 220], xp: [25, 50], item: 'piedra', qty: 1 },
];

export default {
  SHOP_ITEMS,
  CRAFTED_ITEMS,
  ALL_ITEMS,
  itemById,
  MONSTERS,
  BOSSES,
  DUNGEONS,
  QUESTS,
  RECIPES,
  ADVENTURE_EVENTS,
};
