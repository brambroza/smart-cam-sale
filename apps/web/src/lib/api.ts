export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string; // staff | admin | superadmin
  orgId?: string;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

/** fetch with Authorization header; a 401 clears the session and reloads to the login gate. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('session หมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  }
  return res;
}

/** apiFetch + JSON parse; throws with the server's Thai message on non-2xx. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
    throw new Error(msg ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function postJson<T>(path: string, data: unknown, method = 'POST'): Promise<T> {
  return apiJson<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `เข้าสู่ระบบไม่สำเร็จ (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { accessToken: string; user: AuthUser };
  setAuth(data.accessToken, data.user);
  return data.user;
}
