/**
 * Evaluador matemático seguro (sin eval/Function).
 * Soporta + - * / % ^, paréntesis, funciones básicas y constantes.
 */
import { UserError } from './errors.js';

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

const tokenize = (input) => {
  const tokens = [];
  const text = String(input).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (/\d|\./.test(char)) {
      let number = '';
      while (i < text.length && /[\d.]/.test(text[i])) number += text[i++];
      if (Number.isNaN(Number(number))) throw new UserError('❌ Expresión matemática inválida.');
      tokens.push({ type: 'number', value: Number(number) });
      continue;
    }
    if (/[a-z]/i.test(char)) {
      let name = '';
      while (i < text.length && /[a-z]/i.test(text[i])) name += text[i++].toLowerCase();
      if (FUNCTIONS[name]) tokens.push({ type: 'function', value: name });
      else if (CONSTANTS[name] !== undefined) tokens.push({ type: 'number', value: CONSTANTS[name] });
      else throw new UserError(`❌ Función o constante desconocida: ${name}`);
      continue;
    }
    if ('+-*/%^()'.includes(char)) {
      tokens.push({ type: char === '(' || char === ')' ? 'paren' : 'operator', value: char });
      i += 1;
      continue;
    }
    throw new UserError(`❌ Carácter no permitido: ${char}`);
  }
  return tokens;
};

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };

/** Shunting-yard → notación polaca inversa. */
const toRpn = (tokens) => {
  const output = [];
  const stack = [];
  let previous = null;
  for (const token of tokens) {
    if (token.type === 'number') output.push(token);
    else if (token.type === 'function') stack.push(token);
    else if (token.type === 'operator') {
      // Unario (-5, +3)
      const isUnary = !previous || (previous.type === 'operator') || (previous.type === 'paren' && previous.value === '(');
      if (isUnary && (token.value === '-' || token.value === '+')) {
        output.push({ type: 'number', value: 0 });
      }
      while (
        stack.length &&
        stack.at(-1).type !== 'paren' &&
        (stack.at(-1).type === 'function' ||
          PRECEDENCE[stack.at(-1).value] > PRECEDENCE[token.value] ||
          (PRECEDENCE[stack.at(-1).value] === PRECEDENCE[token.value] && token.value !== '^'))
      ) {
        output.push(stack.pop());
      }
      stack.push(token);
    } else if (token.value === '(') stack.push(token);
    else {
      while (stack.length && stack.at(-1).value !== '(') output.push(stack.pop());
      if (!stack.length) throw new UserError('❌ Paréntesis desbalanceados.');
      stack.pop();
      if (stack.length && stack.at(-1).type === 'function') output.push(stack.pop());
    }
    previous = token;
  }
  while (stack.length) {
    const token = stack.pop();
    if (token.type === 'paren') throw new UserError('❌ Paréntesis desbalanceados.');
    output.push(token);
  }
  return output;
};

/** Evalúa una expresión matemática. */
export const evaluate = (expression) => {
  const rpn = toRpn(tokenize(expression));
  const stack = [];
  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.type === 'function') {
      const value = stack.pop();
      if (value === undefined) throw new UserError('❌ Expresión matemática inválida.');
      stack.push(FUNCTIONS[token.value](value));
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) throw new UserError('❌ Expresión matemática inválida.');
    switch (token.value) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/':
        if (b === 0) throw new UserError('❌ No se puede dividir entre cero.');
        stack.push(a / b);
        break;
      case '%':
        if (b === 0) throw new UserError('❌ No se puede dividir entre cero.');
        stack.push(a % b);
        break;
      case '^': stack.push(a ** b); break;
      default: throw new UserError('❌ Operador no soportado.');
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new UserError('❌ Expresión matemática inválida.');
  return stack[0];
};

export default evaluate;
