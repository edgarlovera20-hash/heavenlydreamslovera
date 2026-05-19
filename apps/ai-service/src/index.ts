import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.AI_SERVICE_PORT ?? 4003;
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const PHI3_MODEL = process.env.PHI3_MODEL ?? 'phi3';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? 'mistral:7b';

app.get('/health', (_req, res) => res.json({ status: 'ok', ollama: OLLAMA_URL }));

// Ask with optional RAG context
app.post('/ask', async (req, res) => {
  const { question, context, model = PHI3_MODEL } = req.body;

  const systemPrompt = context
    ? `Eres un asistente de Heavenly Dreams. Usa el siguiente contexto para responder:\n\n${context}`
    : 'Eres un asistente empresarial de Heavenly Dreams. Responde en español de forma precisa y profesional.';

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      prompt: question,
      system: systemPrompt,
      stream: false,
    });
    res.json({ answer: response.data.response, model });
  } catch (err: any) {
    res.status(500).json({ error: `AI unavailable: ${err.message}` });
  }
});

// Fraud analysis using Mistral 7B
app.post('/fraud-analysis', async (req, res) => {
  const { saleId, data } = req.body;

  const prompt = `Analiza estos datos de una solicitud de servicio y detecta posibles fraudes:\n${JSON.stringify(data, null, 2)}\n\nResponde con un JSON: {"riskLevel": "LOW|MEDIUM|HIGH", "score": 0-100, "reasons": ["..."], "recommendations": ["..."]}`;

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: MISTRAL_MODEL,
      prompt,
      system: 'Eres un sistema de detección de fraude. Responde SOLO con JSON válido.',
      stream: false,
      format: 'json',
    });

    const result = JSON.parse(response.data.response);
    res.json({ saleId, ...result });
  } catch (err: any) {
    res.status(500).json({ error: `Fraud analysis unavailable: ${err.message}` });
  }
});

// OCR text cleanup using Phi-3
app.post('/ocr-cleanup', async (req, res) => {
  const { rawText, documentType } = req.body;

  const prompt = `Limpia y estructura el siguiente texto extraído por OCR de un documento ${documentType}. Extrae los campos más importantes y corrije errores obvios de OCR:\n\n${rawText}\n\nResponde con JSON: {"cleaned": "texto limpio", "fields": {}}`;

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: PHI3_MODEL,
      prompt,
      system: 'Eres un procesador de OCR. Responde SOLO con JSON válido.',
      stream: false,
      format: 'json',
    });

    res.json(JSON.parse(response.data.response));
  } catch (err: any) {
    res.status(500).json({ error: `OCR cleanup unavailable: ${err.message}` });
  }
});

// RAG search — called by apps/api knowledge-base service
app.post('/rag/search', async (req, res) => {
  const { query, entries, limit = 5 } = req.body;

  // Simple cosine similarity via keyword scoring (Ollama embeddings would be ideal)
  const scored = (entries as Array<{ id: string; title: string; content: string; category: string }>)
    .map((entry) => {
      const text = `${entry.title} ${entry.content}`.toLowerCase();
      const words = query.toLowerCase().split(/\s+/);
      const score = words.reduce((acc: number, word: string) => acc + (text.includes(word) ? 1 : 0), 0);
      return { ...entry, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  res.json({ results: scored });
});

app.listen(PORT, () => {
  console.log(`[AI Service] running on port ${PORT}`);
  console.log(`[AI Service] Ollama: ${OLLAMA_URL} | Phi-3: ${PHI3_MODEL} | Mistral: ${MISTRAL_MODEL}`);
});
