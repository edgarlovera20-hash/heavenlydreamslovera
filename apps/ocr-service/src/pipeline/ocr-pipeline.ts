import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import axios from 'axios';

export interface OcrResult {
  raw: string;
  structured: Record<string, string>;
  confidence: number;
  provider: 'gemini' | 'tesseract';
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Preprocess image with sharp (resize, grayscale, sharpen)
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 1800, withoutEnlargement: true })
    .grayscale()
    .sharpen()
    .normalize()
    .toBuffer();
}

// Extract structured data from raw OCR text for INE
function parseIneData(raw: string): Record<string, string> {
  const data: Record<string, string> = {};
  const curpMatch = raw.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
  if (curpMatch) data.curp = curpMatch[0];

  const nameMatch = raw.match(/NOMBRES?\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i);
  if (nameMatch) data.nombres = nameMatch[1].trim();

  const yearMatch = raw.match(/\b(19|20)\d{2}\b/g);
  if (yearMatch) data.anoNacimiento = yearMatch[0];

  return data;
}

function parseComprobanteData(raw: string): Record<string, string> {
  const data: Record<string, string> = {};
  const cpMatch = raw.match(/\b\d{5}\b/);
  if (cpMatch) data.codigoPostal = cpMatch[0];

  const calleMatch = raw.match(/CALLE\s+([^,\n]+)/i);
  if (calleMatch) data.calle = calleMatch[1].trim();

  return data;
}

function parseStructured(raw: string, documentType: string): Record<string, string> {
  switch (documentType.toUpperCase()) {
    case 'INE': return parseIneData(raw);
    case 'COMPROBANTE': return parseComprobanteData(raw);
    default: return {};
  }
}

function assessFraudRisk(confidence: number, structured: Record<string, string>): OcrResult['fraudRisk'] {
  if (confidence < 40) return 'HIGH';
  if (confidence < 65) return 'MEDIUM';
  return 'LOW';
}

async function runGeminiOcr(buffer: Buffer, documentType: string): Promise<{ raw: string; confidence: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const base64 = buffer.toString('base64');
    const prompt = `Extract all text from this ${documentType} document image. Return ONLY the extracted text, preserving the layout as much as possible. Be precise with names, numbers, and alphanumeric codes.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/jpeg', data: base64 } },
    ]);

    const text = result.response.text();
    return { raw: text, confidence: 85 };
  } catch {
    return null;
  }
}

async function runTesseractOcr(buffer: Buffer): Promise<{ raw: string; confidence: number }> {
  const worker = await createWorker('spa+eng');
  try {
    const { data } = await worker.recognize(buffer);
    return { raw: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

export async function runOcrPipeline(buffer: Buffer, documentType: string): Promise<OcrResult> {
  const preprocessed = await preprocessImage(buffer);

  // Try Gemini first
  const geminiResult = await runGeminiOcr(preprocessed, documentType);
  if (geminiResult && geminiResult.raw.length > 10) {
    const structured = parseStructured(geminiResult.raw, documentType);
    return {
      raw: geminiResult.raw,
      structured,
      confidence: geminiResult.confidence,
      provider: 'gemini',
      fraudRisk: assessFraudRisk(geminiResult.confidence, structured),
    };
  }

  // Fallback to Tesseract
  const tesseractResult = await runTesseractOcr(preprocessed);
  const structured = parseStructured(tesseractResult.raw, documentType);
  return {
    raw: tesseractResult.raw,
    structured,
    confidence: tesseractResult.confidence,
    provider: 'tesseract',
    fraudRisk: assessFraudRisk(tesseractResult.confidence, structured),
  };
}
