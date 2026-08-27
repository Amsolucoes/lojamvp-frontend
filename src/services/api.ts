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

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch() lançou antes de qualquer resposta chegar — sem internet, servidor
    // fora do ar, ou erro de rede/CORS. Não existe um "res" pra inspecionar aqui.
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }

  // Token expirado ou inválido — faz logout automático
  if (res.status === 401) {
    logout();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (res.status === 204) return undefined as T;

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Corpo vazio ou não-JSON (ex: página de erro de um proxy) — segue sem dados.
  }

  if (!res.ok) {
    const err = new Error(data?.erro ?? data?.title ?? `Erro ${res.status}. Tente novamente.`) as Error & { bloqueado?: boolean; status?: number };
    err.bloqueado = data?.bloqueado === true;
    err.status = res.status;
    throw err;
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