import type { WebSearchResult } from './web-search';

export const TELMEX_HOME_URL = 'https://telmex.com/web/hogar?srsltid=AfmBOordxVX_FjPBRyCvjGuPf0M0uFyMjJ5PN0vbgO_y99CCSHPwrWR9';
export const TELMEX_BUSINESS_URL = 'https://telmex.com/web/negocios';
export const TELMEX_BUSINESS_PACKAGES_URL = 'https://telmex.com/web/negocios/mkt/paquetes-infinitum-negocio';
export const TELMEX_COVERAGE_URL = 'https://telmex.com/web/acerca-de-telmex/mapas-de-cobertura';
export const TELMEX_COVERAGE_SHORT_URL = 'https://telmex.com/mapasdecobertura';

export type TelmexPackageCategory = 'telefonia_internet' | 'solo_internet';
export type TelmexSegment = 'hogar' | 'negocio';

export interface TelmexPackage {
  id: string;
  segment?: TelmexSegment;
  category: TelmexPackageCategory;
  name: string;
  speedMbps: number;
  price: number;
  includes: string[];
  source: string;
}

export interface TelmexInfo {
  url: string;
  fetchedAt: string;
  live: boolean;
  packages: TelmexPackage[];
  promos: string[];
  notes: string[];
  contact: string[];
  rawText?: string;
}

interface TelmexAnswer {
  query: string;
  reply: string;
  sources: WebSearchResult[];
  info: TelmexInfo;
}

const SOURCE_TITLE = 'Telmex Hogar - Paquetes Infinitum';
const CACHE_TTL_MS = 15 * 60 * 1000;

const FALLBACK_PACKAGES: TelmexPackage[] = [
  { id: 'ti-120', category: 'telefonia_internet', name: 'Telefonia + Internet 120 Megas', speedMbps: 120, price: 389, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-150', category: 'telefonia_internet', name: 'Telefonia + Internet 150 Megas', speedMbps: 150, price: 435, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-250', category: 'telefonia_internet', name: 'Telefonia + Internet 250 Megas', speedMbps: 250, price: 499, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-350', category: 'telefonia_internet', name: 'Telefonia + Internet 350 Megas', speedMbps: 350, price: 599, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-500', category: 'telefonia_internet', name: 'Telefonia + Internet 500 Megas', speedMbps: 500, price: 649, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-600', category: 'telefonia_internet', name: 'Telefonia + Internet 600 Megas', speedMbps: 600, price: 725, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-850', category: 'telefonia_internet', name: 'Telefonia + Internet 850 Megas', speedMbps: 850, price: 999, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'ti-1000', category: 'telefonia_internet', name: 'Telefonia + Internet 1000 Megas', speedMbps: 1000, price: 1399, includes: ['Telefonia', 'Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-120', category: 'solo_internet', name: 'Solo Internet 120 Megas', speedMbps: 120, price: 349, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-150', category: 'solo_internet', name: 'Solo Internet 150 Megas', speedMbps: 150, price: 399, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-250', category: 'solo_internet', name: 'Solo Internet 250 Megas', speedMbps: 250, price: 449, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-350', category: 'solo_internet', name: 'Solo Internet 350 Megas', speedMbps: 350, price: 499, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-500', category: 'solo_internet', name: 'Solo Internet 500 Megas', speedMbps: 500, price: 549, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-600', category: 'solo_internet', name: 'Solo Internet 600 Megas', speedMbps: 600, price: 649, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
  { id: 'si-850', category: 'solo_internet', name: 'Solo Internet 850 Megas', speedMbps: 850, price: 899, includes: ['Internet Infinitum'], source: TELMEX_HOME_URL },
];

const FALLBACK_BUSINESS_PACKAGES: TelmexPackage[] = [
  { id: 'neg-ti-120', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 120 Megas', speedMbps: 120, price: 399, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-250', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 250 Megas', speedMbps: 250, price: 549, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-350', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 350 Megas', speedMbps: 350, price: 649, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-500', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 500 Megas', speedMbps: 500, price: 799, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-600', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 600 Megas', speedMbps: 600, price: 999, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-850', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 850 Megas', speedMbps: 850, price: 1499, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-ti-1000', segment: 'negocio', category: 'telefonia_internet', name: 'Negocio Telefonia + Internet 1000 Megas', speedMbps: 1000, price: 2289, includes: ['Telefonia comercial', 'Internet Infinitum Negocio', 'Soluciones PyME'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-120', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 120 Megas', speedMbps: 120, price: 349, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-150', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 150 Megas', speedMbps: 150, price: 399, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-250', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 250 Megas', speedMbps: 250, price: 449, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-350', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 350 Megas', speedMbps: 350, price: 499, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-500', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 500 Megas', speedMbps: 500, price: 549, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-600', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 600 Megas', speedMbps: 600, price: 649, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
  { id: 'neg-si-850', segment: 'negocio', category: 'solo_internet', name: 'Negocio Solo Internet 850 Megas', speedMbps: 850, price: 899, includes: ['Internet Infinitum Negocio'], source: TELMEX_BUSINESS_URL },
];

const BUSINESS_BENEFITS = [
  'Misma velocidad de subida y bajada en paquetes compatibles; en 500 Megas o mas la subida puede tener limite tecnico segun condiciones.',
  'Soluciones PyME: Seguridad Internet, Correo Negocio, Factura electronica ADM y Claro Drive.',
  'Desde paquetes compatibles se agregan respaldo de informacion y pagina web.',
  'Portabilidad negocio: promociones de meses sin costo y gastos de instalacion pueden aplicar segun vigencia y condiciones.',
  'Contacto Telmex Negocio: 800 123 0321.',
];

const COVERAGE_NOTES = [
  'El mapa oficial muestra Telefonia fija (Voz) y Acceso a internet (Infinitum).',
  'La cobertura mostrada esta sujeta a factibilidad tecnica del domicilio exacto.',
  'Solo puede visualizarse una capa a la vez; al cambiar de capa se desactiva la anterior.',
  'Acepta coordenadas en grados, minutos y segundos (DMS) o grados decimales (DD).',
  'Para fibra optica, confirma el domicilio exacto en el mapa y valida disponibilidad antes de prometer instalacion.',
];

const FALLBACK_INFO: TelmexInfo = {
  url: TELMEX_HOME_URL,
  fetchedAt: '2026-05-26T00:00:00.000Z',
  live: false,
  packages: [...FALLBACK_PACKAGES, ...FALLBACK_BUSINESS_PACKAGES],
  promos: [
    'Al contratar, domiciliate y elige 2 de 3 servicios: Netflix, HBO Max o F1 TV por 6 meses.',
    'Universal+ incluido en paquetes compatibles.',
    'Si te cambias a Telmex no pagas instalacion.',
  ],
  notes: [
    'Todos los precios incluyen impuestos.',
    'Las velocidades son maximas y la disponibilidad depende de cobertura y condiciones Telmex.',
    'Cuando el portal oficial protege la pagina con captcha, ARIUX usa este snapshot oficial guardado y recomienda confirmar antes de cerrar venta.',
  ],
  contact: [
    'Para contratar llama al 800 123 1012.',
    'Fuente oficial: telmex.com/web/hogar.',
  ],
};

let cache: { at: number; info: TelmexInfo } | null = null;

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function decodeHtml(value: string) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function packageCategoryLabel(category: TelmexPackageCategory) {
  return category === 'solo_internet' ? 'Solo Internet' : 'Telefonia + Internet';
}

function sourceSnippet(info: TelmexInfo) {
  const live = info.live ? 'consulta en vivo' : 'snapshot oficial';
  return `Paquetes Infinitum Telmex Hogar y Negocio, cobertura, precios, promociones y contacto (${live}).`;
}

async function fetchTelmexHomeHtml(timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TELMEX_HOME_URL, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 HeavenlyDreamsARIUX/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'es-MX,es;q=0.9,en;q=0.6',
        referer: 'https://telmex.com/',
      },
    });
    if (!res.ok) throw new Error(`Telmex HTTP ${res.status}`);
    const html = await res.text();
    if (/shieldsquare|captcha|sec-container/i.test(html) || !/Paquetes\s+Infinitum|tarjeta_paq_c|Solo\s+Internet/i.test(html)) {
      throw new Error('Telmex protegió la pagina con captcha o no entrego contenido de paquetes.');
    }
    return html;
  } finally {
    clearTimeout(timer);
  }
}

function parsePackagesFromHtml(html: string): TelmexPackage[] {
  const soloMarker = html.search(/container_tarjetas_c\s+items\s+naked|Solo\s+Internet/i);
  const cards: TelmexPackage[] = [];
  const cardRe = /<div\s+id="([^"]+)"[^>]*aria-label="Contrata\s+([^"]+)"[^>]*class="[^"]*tarjeta_paq_c[^"]*"[^>]*>([\s\S]*?)(?=<div\s+id="[^"]+"[^>]*aria-label="Contrata|<div\s+class="legal_paq_c|<section|<\/body>|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = cardRe.exec(html))) {
    const id = decodeHtml(match[1] || '').trim();
    const aria = decodeHtml(match[2] || '');
    const block = match[3] || '';
    const speed = Number((block.match(/<h3[^>]*>\s*(\d{2,4})\s*<span[^>]*>\s*Megas/i) || aria.match(/(\d{2,4})\s*Megas/i) || [])[1]);
    const priceText = (aria.match(/\$\s*([\d,]+)/) || block.match(/\$\s*<\/span>\s*<span[^>]*class="numeros_c"[^>]*>\s*([\d,]+)/i) || [])[1];
    const price = Number(String(priceText || '').replace(/[^\d]/g, ''));
    if (!speed || !price) continue;
    const category: TelmexPackageCategory = soloMarker >= 0 && match.index >= soloMarker ? 'solo_internet' : 'telefonia_internet';
    cards.push({
      id: id || `${category}-${speed}-${price}`,
      segment: 'hogar',
      category,
      name: `${packageCategoryLabel(category)} ${speed} Megas`,
      speedMbps: speed,
      price,
      includes: category === 'solo_internet' ? ['Internet Infinitum'] : ['Telefonia', 'Internet Infinitum'],
      source: TELMEX_HOME_URL,
    });
  }

  const seen = new Set<string>();
  return cards
    .filter(item => {
      const key = `${item.category}:${item.speedMbps}:${item.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.speedMbps - b.speedMbps);
}

function parseTelmexInfo(html: string): TelmexInfo {
  const text = stripTags(html).slice(0, 4000);
  const parsedPackages = parsePackagesFromHtml(html);
  return {
    ...FALLBACK_INFO,
    fetchedAt: new Date().toISOString(),
    live: parsedPackages.length >= 5,
    packages: parsedPackages.length >= 5 ? [...parsedPackages, ...FALLBACK_BUSINESS_PACKAGES] : FALLBACK_INFO.packages,
    rawText: text,
  };
}

export function shouldUseTelmexInfo(text: string) {
  const raw = String(text || '').trim();
  const body = normalizeText(raw);
  if (!body) return false;
  if (/^https?:\/\/(www\.)?telmex\.com\/(web\/hogar|web\/negocios|web\/acerca-de-telmex\/mapas-de-cobertura|mapasdecobertura)/i.test(raw)) return true;
  const mentionsTelmex = /\b(telmex|infinitum|paquetes?\s+telmex|internet\s+telmex|hogar\s+telmex|telmex\s+negocio|negocio\s+telmex|pyme|pymes|mapas?\s+de\s+cobertura|cobertura\s+telmex|fibra\s+optica)\b/.test(body);
  if (!mentionsTelmex) return false;
  return /\b(precio|precios|costo|costos|paquete|paquetes|megas|promocion|promociones|beneficio|beneficios|soluciones|cobertura|contratar|contratacion|telefono|telefonia|solo internet|fibra|hogar|negocio|pyme|pymes|linea|llamadas|info|informacion|consulta|consultar|busca|buscar|mapa|zona|zonas)\b/.test(body);
}

export async function getTelmexHomeInfo(force = false): Promise<TelmexInfo> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.info;
  try {
    const html = await fetchTelmexHomeHtml();
    const info = parseTelmexInfo(html);
    cache = { at: Date.now(), info };
    return info;
  } catch {
    const info = { ...FALLBACK_INFO, fetchedAt: new Date().toISOString() };
    cache = { at: Date.now(), info };
    return info;
  }
}

function extractRequestedSpeed(text: string) {
  const match = normalizeText(text).match(/\b(\d{2,4})\s*(?:mega|megas|mb|mbps)\b/);
  return match ? Number(match[1]) : null;
}

function requestedCategory(text: string): TelmexPackageCategory | null {
  const body = normalizeText(text);
  if (/\b(solo\s+internet|puro\s+internet|sin\s+telefono|sin\s+linea)\b/.test(body)) return 'solo_internet';
  if (/\b(telefonia|telefono|linea|llamadas|doble\s+play)\b/.test(body)) return 'telefonia_internet';
  return null;
}

function requestedSegment(text: string): TelmexSegment {
  const body = normalizeText(text);
  if (/\b(negocio|negocios|pyme|pymes|comercial|empresa|local|oficina)\b/.test(body)) return 'negocio';
  return 'hogar';
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString('es-MX')}`;
}

function formatPackages(packages: TelmexPackage[]) {
  return packages.map(item => `- ${item.name}: ${money(item.price)}/mes`).join('\n');
}

function buildSources(info: TelmexInfo, mode: 'hogar' | 'negocio' | 'cobertura' = 'hogar'): WebSearchResult[] {
  if (mode === 'cobertura') {
    return [
      {
        title: 'Mapas de cobertura Telmex',
        url: TELMEX_COVERAGE_URL,
        snippet: 'Mapa oficial para consultar Telefonia fija e Internet Infinitum, sujeto a factibilidad tecnica.',
        source: 'telmex.com',
      },
      {
        title: 'Google Maps',
        url: 'https://www.google.com/maps',
        snippet: 'Apoyo para ubicar colonias, rutas y puntos de referencia.',
        source: 'google.com/maps',
      },
    ];
  }
  if (mode === 'negocio') {
    return [
      {
        title: 'Telmex Negocio - Paquetes Infinitum Negocio',
        url: TELMEX_BUSINESS_URL,
        snippet: sourceSnippet(info),
        source: 'telmex.com',
      },
      {
        title: 'Paquetes Infinitum Negocio',
        url: TELMEX_BUSINESS_PACKAGES_URL,
        snippet: 'Soluciones PyME, paquetes, beneficios y condiciones para negocio.',
        source: 'telmex.com',
      },
    ];
  }
  return [
    {
      title: SOURCE_TITLE,
      url: TELMEX_HOME_URL,
      snippet: sourceSnippet(info),
      source: 'telmex.com',
    },
  ];
}

export async function answerTelmexQuestion(text: string): Promise<TelmexAnswer> {
  const query = String(text || '').trim().slice(0, 240) || 'Telmex Hogar';
  const info = await getTelmexHomeInfo();
  const body = normalizeText(query);
  const speed = extractRequestedSpeed(query);
  const category = requestedCategory(query);
  const segment = requestedSegment(query);
  let packages = info.packages.filter(item => (item.segment || 'hogar') === segment);
  if (category) packages = packages.filter(item => item.category === category);
  if (speed) {
    const exact = packages.filter(item => item.speedMbps === speed);
    packages = exact.length ? exact : packages.filter(item => Math.abs(item.speedMbps - speed) <= 50);
  }
  packages = packages.slice(0, speed ? 4 : 10);

  const usingFallback = !info.live
    ? '\n\nNota: el portal Telmex puede proteger la pagina con captcha; uso snapshot oficial guardado y conviene confirmar antes de cerrar venta.'
    : '';
  const sourceUrl = segment === 'negocio' ? TELMEX_BUSINESS_URL : TELMEX_HOME_URL;
  const sourceLine = `\n\nFuente: ${sourceUrl}`;

  if (/\b(cobertura|fibra|fibra\s+optica|mapa|mapas|zona|zonas|factibilidad|domicilio)\b/.test(body)) {
    const place = query
      .replace(/.*?\b(?:en|para|de|zona|colonia)\s+/i, '')
      .replace(/\b(telmex|cobertura|fibra|optica|infinitum|mapa|mapas|zona|zonas|negocio|hogar)\b/gi, ' ')
      .replace(/^\s*\b(en|para|de)\b\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const placeLine = place && place.length >= 4
      ? `\nZona mencionada: ${place}. Abre el mapa y busca el domicilio exacto o coordenadas.`
      : '\nSi me das colonia, alcaldia/municipio o domicilio, puedo dejarte el enlace de ubicacion mas directo.';
    return {
      query,
      info,
      sources: buildSources(info, 'cobertura'),
      reply: `Cobertura Telmex / fibra optica:${placeLine}\n${COVERAGE_NOTES.map(item => `- ${item}`).join('\n')}\n\nMapa oficial: ${TELMEX_COVERAGE_URL}\nAcceso corto: ${TELMEX_COVERAGE_SHORT_URL}`,
    };
  }

  if (segment === 'negocio' && /\b(beneficio|beneficios|solucion|soluciones|pyme|pymes|negocio|herramienta|herramientas)\b/.test(body)) {
    return {
      query,
      info,
      sources: buildSources(info, 'negocio'),
      reply: `Telmex Negocio - beneficios principales:\n${BUSINESS_BENEFITS.map(item => `- ${item}`).join('\n')}\n\nPaquetes destacados:\n${formatPackages(packages.slice(0, 6))}\n\nTodos los precios y beneficios pueden cambiar por vigencia o factibilidad tecnica.${usingFallback}${sourceLine}`,
    };
  }

  if (/\b(promocion|promociones|promo|domicilia|netflix|hbo|max|f1|universal)\b/.test(body)) {
    const promoIntro = segment === 'negocio'
      ? 'Promociones Telmex Negocio:'
      : 'Promociones Telmex Hogar:';
    const promos = segment === 'negocio'
      ? [
          'Netflix/HBO Max pueden ir por cuenta de Telmex por 6 meses en paquetes participantes.',
          'Portabilidad negocio puede ofrecer meses de servicio sin costo y gastos de instalacion sin costo segun vigencia.',
          ...BUSINESS_BENEFITS.slice(1, 3),
        ]
      : info.promos;
    return {
      query,
      info,
      sources: buildSources(info, segment),
      reply: `${promoIntro}\n${promos.map(item => `- ${item}`).join('\n')}\n\nNotas:\n${info.notes.slice(0, 2).map(item => `- ${item}`).join('\n')}${usingFallback}${sourceLine}`,
    };
  }

  if (/\b(contratar|contratacion|telefono|llamar|contacto|cobertura|instalar|instalacion)\b/.test(body)) {
    const contact = segment === 'negocio'
      ? ['Telmex Negocio / Soluciones PyME: 800 123 0321.', `Mapa de cobertura: ${TELMEX_COVERAGE_URL}`]
      : info.contact;
    return {
      query,
      info,
      sources: buildSources(info, segment),
      reply: `Para contratar o validar cobertura Telmex ${segment === 'negocio' ? 'Negocio' : 'Hogar'}:\n${contact.map(item => `- ${item}`).join('\n')}\n\nPaquetes principales:\n${formatPackages(packages.slice(0, 6))}\n\n${info.notes[1]}${usingFallback}${sourceLine}`,
    };
  }

  const packageBlock = packages.length
    ? formatPackages(packages)
    : 'No encontre un paquete exacto con esos filtros. Prueba con "Telmex 500 megas" o "solo internet Telmex".';

  return {
    query,
    info,
    sources: buildSources(info, segment),
    reply: `Telmex ${segment === 'negocio' ? 'Negocio - Paquetes Infinitum Negocio' : 'Hogar - Paquetes Infinitum'}:\n${packageBlock}\n\n${info.notes[0]}\n${info.notes[1]}${segment === 'negocio' ? `\nBeneficios: ${BUSINESS_BENEFITS.slice(1, 4).join(' ')}` : ''}${usingFallback}${sourceLine}`,
  };
}
