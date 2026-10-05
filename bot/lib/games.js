/**
 * Motor de minijuegos con estado.
 * Las partidas viven en sesiones con expiración (lib/sessions.js) y se resuelven
 * con mensajes normales (sin prefijo), gestionados por `handleGameInput`.
 */
import { getSession, setSession, deleteSession, touchSession } from './sessions.js';
import { pickRandom, randomInt, jidToNumber, shuffle } from './utils.js';
import { words, difficulties, trivia } from './data/words.js';
import { addMoney } from '../database/economy.js';
import { addXp } from '../database/xp.js';
import config from '../config.js';

const NS = 'game';
const TTL = 5 * 60_000;

export const getGame = (chat) => getSession(NS, chat);
export const endGame = (chat) => deleteSession(NS, chat);

export const startGame = (chat, game, ttl = TTL) => setSession(NS, chat, game, ttl);

export const assertNoGame = (chat) => {
  const game = getGame(chat);
  if (game) {
    return `⚠️ Ya hay una partida de *${game.type}* en curso en este chat. Escribe *rendirse* para terminarla.`;
  }
  return null;
};

const reward = (jid, money, xp) => {
  addMoney(jid, money);
  addXp(jid, xp);
  return `${config.economy.symbol} +${money} ${config.economy.currency} · ★ +${xp} XP`;
};

/* ───────────────────────── Tic Tac Toe ───────────────────────── */

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const renderBoard = (board) => {
  const cells = board.map((cell, index) => (cell === '' ? `${index + 1}️⃣` : cell === 'X' ? '❌' : '⭕'));
  return [
    `${cells[0]}${cells[1]}${cells[2]}`,
    `${cells[3]}${cells[4]}${cells[5]}`,
    `${cells[6]}${cells[7]}${cells[8]}`,
  ].join('\n');
};

export const createTicTacToe = (chat, playerX, playerO) =>
  startGame(chat, {
    type: 'tictactoe',
    board: Array(9).fill(''),
    players: { X: playerX, O: playerO },
    turn: 'X',
  }, 10 * 60_000);

/* ───────────────────────── Hangman ───────────────────────── */

export const createHangman = (chat, difficulty = 'normal') => {
  const settings = difficulties[difficulty] || difficulties.normal;
  const pool = words.filter((w) => w.length >= settings.minLength && w.length <= settings.maxLength);
  const word = pickRandom(pool.length ? pool : words);
  return startGame(chat, { type: 'hangman', word, guessed: [], lives: settings.lives, difficulty });
};

export const renderHangman = (game) =>
  [
    `🔤 Palabra: ${game.word.split('').map((l) => (game.guessed.includes(l) ? l.toUpperCase() : '＿')).join(' ')}`,
    `❤️ Vidas: ${game.lives}`,
    `🔠 Letras usadas: ${game.guessed.filter((l) => !game.word.includes(l)).join(', ') || '—'}`,
  ].join('\n');

/* ───────────────────────── Trivia ───────────────────────── */

export const createTrivia = (chat, category) => {
  const pool = category ? trivia.filter((t) => t.category === category) : trivia;
  const question = pickRandom(pool.length ? pool : trivia);
  const options = shuffle(question.options);
  return startGame(chat, { type: 'trivia', question: question.q, answer: question.a, options }, 60_000);
};

/* ───────────────────────── Math game ───────────────────────── */

export const createMathGame = (chat, difficulty = 'normal') => {
  const ranges = { facil: [1, 20], normal: [5, 60], dificil: [20, 300] };
  const [min, max] = ranges[difficulty] || ranges.normal;
  const a = randomInt(min, max);
  const b = randomInt(min, max);
  const operator = pickRandom(difficulty === 'facil' ? ['+', '-'] : ['+', '-', '*']);
  const answer = operator === '+' ? a + b : operator === '-' ? a - b : a * b;
  return startGame(chat, { type: 'mathgame', question: `${a} ${operator} ${b}`, answer, difficulty }, 60_000);
};

/* ───────────────────────── Guess ───────────────────────── */

export const createGuess = (chat) =>
  startGame(chat, { type: 'guess', number: randomInt(1, 100), attempts: 0 }, 3 * 60_000);

/* ───────────────────────── Word game ───────────────────────── */

export const createWordGame = (chat) => {
  const word = pickRandom(words);
  const scrambled = shuffle(word.split('')).join('');
  return startGame(chat, { type: 'wordgame', word, scrambled }, 2 * 60_000);
};

/* ───────────────────────── Entrada de los jugadores ───────────────────────── */

/**
 * Procesa un mensaje normal (sin prefijo) dentro de una partida activa.
 * @returns {Promise<boolean>} true si el mensaje formaba parte de un juego.
 */
export const handleGameInput = async ({ sock, m }) => {
  const game = getGame(m.chat);
  if (!game) return false;
  const text = (m.text || '').trim().toLowerCase();
  if (!text) return false;

  const say = (content) => sock.sendMessage(m.chat, typeof content === 'string' ? { text: content } : content, { quoted: m.raw });

  if (['rendirse', 'surrender', 'cancelar partida'].includes(text)) {
    endGame(m.chat);
    await say('🏳️ Partida cancelada.');
    return true;
  }

  switch (game.type) {
    case 'tictactoe': {
      if (!/^[1-9]$/.test(text)) return false;
      const current = game.players[game.turn];
      if (m.sender !== current) return false;
      const index = Number(text) - 1;
      if (game.board[index] !== '') {
        await say('⚠️ Esa casilla ya está ocupada.');
        return true;
      }
      game.board[index] = game.turn;
      const winner = WIN_LINES.find((line) => line.every((i) => game.board[i] === game.turn));
      if (winner) {
        const prize = reward(current, 300, 60);
        endGame(m.chat);
        await say({ text: `${renderBoard(game.board)}\n\n🎉 ¡@${jidToNumber(current)} ha ganado!\n${prize}`, mentions: [current] });
        return true;
      }
      if (game.board.every((cell) => cell !== '')) {
        endGame(m.chat);
        await say(`${renderBoard(game.board)}\n\n🤝 ¡Empate!`);
        return true;
      }
      game.turn = game.turn === 'X' ? 'O' : 'X';
      touchSession(NS, m.chat, 10 * 60_000);
      const next = game.players[game.turn];
      await say({
        text: `${renderBoard(game.board)}\n\nTurno de @${jidToNumber(next)} (${game.turn === 'X' ? '❌' : '⭕'})`,
        mentions: [next],
      });
      return true;
    }

    case 'hangman': {
      if (!/^[a-záéíóúñ]+$/i.test(text)) return false;
      if (text.length > 1) {
        if (text === game.word) {
          const prize = reward(m.sender, 400, 80);
          endGame(m.chat);
          await say(`🎉 ¡Correcto! La palabra era *${game.word}*.\n${prize}`);
        } else {
          game.lives -= 1;
          if (game.lives <= 0) {
            endGame(m.chat);
            await say(`💀 Sin vidas. La palabra era *${game.word}*.`);
          } else {
            touchSession(NS, m.chat);
            await say(`❌ No es la palabra.\n\n${renderHangman(game)}`);
          }
        }
        return true;
      }
      if (game.guessed.includes(text)) {
        await say('⚠️ Ya has probado esa letra.');
        return true;
      }
      game.guessed.push(text);
      if (!game.word.includes(text)) game.lives -= 1;
      const complete = game.word.split('').every((letter) => game.guessed.includes(letter));
      if (complete) {
        const prize = reward(m.sender, 300, 60);
        endGame(m.chat);
        await say(`🎉 ¡Palabra completada: *${game.word}*!\n${prize}`);
      } else if (game.lives <= 0) {
        endGame(m.chat);
        await say(`💀 Sin vidas. La palabra era *${game.word}*.`);
      } else {
        touchSession(NS, m.chat);
        await say(renderHangman(game));
      }
      return true;
    }

    case 'trivia': {
      const index = Number(text) - 1;
      const chosen = Number.isInteger(index) && game.options[index] ? game.options[index] : text;
      if (!game.options.some((o) => o.toLowerCase() === String(chosen).toLowerCase()) && !/^\d$/.test(text)) return false;
      if (String(chosen).toLowerCase().includes(game.answer.toLowerCase()) || game.answer.includes(String(chosen).toLowerCase())) {
        const prize = reward(m.sender, 250, 50);
        endGame(m.chat);
        await say(`✅ ¡Correcto!\n${prize}`);
      } else {
        endGame(m.chat);
        await say(`❌ Incorrecto. La respuesta era: *${game.answer}*`);
      }
      return true;
    }

    case 'mathgame': {
      if (!/^-?\d+$/.test(text)) return false;
      if (Number(text) === game.answer) {
        const prize = reward(m.sender, 200, 40);
        endGame(m.chat);
        await say(`✅ ¡Correcto! ${game.question} = ${game.answer}\n${prize}`);
      } else {
        await say('❌ Incorrecto, sigue intentándolo.');
      }
      return true;
    }

    case 'guess': {
      if (!/^\d{1,3}$/.test(text)) return false;
      const value = Number(text);
      game.attempts += 1;
      if (value === game.number) {
        const prize = reward(m.sender, Math.max(80, 500 - game.attempts * 30), 50);
        endGame(m.chat);
        await say(`🎯 ¡Acertaste en ${game.attempts} intentos! El número era *${game.number}*.\n${prize}`);
      } else {
        touchSession(NS, m.chat);
        await say(value < game.number ? '🔼 Más alto…' : '🔽 Más bajo…');
      }
      return true;
    }

    case 'wordgame': {
      if (!/^[a-záéíóúñ]+$/i.test(text)) return false;
      if (text === game.word) {
        const prize = reward(m.sender, 300, 60);
        endGame(m.chat);
        await say(`✅ ¡Correcto! La palabra era *${game.word}*.\n${prize}`);
      } else {
        await say('❌ No es esa, sigue probando.');
      }
      return true;
    }

    default:
      return false;
  }
};

export default {
  getGame,
  endGame,
  startGame,
  assertNoGame,
  createTicTacToe,
  createHangman,
  createTrivia,
  createMathGame,
  createGuess,
  createWordGame,
  renderBoard,
  renderHangman,
  handleGameInput,
};
