import { useState, FormEvent } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [mostraSenha, setMostra] = useState(false);
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [nomeLoja, setNomeLoja] = useState('AlDevSoftware');
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setErro('');
    setLoading(true);
    const res = await login(email, senha);
    setLoading(false);
    if (!res.ok) {
      setErro(res.erro ?? 'Erro ao fazer login.');
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="login-bg">
      {/* Decoração de fundo */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />

      <div className="login-box">
        {/* Logo */}
        <div className="login-logo">
          <img src="/logo-aldevsoftware-padrao.png" alt="AlDevSoftware" className="login-logo-icon" style={{ objectFit: 'contain' }} />
          <div>
            <div className="login-logo-nome">{nomeLoja}</div>
            <div className="login-logo-sub">Sistema de Gestão</div>
          </div>
        </div>

        <h1 className="login-title">Bem-vinda de volta</h1>
        <p className="login-subtitle">Entre com suas credenciais para acessar o sistema.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErro(''); }}
              placeholder="seu@email.com"
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <div className="login-senha-wrap">
              <input
                type={mostraSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => { setSenha(e.target.value); setErro(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-olho"
                onClick={() => setMostra(v => !v)}
                tabIndex={-1}
              >
                {mostraSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {erro && (
            <div className="login-erro">
              <AlertCircle size={14} />
              {erro}
            </div>
          )}

          <button
            type="submit"
            className={`login-btn${loading ? ' loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <><LogIn size={16} /> Entrar</>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-3, #888)' }}>
          Ainda não tem conta?{' '}
          <a onClick={() => navigate('/cadastro')} style={{ color: 'var(--accent, #c38228)', cursor: 'pointer', fontWeight: 500 }}>
            Criar conta grátis
          </a>
        </p>
      </div>
    </div>
  );
}
