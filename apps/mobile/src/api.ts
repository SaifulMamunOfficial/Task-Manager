import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Set EXPO_PUBLIC_API_URL to force an address (e.g. a production server). Without it, development builds use the
// computer that serves the app, which also works over Wi-Fi without any cable setup.
// In development the app is served by Metro on your computer, so the API is on the same computer (port 4000).
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const BASE = process.env.EXPO_PUBLIC_API_URL ?? (devHost ? `http://${devHost}:4000/api` : 'http://10.0.2.2:4000/api');

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionLost: () => void = () => {};
export const setSessionLostHandler = (f: () => void) => (onSessionLost = f);

export async function loadTokens() {
  accessToken = await SecureStore.getItemAsync('at');
  refreshToken = await SecureStore.getItemAsync('rt');
  return !!accessToken;
}
export async function saveTokens(t: { accessToken: string; refreshToken: string }) {
  accessToken = t.accessToken;
  refreshToken = t.refreshToken;
  await SecureStore.setItemAsync('at', t.accessToken);
  await SecureStore.setItemAsync('rt', t.refreshToken);
}
export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync('at');
  await SecureStore.deleteItemAsync('rt');
}
export const currentRefreshToken = () => refreshToken;

let refreshing: Promise<boolean> | null = null;
/** True when the last refresh failed only because the network was down (the session may still be fine). */
let refreshOffline = false;
function tryRefresh(): Promise<boolean> {
  // Several requests can fail at once; they all wait for the same refresh (refresh tokens rotate, so it must run once).
  if (!refreshing) {
    refreshing = (async () => {
      refreshOffline = false;
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
        if (!res.ok) return false;
        await saveTokens(await res.json());
        return true;
      } catch {
        refreshOffline = true;
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function authed(path: string, init: RequestInit = {}, json = true): Promise<Response> {
  const make = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...((init.headers as Record<string, string>) ?? {}) },
    });
  let res = await make();
  if (res.status === 401) {
    if (await tryRefresh()) res = await make();
    else if (accessToken && !refreshOffline) {
      // The server rejected the sign-in (not just a dropped connection): sign out.
      await clearTokens();
      onSessionLost();
    }
  }
  return res;
}

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const e: any = new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `HTTP ${res.status}`);
  e.status = res.status;
  throw e;
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authed(path, init);
  if (!res.ok) return fail(res);
  return res.status === 204 ? (undefined as T) : res.json();
}
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });

/** Sign in without the auth header (and without the session-lost logic). */
export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) return fail(res);
  return res.json();
}

export type PickedFile = { uri: string; name: string; mimeType?: string | null };

/** multipart upload: files in the "files" field, extra text fields beside them. */
export async function upload<T = any>(path: string, files: PickedFile[], fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', { uri: f.uri, name: f.name, type: f.mimeType || 'application/octet-stream' } as any));
  Object.entries(fields).forEach(([k, v]) => v && fd.append(k, v));
  const res = await authed(path, { method: 'POST', body: fd }, false);
  if (!res.ok) return fail(res);
  return res.json();
}

/** Downloads need the auth header, so save the file to the app cache and open the share sheet. */
export async function downloadAndOpen(attachmentId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\- ]+/g, '_');
  const dest = `${FileSystem.cacheDirectory}${Date.now()}-${safe}`;
  const run = () => FileSystem.downloadAsync(`${BASE}/attachments/${attachmentId}/download`, dest, { headers: { Authorization: `Bearer ${accessToken}` } });
  let r = await run();
  if (r.status === 401 && (await tryRefresh())) r = await run();
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(r.uri);
}
