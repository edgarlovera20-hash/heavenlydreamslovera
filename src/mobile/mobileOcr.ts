function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export async function runMobileOcr(fileOrFiles: File | File[], mode: 'ine' | 'comprobante' | 'siac' = 'ine') {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles.filter(Boolean) : [fileOrFiles];
  if (files.length === 0) throw new Error('Selecciona primero un archivo o foto.');
  const images = await Promise.all(files.map(readAsDataUrl));
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
