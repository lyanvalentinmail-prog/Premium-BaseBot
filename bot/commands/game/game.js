/** Minijuegos. Las partidas con estado se resuelven respondiendo sin prefijo. */
import config from '../../config.js';
import {
  assertNoGame, createTicTacToe, createHangman, createTrivia, createMathGame,
  createGuess, createWordGame, renderBoard, renderHangman, getGame, endGame,
} from '../../lib/games.js';
import { pickRandom, randomInt, jidToNumber, formatNumber } from '../../lib/utils.js';
import { requireOption, requireInteger } from '../../lib/validators.js';
import { triviaCategories } from '../../lib/data/words.js';
import { UserError } from '../../lib/errors.js';
import { getBalance, addMoney } from '../../database/economy.js';

const tictactoe = {
  name: 'tictactoe',
  aliases: ['ttt', 'tresenraya'],
  category: 'game',
  args: '<@usuario>',
  description: 'Juega al tres en raya contra otra persona',
  groupOnly: true,
  skipArgCheck: true,
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    const rival = ctx.mentions[0] || ctx.quoted?.sender;
    if (!rival) throw new UserError(`❌ Menciona a tu rival.\n\nUso:\n${ctx.prefix}tictactoe <@usuario>`);
    if (rival === ctx.sender) throw new UserError('❌ No puedes jugar contra ti mismo.');
    const game = createTicTacToe(ctx.chat, ctx.sender, rival);
    await ctx.reply({
      text: [
        '🎮 *TRES EN RAYA*',
        '',
        `❌ @${jidToNumber(ctx.sender)}`,
        `⭕ @${jidToNumber(rival)}`,
        '',
        renderBoard(game.board),
        '',
        `Turno de @${jidToNumber(ctx.sender)}. Escribe un número del 1 al 9.`,
        '_Escribe "rendirse" para terminar._',
      ].join('\n'),
      mentions: [ctx.sender, rival],
    });
  },
};

const hangman = {
  name: 'hangman',
  aliases: ['ahorcado'],
  category: 'game',
  args: '[dificultad]',
  description: 'Juego del ahorcado (facil/normal/dificil)',
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    const difficulty = ctx.args[0] ? requireOption(ctx.args[0], ['facil', 'normal', 'dificil'], { name: 'Dificultad' }) : 'normal';
    const game = createHangman(ctx.chat, difficulty);
    await ctx.reply(`🪢 *AHORCADO* (${difficulty})\n\n${renderHangman(game)}\n\nEscribe una letra o la palabra completa.`);
  },
};

const triviaCmd = {
  name: 'trivia',
  aliases: ['preguntados'],
  category: 'game',
  args: '[categoria]',
  description: `Pregunta de trivia (${triviaCategories.join(', ')})`,
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    const category = ctx.args[0] ? requireOption(ctx.args[0], triviaCategories, { name: 'Categoría' }) : null;
    const game = createTrivia(ctx.chat, category);
    await ctx.reply(
      [
        '🧠 *TRIVIA*',
        '',
        `❓ ${game.question}`,
        '',
        ...game.options.map((option, index) => `${index + 1}. ${option}`),
        '',
        '_Responde con el número de la opción (60s)._',
      ].join('\n'),
    );
  },
};

const mathgame = {
  name: 'mathgame',
  aliases: ['matematicas'],
  category: 'game',
  args: '[dificultad]',
  description: 'Resuelve una operación matemática',
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    const difficulty = ctx.args[0] ? requireOption(ctx.args[0], ['facil', 'normal', 'dificil'], { name: 'Dificultad' }) : 'normal';
    const game = createMathGame(ctx.chat, difficulty);
    await ctx.reply(`🧮 *MATEMÁTICAS* (${difficulty})\n\n¿Cuánto es *${game.question}*?\n\n_Responde con el número (60s)._`);
  },
};

const guess = {
  name: 'guess',
  aliases: ['adivina'],
  category: 'game',
  description: 'Adivina el número del 1 al 100',
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    createGuess(ctx.chat);
    await ctx.reply('🎯 He pensado un número del *1 al 100*. ¡Adivínalo escribiendo números!');
  },
};

const wordgame = {
  name: 'wordgame',
  aliases: ['palabra'],
  category: 'game',
  description: 'Ordena las letras y descubre la palabra',
  async execute(ctx) {
    const busy = assertNoGame(ctx.chat);
    if (busy) throw new UserError(busy);
    const game = createWordGame(ctx.chat);
    await ctx.reply(`🔤 *PALABRA REVUELTA*\n\n*${game.scrambled.toUpperCase()}*\n\n_Escribe la palabra correcta (${game.word.length} letras)._`);
  },
};

const coinflip = {
  name: 'coinflip',
  aliases: ['moneda', 'cara'],
  category: 'game',
  description: 'Lanza una moneda',
  async execute(ctx) {
    await ctx.reply(`🪙 Ha salido... *${pickRandom(['CARA', 'CRUZ'])}*`);
  },
};

const dice = {
  name: 'dice',
  aliases: ['dado'],
  category: 'game',
  args: '[caras]',
  description: 'Lanza un dado',
  async execute(ctx) {
    const faces = ctx.args[0] ? requireInteger(ctx.args[0], { min: 2, max: 1000, name: 'número de caras' }) : 6;
    await ctx.reply(`🎲 Dado de ${faces} caras: *${randomInt(1, faces)}*`);
  },
};

const rps = {
  name: 'rps',
  aliases: ['ppt', 'piedrapapeltijera'],
  category: 'game',
  args: '<piedra/papel/tijera>',
  description: 'Piedra, papel o tijera contra el bot',
  async execute(ctx) {
    const choice = requireOption(ctx.args[0], ['piedra', 'papel', 'tijera'], { name: 'Jugada' });
    const botChoice = pickRandom(['piedra', 'papel', 'tijera']);
    const wins = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };
    const emoji = { piedra: '🪨', papel: '📄', tijera: '✂️' };
    let result;
    if (choice === botChoice) result = '🤝 ¡Empate!';
    else if (wins[choice] === botChoice) {
      addMoney(ctx.sender, 50);
      result = `🎉 ¡Ganaste! ${config.economy.symbol} +50`;
    } else result = '😢 Has perdido.';
    await ctx.reply(`${emoji[choice]} Tú: ${choice}\n${emoji[botChoice]} Bot: ${botChoice}\n\n${result}`);
  },
};

const slots = {
  name: 'slots',
  aliases: ['tragaperras'],
  category: 'game',
  args: '[apuesta]',
  description: 'Máquina tragaperras',
  cooldown: 10,
  async execute(ctx) {
    const bet = ctx.args[0] ? requireInteger(ctx.args[0], { min: 10, max: 100000, name: 'apuesta' }) : 100;
    const { balance } = getBalance(ctx.sender);
    if (balance < bet) throw new UserError(`❌ No tienes saldo suficiente. Tu saldo: ${formatNumber(balance)}.`);

    const symbols = ['🍒', '🍋', '🍉', '⭐', '💎', '7️⃣'];
    const roll = [pickRandom(symbols), pickRandom(symbols), pickRandom(symbols)];
    let multiplier = 0;
    if (roll[0] === roll[1] && roll[1] === roll[2]) multiplier = roll[0] === '7️⃣' ? 10 : 5;
    else if (roll[0] === roll[1] || roll[1] === roll[2] || roll[0] === roll[2]) multiplier = 1.5;

    const delta = Math.floor(bet * multiplier) - bet;
    addMoney(ctx.sender, delta);
    const { balance: newBalance } = getBalance(ctx.sender);
    await ctx.reply(
      [
        '🎰 *TRAGAPERRAS*',
        '',
        `｜ ${roll.join(' ｜ ')} ｜`,
        '',
        multiplier ? `🎉 Premio x${multiplier} → ${delta >= 0 ? '+' : ''}${formatNumber(delta)}` : `😢 Has perdido ${formatNumber(bet)}`,
        `${config.economy.symbol} Saldo ☇ ${formatNumber(newBalance)}`,
      ].join('\n'),
    );
  },
};

const stopGame = {
  name: 'stopgame',
  aliases: ['pararjuego'],
  category: 'game',
  description: 'Cancela la partida activa en este chat',
  async execute(ctx) {
    const game = getGame(ctx.chat);
    if (!game) throw new UserError('❌ No hay ninguna partida activa aquí.');
    endGame(ctx.chat);
    await ctx.reply(`🏳️ Partida de *${game.type}* cancelada.`);
  },
};

export default [tictactoe, hangman, triviaCmd, mathgame, guess, wordgame, coinflip, dice, rps, slots, stopGame];
