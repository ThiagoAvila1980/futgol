const resolveBaseUrl = () => {
  const envUrl = process.env.API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const { hostname } = window.location as Location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
    return '';
  }
  return 'http://localhost:3001';
};

const BASE_URL = resolveBaseUrl().replace(/\/$/, '');

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) =>
    request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (path: string, body: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

export default api;
