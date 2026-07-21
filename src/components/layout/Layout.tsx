import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import './Layout.css';

// Puxar a tela pra baixo no topo do scroll recarrega o app — padrão comum em apps mobile
function usePullToRefresh(containerRef: React.RefObject<HTMLElement | null>) {
  const [pull, setPull] = useState(0);
  const [recarregando, setRecarregando] = useState(false);
  const startY = useRef(0);
  const puxando = useRef(false);
  const pullAtual = useRef(0);

  // Considera "no topo" tanto se o próprio elemento rolou (scrollTop)
  // quanto se quem rolou foi a janela/página inteira (window.scrollY) —
  // depende de como o layout se comporta em cada tela/resolução.
  function estaNoTopo(el: HTMLElement) {
    return el.scrollTop <= 0 && window.scrollY <= 0;
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (estaNoTopo(el!)) {
        startY.current = e.touches[0].clientY;
        puxando.current = true;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!puxando.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && estaNoTopo(el!)) {
        const novoPull = Math.min(delta * 0.5, 90);
        pullAtual.current = novoPull;
        setPull(novoPull);
      } else {
        puxando.current = false;
        pullAtual.current = 0;
        setPull(0);
      }
    }
    function onTouchEnd() {
      if (!puxando.current) return;
      puxando.current = false;
      if (pullAtual.current > 60) {
        setRecarregando(true);
        setPull(60);
        window.location.reload();
      } else {
        setPull(0);
      }
    }

    // Escuta tanto no elemento quanto na janela, pois em algumas telas
    // (mobile, conteúdo mais alto que a viewport) quem rola é a página, não o elemento.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef]);

  return { pull, recarregando };
}

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
  const mainRef = useRef<HTMLElement | null>(null);
  const { pull, recarregando } = usePullToRefresh(mainRef);

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
      <main className="layout-main" ref={mainRef} style={{ position: 'relative' }}>
        {pull > 0 && (
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: `translate(-50%, ${pull - 40}px)`,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, boxShadow: 'var(--shadow)',
            transition: recarregando ? 'none' : 'transform 0.1s',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid var(--border-2)', borderTopColor: 'var(--accent)',
              animation: recarregando ? 'spin 0.6s linear infinite' : 'none',
              transform: recarregando ? 'none' : `rotate(${pull * 3}deg)`,
            }} />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}