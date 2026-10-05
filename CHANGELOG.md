# Changelog

Todas las novedades relevantes de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [SemVer](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-05

### Añadido

- **Conexión Baileys multi-device** con Pairing Code (número normalizado) y QR alternativo, sesión persistente en `sessions/` y reconexión con límite de intentos (sin bucles infinitos).
- **Carga automática de comandos** desde `bot/commands/` con metadata uniforme y validación; sin registro manual en el handler. **263 comandos en 26 categorías**.
- **Contexto reutilizable** (`ctx`) con helpers `reply`, `react`, `send`, `targetJid`, `mediaMessage`, `downloadMedia`.
- **Prefijo configurable** (`PREFIX` / `PREFIXES`), nunca hardcodeado.
- **Menú** con banner, caption dinámico (nombre, owner, versión, modo, estado, uptime, prefijo, total de comandos), lista interactiva y fallback textual (`.menu list`, `.commands`, `.menu <categoría>`).
- **Símbolos de permiso** Ⓟ Ⓛ Ⓞ Ⓐ generados automáticamente desde la metadata, con leyenda y totales por categoría.
- **Validación real de argumentos** con validadores de URL, número, mención, media y enumerados; mensaje `❌ Falta un argumento obligatorio.` + uso.
- **Sistemas**: límites diarios con reset y reembolso, premium con expiración, economía atómica, XP con anti-farm y prestigio, RPG persistente con cooldowns, minijuegos por chat, gestión de grupos (welcome/goodbye/antilink/kick/promote/demote), panel y herramientas de owner, modo público/privado persistente.
- **Base de datos SQLite vía `sql.js`** (sin compilación nativa, apta para Termux) con migraciones seguras y guardado atómico.
- **Cliente HTTP centralizado** con timeout, tamaño máximo, validación de URL y protección anti-SSRF (localhost, 127/8, ::1, rangos privados, link-local y metadatos de nube).
- **Logging estructurado** (pino) con redacción de secretos y rotación simple; `.logs` para el owner.
- **Manejo global de errores**: `UserError` / `ProviderError` / `NotConfiguredError`; nunca se envían stack traces a WhatsApp.
- **Scripts**: `start`, `dev`, `setup`, `reset-session`, `check`, `test`.
- **Suite de pruebas** (37 tests) sobre el handler real con socket de WhatsApp simulado.
- **Documentación**: README completo (Termux, VPS, pairing code, personalización, APIs, 24/7, troubleshooting, seguridad) y clasificación ✅ / ⚙️ / 🚧.

### Notas

- `assets/sounds/` se distribuye vacío para no incluir audio con derechos.
- Renombrados por colisión: alias `invertir` → `alreves` (`reverse`), alias `speed` → `latencia` (`ping`), comando `pinterest` de SEARCH → `pinterestsearch`.
- `.spotify` devuelve únicamente metadatos: no se implementa ningún bypass de DRM.
