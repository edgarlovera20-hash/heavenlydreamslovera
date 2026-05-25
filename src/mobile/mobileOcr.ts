function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

const OCR_READY_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isHeic(file: File) {
  const name = file.name.toLowerCase();
  return file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
}

function canvasToJpegFile(canvas: HTMLCanvasElement, sourceName: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo preparar la imagen para OCR.'));
        return;
      }
      const cleanName = sourceName.replace(/\.[^.]+$/, '') || 'documento';
      resolve(new File([blob], `${cleanName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.88);
  });
}

async function convertHeicToJpeg(file: File) {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.88 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new Error('No se pudo convertir HEIC a JPG.');
  const cleanName = file.name.replace(/\.[^.]+$/, '') || 'documento';
  return new File([blob], `${cleanName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

async function normalizeImageForOcr(file: File) {
  if (isPdf(file)) {
    throw new Error('El OCR movil todavia no lee PDF directo. Guarda el PDF en expediente o sube una foto/imagen del documento.');
  }
  if (!file.type.startsWith('image/') && !isHeic(file)) {
    throw new Error('OCR solo acepta imagenes. Audio, video y PDF se guardan como expediente.');
  }
  if (isHeic(file)) {
    try {
      return await convertHeicToJpeg(file);
    } catch {
      throw new Error('La foto esta en HEIC y este navegador no pudo convertirla. Toma la foto desde la camara de la app o cambia la camara a JPG/compatible.');
    }
  }
  if (OCR_READY_IMAGE_TYPES.has(file.type.toLowerCase())) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible.');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return await canvasToJpegFile(canvas, file.name);
  } catch {
    throw new Error('Formato de imagen no compatible para OCR. Usa JPG, PNG, WEBP o HEIC convertible.');
  }
}

export async function runMobileOcr(fileOrFiles: File | File[], mode: 'ine' | 'comprobante' | 'siac' = 'ine') {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles.filter(Boolean) : [fileOrFiles];
  if (files.length === 0) throw new Error('Selecciona primero un archivo o foto.');
  const normalizedFiles = await Promise.all(files.map(normalizeImageForOcr));
  const images = await Promise.all(normalizedFiles.map(readAsDataUrl));
  const endpoint = mode === 'comprobante'
    ? '/api/vision/comprobante'
    : mode === 'siac'
      ? '/api/vision/siac'
      : '/api/vision/ocr';
  const payload = images.length > 1 ? { images } : { image: images[0] };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo procesar el OCR.');
  return data;
}
