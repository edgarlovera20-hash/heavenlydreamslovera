import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = join(__dirname, 'google-vision-credentials.json');

let auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!auth) {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-vision'],
    });
  }
  return auth;
}

export async function runVisionOCR(base64Image: string): Promise<string> {
  const client = await getAuth().getClient();
  const token = await (client as any).getAccessToken();
  const accessToken = token.token as string;

  // Strip data-URL prefix if present
  const base64 = base64Image.replace(/^data:image\/[a-z+]+;base64,/, '');

  const response = await fetch(
    'https://vision.googleapis.com/v1/images:annotate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['es', 'es-MX'] },
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    const msg = err?.error?.message || response.statusText;
    throw new Error(`Vision API error (${response.status}): ${msg}`);
  }

  const data = await response.json() as any;
  const text: string =
    data.responses?.[0]?.fullTextAnnotation?.text ||
    data.responses?.[0]?.textAnnotations?.[0]?.description ||
    '';
  return text;
}
