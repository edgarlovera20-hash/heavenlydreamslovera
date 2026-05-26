import { runAiWithFallback } from './enterprise';
import { answerMapsQuestion, shouldUseMapsDirections } from './maps-directions-agent';
import { answerTelmexQuestion, shouldUseTelmexInfo } from './telmex-info-agent';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface WebAnswer {
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

export function shouldUseWebSearch(text: string) {
  const body = normalizeText(text);
  if (!body || body.length < 6) return false;
  const raw = String(text || '').trim();
  if (shouldUseMapsDirections(text)) return true;
  if (shouldUseTelmexInfo(text)) return true;
  if (/^\[(sticker|imagen|documento|audio|video|contacto|ubicacion|mensaje recibido sin texto)/i.test(raw)) return false;
  if (/^[a-z0-9-]{5,}$/i.test(raw) && /\d/.test(raw)) return false;
  const isLocalFolio = /\b(folio|siac|estatus)\b/.test(body) && /\b[a-z0-9-]*\d[a-z0-9-]{4,}\b/i.test(text);
  const isLocalCapture = /\b(ine|curp|expediente|captura|venta|cliente|telefono|whatsapp|direccion|colonia|paquete)\b/.test(body)
    && !/\b(precio|costo|requisito|requisitos|oficial|actualizado|actualizada|internet|web|noticia|noticias)\b/.test(body);
  const isGreeting = /^(hola|holi|buenos dias|buen dia|buenas tardes|buenas noches|buenas|hi|hello|hey)(\s|[!.?])*$/i.test(body);
  const explicitWeb = /\b(web|internet|google|googlea|noticia|noticias|actualizado|actualizada|hoy|pagina oficial)\b/.test(body);
  const generalQuestion = /^(que|quien|quienes|cual|cuales|cuando|donde|como|cuanto|cuanta|cuantos|cuantas|por que)\b/.test(body)
    || /[?¿]/.test(raw)
    || /\b(explicame|dime|dame informacion|informacion de|resumen de|significa|definicion|definicion de|precio|costo|costos|requisitos|tramite|horario|direccion oficial|telefono oficial|sitio oficial|pagina oficial)\b/.test(body);
  if (isLocalFolio && !explicitWeb) return false;
  if (isGreeting || isLocalCapture) return false;
  return explicitWeb
    || /\b(busca|buscar|buscame|investiga|investigar|verifica|verificar|revisa en linea|consulta en linea)\b/.test(body)
    || generalQuestion
    || /^https?:\/\//i.test(raw);
}

export function extractWebQuery(text: string) {
  const cleaned = String(text || '')
    .replace(/^ariux[:,]?\s*/i, '')
    .replace(/\b(busca|buscar|buscame|investiga|investigar|googlea|verifica|verificar|revisa en linea|consulta en linea|en internet|en la web|por favor|dime|explicame|dame informacion|informacion de|resumen de)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || String(text || '').trim()).slice(0, 240);
}

function stripVisibleThinking(value: string) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .replace(/^\s*\/?no_think\s*/i, '')
    .trim();
}

function decodeHtml(value: string) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '));
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeDuckUrl(value: string) {
  const raw = decodeHtml(value || '');
  if (!raw) return '';
  const url = raw.startsWith('//') ? `https:${raw}` : raw;
  try {
    const parsed = new URL(url);
    const uddg = parsed.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : parsed.toString();
  } catch {
    return url;
  }
}

async function fetchText(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 HeavenlyDreamsARIUX/1.0',
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function collectRelatedTopics(topics: any[], limit: number, results: WebSearchResult[]) {
  for (const topic of topics || []) {
    if (results.length >= limit) return;
    if (Array.isArray(topic?.Topics)) {
      collectRelatedTopics(topic.Topics, limit, results);
      continue;
    }
    const text = String(topic?.Text || '').trim();
    const url = String(topic?.FirstURL || '').trim();
    if (!text || !url) continue;
    results.push({
      title: text.split(' - ')[0].slice(0, 120),
      url,
      snippet: text.slice(0, 260),
      source: hostFromUrl(url) || 'duckduckgo',
    });
  }
}

async function instantAnswerSearch(query: string, limit: number) {
  const results: WebSearchResult[] = [];
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const text = await fetchText(url, 6500);
  const data = JSON.parse(text || '{}');
  if (data?.AbstractText && data?.AbstractURL) {
    results.push({
      title: String(data.Heading || query).slice(0, 120),
      url: String(data.AbstractURL),
      snippet: String(data.AbstractText).slice(0, 320),
      source: hostFromUrl(String(data.AbstractURL)) || 'duckduckgo',
    });
  }
  if (data?.Answer) {
    results.push({
      title: String(data.AnswerType || 'Respuesta directa').slice(0, 120),
      url: String(data.AbstractURL || 'https://duckduckgo.com/'),
      snippet: String(data.Answer).slice(0, 320),
      source: hostFromUrl(String(data.AbstractURL || '')) || 'duckduckgo',
    });
  }
  collectRelatedTopics(data?.RelatedTopics || [], limit, results);
  return results.slice(0, limit);
}

async function htmlSearch(query: string, limit: number) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=mx-es`, 8000);
  const blocks = html.split(/<div class="result/i).slice(1);
  const results: WebSearchResult[] = [];
  for (const block of blocks) {
    if (results.length >= limit) break;
    const link = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = normalizeDuckUrl(link[1]);
    const title = stripTags(link[2]).slice(0, 140);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/div>)/i);
    const snippet = stripTags(snippetMatch?.[1] || '').slice(0, 320);
    if (!url || !title || /duckduckgo\.com\/y\.js/i.test(url)) continue;
    results.push({ title, url, snippet, source: hostFromUrl(url) || 'web' });
  }
  return results;
}

function dedupeResults(results: WebSearchResult[], limit: number) {
  const seen = new Set<string>();
  const clean: WebSearchResult[] = [];
  for (const item of results) {
    const key = item.url.replace(/[#?].*$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(item);
    if (clean.length >= limit) break;
  }
  return clean;
}

export async function webSearch(query: string, limit = 5) {
  const results: WebSearchResult[] = [];
  try {
    results.push(...await instantAnswerSearch(query, limit));
  } catch {}
  if (results.length < Math.min(3, limit)) {
    try {
      results.push(...await htmlSearch(query, limit));
    } catch {}
  }
  return dedupeResults(results, limit);
}

function withSources(reply: string, sources: WebSearchResult[]) {
  const cleanReply = stripVisibleThinking(reply).slice(0, 1100).trim();
  const topSources = sources.slice(0, 3);
  const sourceText = topSources.map((item, index) => `${index + 1}. ${item.title} - ${item.url}`).join('\n');
  if (!sourceText) return cleanReply;
  if (/fuentes?:/i.test(cleanReply) && /https?:\/\//i.test(cleanReply)) return cleanReply;
  return `${cleanReply}\n\nFuentes:\n${sourceText}`.slice(0, 1500);
}

export async function answerWebQuestion(text: string, context: { promoterName?: string | null } = {}): Promise<WebAnswer> {
  if (shouldUseMapsDirections(text)) {
    return answerMapsQuestion(text);
  }

  if (shouldUseTelmexInfo(text)) {
    return answerTelmexQuestion(text);
  }

  const query = extractWebQuery(text);
  const sources = await webSearch(query, 5);
  if (!sources.length) {
    return {
      query,
      sources,
      reply: `No encontre resultados web confiables para "${query}" en este momento. Dame una palabra clave mas concreta o una pagina oficial y lo vuelvo a revisar.`,
    };
  }

  const sourceBlock = sources.map((item, index) => (
    `[${index + 1}] ${item.title}\nFuente: ${item.source}\nURL: ${item.url}\nResumen disponible: ${item.snippet || 'Sin snippet'}`
  )).join('\n\n');

  const prompt = `/no_think
Eres ARIUX, asistente de Heavenly Dreams. Responde en espanol con informacion verificada desde fuentes web.
Puedes investigar cualquier tema: telecomunicaciones, tramites, tecnologia, noticias, cultura general, empresas, precios, requisitos, ubicaciones o datos actuales.
Usa SOLO las fuentes listadas. Si la fuente no confirma algo, dilo. No inventes precios, fechas ni datos.
Haz una respuesta breve, clara y accionable. Incluye "Fuentes:" con 2 o 3 enlaces.
${context.promoterName ? `Promotor: ${context.promoterName}` : ''}

Pregunta:
${text}

Busqueda:
${query}

Fuentes encontradas:
${sourceBlock}`;

  try {
    const ai = await runAiWithFallback(prompt);
    return { query, sources, reply: withSources(ai.output, sources) };
  } catch {
    const summary = sources.slice(0, 3).map((item, index) => (
      `${index + 1}. ${item.title}: ${item.snippet || item.source}`
    )).join('\n');
    return {
      query,
      sources,
      reply: withSources(`Esto encontre para "${query}":\n${summary}`, sources),
    };
  }
}
