declare global {
  interface Window {
    google?: any;
  }
}

type SaleLike = Record<string, any>;

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
};

export type DriveExportResult = {
  rootFolderId: string;
  rootFolderUrl?: string;
  salesExported: number;
  filesUploaded: number;
};

export type DriveImportResult = {
  sales: SaleLike[];
  importedAt?: string;
  sourceFolderId: string;
};

const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const ROOT_MANIFEST = 'heavenly-dreams-expedientes.json';
const SALE_MANIFEST = 'manifest.json';
const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';

const DOC_LABELS: Record<string, string> = {
  ineFrente: 'INE Frente',
  ineReverso: 'INE Reverso',
  curpDoc: 'CURP',
  comprobanteDomicilio: 'Comprobante Domicilio',
  gpsEvidence: 'GPS Ubicacion',
  anexoPortabilidad: 'Anexo Portabilidad 1',
  anexoPortabilidad2: 'Anexo Portabilidad 2',
  contratoFirmado: 'Solicitud Firmada',
  solicitudFirmada: 'Solicitud Firmada Adicional',
  videofirma: 'Videofirma',
  audioLlamada: 'Audio Llamada',
  capturaSiac: 'Captura SIAC',
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
};

function driveClientId() {
  return (import.meta as any).env?.VITE_GOOGLE_DRIVE_CLIENT_ID || '';
}

function configuredRootFolderId() {
  return (import.meta as any).env?.VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID || '';
}

function requireClientId() {
  const clientId = driveClientId();
  if (!clientId) {
    throw new Error('Falta configurar VITE_GOOGLE_DRIVE_CLIENT_ID en el .env para activar Google Drive.');
  }
  return clientId;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });
}

async function requestAccessToken() {
  const clientId = requireClientId();
  await loadScript(GIS_URL);
  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: any) => {
        if (response?.error) reject(new Error(response.error_description || response.error));
        else if (response?.access_token) resolve(response.access_token);
        else reject(new Error('Google Drive no devolvió token de acceso.'));
      },
      error_callback: (error: any) => reject(new Error(error?.message || 'No se pudo iniciar sesión con Google Drive.')),
    });
    if (!tokenClient) {
      reject(new Error('Google Identity Services no está disponible en este navegador.'));
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function parseDriveFolderId(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const folderMatch = clean.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{12,}$/.test(clean)) return clean;
  return '';
}

export function parseDriveFileId(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const fileMatch = clean.match(/\/(?:file|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{12,}$/.test(clean)) return clean;
  return '';
}

export function isGoogleDriveConfigured() {
  return Boolean(driveClientId());
}

function sanitizeName(value: unknown, fallback = 'sin-nombre') {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|#{}%~&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function dayFolder(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

function monthFolder(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fullName(sale: SaleLike) {
  return [sale.nombres, sale.apellidoPaterno, sale.apellidoMaterno].filter(Boolean).join(' ').trim() || 'Cliente sin nombre';
}

function saleFolderName(sale: SaleLike) {
  const folio = sale.folioSiac || sale.folio || sale.id || 'sin-folio';
  return sanitizeName(`${folio} - ${fullName(sale)}`);
}

async function driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Google Drive error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function createDriveFolder(token: string, name: string, parentId?: string): Promise<DriveFile> {
  return driveFetch<DriveFile>(token, `${DRIVE_API}/files?fields=id,name,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
}

async function uploadMultipart(token: string, metadata: Record<string, any>, blob: Blob): Promise<DriveFile> {
  const boundary = `hdreams_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function uploadJson(token: string, parentId: string, name: string, payload: unknown) {
  return uploadMultipart(token, {
    name,
    parents: [parentId],
    mimeType: 'application/json',
  }, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

async function uploadDocument(token: string, saleFolderId: string, sale: SaleLike, docKey: string) {
  const res = await fetch(`/api/document-files?capture_id=${encodeURIComponent(sale.id || '')}`);
  if (!res.ok) return false;
  const files = await res.json();
  const found = (Array.isArray(files) ? files : []).find((file: any) => {
    const type = String(file.tipo_documento || file.docType || '').toUpperCase();
    return type.includes(docKey.toUpperCase()) || type === docKey.toUpperCase();
  });
  const downloadUrl = found?.downloadUrl || found?.archivo_url || (found?.id ? `/api/document-files/${found.id}/download` : '');
  if (!downloadUrl) return false;
  const blob = await fetch(downloadUrl).then((response) => response.blob());
  const ext = MIME_EXT[blob.type] || 'bin';
  await uploadMultipart(token, {
    name: `${sanitizeName(DOC_LABELS[docKey] || docKey)}.${ext}`,
    parents: [saleFolderId],
    mimeType: blob.type || 'application/octet-stream',
  }, blob);
  return true;
}

async function listDriveChildren(token: string, folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    pageSize: '1000',
  });
  const data = await driveFetch<{ files: DriveFile[] }>(token, `${DRIVE_API}/files?${params}`);
  return data.files || [];
}

async function getDriveFile(token: string, fileId: string) {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink,modifiedTime',
  });
  return driveFetch<DriveFile>(token, `${DRIVE_API}/files/${fileId}?${params}`);
}

async function downloadText(token: string, fileId: string) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isSiacSourceFile(file: DriveFile) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.csv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xlsm') ||
    file.mimeType === SHEETS_MIME
  );
}

function scoreSiacSource(file: DriveFile) {
  const name = file.name.toLowerCase();
  let score = 0;
  if (name.includes('siac')) score += 10;
  if (name.includes('ppies')) score += 6;
  if (name.endsWith('.csv')) score += 4;
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) score += 3;
  if (file.mimeType === SHEETS_MIME) score += 2;
  return score;
}

function chooseSiacSourceFile(files: DriveFile[]) {
  return files
    .filter(isSiacSourceFile)
    .sort((a, b) => {
      const scoreDiff = scoreSiacSource(b) - scoreSiacSource(a);
      if (scoreDiff) return scoreDiff;
      return String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || ''));
    })[0] || null;
}

async function downloadDriveBinary(token: string, file: DriveFile) {
  const url = file.mimeType === SHEETS_MIME
    ? `${DRIVE_API}/files/${file.id}/export?mimeType=${encodeURIComponent('text/csv')}`
    : `${DRIVE_API}/files/${file.id}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const fileName = file.mimeType === SHEETS_MIME && !/\.csv$/i.test(file.name)
    ? `${file.name}.csv`
    : file.name;
  return {
    fileName,
    contentBase64: bufferToBase64(await res.arrayBuffer()),
    fileId: file.id,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
  };
}

export async function downloadSiacSourceFromDrive(input: string) {
  const isFolderLink = /\/folders\//.test(input);
  const folderId = isFolderLink ? parseDriveFolderId(input) : '';
  const fileId = folderId ? '' : parseDriveFileId(input);
  if (!folderId && !fileId) {
    throw new Error('Pega el enlace o ID del archivo SIAC, Google Sheet o carpeta de Drive.');
  }

  const token = await requestAccessToken();
  const file = folderId
    ? chooseSiacSourceFile(await listDriveChildren(token, folderId))
    : await getDriveFile(token, fileId);

  if (file?.mimeType === DRIVE_FOLDER_MIME) {
    const child = chooseSiacSourceFile(await listDriveChildren(token, file.id));
    if (!child) throw new Error('No encontré un CSV, XLSX o Google Sheet SIAC dentro de esa carpeta.');
    return downloadDriveBinary(token, child);
  }

  if (!file) {
    throw new Error('No encontré un CSV, XLSX o Google Sheet SIAC dentro de esa carpeta.');
  }
  if (!isSiacSourceFile(file)) {
    throw new Error(`El archivo "${file.name}" no parece ser CSV, Excel o Google Sheet.`);
  }
  return downloadDriveBinary(token, file);
}

export async function exportExpedientesToDrive(sales: SaleLike[], folderInput = ''): Promise<DriveExportResult> {
  const token = await requestAccessToken();
  const parentFolderId = parseDriveFolderId(folderInput) || configuredRootFolderId() || undefined;
  const root = parentFolderId
    ? { id: parentFolderId, webViewLink: `https://drive.google.com/drive/folders/${parentFolderId}` }
    : await createDriveFolder(token, `Heavenly Dreams Expedientes ${new Date().toISOString().slice(0, 10)}`);

  await uploadJson(token, root.id, ROOT_MANIFEST, {
    app: 'Heavenly Dreams CRM',
    type: 'expedientes',
    exportedAt: new Date().toISOString(),
    count: sales.length,
    sales,
  });

  const yearCache = new Map<string, string>();
  const monthCache = new Map<string, string>();
  const dayCache = new Map<string, string>();
  let filesUploaded = 1;

  for (const sale of sales) {
    const date = parseDate(sale.fechaSolicitud);
    const year = String(date.getFullYear());
    if (!yearCache.has(year)) {
      yearCache.set(year, (await createDriveFolder(token, year, root.id)).id);
    }

    const monthKey = `${year}/${monthFolder(date)}`;
    if (!monthCache.has(monthKey)) {
      monthCache.set(monthKey, (await createDriveFolder(token, monthFolder(date), yearCache.get(year))).id);
    }

    const dayKey = `${monthKey}/${dayFolder(date)}`;
    if (!dayCache.has(dayKey)) {
      dayCache.set(dayKey, (await createDriveFolder(token, dayFolder(date), monthCache.get(monthKey))).id);
    }

    const saleFolder = await createDriveFolder(token, saleFolderName(sale), dayCache.get(dayKey));
    await uploadJson(token, saleFolder.id, SALE_MANIFEST, sale);
    filesUploaded += 1;

    for (const docKey of Object.keys(DOC_LABELS)) {
      if (sale[docKey] && await uploadDocument(token, saleFolder.id, sale, docKey)) {
        filesUploaded += 1;
      }
    }
  }

  return {
    rootFolderId: root.id,
    rootFolderUrl: root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`,
    salesExported: sales.length,
    filesUploaded,
  };
}

export async function importExpedientesFromDrive(folderInput: string): Promise<DriveImportResult> {
  const folderId = parseDriveFolderId(folderInput);
  if (!folderId) throw new Error('Pega el enlace o ID de una carpeta de Google Drive.');
  const token = await requestAccessToken();
  const files = await listDriveChildren(token, folderId);
  const manifest = files.find(file => file.name === ROOT_MANIFEST);
  if (!manifest) {
    throw new Error(`No se encontró ${ROOT_MANIFEST} en esa carpeta. Exporta primero desde Heavenly Dreams o pega la carpeta raíz exportada.`);
  }
  const text = await downloadText(token, manifest.id);
  const payload = JSON.parse(text);
  return {
    sales: Array.isArray(payload.sales) ? payload.sales : [],
    importedAt: payload.exportedAt,
    sourceFolderId: folderId,
  };
}
