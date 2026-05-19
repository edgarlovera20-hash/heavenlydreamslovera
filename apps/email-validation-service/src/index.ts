import 'dotenv/config';
import express from 'express';
import { promises as dns } from 'dns';

const app = express();
app.use(express.json());
const PORT = process.env.EMAIL_SERVICE_PORT ?? 4006;

// Known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info', 'spam4.me',
  '10minutemail.com', 'dispostable.com', 'maildrop.cc', 'spamgourmet.com',
  'mintemail.com', 'trashmail.me', 'mailnull.com', 'spamex.com',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

async function validateEmail(email: string) {
  const normalized = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Formato de email inválido', email: normalized };
  }

  const [, domain] = normalized.split('@');

  const disposable = DISPOSABLE_DOMAINS.has(domain);
  if (disposable) {
    return {
      valid: false,
      email: normalized,
      disposable: true,
      error: 'Correos temporales no están permitidos',
      riskScore: 90,
      riskLevel: 'HIGH',
    };
  }

  const mxValid = await checkMxRecords(domain);
  const domainValid = mxValid;

  const riskScore = !mxValid ? 70 : disposable ? 90 : 5;
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

  return {
    valid: mxValid,
    email: normalized,
    mxValid,
    smtpValid: mxValid, // SMTP validation would require actual SMTP connection
    disposable: false,
    domainValid,
    riskScore,
    riskLevel,
  };
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/validate', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const result = await validateEmail(email);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`[Email Validation Service] running on port ${PORT}`));
