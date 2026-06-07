/**
 * Google Workspace API helpers — Calendar, Sheets, Contacts (People API).
 * Uses OAuth 2.0 access tokens obtained via the oauth_accounts flow.
 * Env vars needed:
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET — same as OAuth login.
 *   GOOGLE_CALENDAR_SCOPES / GOOGLE_SHEETS_SCOPES can extend login scopes.
 */

import { AuditLog, OAuthAccounts } from './db';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4';
const PEOPLE_API = 'https://people.googleapis.com/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type GoogleService = 'calendar' | 'sheets' | 'contacts';

// --- Token refresh ---------------------------------------------------------

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth no configurado');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({})) as any;
    if (!res.ok || !data.access_token) throw new Error(data?.error_description || data?.error || 'No se pudo renovar el token de Google');
    return data.access_token as string;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Calendar --------------------------------------------------------------

export async function listCalendarEvents(accessToken: string, calendarId = 'primary', maxResults = 20) {
  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('timeMin', new Date().toISOString());

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Calendar error ${res.status}`);
  return (data.items || []) as any[];
}

export async function createCalendarEvent(accessToken: string, event: {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  calendarId?: string;
}) {
  const calendarId = event.calendarId || 'primary';
  const body: Record<string, any> = {
    summary: event.summary,
    description: event.description || '',
    location: event.location || '',
    start: { dateTime: event.start, timeZone: 'America/Mexico_City' },
    end: { dateTime: event.end, timeZone: 'America/Mexico_City' },
  };
  if (event.attendees?.length) {
    body.attendees = event.attendees.map((email) => ({ email }));
  }

  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Calendar create error ${res.status}`);
  return data;
}

export async function deleteCalendarEvent(accessToken: string, eventId: string, calendarId = 'primary') {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const data = await res.json().catch(() => ({})) as any;
    throw new Error(data?.error?.message || `Google Calendar delete error ${res.status}`);
  }
  return true;
}

// --- Sheets ----------------------------------------------------------------

export async function readSheet(accessToken: string, spreadsheetId: string, range: string) {
  const url = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Sheets read error ${res.status}`);
  return (data.values || []) as string[][];
}

export async function appendToSheet(accessToken: string, spreadsheetId: string, range: string, rows: (string | number | null)[][]) {
  const url = new URL(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`);
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  url.searchParams.set('insertDataOption', 'INSERT_ROWS');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Sheets append error ${res.status}`);
  return data;
}

export async function createSpreadsheet(accessToken: string, title: string, headers: string[]) {
  const body = {
    properties: { title },
    sheets: [{
      properties: { title: 'Datos' },
      data: [{ rowData: [{ values: headers.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
    }],
  };
  const res = await fetch(`${SHEETS_API}/spreadsheets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Sheets create error ${res.status}`);
  return data as { spreadsheetId: string; spreadsheetUrl: string };
}

// --- Contacts (People API) ------------------------------------------------

export async function listContacts(accessToken: string, pageSize = 50) {
  const url = new URL(`${PEOPLE_API}/people/me/connections`);
  url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations');
  url.searchParams.set('pageSize', String(pageSize));

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Contacts error ${res.status}`);
  return (data.connections || []) as any[];
}

export async function createContact(accessToken: string, contact: {
  givenName: string;
  familyName?: string;
  email?: string;
  phone?: string;
  company?: string;
}) {
  const body: Record<string, any> = {
    names: [{ givenName: contact.givenName, familyName: contact.familyName || '' }],
  };
  if (contact.email) body.emailAddresses = [{ value: contact.email }];
  if (contact.phone) body.phoneNumbers = [{ value: contact.phone }];
  if (contact.company) body.organizations = [{ name: contact.company }];

  const res = await fetch(`${PEOPLE_API}/people:createContact`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Google Contacts create error ${res.status}`);
  return data;
}

// --- OAuth scope check -----------------------------------------------------

const SERVICE_SCOPES: Record<GoogleService, string[]> = {
  calendar: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  contacts: ['https://www.googleapis.com/auth/contacts'],
};

export function getGoogleServiceAuthUrl(service: GoogleService, baseUrl: string, userId: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID no configurado');
  const scopes = ['openid', 'email', 'profile', ...SERVICE_SCOPES[service]];
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${baseUrl}/api/integrations/google/${service}/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', Buffer.from(JSON.stringify({ userId, service })).toString('base64url'));
  return url.toString();
}

export async function exchangeGoogleServiceCode(service: GoogleService, code: string, baseUrl: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth no configurado');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${baseUrl}/api/integrations/google/${service}/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error_description || data?.error || `Google token error ${res.status}`);
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

// --- Status helpers --------------------------------------------------------

export function googleServicesStatus() {
  const configured = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  return {
    configured,
    services: {
      calendar: configured,
      sheets: configured,
      contacts: configured,
      drive: configured,
    },
  };
}

export function auditGoogleService(action: string, userId: string | null, detail: any) {
  AuditLog.insert({
    accion: action,
    entidad: 'google_services',
    entidad_id: null,
    user_id: userId,
    user_nombre: null,
    detalle: JSON.stringify(detail).slice(0, 900),
  });
}
