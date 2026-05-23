function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export async function runMobileOcr(file: File, mode: 'ine' | 'comprobante' | 'siac' = 'ine') {
  const image = await readAsDataUrl(file);
  const endpoint = mode === 'comprobante'
    ? '/api/vision/comprobante'
    : mode === 'siac'
      ? '/api/vision/siac'
      : '/api/vision/ocr';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo procesar el OCR.');
  return data;
}
