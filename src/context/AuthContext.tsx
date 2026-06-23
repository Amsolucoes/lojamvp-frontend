import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';

interface Usuario {
  nome: string;
  email: string;
  role: 'admin' | 'operador';
  token: string;
}

interface AuthCtx {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  setSessao: (u: Usuario) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function salvarSessao(u: Usuario) {
  localStorage.setItem('loja:sessao', JSON.stringify(u));
}
function carregarSessao(): Usuario | null {
  try {
    const raw = localStorage.getItem('loja:sessao');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => carregarSessao());

  async function login(email: string, senha: string) {
    try {
      const res = await api.post<{ token: string; nome: string; email: string; role: string }>(
        '/api/auth/login',
        { email, senha }
      );

      const u: Usuario = {
        nome:  res.nome,
        email: res.email,
        role:  res.role as 'admin' | 'operador',
        token: res.token,
      };

      setUsuario(u);
      salvarSessao(u);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: (err as Error).message };
    }
  }

  function setSessao(u: Usuario) {
    setUsuario(u);
    salvarSessao(u);
  }

  function logout() {
    setUsuario(null);
    localStorage.removeItem('loja:sessao');
  }

  return <Ctx.Provider value={{ usuario, login, setSessao, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}