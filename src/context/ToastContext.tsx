import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastTipo = 'sucesso' | 'erro' | 'info';

interface Toast {
  id: number;
  tipo: ToastTipo;
  mensagem: string;
}

interface ToastCtx {
  toast: (mensagem: string, tipo?: ToastTipo) => void;
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
  info: (mensagem: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((mensagem: string, tipo: ToastTipo = 'info') => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, tipo, mensagem }]);
    setTimeout(() => remover(id), 4000);
  }, [remover]);

  const sucesso = useCallback((m: string) => toast(m, 'sucesso'), [toast]);
  const erro = useCallback((m: string) => toast(m, 'erro'), [toast]);
  const info = useCallback((m: string) => toast(m, 'info'), [toast]);

  return (
    <Ctx.Provider value={{ toast, sucesso, erro, info }}>
      {children}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        width: 'calc(100% - 32px)', maxWidth: 420, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id}
            onClick={() => remover(t.id)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500,
              color: '#fff', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'toastIn 0.25s ease',
              background:
                t.tipo === 'sucesso' ? '#16a34a' :
                t.tipo === 'erro'    ? '#dc2626' :
                                       '#334155',
            }}>
            <span style={{ fontSize: 16 }}>
              {t.tipo === 'sucesso' ? '✓' : t.tipo === 'erro' ? '⚠️' : 'ℹ️'}
            </span>
            <span>{t.mensagem}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}