import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';

let auth: GoogleAuth | null = null;

function readVisionCredentials() {
  const inlineJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (inlineJson) return JSON.parse(inlineJson);

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) return JSON.parse(readFileSync(credentialsPath, 'utf-8'));

  throw new Error(
    'Google Vision no configurado. Define GOOGLE_APPLICATION_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS; no subas service accounts al repo.',
  );
}

function getAuth(): GoogleAuth {
  if (!auth) {
    const credentials = readVisionCredentials();
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
