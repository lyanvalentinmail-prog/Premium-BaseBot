/**
 * Generación local de imágenes con Jimp (texto, degradados, marcas de agua).
 * Sin dependencias nativas: funciona en Termux.
 */
import { Jimp, loadFont, measureText, measureTextHeight, rgbaToInt, cssColorToHex } from 'jimp';
import * as fonts from 'jimp/fonts';
import { UserError } from './errors.js';

const FONT_CACHE = new Map();

export const getFont = async (name = 'SANS_64_WHITE') => {
  if (FONT_CACHE.has(name)) return FONT_CACHE.get(name);
  const path = fonts[name];
  if (!path) throw new UserError('❌ Fuente no disponible.');
  const font = await loadFont(path);
  FONT_CACHE.set(name, font);
  return font;
};

/** Convierte un color CSS/hex a entero Jimp. Lanza UserError si no es válido. */
export const parseColor = (input, fallback = 0x000000ff) => {
  if (!input) return fallback;
  const value = String(input).trim();
  try {
    return cssColorToHex(value.startsWith('#') || /^[a-z]+$/i.test(value) ? value : `#${value}`);
  } catch {
    throw new UserError(`❌ Color no válido: ${input}. Usa nombres (red) o hex (#ff0000).`);
  }
};

/** Degradado lineal horizontal/vertical. */
export const gradientImage = (width, height, colorA, colorB, vertical = false) => {
  const image = new Jimp({ width, height, color: 0x000000ff });
  const a = { r: (colorA >>> 24) & 255, g: (colorA >>> 16) & 255, b: (colorA >>> 8) & 255 };
  const b = { r: (colorB >>> 24) & 255, g: (colorB >>> 16) & 255, b: (colorB >>> 8) & 255 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ratio = vertical ? y / (height - 1 || 1) : x / (width - 1 || 1);
      const color = rgbaToInt(
        Math.round(a.r + (b.r - a.r) * ratio),
        Math.round(a.g + (b.g - a.g) * ratio),
        Math.round(a.b + (b.b - a.b) * ratio),
        255,
      );
      image.setPixelColor(color, x, y);
    }
  }
  return image;
};

/** Elige el tamaño de fuente más grande que quepa. */
export const fitFont = async (text, maxWidth, { white = true, sizes = [128, 64, 32, 16] } = {}) => {
  for (const size of sizes) {
    const name = `SANS_${size}_${white ? 'WHITE' : 'BLACK'}`;
    if (!fonts[name]) continue;
    // eslint-disable-next-line no-await-in-loop
    const font = await getFont(name);
    if (measureText(font, text) <= maxWidth) return font;
  }
  return getFont(`SANS_16_${white ? 'WHITE' : 'BLACK'}`);
};

/** Dibuja texto centrado sobre una imagen. */
export const drawCenteredText = async (image, text, { white = true, y = null, padding = 40, maxSizes } = {}) => {
  const maxWidth = image.bitmap.width - padding * 2;
  const font = await fitFont(text, maxWidth, { white, ...(maxSizes ? { sizes: maxSizes } : {}) });
  const textWidth = Math.min(measureText(font, text), maxWidth);
  const textHeight = measureTextHeight(font, text, maxWidth);
  image.print({
    font,
    x: Math.max(padding, Math.round((image.bitmap.width - textWidth) / 2)),
    y: y ?? Math.round((image.bitmap.height - textHeight) / 2),
    text,
    maxWidth,
  });
  return image;
};

export { Jimp, measureText, measureTextHeight };

export default { getFont, parseColor, gradientImage, drawCenteredText, fitFont };
