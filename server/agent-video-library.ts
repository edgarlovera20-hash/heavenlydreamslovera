import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type AgentVideoAudience = 'promotores' | 'clientes' | 'todos';

export interface AgentVideoItem {
  id: string;
  title: string;
  topic: string;
  keywords: string[];
  audience: AgentVideoAudience;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  createdAt: string;
}

const VIDEO_DIR = path.resolve(process.cwd(), 'data', 'agent-videos');
const INDEX_PATH = path.join(VIDEO_DIR, 'videos.json');
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
  'video/mpeg': '.mpeg',
};

function ensureVideoDir() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) fs.writeFileSync(INDEX_PATH, '[]', 'utf8');
}

function normalizeText(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseKeywords(value: any) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/);
  return raw.map(item => normalizeText(item)).filter(Boolean);
}

function publicUrlFor(fileName: string) {
  return `/agent-videos/${encodeURIComponent(fileName)}`;
}

export function agentVideoDirectory() {
  ensureVideoDir();
  return VIDEO_DIR;
}

export function listAgentVideos(): AgentVideoItem[] {
  ensureVideoDir();
  try {
    const rows = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeIndex(rows: AgentVideoItem[]) {
  ensureVideoDir();
  await fsp.writeFile(INDEX_PATH, JSON.stringify(rows, null, 2), 'utf8');
}

export async function uploadAgentVideo(input: {
  title: string;
  topic: string;
  keywords?: string[] | string;
  audience?: AgentVideoAudience;
  fileName?: string;
  mimeType: string;
  base64: string;
}) {
  ensureVideoDir();
  const mimeType = String(input.mimeType || '').toLowerCase();
  const ext = VIDEO_EXT[mimeType];
  if (!ext) throw new Error('Formato de video no permitido. Usa mp4, webm, mov, avi, mkv, 3gp o mpeg.');
  const base64 = String(input.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new Error('Video vacio o invalido.');
  const id = randomUUID();
  const safeBase = normalizeText(input.fileName || input.title || input.topic || 'video').replace(/\s+/g, '-').slice(0, 60) || 'video';
  const fileName = `${id}-${safeBase}${ext}`;
  const storagePath = path.join(VIDEO_DIR, fileName);
  await fsp.writeFile(storagePath, buffer);
  const item: AgentVideoItem = {
    id,
    title: String(input.title || input.topic || 'Video de apoyo').trim(),
    topic: String(input.topic || input.title || 'General').trim(),
    keywords: parseKeywords(input.keywords),
    audience: input.audience === 'clientes' || input.audience === 'promotores' ? input.audience : 'todos',
    fileName,
    mimeType,
    sizeBytes: buffer.length,
    storagePath,
    url: publicUrlFor(fileName),
    createdAt: new Date().toISOString(),
  };
  await writeIndex([item, ...listAgentVideos()]);
  return item;
}

export async function deleteAgentVideo(id: string) {
  const rows = listAgentVideos();
  const item = rows.find(video => video.id === id);
  if (!item) return false;
  await fsp.unlink(item.storagePath).catch(() => {});
  await writeIndex(rows.filter(video => video.id !== id));
  return true;
}

export function findAgentVideoForQuestion(question: string, audience: AgentVideoAudience = 'todos') {
  const normalized = normalizeText(question);
  if (!normalized) return null;
  let best: { item: AgentVideoItem; score: number } | null = null;
  for (const item of listAgentVideos()) {
    if (item.audience !== 'todos' && audience !== 'todos' && item.audience !== audience) continue;
    const terms = [
      normalizeText(item.title),
      normalizeText(item.topic),
      ...parseKeywords(item.keywords),
    ].filter(Boolean);
    const score = terms.reduce((sum, term) => {
      if (!term) return sum;
      if (normalized.includes(term)) return sum + Math.max(3, term.split(' ').length * 2);
      return sum + term.split(' ').filter(word => word.length > 2 && normalized.includes(word)).length;
    }, 0);
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item || null;
}
