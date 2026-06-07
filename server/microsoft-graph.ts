/**
 * Microsoft Graph API helpers — Outlook Calendar, Teams, OneDrive, Excel.
 * Uses OAuth 2.0 access tokens from Azure AD (via microsoft OAuth provider).
 * Env vars needed:
 *   MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET
 *   MICROSOFT_OAUTH_TENANT  (optional, defaults to 'common')
 */

import { AuditLog } from './db';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL_BASE = 'https://login.microsoftonline.com';

export type MicrosoftService = 'calendar' | 'teams' | 'onedrive' | 'excel';

// --- Token refresh ---------------------------------------------------------

export async function refreshMicrosoftToken(refreshToken: string): Promise<string> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  if (!clientId || !clientSecret) throw new Error('Microsoft OAuth no configurado');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${TOKEN_URL_BASE}/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'openid email profile User.Read offline_access Calendars.ReadWrite Mail.ReadWrite Files.ReadWrite.All Chat.ReadWrite ChannelMessage.Send',
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({})) as any;
    if (!res.ok || !data.access_token) throw new Error(data?.error_description || data?.error || 'No se pudo renovar el token de Microsoft');
    return data.access_token as string;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Outlook Calendar ------------------------------------------------------

export async function listOutlookEvents(accessToken: string, maxResults = 20) {
  const url = new URL(`${GRAPH}/me/calendarview`);
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  url.searchParams.set('startDateTime', now.toISOString());
  url.searchParams.set('endDateTime', future.toISOString());
  url.searchParams.set('$top', String(maxResults));
  url.searchParams.set('$orderby', 'start/dateTime');
  url.searchParams.set('$select', 'id,subject,start,end,location,attendees,bodyPreview,isOnlineMeeting,onlineMeetingUrl');

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Outlook Calendar error ${res.status}`);
  return (data.value || []) as any[];
}

export async function createOutlookEvent(accessToken: string, event: {
  subject: string;
  body?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  isOnlineMeeting?: boolean;
}) {
  const body: Record<string, any> = {
    subject: event.subject,
    body: { contentType: 'text', content: event.body || '' },
    start: { dateTime: event.start, timeZone: 'America/Mexico_City' },
    end: { dateTime: event.end, timeZone: 'America/Mexico_City' },
    isOnlineMeeting: event.isOnlineMeeting ?? false,
  };
  if (event.location) body.location = { displayName: event.location };
  if (event.attendees?.length) {
    body.attendees = event.attendees.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  const res = await fetch(`${GRAPH}/me/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Outlook Calendar create error ${res.status}`);
  return data;
}

export async function deleteOutlookEvent(accessToken: string, eventId: string) {
  const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const data = await res.json().catch(() => ({})) as any;
    throw new Error(data?.error?.message || `Outlook delete error ${res.status}`);
  }
  return true;
}

// --- Microsoft Teams -------------------------------------------------------

export async function listTeams(accessToken: string) {
  const res = await fetch(`${GRAPH}/me/joinedTeams`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Teams list error ${res.status}`);
  return (data.value || []) as any[];
}

export async function listChannels(accessToken: string, teamId: string) {
  const res = await fetch(`${GRAPH}/teams/${encodeURIComponent(teamId)}/channels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Teams channels error ${res.status}`);
  return (data.value || []) as any[];
}

export async function sendTeamsMessage(accessToken: string, teamId: string, channelId: string, message: string) {
  const res = await fetch(`${GRAPH}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { contentType: 'text', content: message } }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Teams send error ${res.status}`);
  return data;
}

export async function sendTeamsChatMessage(accessToken: string, chatId: string, message: string) {
  const res = await fetch(`${GRAPH}/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { contentType: 'text', content: message } }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Teams chat error ${res.status}`);
  return data;
}

// --- Teams Webhook (incoming) ----------------------------------------------

export async function sendTeamsWebhookMessage(webhookUrl: string, payload: {
  title: string;
  text: string;
  themeColor?: string;
}) {
  if (!webhookUrl) throw new Error('URL de webhook de Teams no configurada');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: payload.themeColor || '00d4ff',
        summary: payload.title,
        sections: [{ activityTitle: payload.title, activityText: payload.text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Teams webhook error ${res.status}`);
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

// --- OneDrive --------------------------------------------------------------

export async function listOneDriveFiles(accessToken: string, folderId = 'root', top = 50) {
  const url = `${GRAPH}/me/drive/${folderId === 'root' ? 'root' : `items/${encodeURIComponent(folderId)}`}/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,webUrl,file,folder`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `OneDrive list error ${res.status}`);
  return (data.value || []) as any[];
}

export async function uploadToOneDrive(accessToken: string, fileName: string, content: Buffer | Uint8Array, folderId = 'root') {
  const path = folderId === 'root' ? `/me/drive/root:/${encodeURIComponent(fileName)}:/content` : `/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content`;
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
    body: content,
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `OneDrive upload error ${res.status}`);
  return data as { id: string; name: string; webUrl: string };
}

export async function createOneDriveFolder(accessToken: string, name: string, parentId = 'root') {
  const url = parentId === 'root' ? `${GRAPH}/me/drive/root/children` : `${GRAPH}/me/drive/items/${encodeURIComponent(parentId)}/children`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `OneDrive mkdir error ${res.status}`);
  return data as { id: string; name: string; webUrl: string };
}

// --- Excel (via OneDrive/Graph) --------------------------------------------

export async function listExcelWorksheets(accessToken: string, driveItemId: string) {
  const res = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(driveItemId)}/workbook/worksheets`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Excel worksheets error ${res.status}`);
  return (data.value || []) as any[];
}

export async function readExcelRange(accessToken: string, driveItemId: string, worksheetId: string, address: string) {
  const res = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(driveItemId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/range(address='${encodeURIComponent(address)}')`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Excel read error ${res.status}`);
  return (data.values || []) as any[][];
}

export async function appendExcelRows(accessToken: string, driveItemId: string, worksheetId: string, rows: (string | number | null)[][]) {
  // Get used range to find last row
  const rangeRes = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(driveItemId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/usedRange`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const rangeData = await rangeRes.json().catch(() => ({})) as any;
  const lastRow = rangeData?.rowCount ?? 1;

  const body = { values: rows };
  const res = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(driveItemId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/range(address='A${lastRow + 1}')`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Excel append error ${res.status}`);
  return data;
}

// --- OAuth scope auth URL --------------------------------------------------

const SERVICE_SCOPES: Record<MicrosoftService, string[]> = {
  calendar: ['Calendars.ReadWrite', 'offline_access'],
  teams: ['Chat.ReadWrite', 'ChannelMessage.Send', 'Team.ReadBasic.All', 'offline_access'],
  onedrive: ['Files.ReadWrite.All', 'offline_access'],
  excel: ['Files.ReadWrite.All', 'offline_access'],
};

export function getMicrosoftServiceAuthUrl(service: MicrosoftService, baseUrl: string, userId: string) {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  if (!clientId) throw new Error('MICROSOFT_OAUTH_CLIENT_ID no configurado');
  const scopes = ['openid', 'email', 'profile', 'User.Read', ...SERVICE_SCOPES[service]];
  const url = new URL(`${TOKEN_URL_BASE}/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${baseUrl}/api/integrations/microsoft/${service}/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', Buffer.from(JSON.stringify({ userId, service })).toString('base64url'));
  return url.toString();
}

export async function exchangeMicrosoftServiceCode(service: MicrosoftService, code: string, baseUrl: string) {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  if (!clientId || !clientSecret) throw new Error('Microsoft OAuth no configurado');
  const scopes = ['openid', 'email', 'profile', 'User.Read', ...SERVICE_SCOPES[service]];

  const res = await fetch(`${TOKEN_URL_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${baseUrl}/api/integrations/microsoft/${service}/callback`,
      client_id: clientId,
      client_secret: clientSecret,
      scope: scopes.join(' '),
    }),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error_description || data?.error || `Microsoft token error ${res.status}`);
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

// --- Status ----------------------------------------------------------------

export function microsoftServicesStatus() {
  const configured = Boolean(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET);
  const webhookUrl = process.env.MICROSOFT_TEAMS_WEBHOOK_URL;
  return {
    configured,
    teamsWebhook: Boolean(webhookUrl),
    services: {
      calendar: configured,
      teams: configured || Boolean(webhookUrl),
      onedrive: configured,
      excel: configured,
    },
  };
}

export function auditMicrosoftService(action: string, userId: string | null, detail: any) {
  AuditLog.insert({
    accion: action,
    entidad: 'microsoft_services',
    entidad_id: null,
    user_id: userId,
    user_nombre: null,
    detalle: JSON.stringify(detail).slice(0, 900),
  });
}
