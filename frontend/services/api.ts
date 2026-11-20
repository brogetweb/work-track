import type { Meta } from '@/types';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

// Socket.IO lives on the API host root, not under /api.
export const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || BASE.replace(/\/api$/, '')).replace(/\/+$/, '');
const TOKEN_KEY = 'wt_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type Envelope<T> = { success: boolean; data: T; meta?: Meta; message?: string; errors?: Array<{ message: string }> };

export async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; meta?: Meta }> {
  const headers = new Headers(options.headers);
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isForm && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};

  if (response.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    const details = Array.isArray(payload.errors) && payload.errors.length
      ? `: ${payload.errors.map((error: { message: string }) => error.message).join(', ')}`
      : '';
    throw new Error((payload.message || 'Request failed') + details);
  }

  return { data: (payload as Envelope<T>).data, meta: (payload as Envelope<T>).meta };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<T>(path, { method: 'POST', body });
  },
  form: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
};

export async function authedBlob(path: string) {
  const token = getToken();
  const response = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Could not open the file');
  return response.blob();
}

export async function downloadFile(id: string, filename: string) {
  const token = getToken();
  const response = await fetch(`${BASE}/files/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
