import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useEffect, useRef } from 'react';
import { api } from '../../services/api';
import './Layout.css';

// Trava o scroll do body sempre que existir algum modal (.modal-overlay) aberto
// em qualquer tela do sistema — sem precisar mexer em cada modal individualmente.
function useTravaScrollModal() {
  const scrollYRef = useRef(0);

  useEffect(() => {
    function atualizar() {
      const temModalAberto = document.querySelector('.modal-overlay') !== null;

      if (temModalAberto && document.body.style.position !== 'fixed') {
        scrollYRef.current = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollYRef.current}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
      } else if (!temModalAberto && document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollYRef.current);
      }
    }

    const observer = new MutationObserver(atualizar);
    observer.observe(document.body, { childList: true, subtree: true });
    atualizar();

    return () => {
      observer.disconnect();
      // Garante que não fica travado se o componente desmontar com modal aberto
      if (document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
      }
    };
  }, []);
}

export function Layout() {
  const { loading, erro, recarregar, fase, nomeLoja, temFinanceiro } = useApp();
  const { aviso } = useToast();

  useTravaScrollModal();

  useEffect(() => {
    if (!temFinanceiro) return;
    const jaAvisouHoje = sessionStorage.getItem('financeiro:avisoVencimento');
    if (jaAvisouHoje) return;

    api.get<any[]>('/api/financeiro/alertas-vencimento?dias=3').then(alertas => {
      if (alertas.length === 0) return;
      const total = alertas.reduce((s, a) => s + a.valor, 0);
      const primeiro = alertas[0];
      const msg = alertas.length === 1
        ? `💰 "${primeiro.descricao}" vence em breve — ${primeiro.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        : `💰 ${alertas.length} conta(s) vencendo nos próximos dias — total ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      aviso(msg);
      sessionStorage.setItem('financeiro:avisoVencimento', '1');
    }).catch(() => {});
  }, [temFinanceiro]);

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