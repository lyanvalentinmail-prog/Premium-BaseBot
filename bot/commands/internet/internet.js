/**
 * Herramientas de red (solo diagnóstico de recursos públicos).
 * Todas las URLs/hosts pasan por validación anti-SSRF: no se permiten
 * destinos locales, privados, link-local ni endpoints de metadatos cloud.
 */
import dnsPromises from 'node:dns/promises';
import net from 'node:net';
import { request, requestJson, assertSafeUrl, isPrivateIp } from '../../lib/apiClient.js';
import { requireUrl } from '../../lib/validators.js';
import { UserError, ProviderError } from '../../lib/errors.js';
import { stripTags, truncate, formatBytes } from '../../lib/utils.js';

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

const requireDomain = (input, ctx, command) => {
  const domain = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!DOMAIN_REGEX.test(domain)) {
    throw new UserError(`❌ Dominio no válido.\n\nUso:\n${ctx.prefix}${command.name} ${command.args}`);
  }
  return domain;
};

const ip = {
  name: 'ip',
  category: 'internet',
  args: '<ip>',
  description: 'Información pública de una dirección IP (ip-api.com)',
  example: 'ip 8.8.8.8',
  async execute(ctx) {
    const address = ctx.args[0];
    if (!net.isIP(address)) throw new UserError('❌ Dirección IP no válida.');
    if (isPrivateIp(address)) throw new UserError('🛡️ Las direcciones privadas o locales no están permitidas.');
    const data = await requestJson(`http://ip-api.com/json/${encodeURIComponent(address)}?lang=es`, { label: 'ip-api' });
    if (data.status !== 'success') throw new UserError(`❌ No se pudo consultar esa IP (${data.message || 'desconocido'}).`);
    await ctx.reply(
      [
        `🌐 *INFORMACIÓN DE ${address}*`,
        '',
        `📍 Ubicación ☇ ${data.city || '—'}, ${data.regionName || '—'}, ${data.country || '—'}`,
        `🏢 ISP ☇ ${data.isp || '—'}`,
        `🏛️ Organización ☇ ${data.org || '—'}`,
        `🔢 AS ☇ ${data.as || '—'}`,
        `🕐 Zona horaria ☇ ${data.timezone || '—'}`,
        '',
        '_Fuente: ip-api.com_',
      ].join('\n'),
    );
  },
};

const dns = {
  name: 'dns',
  category: 'internet',
  args: '<dominio>',
  description: 'Registros DNS de un dominio',
  example: 'dns github.com',
  async execute(ctx) {
    const domain = requireDomain(ctx.args[0], ctx, dns);
    const query = async (type) => {
      try {
        return await dnsPromises.resolve(domain, type);
      } catch {
        return [];
      }
    };
    const [a, aaaa, mx, txt, ns] = await Promise.all([
      query('A'), query('AAAA'), query('MX'), query('TXT'), query('NS'),
    ]);
    if (!a.length && !aaaa.length && !ns.length) throw new UserError('❌ No se encontraron registros DNS para ese dominio.');
    await ctx.reply(
      [
        `🧭 *DNS DE ${domain}*`,
        '',
        `*A* ☇ ${a.join(', ') || '—'}`,
        `*AAAA* ☇ ${aaaa.join(', ') || '—'}`,
        `*MX* ☇ ${mx.map((r) => `${r.exchange} (${r.priority})`).join(', ') || '—'}`,
        `*NS* ☇ ${ns.join(', ') || '—'}`,
        `*TXT* ☇ ${truncate(txt.flat().join(' | '), 500) || '—'}`,
      ].join('\n'),
    );
  },
};

const whois = {
  name: 'whois',
  category: 'internet',
  args: '<dominio>',
  description: 'Datos de registro (RDAP) de un dominio',
  example: 'whois google.com',
  async execute(ctx) {
    const domain = requireDomain(ctx.args[0], ctx, whois);
    const data = await requestJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { label: 'rdap' });
    const events = Object.fromEntries((data.events || []).map((e) => [e.eventAction, e.eventDate]));
    const registrar = (data.entities || []).find((e) => e.roles?.includes('registrar'));
    const registrarName =
      registrar?.vcardArray?.[1]?.find((entry) => entry[0] === 'fn')?.[3] || registrar?.handle || '—';
    await ctx.reply(
      [
        `📄 *WHOIS (RDAP) DE ${domain}*`,
        '',
        `🏷️ Estado ☇ ${(data.status || []).join(', ') || '—'}`,
        `🏢 Registrador ☇ ${registrarName}`,
        `📅 Registro ☇ ${events.registration?.slice(0, 10) || '—'}`,
        `♻️ Última actualización ☇ ${events['last changed']?.slice(0, 10) || events.lastChanged?.slice(0, 10) || '—'}`,
        `⏳ Expiración ☇ ${events.expiration?.slice(0, 10) || '—'}`,
        `🖥️ Nameservers ☇ ${(data.nameservers || []).map((n) => n.ldhName).join(', ') || '—'}`,
        '',
        '_Fuente: RDAP (rdap.org)_',
      ].join('\n'),
    );
  },
};

const http = {
  name: 'http',
  category: 'internet',
  args: '<url>',
  description: 'Comprueba el estado HTTP de una URL',
  example: 'http https://example.com',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, http);
    const started = Date.now();
    const response = await request(url, { userProvided: true, method: 'GET', redirect: 'follow' });
    const elapsed = Date.now() - started;
    const body = await response.text().catch(() => '');
    await ctx.reply(
      [
        `🌐 *HTTP ${response.status} ${response.statusText}*`,
        '',
        `🔗 URL final ☇ ${response.url}`,
        `⚡ Tiempo ☇ ${elapsed} ms`,
        `📦 Tipo ☇ ${response.headers.get('content-type') || '—'}`,
        `📏 Tamaño ☇ ${formatBytes(Buffer.byteLength(body))}`,
        `🖥️ Servidor ☇ ${response.headers.get('server') || '—'}`,
      ].join('\n'),
    );
  },
};

const headers = {
  name: 'headers',
  aliases: ['cabeceras'],
  category: 'internet',
  args: '<url>',
  description: 'Muestra las cabeceras de respuesta de una URL',
  example: 'headers https://example.com',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, headers);
    const response = await request(url, { userProvided: true, method: 'GET' });
    const list = [...response.headers.entries()].map(([key, value]) => `• *${key}:* ${truncate(value, 150)}`);
    await ctx.reply(`📋 *CABECERAS (${response.status})*\n${response.url}\n\n${list.join('\n')}`);
  },
};

const domain = {
  name: 'domain',
  aliases: ['dominio'],
  category: 'internet',
  args: '<dominio>',
  description: 'Resumen de un dominio (DNS + disponibilidad web)',
  example: 'domain example.com',
  async execute(ctx) {
    const name = requireDomain(ctx.args[0], ctx, domain);
    let addresses = [];
    try {
      addresses = await dnsPromises.resolve4(name);
    } catch {
      addresses = [];
    }
    let web = 'no responde';
    try {
      const response = await request(`https://${name}`, { userProvided: true, method: 'GET', timeout: 10000 });
      web = `HTTP ${response.status}`;
    } catch {
      web = 'no responde por HTTPS';
    }
    await ctx.reply(
      [
        `🌍 *DOMINIO ${name}*`,
        '',
        `🧭 IPs ☇ ${addresses.join(', ') || '—'}`,
        `🌐 Web ☇ ${web}`,
        `📄 Más datos ☇ ${ctx.prefix}whois ${name}`,
      ].join('\n'),
    );
  },
};

const urlcheck = {
  name: 'urlcheck',
  aliases: ['checkurl'],
  category: 'internet',
  args: '<url>',
  description: 'Sigue las redirecciones de una URL y muestra el destino final',
  example: 'urlcheck https://bit.ly/ejemplo',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, urlcheck);
    const chain = [];
    let current = url;
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await assertSafeUrl(current);
      // eslint-disable-next-line no-await-in-loop
      const response = await request(current, { method: 'GET', redirect: 'manual', timeout: 12000 });
      chain.push(`${response.status} → ${current}`);
      const location = response.headers.get('location');
      if (!location || response.status < 300 || response.status >= 400) break;
      current = new URL(location, current).toString();
    }
    await ctx.reply(
      [
        '🔎 *ANÁLISIS DE URL*',
        '',
        ...chain.map((line, index) => `${index + 1}. ${truncate(line, 180)}`),
        '',
        `🏁 Destino final ☇ ${truncate(current, 200)}`,
        '',
        '_Nota: esto no es un análisis antivirus, solo seguimiento de redirecciones._',
      ].join('\n'),
    );
  },
};

const website = {
  name: 'website',
  aliases: ['web', 'preview'],
  category: 'internet',
  args: '<url>',
  description: 'Vista previa del contenido de una página',
  example: 'website https://example.com',
  async execute(ctx) {
    const url = requireUrl(ctx.args[0], ctx, website);
    const response = await request(url, { userProvided: true, headers: { accept: 'text/html' } });
    if (!response.ok) throw new ProviderError(`⚠️ El sitio respondió con HTTP ${response.status}.`);
    const html = (await response.text()).slice(0, 400_000);
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
    const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
    const text = stripTags(html);
    await ctx.reply(
      [
        `🌐 *${title || 'Sin título'}*`,
        description ? `\n📝 ${truncate(description, 300)}` : '',
        `\n🔗 ${response.url}`,
        `\n📄 *Extracto:*\n${truncate(text, 900)}`,
      ].join('\n'),
    );
  },
};

const pinghost = {
  name: 'pinghost',
  aliases: ['tcping'],
  category: 'internet',
  args: '<host> [puerto]',
  description: 'Comprueba si un host responde por TCP (por defecto 443)',
  example: 'pinghost github.com 443',
  async execute(ctx) {
    const host = requireDomain(ctx.args[0], ctx, pinghost);
    const port = Number(ctx.args[1] || 443);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new UserError('❌ Puerto no válido (1-65535).');
    const { address } = await dnsPromises.lookup(host).catch(() => ({ address: null }));
    if (!address) throw new UserError('❌ No se pudo resolver el host.');
    if (isPrivateIp(address)) throw new UserError('🛡️ Ese destino no está permitido.');

    const started = Date.now();
    const result = await new Promise((resolve) => {
      const socket = net.createConnection({ host: address, port, timeout: 8000 });
      socket.on('connect', () => {
        socket.destroy();
        resolve({ ok: true, ms: Date.now() - started });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ ok: false, reason: 'timeout' });
      });
      socket.on('error', (error) => {
        socket.destroy();
        resolve({ ok: false, reason: error.code || 'error' });
      });
    });

    await ctx.reply(
      result.ok
        ? `🛰️ *${host}:${port}* responde en *${result.ms} ms* (${address})`
        : `❌ *${host}:${port}* no responde (${result.reason})`,
    );
  },
};

export default [ip, dns, whois, http, headers, domain, urlcheck, website, pinghost];
