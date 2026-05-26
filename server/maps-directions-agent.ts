import type { WebSearchResult } from './web-search';

export const GOOGLE_MAPS_URL = 'https://www.google.com/maps';

type TravelMode = 'driving' | 'transit' | 'walking' | 'bicycling';

interface RouteIntent {
  origin: string | null;
  destination: string | null;
  mode: TravelMode;
}

interface MapsAnswer {
  query: string;
  reply: string;
  sources: WebSearchResult[];
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanPlace(value: string) {
  return String(value || '')
    .replace(/[?¿!¡]+/g, ' ')
    .replace(/\b(por favor|en google maps|google maps|maps|la ruta|ruta|como llego|como llegar|indicaciones|direcciones)\b/gi, ' ')
    .replace(/\b(?:en|por|para)\s+(?:transporte\s+publico|auto|carro|coche|caminando|a pie|bicicleta|bici)\b/gi, ' ')
    .replace(/\b(transporte\s+publico|metro|metrobus|auto|carro|coche|caminando|a pie|bicicleta|bici)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.\-\s]+|[,.\-\s]+$/g, '');
}

function detectMode(text: string): TravelMode {
  const body = normalizeText(text);
  if (/\b(transporte|publico|metro|metrobus|camion|pesero|combi|bus|autobus|ruta publica)\b/.test(body)) return 'transit';
  if (/\b(caminando|a pie|caminar)\b/.test(body)) return 'walking';
  if (/\b(bici|bicicleta)\b/.test(body)) return 'bicycling';
  return 'driving';
}

export function shouldUseMapsDirections(text: string) {
  const raw = String(text || '').trim();
  const body = normalizeText(raw);
  if (!body || body.length < 6) return false;
  if (/^https?:\/\/(www\.)?google\.com\/maps/i.test(raw)) return true;
  return /\b(google maps|maps|como llegar|como llego|ruta para llegar|ruta a|rutas a|indicaciones|direcciones|llegar a|ir a|ubicacion de|ubicacion para|donde esta)\b/.test(body)
    && /\b(colonia|zona|calle|avenida|av\.|municipio|alcaldia|estado|ciudad|cp|codigo postal|desde|hasta|a\s+[a-z])/i.test(raw);
}

function extractRouteIntent(text: string): RouteIntent {
  const raw = String(text || '').trim();
  const mode = detectMode(raw);
  const direct = raw.match(/\bdesde\s+(.+?)\s+(?:a|hasta|hacia)\s+(.+)$/i);
  if (direct) {
    return {
      origin: cleanPlace(direct[1]),
      destination: cleanPlace(direct[2]),
      mode,
    };
  }

  const destinationFirst = raw.match(/\b(?:como\s+llegar\s+a|como\s+llego\s+a|llegar\s+a|ir\s+a|ruta\s+a|rutas\s+a|indicaciones\s+a|direcciones\s+a|ubicacion\s+de|donde\s+esta)\s+(.+)$/i);
  let destination = cleanPlace(destinationFirst?.[1] || raw);
  let origin: string | null = null;

  const fromMatch = destination.match(/\bdesde\s+(.+)$/i);
  if (fromMatch) {
    origin = cleanPlace(fromMatch[1]);
    destination = cleanPlace(destination.slice(0, fromMatch.index));
  }

  if (!destination || /^(transporte|auto|carro|caminando|publico)$/i.test(destination)) destination = '';
  return { origin: origin || null, destination: destination || null, mode };
}

function modeLabel(mode: TravelMode) {
  if (mode === 'transit') return 'transporte publico';
  if (mode === 'walking') return 'caminando';
  if (mode === 'bicycling') return 'bicicleta';
  return 'auto';
}

function buildDirectionsUrl(intent: RouteIntent) {
  const params = new URLSearchParams({ api: '1', travelmode: intent.mode });
  if (intent.origin) params.set('origin', intent.origin);
  if (intent.destination) params.set('destination', intent.destination);
  return `${GOOGLE_MAPS_URL}/dir/?${params.toString()}`;
}

function buildSearchUrl(place: string) {
  const params = new URLSearchParams({ api: '1', query: place });
  return `${GOOGLE_MAPS_URL}/search/?${params.toString()}`;
}

function buildSources(url: string): WebSearchResult[] {
  return [{
    title: 'Google Maps',
    url,
    snippet: 'Ruta, ubicacion y navegacion generadas en Google Maps.',
    source: 'google.com/maps',
  }];
}

export async function answerMapsQuestion(text: string): Promise<MapsAnswer> {
  const query = String(text || '').trim().slice(0, 240) || 'Google Maps';
  const intent = extractRouteIntent(query);

  if (!intent.destination) {
    return {
      query,
      sources: buildSources(GOOGLE_MAPS_URL),
      reply: 'Claro. Para darte una ruta exacta necesito el destino y, si quieres precision, el punto de salida. Ejemplo: "como llegar desde Xochimilco a colonia Roma en transporte publico".',
    };
  }

  const directionsUrl = buildDirectionsUrl(intent);
  const searchUrl = buildSearchUrl(intent.destination);
  const sourceLine = `\n\nGoogle Maps: ${directionsUrl}`;

  if (!intent.origin) {
    return {
      query,
      sources: buildSources(directionsUrl),
      reply: `Para llegar a ${intent.destination}, abre la ruta en Google Maps y usa tu ubicacion actual como salida.\nModo sugerido: ${modeLabel(intent.mode)}.\n\nSi quieres que te lo deje mas exacto, dime desde donde sales.${sourceLine}`,
    };
  }

  return {
    query,
    sources: buildSources(directionsUrl),
    reply: `Ruta a ${intent.destination} desde ${intent.origin}.\nModo: ${modeLabel(intent.mode)}.\n\nAbre Google Maps para ver pasos exactos, trafico, transbordos y tiempo actualizado:${sourceLine}\n\nBusqueda del destino: ${searchUrl}`,
  };
}
