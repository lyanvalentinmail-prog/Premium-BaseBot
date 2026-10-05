# Premium BaseBot

Bot de WhatsApp **completo, modular y funcional** construido sobre [Baileys](https://github.com/WhiskeySockets/Baileys) (multi-device).
Pensado para funcionar igual en **Termux/Android** y en **Linux/VPS**.

- **263 comandos** repartidos en **26 categorías**, cargados automáticamente desde `bot/commands/`.
- Conexión con **Pairing Code** (código de 8 dígitos) o **QR**, sesión persistente y reconexión controlada.
- Sistemas de **límites diarios, premium, economía, XP, RPG, minijuegos, grupos y panel de owner**.
- Base de datos **SQLite (sql.js)** persistente, con migraciones seguras.
- Sin funcionalidad falsa: lo que no está configurado responde `⚠️ Este servicio no está configurado.` y se documenta aquí.

> ⚠️ Este proyecto **no es** una API REST ni un servidor HTTP: es únicamente un bot que se conecta a WhatsApp.

---

## Índice

1. [Requisitos](#requisitos)
2. [Instalación en Termux (Android)](#instalación-en-termux-android)
3. [Instalación en Linux / VPS](#instalación-en-linux--vps)
4. [Configuración (`.env`)](#configuración-env)
5. [Vincular el bot (Pairing Code o QR)](#vincular-el-bot-pairing-code-o-qr)
6. [Scripts disponibles](#scripts-disponibles)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Catálogo de comandos](#catálogo-de-comandos)
9. [Sistemas internos](#sistemas-internos)
10. [Personalización](#personalización)
11. [Añadir comandos, categorías y APIs](#añadir-comandos-categorías-y-apis)
12. [Ejecución 24/7](#ejecución-247)
13. [Estado de funcionalidades](#estado-de-funcionalidades)
14. [Solución de problemas](#solución-de-problemas)
15. [Seguridad y buenas prácticas](#seguridad-y-buenas-prácticas)
16. [Actualización](#actualización)
17. [Pruebas](#pruebas)
18. [Licencia](#licencia)

---

## Requisitos

| Requisito | Versión | Obligatorio |
|---|---|---|
| Node.js | **20 o superior** (probado en 22) | ✅ |
| npm | 9+ | ✅ |
| git | cualquiera | ✅ |
| FFmpeg | 5+ | ⚙️ Solo para stickers animados, audio y voz |
| yt-dlp | reciente | ⚙️ Solo para la categoría DOWNLOADER |
| espeak-ng | cualquiera | ⚙️ TTS local de respaldo (si no hay OpenAI) |

La base de datos usa **`sql.js` (SQLite compilado a WebAssembly)**: no requiere compilación nativa, por lo que **funciona en Termux sin `gcc` ni `python`**, a diferencia de `better-sqlite3`. El fichero resultante (`data/database.db`) es un SQLite estándar que puedes abrir con cualquier herramienta SQLite.

---

## Instalación en Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts git ffmpeg -y

git clone https://github.com/lyanvalentinmail-prog/Premium-BaseBot.git
cd Premium-BaseBot

npm install
npm run setup
```

Opcional (descargas de vídeo/audio):

```bash
pkg install python -y
pip install -U yt-dlp
```

Opcional (voz local sin API de pago):

```bash
pkg install espeak -y    # proporciona espeak-ng en la mayoría de repos
```

Después edita el `.env` (ver [Configuración](#configuración-env)) y arranca:

```bash
npm start
```

Para que Termux no mate el proceso al apagar la pantalla:

```bash
termux-wake-lock
```

---

## Instalación en Linux / VPS

```bash
# Node 20+ (ejemplo Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git ffmpeg

git clone https://github.com/lyanvalentinmail-prog/Premium-BaseBot.git
cd Premium-BaseBot
npm install
npm run setup
nano .env
npm start
```

---

## Configuración (`.env`)

`npm run setup` crea el `.env` a partir de `.env.example` **sin sobrescribir** uno existente.
Lo mínimo imprescindible es `OWNER_NUMBER`.

### Variables principales

| Variable | Por defecto | Descripción |
|---|---|---|
| `BOT_NAME` | `Premium BaseBot` | Nombre mostrado en el menú |
| `BOT_VERSION` | `1.0.0` | Versión mostrada en el menú |
| `PREFIX` | `.` | Prefijo de comandos (**nunca hardcodeado**) |
| `PREFIXES` | — | Lista alternativa separada por comas, ej. `.,!,#` |
| `OWNER_NAME` | `Owner` | Nombre del propietario en el menú |
| `OWNER_NUMBER` | — | **Obligatorio**. Número del owner con prefijo internacional, sin `+` ni espacios (`34600000000`) |
| `OWNER_NUMBERS` | — | Varios owners separados por comas |
| `BOT_MODE` | `public` | `public` o `private` (también se cambia con `.public` / `.private`) |
| `DEFAULT_LIMIT` | `25` | Usos diarios para usuarios normales |
| `PREMIUM_LIMIT` | `100` | Usos diarios para usuarios premium |
| `USE_PAIRING_CODE` | `true` | `true` = código de 8 dígitos, `false` = QR |
| `PAIRING_NUMBER` | — | Número **del teléfono donde corre el bot**; si falta, se pedirá por consola |
| `SESSION_DIR` | `sessions` | Carpeta de credenciales |
| `BANNER_PATH` | `assets/banner.jpg` | Imagen del menú |
| `ANTISPAM_SECONDS` | `3` | Cooldown global por usuario y comando |
| `INTERACTIVE_MENU` | `false` | `true` intenta el menú con botón/lista nativa; muchas versiones de WhatsApp lo descartan sin avisar, por eso por defecto se envía el menú clásico (imagen + texto) |
| `LOG_LEVEL` | `info` | `trace`…`silent` |
| `DEBUG_MESSAGES` | `false` | `true` registra metadatos de cada mensaje recibido y del comando detectado (sin contenido privado). Úsalo para diagnosticar «el bot no responde» |
| `NODE_ENV` | `production` | Entorno |

Otras variables de comportamiento (`AUTO_READ`, `AUTO_TYPING`, `SELF_REPLY`, `REACT_ON_COMMAND`, `MAX_MEDIA_MB`, `MAX_AUDIO_SECONDS`, `TEMP_TTL_MINUTES`, `HTTP_TIMEOUT_MS`, `MAX_RECONNECT_ATTEMPTS`, `BROWSER_NAME`, `STICKER_PACK`, `STICKER_AUTHOR`, `XP_*`, `CURRENCY_*`, `DAILY_REWARD`, `START_BALANCE`) están documentadas en `.env.example`.

### Claves de API (todas opcionales)

| Variable | Servicio | Qué habilita |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | `.chat`, `.ask`, `.imagine`, `.tts`, `.say`… |
| `GEMINI_API_KEY` | Google Gemini | Alternativa de texto para los comandos de IA |
| `WEATHER_API_KEY` | OpenWeather | Mejora `.weather` (sin clave usa **Open-Meteo**, gratuito) |
| `REMOVE_BG_API_KEY` | remove.bg | `.removebg` |
| `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Google CSE | `.google`, `.imagesearch` nativo |
| `YOUTUBE_API_KEY` | YouTube Data v3 | `.youtube`, `.ytstalk` |
| `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` | Twitch | `.twitchstalk` |
| `STEAM_API_KEY` | Steam Web API | `.steamstalk` |
| `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` | Spotify | `.spotify` (**solo metadatos**, nunca audio: DRM) |
| `GITHUB_TOKEN` | GitHub | Sube el límite de peticiones de `.github` / `.githubstalk` |
| `LIBRETRANSLATE_URL` (+ `LIBRETRANSLATE_API_KEY`) | LibreTranslate | `.translate` |
| `TENOR_API_KEY` | Tenor | `.emojimix` |

Sin clave, cada comando responde `⚠️ Este servicio no está configurado.` e indica qué variable falta: **nunca devuelve datos inventados**.

---

## Vincular el bot (Pairing Code o QR)

### Pairing Code (recomendado, no necesita cámara)

1. En `.env`: `USE_PAIRING_CODE=true` y, opcionalmente, `PAIRING_NUMBER=34600000000`.
2. `npm start`. Si no hay `PAIRING_NUMBER`, la consola pedirá el número (se normaliza solo: se eliminan `+`, espacios y guiones).
3. Aparecerá un código tipo `ABCD-EFGH`.
4. En WhatsApp: **Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono** e introduce el código.

### QR

1. `USE_PAIRING_CODE=false`.
2. `npm start` y escanea el QR que se dibuja en la terminal desde **Dispositivos vinculados**.

La sesión queda en `sessions/` y se reutiliza en los siguientes arranques. Si la sesión se corrompe o cierras el dispositivo desde el móvil: `npm run reset-session`.

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Arranca el bot |
| `npm run dev` | Arranca con recarga automática (`node --watch`) |
| `npm run setup` | Comprueba Node, crea `.env`, carpetas y base de datos, detecta FFmpeg/yt-dlp y resume la configuración |
| `npm run reset-session` | Borra **solo** la carpeta de sesión. Pide confirmación; para saltarla usa `npm run reset-session -- --yes` (los dos guiones son obligatorios: npm se queda con los flags que van antes) |
| `npm run check` | Diagnóstico offline: config, owner, DB, comandos, binarios, proveedores y banner |
| `npm test` | Suite de pruebas automáticas (37 tests, sin conexión a WhatsApp) |

---

## Estructura del proyecto

```
Premium-BaseBot/
├── bot/
│   ├── index.js                 # Punto de entrada: arranque, errores globales, apagado limpio
│   ├── connection.js            # Baileys: pairing code/QR, reconexión, eventos
│   ├── handler.js               # Pipeline de mensajes: prefijo, permisos, límites, ejecución
│   ├── config.js                # Carga y normalización de .env + rutas
│   ├── commands/                # 27 ficheros · 26 categorías · 263 comandos
│   │   ├── main/   info/   fun/   tools/   internet/  stalk/   anime/
│   │   ├── game/   rpg/    xp/    ai/      audio/     voice/   downloader/
│   │   ├── image/  maker/  sticker/ quotes/ quran/    random/  search/
│   │   └── sound/  store/  group/  panel/   owner/
│   ├── lib/
│   │   ├── commandLoader.js     # Carga automática y validación de metadata
│   │   ├── context.js           # ctx reutilizable para todos los comandos
│   │   ├── menu.js              # Menú principal, categorías y símbolos de permiso
│   │   ├── apiClient.js         # HTTP centralizado: timeout, tamaño máx., anti-SSRF
│   │   ├── limits.js            # Límites diarios
│   │   ├── errors.js            # UserError / ProviderError / NotConfiguredError
│   │   ├── validators.js        # Validación real de argumentos
│   │   ├── media.js  ffmpeg.js  sticker.js  imageMaker.js  downloader.js
│   │   ├── games.js  mathEval.js  logger.js  utils.js  categories.js
│   │   └── data/                # Datos locales (chistes, trivia, objetos RPG, tienda…)
│   ├── middleware/              # owner, admin, grupo, premium, límite, bloqueos
│   └── database/
│       ├── index.js             # sql.js + migraciones + guardado atómico
│       ├── users.js  groups.js  premium.js  economy.js  xp.js  rpg.js  settings.js
├── scripts/
│   ├── setup.js  reset-session.js  check.js
├── tests/
│   ├── bot.test.js              # 37 pruebas sobre el handler real
│   └── helpers/mockSock.js      # Socket de WhatsApp simulado
├── assets/
│   ├── banner.jpg               # Imagen del menú
│   ├── sounds/                  # Vacío: añade tus propios audios
│   └── temp/                    # Temporales (se limpian solos)
├── data/                        # Base de datos (ignorada por git)
├── sessions/                    # Credenciales de WhatsApp (ignorada por git)
├── .env.example  .gitignore  LICENSE  package.json  README.md  CHANGELOG.md
```

---

## Catálogo de comandos

Símbolos: **Ⓟ** premium · **Ⓛ** consume límite · **Ⓞ** solo owner · **Ⓐ** solo admins del grupo · sin símbolo = público.
Se generan automáticamente desde la metadata de cada comando; `.menu` y `.menu <categoría>` siempre muestran el estado real.

| Categoría | Nº | Comandos |
|---|---|---|
| 🏠 MAIN | 12 | menu, commands, categories, help, ping, profile, report, rules, runtime, settings, status, support |
| ℹ️ INFO | 8 | botinfo, ownerinfo, groupinfo, admins, user, stats, version, changelog |
| 🎉 FUN | 10 | 8ball, choose, dare, joke, meme, rate, reverse, roast, ship, truth |
| 🛠️ TOOLS | 10 | base64, decode64, calc, hash, qr, readqr, shorturl, timestamp, translateⓁ, weather |
| 🌐 INTERNET | 9 | dns, domain, headers, http, ip, pinghost, urlcheck, website, whois |
| 🔎 STALK | 8 | githubstalk, npmstalk, robloxstalk, steamstalk, twitchstalk, ytstalk, igstalk, tiktokstalk |
| 🌸 ANIME | 10 | animeinfo, mangainfo, character, animequote, neko, waifu, husbando, season, topanime, topmanga |
| 🎮 GAME | 11 | coinflip, dice, guess, hangman, mathgame, rps, slots, tictactoe, trivia, wordgame, stopgame |
| ⚔️ RPG | 12 | rpg, hunt, fight, adventure, dungeon, boss, quest, craft, equip, heal, rpginv, toprpg |
| ⭐ XP | 10 | xp, rank, level, progress, leaderboard, topxp, dailyxp, rewards, prestige, xpstats |
| 🤖 AI | 10 | askⓁ, chatⓁ, codeⓅ, explainⓁ, grammar, imagineⓅ, promptⓅ, rewriteⓁ, summarizeⓁ, translateaiⓁ |
| 🎵 AUDIO | 10 | bass, echo, mp3, nightcore, reverb, reverseaudio, slow, speed, trim, volume |
| ⬇️ DOWNLOADER | 11 | ytmp3Ⓛ, ytmp4Ⓛ, tiktokⓁ, instagramⓁ, facebookⓁ, twitterⓁ, pinterestⓁ, soundcloudⓁ, mediafireⓁ, spotify, mediainfo |
| 🖼️ IMAGE | 11 | blur, compress, crop, grayscale, invert, pixel, removebgⓅ, resize, rotate, tojpg, upscale |
| 🎨 MAKER | 9 | avatar, banner, gradient, logo, neon, poster, quoteimg, textlogo, watermark |
| 👥 GROUP | 12 | welcomeⒶ, goodbyeⒶ, setwelcomeⒶ, setgoodbyeⒶ, resetwelcomeⒶ, antilinkⒶ, kickⒶ, promoteⒶ, demoteⒶ, tagallⒶ, grouplinkⒶ, groupmodeⒶ |
| 🧩 PANEL | 9 | panel, limit, mylimit, premium, premiumstatus, premiumlistⓄ, publicⓄ, privateⓄ, cleantempⓄ |
| 💬 QUOTES | 9 | quote, dailyquote, motivation, wisdom, lovequote, sadquote, lifequote, friendquote, successquote |
| 📖 QURAN | 10 | quran, surah, ayah, juz, randomayah, quransearch, quranaudio, tafsir, translation, quraninfo |
| 🎲 RANDOM | 10 | randomanime, randomcolor, randomcountry, randomemoji, randomfact, randomimage, randomnumber, randomquote, randomuser, randomword |
| 🔍 SEARCH | 10 | googleⓁ, imagesearchⓁ, youtubeⓁ, lyricsⓁ, wikipedia, github, npm, animesearch, mangasearch, pinterestsearch |
| 🔊 SOUND | 4 | sound, sounds, soundinfo, beep |
| 🏷️ STICKER | 9 | sticker, toimg, togif, take, stickerwm, stickercrop, stickerinfo, circle, emojimix |
| 🛒 STORE | 12 | store, shop, buy, sell, item, use, inventory, balance, daily, gift, redeem, topmoney |
| 🎙️ VOICE | 10 | ttsⓁ, sayⓁ, chipmunk, deepvoice, fastvoice, slowvoice, robotvoice, reversevoice, voicefx, toptt |
| 👑 OWNER | 17 | addpremium, delpremium, banuser, unbanuser, banlist, blockcmd, unblockcmd, blockedcmds, broadcast, logs, reload, restart, shutdown, whitelist, addmoney, createcode, botstats (todos Ⓞ) |
| **TOTAL** | **263** | |

### Nombres renombrados para evitar colisiones

| Original | Final | Motivo |
|---|---|---|
| alias `invertir` de `reverse` (FUN) | `alreves` | `invertir` pertenece a `invert` (IMAGE) |
| alias `speed` de `ping` | `latencia` | `speed` es un comando de AUDIO |
| `pinterest` (SEARCH) | `pinterestsearch` (alias `pinsearch`) | `pinterest` pertenece a DOWNLOADER |

---

## Sistemas internos

- **Límites diarios** — `DEFAULT_LIMIT` / `PREMIUM_LIMIT`, reset automático cada 24 h, owner ilimitado, consulta con `.limit` / `.mylimit`. El límite **se consume después de validar argumentos** y se **reembolsa** si el proveedor externo falla.
- **Premium** — `.addpremium <número> <días>` / `.delpremium`; expira solo; `.premiumstatus` muestra el tiempo restante.
- **Economía** — saldo e inventario con operaciones **atómicas** (transacción SQL): nunca hay saldo negativo ni objetos duplicados si falla el pago.
- **XP** — XP por actividad con cooldown anti-farm, niveles con recompensas (niveles 5/10/20/35/50 → 500/1500/4000/10000/25000 monedas y +2/5/10/20/40 de límite) y prestigio a nivel 50.
- **RPG** — personaje persistente, inventario, equipo, mazmorras y jefes con cooldowns (hunt 60 s, fight 120 s, adventure 300 s, dungeon 600 s, boss 1800 s).
- **Minijuegos** — una partida por chat, TTL de 5 min (10 min en tictactoe), se responde sin prefijo, `rendirse` o `.stopgame` para abandonar.
- **Grupos** — bienvenida/despedida personalizables, antilink (`on` / `off` / `all`), kick/promote/demote con verificación de **admin del usuario y del bot**.
- **Owner** — `restart`, `shutdown`, `broadcast` (1,2 s entre envíos), ban/unban, bloqueo de comandos, `logs`, `reload`, `botstats`.
- **Modo público/privado** — persistente en base de datos (`.public` / `.private`).
- **Errores** — jerarquía `UserError` / `ProviderError` / `NotConfiguredError`; los stack traces **solo van al log**, nunca a WhatsApp, y un comando que falla no tumba el bot.
- **HTTP centralizado** (`bot/lib/apiClient.js`) — timeout, tamaño máximo de respuesta, validación de URL y **protección anti-SSRF** (bloquea `localhost`, `127.0.0.0/8`, `::1`, rangos privados, link-local y metadatos de nube `169.254.169.254`).
- **Menú** — por defecto se envía como **imagen + caption + navegación textual** (`.menu list`, `.categories`, `.menu <categoría>`), que es el formato que renderizan todas las versiones de WhatsApp. Con `INTERACTIVE_MENU=true` se intenta primero el botón/lista nativa y, si falla, cae automáticamente al menú clásico.
- **Temporales** — todo archivo multimedia temporal se elimina **también en caso de error**; `.cleantemp` fuerza la limpieza.

---

## Personalización

**Cambiar el prefijo** — `.env` → `PREFIX=!` (o varios: `PREFIXES=.,!,#`). Reinicia el bot.

**Cambiar el nombre y la versión** — `BOT_NAME` y `BOT_VERSION` en `.env`.

**Cambiar el owner** — `OWNER_NUMBER=34600000000` (sin `+`). El owner se determina **solo por el número normalizado**, nunca por el nombre de perfil. Varios owners: `OWNER_NUMBERS=34600000000,34611111111`.

**Cambiar el banner** — sustituye `assets/banner.jpg` por tu imagen (JPG/PNG, recomendado 1280×720) o apunta a otra ruta con `BANNER_PATH=assets/mi-banner.jpg`.

**Añadir sonidos** — copia tus `.mp3`/`.ogg` en `assets/sounds/` (el repositorio los incluye vacíos para no distribuir audio con copyright) y úsalos con `.sound <nombre>`; `.sounds` lista los disponibles.

---

## Añadir comandos, categorías y APIs

### Nuevo comando

Crea o edita un fichero dentro de `bot/commands/<categoria>/`. El loader lo detecta solo, **no hay que registrar nada en el handler**:

```js
// bot/commands/tools/ejemplo.js
export default {
  name: 'ejemplo',
  aliases: ['ej'],
  category: 'tools',          // opcional: si falta, se usa el nombre de la carpeta
  args: '<texto> [extra]',    // <> obligatorio · [] opcional (solo documentación)
  description: 'Comando de ejemplo',
  limit: false,               // Ⓛ consume límite diario
  premium: false,             // Ⓟ
  owner: false,               // Ⓞ
  admin: false,               // Ⓐ (admin del grupo)
  botAdmin: false,            // requiere que el bot sea admin
  groupOnly: false,
  cooldown: 3,                // segundos
  async execute(ctx) {
    await ctx.reply(`Has dicho: ${ctx.text}`);
  },
};
```

Un mismo fichero puede exportar **varios** comandos con `export default [cmd1, cmd2]`.

La validación de `<obligatorio>` es automática: si falta, el usuario recibe
`❌ Falta un argumento obligatorio.` seguido del uso correcto.

**`ctx` incluye**: `sock, m, raw, text, args, command, prefix, sender, senderNumber, pushName, chat, isGroup, isAdmin, isBotAdmin, isOwner, isPremium, quoted, mentions, groupMetadata, db, user, group` y los helpers `reply()`, `react()`, `send()`, `targetJid()`, `mediaMessage()`, `downloadMedia()`.

### Nueva categoría

1. Crea la carpeta `bot/commands/mitema/` con al menos un comando.
2. Añade su icono y nombre en `bot/lib/categories.js`.
3. Reinicia (o `.reload`): el menú la mostrará automáticamente con su total.

### Nueva API

1. Añade la variable a `.env.example` y a `.env`.
2. Regístrala en `PROVIDERS` de `bot/lib/apiClient.js`.
3. En el comando, usa `requireProvider('miapi')` y `requestJson(...)`; si falta la clave se lanza `NotConfiguredError` y el usuario recibe `⚠️ Este servicio no está configurado.` sin que el bot se caiga.

---

## Ejecución 24/7

En **VPS** (recomendado para uso permanente):

```bash
npm i -g pm2
pm2 start npm --name premium-basebot -- start
pm2 save && pm2 startup
pm2 logs premium-basebot
```

En **Android/Termux** se puede dejar corriendo con `termux-wake-lock` + sesión persistente, pero **no se puede garantizar 24/7**: el sistema puede matar el proceso por ahorro de batería, cambios de red, actualizaciones o falta de memoria. Para disponibilidad real usa un VPS.

---

## Estado de funcionalidades

### ✅ Implementado y funcionando sin configurar nada

MAIN, INFO, FUN, PANEL, OWNER, GROUP, GAME, RPG, XP, STORE, QUOTES, RANDOM (incluye uselessfacts, randomuser.me, restcountries, picsum.photos), QURAN (api.alquran.cloud), ANIME (Jikan v4 + nekos.best), TOOLS (base64, calc, hash, qr, readqr, timestamp, shorturl con is.gd, weather vía Open-Meteo), INTERNET (ip-api, `node:dns`, RDAP, headers/http/urlcheck), SEARCH (wikipedia, github, npm, animesearch, mangasearch, lyrics.ovh, `.imagesearch` vía Openverse), STALK (GitHub, npm, Roblox), IMAGE (procesado local con Jimp, incluido `.upscale`), MAKER (generación local de imágenes), STICKER y AUDIO/VOICE **si hay FFmpeg**.

### ⚙️ Requiere configuración

| Función | Qué hace falta |
|---|---|
| AI (`.chat`, `.ask`, `.imagine`, `.code`…) | `OPENAI_API_KEY` o `GEMINI_API_KEY` |
| `.tts`, `.say` | `OPENAI_API_KEY`, o `espeak-ng` instalado (respaldo local) |
| STICKER animado, AUDIO, VOICE | **FFmpeg** instalado (`⚠️ Esta función requiere FFmpeg.` si falta) |
| DOWNLOADER | **yt-dlp** instalado |
| `.google`, `.imagesearch` nativo | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` |
| `.youtube`, `.ytstalk` | `YOUTUBE_API_KEY` |
| `.twitchstalk` | `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `.steamstalk` | `STEAM_API_KEY` |
| `.spotify` | `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (**solo metadatos**) |
| `.removebg` | `REMOVE_BG_API_KEY` |
| `.translate` | `LIBRETRANSLATE_URL` (instancia propia o pública con clave) |
| `.emojimix` | `TENOR_API_KEY` |
| `.weather` preciso | `WEATHER_API_KEY` (sin ella funciona con Open-Meteo) |
| `.sound` | Audios propios en `assets/sounds/` |

### 🚧 No disponible (y por qué)

| Función | Motivo |
|---|---|
| `.pinterestsearch` | Pinterest no ofrece API pública abierta de búsqueda; scrapear su web incumpliría sus términos. El comando lo explica y sugiere `.imagesearch`. |
| `.igstalk`, `.tiktokstalk` | Instagram y TikTok exigen autenticación/aprobación para datos de perfil; solo se devuelve lo público disponible y se informa de la limitación. |
| Descarga de audio de Spotify | Protegido por DRM: **no se implementa ningún bypass**; `.spotify` devuelve solo metadatos. |
| Descargas de contenido privado o de pago | Fuera de alcance por política del proyecto. |

---

## Solución de problemas

| Problema | Solución |
|---|---|
| `Error: Cannot find module` tras actualizar | `rm -rf node_modules package-lock.json && npm install` |
| El pairing code no aparece | Revisa `USE_PAIRING_CODE=true`, borra `sessions/` con `npm run reset-session` y reintenta; el número debe llevar prefijo internacional sin `+` |
| `Connection closed · loggedOut` | La sesión fue cerrada desde el móvil: `npm run reset-session` y vuelve a vincular |
| Reconexiones infinitas | El bot se detiene tras `MAX_RECONNECT_ATTEMPTS`; revisa tu conexión y la hora del sistema |
| `⚠️ Esta función requiere FFmpeg.` | `pkg install ffmpeg` (Termux) o `sudo apt install ffmpeg` |
| Descargas fallan | Instala/actualiza `yt-dlp` (`pip install -U yt-dlp`) |
| `⚠️ Este servicio no está configurado.` | Falta la clave de API correspondiente (ver la tabla anterior) |
| La base de datos no guarda | Comprueba permisos de escritura en `data/`; `npm run check` lo verifica |
| `npm run reset-session` dice «No hay ninguna sesión guardada» | Desde la v1.0.2 detecta la carpeta aunque el `.env` esté en formato Windows (CRLF), con comillas o con comentarios, y busca también `session/`, `auth_info_baileys/` y `auth_info/`. Si usas otra ruta: `SESSION_DIR=mi_carpeta npm run reset-session -- --yes` |
| `npm run reset-session` no borra nada o se queda esperando | Sin terminal interactiva no puede preguntar: usa `npm run reset-session -- --yes`. Detén el bot antes, o volverá a escribir la sesión al instante |
| **Ningún comando responde** | Sigue el diagnóstico de abajo (⤵︎ *El bot no responde a nada*) |
| El bot no responde a los comandos que escribes **desde su propio número** | Corregido en la v1.0.3: esos mensajes llegan como `append` y antes se descartaban. Actualiza con `git pull` |
| El bot responde a otros pero no te reconoce como owner | Desde la v1.0.3 se resuelve el LID (`@lid`) al número real. Comprueba también `OWNER_NUMBER` (sin `+`, con código de país) |
| `.menu` no responde (el resto de comandos sí) | Estás usando el menú interactivo: pon `INTERACTIVE_MENU=false` en `.env` (valor por defecto desde la v1.0.1). WhatsApp descarta en silencio los mensajes de botón/lista en muchas versiones |
| `.menu` llega sin imagen | Falta o está vacío `assets/banner.jpg` (o `BANNER_PATH` apunta mal): el bot envía el menú en texto y lo avisa en el log |
| El bot no responde en un grupo | Modo privado activo (`.public`), comando bloqueado (`.blockedcmds`) o usuario baneado (`.banlist`) |
| Termux mata el proceso | `termux-wake-lock` y desactiva la optimización de batería; para 24/7 real usa un VPS |
| Errores TLS al instalar | Problema de red/proxy local, no del proyecto; prueba otra red o `npm config set registry https://registry.npmjs.org/` |

### El bot no responde a nada

Ejecútalo con el diagnóstico activado y observa la consola mientras escribes `.ping`:

```bash
DEBUG_MESSAGES=true LOG_LEVEL=debug npm start
```

1. **¿Aparece «✅ Conectado a WhatsApp» y el recuadro del bot?** Si no, el problema es la conexión/sesión: `npm run reset-session -- --yes` y vuelve a vincular.
2. **¿Aparece «Mensaje recibido» al escribir?** Si no, el bot no está recibiendo nada: la sesión está vinculada a otro dispositivo o se cerró desde el móvil.
3. **¿Dice «Mensaje sin prefijo»?** Tu `PREFIX` no coincide con lo que escribes (el log muestra los prefijos activos).
4. **¿Dice «Comando no encontrado»?** El nombre está mal escrito; prueba `.menu list`.
5. **¿Dice «modo privado»?** Ejecuta `.public` desde el número del owner o pon `BOT_MODE=public` en `.env`.
6. **¿Dice «Ignorado por cooldown»?** Espera unos segundos entre comandos (`ANTISPAM_SECONDS`).
7. **¿No aparece nada de lo anterior?** Comprueba con `npm run check` que carga los 263 comandos y que el `.env` tiene `OWNER_NUMBER`.

Logs: `logs/` (rotados) y `.logs` desde WhatsApp (solo owner). Nunca se registran claves, credenciales ni la sesión.

---

## Seguridad y buenas prácticas

- `.env`, `sessions/`, `data/*.db`, `assets/temp/` y `*.log` están en `.gitignore`: **nunca subas credenciales ni sesiones**.
- Ninguna clave real se incluye en el repositorio; `.env.example` solo tiene nombres de variables vacíos.
- Los logs no contienen claves de API, tokens ni la sesión.
- Protección anti-SSRF en todas las peticiones HTTP salientes.
- Los stack traces nunca llegan a WhatsApp.
- El owner se valida por número normalizado, nunca por nombre de perfil.
- Evaluador matemático propio (`.calc`): no usa `eval` ni ejecuta código.
- El proyecto **no implementa** bypass de DRM, paywalls, autenticación, CAPTCHA ni límites de uso de terceros.
- Usa el bot respetando los Términos de Servicio de WhatsApp: evita spam y envíos masivos no solicitados.

---

## Actualización

```bash
cd Premium-BaseBot
git pull
npm install
npm run check   # verifica config, DB y comandos
npm start
```

Las migraciones de base de datos se aplican solas y **no borran datos existentes**.

---

## Pruebas

```bash
npm test
```

37 pruebas automáticas que ejercitan el handler real con un socket de WhatsApp simulado: carga de comandos y metadata, alias, prefijo configurable, validación de argumentos, permisos (owner/admin/grupo), premium con expiración, límites (consumo, agotamiento, reembolso, owner ilimitado), usuarios baneados, comandos bloqueados, modo privado, economía atómica, XP, menú dinámico, anti-SSRF, evaluador matemático, persistencia en disco y manejo de errores.

> Nota: todo lo que requiere una **sesión real de WhatsApp** (envío efectivo de stickers, audios o difusiones a contactos reales) no puede probarse automáticamente y **no se declara como probado**.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
