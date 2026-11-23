export const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const store = {
  get: (k: string) => (typeof window === 'undefined' ? null : localStorage.getItem(k)),
  set: (k: string, v: string) => localStorage.setItem(k, v),
  del: (k: string) => localStorage.removeItem(k),
};

export function saveTokens(t: { accessToken: string; refreshToken: string }) {
  store.set('at', t.accessToken);
  store.set('rt', t.refreshToken);
}
export function clearTokens() {
  store.del('at');
  store.del('rt');
}
export const hasSession = () => !!store.get('at');

function authHeaders(): Record<string, string> {
  const t = store.get('at');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function tryRefresh(): Promise<boolean> {
  const rt = store.get('rt');
  if (!rt) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) return false;
  saveTokens(await res.json());
  return true;
}

/** Fetch with the access token; on 401 refresh once and retry. */
async function authed(path: string, init: RequestInit & { json?: boolean } = {}): Promise<Response> {
  const make = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.json === false ? {} : { 'Content-Type': 'application/json' }), ...authHeaders(), ...(init.headers ?? {}) },
    });
  let res = await make();
  if (res.status === 401 && (await tryRefresh())) res = await make();
  return res;
}

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `HTTP ${res.status}`);
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authed(path, init);
  if (!res.ok) return fail(res);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/** multipart upload: files go in the "files" field, extra text fields alongside. */
export async function upload<T = any>(path: string, files: File[], fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  Object.entries(fields).forEach(([k, v]) => v && fd.append(k, v));
  const res = await authed(path, { method: 'POST', body: fd, json: false });
  if (!res.ok) return fail(res);
  return res.json();
}

/** Downloads need the auth header, so fetch as a blob and trigger a save. */
export async function download(attachmentId: string, fileName: string) {
  const res = await authed(`/attachments/${attachmentId}/download`);
  if (!res.ok) return fail(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
