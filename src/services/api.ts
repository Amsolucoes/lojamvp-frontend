const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

function getToken(): string | null {
  try {
    const sessao = localStorage.getItem('loja:sessao');
    return sessao ? JSON.parse(sessao).token : null;
  } catch { return null; }
}

function logout() {
  localStorage.removeItem('loja:sessao');
  window.location.href = '/';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token expirado ou inválido — faz logout automático
  if (res.status === 401) {
    logout();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.erro ?? data?.title ?? `Erro ${res.status}`);
  }

  return data as T;
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};