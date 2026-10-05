/**
 * Catálogo de categorías: icono, nombre visible y orden en el menú.
 * Para añadir una categoría nueva basta con crear la carpeta en bot/commands/
 * y registrarla aquí (si no se registra, se mostrará con un icono por defecto).
 */
export const CATEGORIES = {
  main: { icon: '◈', label: 'MAIN', description: 'Comandos principales del bot' },
  info: { icon: 'ⓘ', label: 'INFO', description: 'Información del bot, usuarios y grupos' },
  fun: { icon: '♢', label: 'FUN', description: 'Diversión y juegos rápidos' },
  tools: { icon: '⚒', label: 'TOOLS', description: 'Herramientas de utilidad' },
  internet: { icon: '◎', label: 'INTERNET', description: 'Diagnóstico y consultas de red' },
  stalk: { icon: '◉', label: 'STALK', description: 'Perfiles públicos de plataformas' },
  anime: { icon: '✿', label: 'ANIME', description: 'Anime, manga y personajes' },
  game: { icon: '♟', label: 'GAME', description: 'Minijuegos' },
  rpg: { icon: '⚔', label: 'RPG', description: 'Aventura, combate e inventario' },
  xp: { icon: '★', label: 'XP', description: 'Experiencia, niveles y rankings' },
  ai: { icon: '◇', label: 'AI', description: 'Inteligencia artificial' },
  audio: { icon: '♫', label: 'AUDIO', description: 'Efectos y conversión de audio' },
  downloader: { icon: '⇩', label: 'DOWNLOADER', description: 'Descargas de contenido público' },
  image: { icon: '▣', label: 'IMAGE', description: 'Edición de imágenes' },
  maker: { icon: '✎', label: 'MAKER', description: 'Generadores gráficos' },
  group: { icon: '✦', label: 'GROUP', description: 'Administración de grupos' },
  panel: { icon: '⚙', label: 'PANEL', description: 'Panel de control y ajustes' },
  quotes: { icon: '❝', label: 'QUOTES', description: 'Frases y citas' },
  quran: { icon: '۞', label: 'QURAN', description: 'Corán: suras, aleyas y búsqueda' },
  random: { icon: '⟳', label: 'RANDOM', description: 'Generadores aleatorios' },
  search: { icon: '⌕', label: 'SEARCH', description: 'Búsquedas en Internet' },
  sound: { icon: '♪', label: 'SOUND', description: 'Sonidos y efectos' },
  sticker: { icon: '◩', label: 'STICKER', description: 'Creación y conversión de stickers' },
  store: { icon: '♜', label: 'STORE', description: 'Economía y tienda' },
  voice: { icon: '♬', label: 'VOICE', description: 'Voz: TTS y efectos vocales' },
  owner: { icon: '♛', label: 'OWNER', description: 'Exclusivo del propietario' },
};

export const CATEGORY_ORDER = Object.keys(CATEGORIES);

export const categoryInfo = (name) =>
  CATEGORIES[name] || { icon: '✧', label: String(name || 'otros').toUpperCase(), description: '' };

export default CATEGORIES;
