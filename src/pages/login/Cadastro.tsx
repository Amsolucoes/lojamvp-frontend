import { useState, useEffect, FormEvent } from 'react';
import { Eye, EyeOff, AlertCircle, Check, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export function Cadastro() {
  const navigate = useNavigate();
  const { setSessao } = useAuth();

  const [perfis, setPerfis] = useState<{ id: string; nome: string; icone: string; desc: string; tipoPlano: string }[]>([]);
  const [nomeLoja, setNomeLoja]   = useState('');
  const [perfilId, setPerfilId]   = useState('');
  const [nome, setNome]           = useState('');
  const [email, setEmail]         = useState('');
  const [telefone, setTelefone]   = useState('');
  const [senha, setSenha]         = useState('');
  const [mostraSenha, setMostra]  = useState(false);
  const [erro, setErro]           = useState('');
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.get<any[]>('/api/perfis').then(res => {
      const lista = res.map(p => ({
        id: p.id,
        nome: p.nome,
        icone: p.icone ?? '🏪',
        desc: p.descricao ?? '',
        tipoPlano: p.tipoPlanoAplica ?? 'loja',
      }));
      setPerfis(lista);
    }).catch(() => {});
  }, []);

  const grupoBranco = perfis.filter(p => p.nome === 'Começar do zero');
  const grupoLojas = perfis.filter(p => p.tipoPlano === 'loja' && p.nome !== 'Começar do zero');
  const grupoServicos = perfis.filter(p => p.tipoPlano === 'servicos' || p.tipoPlano === 'loja_modulos');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nomeLoja.trim() || !nome.trim() || !email.trim() || !senha.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; nome: string; email: string; role: string }>(
        '/api/auth/signup',
        { nomeLoja, perfilId, nomeResponsavel: nome, email, senha, telefone }
      );
      // Loga direto com a sessão retornada
      setSessao({ nome: res.nome, email: res.email, role: res.role as 'admin' | 'operador', token: res.token });
      navigate('/', { replace: true });
    } catch (err) {
      setErro((err as Error).message || 'Erro ao criar conta.');
      setLoading(false);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />

      <div className="login-box" style={{ maxWidth: 640 }}>
        <div className="login-logo">
          <img src="/logo-aldevsoftware-padrao.png" alt="AlDevSoftware" className="login-logo-icon" style={{ objectFit: 'contain' }} />
          <div>
            <div className="login-logo-nome">Al DevSoftware</div>
            <div className="login-logo-sub">Criar conta grátis</div>
          </div>
        </div>

        <h1 className="login-title">Comece seu teste de 7 dias</h1>
        <p className="login-subtitle">Crie sua loja agora. Sem cartão, sem compromisso.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Nome da loja *</label>
            <input value={nomeLoja} onChange={e => { setNomeLoja(e.target.value); setErro(''); }}
              placeholder="Ex: Boutique da Maria" disabled={loading} autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Ramo da loja *</label>

            {grupoBranco.length > 0 && (
              <div className="cad-perfis" style={{ marginBottom: 12 }}>
                {grupoBranco.map(p => (
                  <button type="button" key={p.id}
                    className={`cad-perfil${perfilId === p.id ? ' active' : ''}`}
                    onClick={() => setPerfilId(p.id)} disabled={loading}>
                    <span className="cad-perfil-icone">{p.icone}</span>
                    <span className="cad-perfil-nome">{p.nome}</span>
                    <span className="cad-perfil-desc">{p.desc}</span>
                    {perfilId === p.id && <span className="cad-perfil-check"><Check size={13} /></span>}
                  </button>
                ))}
              </div>
            )}

            <div className="cad-grupo-titulo">🛍️ Lojas de produtos</div>
            <div className="cad-perfis" style={{ marginBottom: 12 }}>
              {grupoLojas.map(p => (
                <button type="button" key={p.id}
                  className={`cad-perfil${perfilId === p.id ? ' active' : ''}`}
                  onClick={() => setPerfilId(p.id)} disabled={loading}>
                  <span className="cad-perfil-icone">{p.icone}</span>
                  <span className="cad-perfil-nome">{p.nome}</span>
                  <span className="cad-perfil-desc">{p.desc}</span>
                  {perfilId === p.id && <span className="cad-perfil-check"><Check size={13} /></span>}
                </button>
              ))}
            </div>

            <div className="cad-grupo-titulo">✂️ Serviços e agendamentos</div>
            <div className="cad-perfis">
              {grupoServicos.map(p => (
                <button type="button" key={p.id}
                  className={`cad-perfil${perfilId === p.id ? ' active' : ''}`}
                  onClick={() => setPerfilId(p.id)} disabled={loading}>
                  <span className="cad-perfil-icone">{p.icone}</span>
                  <span className="cad-perfil-nome">{p.nome}</span>
                  <span className="cad-perfil-desc">{p.desc}</span>
                  {perfilId === p.id && <span className="cad-perfil-check"><Check size={13} /></span>}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Seu nome *</label>
            <input value={nome} onChange={e => { setNome(e.target.value); setErro(''); }}
              placeholder="Seu nome completo" disabled={loading} />
          </div>

          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErro(''); }}
              placeholder="seu@email.com" autoComplete="email" disabled={loading} />
          </div>

          <div className="form-group">
            <label className="form-label">Telefone / WhatsApp</label>
            <input value={telefone} onChange={e => setTelefone(e.target.value)}
              placeholder="(67) 99999-9999" disabled={loading} />
          </div>

          <div className="form-group">
            <label className="form-label">Senha *</label>
            <div className="login-senha-wrap">
              <input type={mostraSenha ? 'text' : 'password'} value={senha}
                onChange={e => { setSenha(e.target.value); setErro(''); }}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password" disabled={loading} />
              <button type="button" className="login-olho" onClick={() => setMostra(v => !v)} tabIndex={-1}>
                {mostraSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {erro && <div className="login-erro"><AlertCircle size={14} />{erro}</div>}

          <button type="submit" className={`login-btn${loading ? ' loading' : ''}`} disabled={loading}>
            {loading ? <span className="login-spinner" /> : <><Store size={16} /> Criar minha loja</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-3, #888)' }}>
          Já tem conta?{' '}
          <a onClick={() => navigate('/login')} style={{ color: 'var(--accent, #c38228)', cursor: 'pointer', fontWeight: 500 }}>
            Entrar
          </a>
        </p>
      </div>
    </div>
  );
}