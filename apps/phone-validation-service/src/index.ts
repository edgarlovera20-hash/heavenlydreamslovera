import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());
const PORT = process.env.PHONE_SERVICE_PORT ?? 4005;

const MX_CARRIERS: Record<string, string> = {
  '55': 'Telcel', '56': 'Telcel', '33': 'Telcel', '81': 'Telcel',
  '22': 'Movistar', '442': 'AT&T', '444': 'AT&T',
};

function detectCarrier(phone: string): string {
  const normalized = phone.replace(/\D/g, '').slice(-10);
  const prefix3 = normalized.slice(0, 3);
  const prefix2 = normalized.slice(0, 2);
  return MX_CARRIERS[prefix3] ?? MX_CARRIERS[prefix2] ?? 'Desconocido';
}

function detectLineType(phone: string): 'MOVIL' | 'FIJA' {
  const normalized = phone.replace(/\D/g, '').slice(-10);
  // Mexican mobile numbers typically start with these area codes
  const mobileAreaCodes = ['55', '56', '33', '81', '22', '444', '442'];
  return mobileAreaCodes.some(c => normalized.startsWith(c)) ? 'MOVIL' : 'FIJA';
}

function calculateFraudScore(phone: string, lineType: string): number {
  let score = 0;
  if (lineType === 'FIJA') score += 20; // landlines slightly higher risk for mobile-first fraud
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length !== 10) score += 30;
  return Math.min(score, 100);
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/validate', async (req, res) => {
  const { phoneNumber, useExternal = false } = req.body;

  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

  const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
  const valid = normalized.length === 10;

  if (!valid) {
    return res.json({ valid: false, phoneNumber, error: 'Número inválido (debe tener 10 dígitos)' });
  }

  const carrier = detectCarrier(normalized);
  const lineType = detectLineType(normalized);
  const fraudScore = calculateFraudScore(normalized, lineType);
  const riskLevel = fraudScore < 30 ? 'LOW' : fraudScore < 70 ? 'MEDIUM' : 'HIGH';

  // If external API configured, use it
  if (useExternal && process.env.NUMVERIFY_API_KEY) {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(`http://apilayer.net/api/validate`, {
        params: { access_key: process.env.NUMVERIFY_API_KEY, number: `52${normalized}`, country_code: 'MX' },
      });
      const ext = response.data;
      return res.json({
        valid: ext.valid,
        phoneNumber: normalized,
        carrier: ext.carrier ?? carrier,
        lineType: ext.line_type?.toUpperCase() ?? lineType,
        portedFrom: ext.location,
        portability: false,
        fraudScore,
        riskLevel,
        country: 'MX',
        rawResponse: ext,
      });
    } catch { /* fallback to local */ }
  }

  res.json({
    valid: true,
    phoneNumber: normalized,
    carrier,
    lineType,
    portedFrom: null,
    portability: false,
    fraudScore,
    riskLevel,
    country: 'MX',
  });
});

app.listen(PORT, () => console.log(`[Phone Validation Service] running on port ${PORT}`));
