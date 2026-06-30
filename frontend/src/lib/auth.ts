let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(url, { ...options, headers, cache: 'no-store' });

  if (res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }
    const newToken = await refreshPromise;
    refreshPromise = null;

    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, cache: 'no-store' });
    }
  }
  return res;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok) {
      accessToken = data.accessToken;
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export async function authFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}
