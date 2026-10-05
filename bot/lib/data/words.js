/**
 * Datos locales para los minijuegos: palabras, dificultades, trivia y emojis.
 * Todo es contenido propio/genérico, sin dependencias externas.
 */

/** Palabras en español usadas por ahorcado y wordgame (solo letras, sin tildes). */
export const words = [
  'casa', 'perro', 'gato', 'libro', 'arbol', 'nube', 'playa', 'luna', 'sol', 'rio',
  'fuego', 'tierra', 'viento', 'piedra', 'flor', 'bosque', 'monte', 'campo', 'lago', 'mar',
  'cielo', 'noche', 'dia', 'tarde', 'manana', 'hora', 'tiempo', 'reloj', 'mesa', 'silla',
  'puerta', 'ventana', 'techo', 'suelo', 'pared', 'cocina', 'jardin', 'ciudad', 'pueblo', 'calle',
  'coche', 'tren', 'avion', 'barco', 'bicicleta', 'camino', 'puente', 'viaje', 'mapa', 'brujula',
  'musica', 'guitarra', 'piano', 'cancion', 'ritmo', 'baile', 'teatro', 'pintura', 'dibujo', 'color',
  'amigo', 'familia', 'hermano', 'abuela', 'vecino', 'maestro', 'alumno', 'medico', 'bombero', 'panadero',
  'comida', 'pan', 'queso', 'leche', 'fruta', 'manzana', 'naranja', 'platano', 'fresa', 'sandia',
  'verdura', 'tomate', 'patata', 'cebolla', 'lechuga', 'zanahoria', 'arroz', 'pasta', 'sopa', 'postre',
  'ordenador', 'teclado', 'pantalla', 'telefono', 'internet', 'programa', 'codigo', 'archivo', 'carpeta', 'memoria',
  'ciencia', 'historia', 'idioma', 'palabra', 'frase', 'lectura', 'escritura', 'cuento', 'novela', 'poema',
  'deporte', 'futbol', 'baloncesto', 'tenis', 'natacion', 'carrera', 'equipo', 'partido', 'premio', 'medalla',
  'animal', 'caballo', 'conejo', 'raton', 'tortuga', 'delfin', 'ballena', 'aguila', 'paloma', 'mariposa',
  'elefante', 'jirafa', 'cocodrilo', 'serpiente', 'murcielago', 'escarabajo', 'hormiga', 'abeja', 'tiburon', 'pinguino',
  'montana', 'desierto', 'isla', 'volcan', 'caverna', 'cascada', 'estrella', 'planeta', 'galaxia', 'cometa',
  'aventura', 'misterio', 'secreto', 'tesoro', 'castillo', 'caballero', 'dragon', 'mago', 'hechizo', 'leyenda',
  'esperanza', 'alegria', 'tristeza', 'sorpresa', 'valentia', 'paciencia', 'confianza', 'respeto', 'libertad', 'justicia',
  'invierno', 'primavera', 'verano', 'otono', 'lluvia', 'nieve', 'tormenta', 'niebla', 'arcoiris', 'trueno',
  'biblioteca', 'universidad', 'hospital', 'mercado', 'estacion', 'aeropuerto', 'restaurante', 'farmacia', 'museo', 'parque',
  'telescopio', 'microscopio', 'laboratorio', 'experimento', 'descubrimiento', 'invento', 'maquina', 'motor', 'energia', 'electricidad',
];

/** Configuración de dificultad del ahorcado. */
export const difficulties = {
  facil: { minLength: 3, maxLength: 5, lives: 8 },
  normal: { minLength: 5, maxLength: 8, lives: 6 },
  dificil: { minLength: 8, maxLength: 20, lives: 4 },
};

/** Preguntas de trivia. `a` es la respuesta correcta y debe estar en `options`. */
export const trivia = [
  { category: 'general', q: '¿Cuál es el océano más grande del planeta?', a: 'pacifico', options: ['Pacifico', 'Atlantico', 'Indico', 'Artico'] },
  { category: 'general', q: '¿Cuántos continentes hay?', a: 'seis', options: ['Cinco', 'Seis', 'Siete', 'Ocho'] },
  { category: 'general', q: '¿Qué instrumento tiene 88 teclas?', a: 'piano', options: ['Piano', 'Organo', 'Acordeon', 'Arpa'] },
  { category: 'general', q: '¿Cuál es el metal líquido a temperatura ambiente?', a: 'mercurio', options: ['Mercurio', 'Plomo', 'Zinc', 'Estano'] },
  { category: 'general', q: '¿Cuántos lados tiene un hexágono?', a: 'seis', options: ['Cinco', 'Seis', 'Siete', 'Ocho'] },
  { category: 'geografia', q: '¿Cuál es la capital de Japón?', a: 'tokio', options: ['Tokio', 'Osaka', 'Kioto', 'Nagoya'] },
  { category: 'geografia', q: '¿En qué continente está Egipto?', a: 'africa', options: ['Africa', 'Asia', 'Europa', 'Oceania'] },
  { category: 'geografia', q: '¿Cuál es el río más largo de Sudamérica?', a: 'amazonas', options: ['Amazonas', 'Parana', 'Orinoco', 'Magdalena'] },
  { category: 'geografia', q: '¿Qué país tiene forma de bota?', a: 'italia', options: ['Italia', 'Grecia', 'Portugal', 'Croacia'] },
  { category: 'geografia', q: '¿Cuál es el desierto más grande del mundo?', a: 'antartico', options: ['Antartico', 'Sahara', 'Gobi', 'Atacama'] },
  { category: 'ciencia', q: '¿Cuál es el símbolo químico del oro?', a: 'au', options: ['Au', 'Ag', 'Or', 'Go'] },
  { category: 'ciencia', q: '¿Cuántos huesos tiene aproximadamente un adulto?', a: '206', options: ['186', '206', '226', '246'] },
  { category: 'ciencia', q: '¿Qué planeta es conocido como el planeta rojo?', a: 'marte', options: ['Marte', 'Venus', 'Jupiter', 'Mercurio'] },
  { category: 'ciencia', q: '¿Qué gas respiran las plantas para la fotosíntesis?', a: 'dioxido de carbono', options: ['Dioxido de carbono', 'Oxigeno', 'Nitrogeno', 'Helio'] },
  { category: 'ciencia', q: '¿Cuál es la velocidad aproximada de la luz en el vacío?', a: '300000 km/s', options: ['300000 km/s', '150000 km/s', '30000 km/s', '1080 km/s'] },
  { category: 'historia', q: '¿En qué año llegó el ser humano a la Luna?', a: '1969', options: ['1959', '1969', '1972', '1981'] },
  { category: 'historia', q: '¿Qué civilización construyó Machu Picchu?', a: 'inca', options: ['Inca', 'Maya', 'Azteca', 'Olmeca'] },
  { category: 'historia', q: '¿En qué año cayó el muro de Berlín?', a: '1989', options: ['1979', '1989', '1991', '1995'] },
  { category: 'historia', q: '¿Quién escribió "Don Quijote de la Mancha"?', a: 'cervantes', options: ['Cervantes', 'Lope de Vega', 'Quevedo', 'Gongora'] },
  { category: 'historia', q: '¿Qué imperio construyó el Coliseo?', a: 'romano', options: ['Romano', 'Griego', 'Persa', 'Otomano'] },
  { category: 'tecnologia', q: '¿Qué significa "CPU"?', a: 'unidad central de procesamiento', options: ['Unidad central de procesamiento', 'Control de potencia unitaria', 'Computo por unidades', 'Canal privado de usuario'] },
  { category: 'tecnologia', q: '¿Qué lenguaje se ejecuta de forma nativa en el navegador?', a: 'javascript', options: ['JavaScript', 'Python', 'Java', 'C#'] },
  { category: 'tecnologia', q: '¿Cuántos bits tiene un byte?', a: 'ocho', options: ['Cuatro', 'Ocho', 'Dieciseis', 'Treinta y dos'] },
  { category: 'tecnologia', q: '¿Quién creó Linux?', a: 'linus torvalds', options: ['Linus Torvalds', 'Bill Gates', 'Steve Jobs', 'Richard Stallman'] },
  { category: 'tecnologia', q: '¿Qué protocolo usan las páginas web seguras?', a: 'https', options: ['HTTPS', 'FTP', 'SMTP', 'SSH'] },
  { category: 'anime', q: '¿Cómo se llama el cuaderno de "Death Note"?', a: 'death note', options: ['Death Note', 'Kira Book', 'Shinigami Pad', 'Note of Life'] },
  { category: 'anime', q: '¿Qué fruta del diablo comió Luffy?', a: 'gomu gomu', options: ['Gomu Gomu', 'Mera Mera', 'Hie Hie', 'Ope Ope'] },
  { category: 'anime', q: '¿En qué aldea vive Naruto?', a: 'konoha', options: ['Konoha', 'Suna', 'Kiri', 'Iwa'] },
  { category: 'anime', q: '¿Qué estudio animó "Attack on Titan" en sus primeras temporadas?', a: 'wit studio', options: ['Wit Studio', 'MAPPA', 'Bones', 'Ufotable'] },
  { category: 'anime', q: '¿Cuál es el apellido de Goku en la Tierra?', a: 'son', options: ['Son', 'Brief', 'Satan', 'Ox'] },
  { category: 'deporte', q: '¿Cada cuántos años se celebran los Juegos Olímpicos de verano?', a: 'cuatro', options: ['Dos', 'Tres', 'Cuatro', 'Cinco'] },
  { category: 'deporte', q: '¿Cuántos jugadores tiene un equipo de fútbol en el campo?', a: 'once', options: ['Nueve', 'Diez', 'Once', 'Doce'] },
  { category: 'deporte', q: '¿En qué deporte se usa un "birdie"?', a: 'badminton', options: ['Badminton', 'Tenis', 'Golf', 'Squash'] },
  { category: 'deporte', q: '¿Cuántos puntos vale un triple en baloncesto?', a: 'tres', options: ['Uno', 'Dos', 'Tres', 'Cuatro'] },
  { category: 'deporte', q: '¿Qué país ha ganado más mundiales de fútbol?', a: 'brasil', options: ['Brasil', 'Alemania', 'Italia', 'Argentina'] },
];

/** Categorías disponibles para `.trivia`. */
export const triviaCategories = [...new Set(trivia.map((item) => item.category))];

/** Emojis para `.randomemoji`. */
export const emojis = [
  '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰',
  '😘', '😎', '🤩', '🥳', '🤔', '🤨', '😐', '😴', '🤤', '😱',
  '😭', '😤', '😡', '🥺', '😬', '🤯', '🤠', '🤖', '👻', '👽',
  '💀', '🎃', '😺', '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐸', '🐵', '🐧', '🦉', '🦄', '🐝', '🦋', '🐢', '🐬',
  '🌸', '🌺', '🌻', '🌹', '🍀', '🌴', '🌵', '🍁', '🌊', '🔥',
  '⭐', '🌙', '☀️', '⚡', '❄️', '🌈', '☁️', '💧', '🌍', '🚀',
  '🍎', '🍌', '🍇', '🍓', '🍉', '🍕', '🍔', '🍟', '🍣', '🍜',
  '🍫', '🍪', '🎂', '☕', '🍵', '🧃', '⚽', '🏀', '🎮', '🎲',
  '🎧', '🎸', '🎹', '🎨', '📚', '💡', '💎', '🏆', '🎁', '❤️',
];

export default { words, difficulties, trivia, triviaCategories, emojis };
