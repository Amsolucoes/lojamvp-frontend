import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useApp } from '../../context/AppContext';
import './Layout.css';

export function Layout() {
  const { loading, erro, recarregar } = useApp();

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

  return (
    <div className="layout">
      <Sidebar />
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
