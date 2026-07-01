import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useApp } from '../../context/AppContext';
import './Layout.css';

export function Layout() {
  const { loading, erro, recarregar, fase, nomeLoja } = useApp();

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="layout-spinner" />
        <p>Carregando dados...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="layout-loading">
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: 'var(--red)', marginBottom: 8 }}>Erro ao conectar com a API</p>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>{erro}</p>
        <button className="btn-primary" onClick={recarregar}>Tentar novamente</button>
      </div>
    );
  }

  // Loja bloqueada por inadimplência — trava o uso, mas mostra como pagar
  if (fase === 'bloqueado') {
    return (
      <div className="layout-loading" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {nomeLoja || 'Sua loja'} está bloqueada
        </h1>
        <p style={{ color: 'var(--text-2)', maxWidth: 380, lineHeight: 1.6, marginBottom: 24 }}>
          O acesso foi suspenso por inadimplência. Regularize o pagamento no painel
          para reativar o sistema imediatamente.
        </p>
        <a
          href="https://admin.aldevsoftware.com.br/"
          className="btn-primary"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px' }}
        >
          💳 Ir para o painel de pagamento →
        </a>
        <button
          className="btn-ghost"
          onClick={recarregar}
          style={{ marginTop: 14, fontSize: 13 }}
        >
          Já paguei — atualizar
        </button>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}