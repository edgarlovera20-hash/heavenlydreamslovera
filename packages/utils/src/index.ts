// ============================================================
// generateFolio
// ============================================================
export function generateFolio(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timestamp = Date.now().toString(36).slice(-3).toUpperCase();
  return `HD-${year}-${random}${timestamp}`;
}

// ============================================================
// sleep
// ============================================================
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// retry
// ============================================================
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delay * Math.pow(2, attempt)); // exponential backoff
      }
    }
  }
  throw lastError;
}

// ============================================================
// chunkArray
// ============================================================
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// sanitizePhone
// ============================================================
export function sanitizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Keep between 10 and 12 digits
  if (digits.length >= 10 && digits.length <= 12) {
    return digits;
  }
  // If longer, take the last 10 digits
  if (digits.length > 12) {
    return digits.slice(-10);
  }
  return digits;
}

// ============================================================
// isValidCurp
// ============================================================
export function isValidCurp(curp: string): boolean {
  const curpRegex =
    /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[HM]{1}(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}[0-9]{1}$/i;
  return curpRegex.test(curp.toUpperCase());
}

// ============================================================
// isValidRfc
// ============================================================
export function isValidRfc(rfc: string): boolean {
  // Mexican RFC: 12 chars for persons, 12 for companies (3 letters + 6 digits + 3 chars)
  const rfcPersonaFisica =
    /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/i;
  const rfcPersonaMoral =
    /^[A-Z]{3}[0-9]{6}[A-Z0-9]{3}$/i;
  const normalized = rfc.toUpperCase().trim();
  return rfcPersonaFisica.test(normalized) || rfcPersonaMoral.test(normalized);
}

// ============================================================
// maskPhone
// ============================================================
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const visible = digits.slice(-4);
  const masked = '*'.repeat(digits.length - 4);
  return `${masked}${visible}`;
}

// ============================================================
// maskEmail
// ============================================================
export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  const firstChar = local.charAt(0);
  const masked = firstChar + '*'.repeat(Math.max(local.length - 1, 3));
  return `${masked}@${domain}`;
}
