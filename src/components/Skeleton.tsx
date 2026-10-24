import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

// Carregamento por esqueleto: mantém a forma da lista enquanto os dados chegam (mais calmo que um spinner solto)
export function SkeletonLista({ linhas = 5, altura = 52 }: { linhas?: number; altura?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: altura, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ cards = 4, altura = 84 }: { cards?: number; altura?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: '6px 0' }}>
      {Array.from({ length: cards }, (_, i) => <div key={i} className="skeleton" style={{ height: altura, borderRadius: 'var(--radius-lg)' }} />)}
    </div>
  );
}

// Estado vazio padrão: ícone, título e dica do que fazer
export function EstadoVazio({ titulo, dica, acao, icone }: { titulo: string; dica?: string; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6, padding: '36px 16px', color: 'var(--text-3)' }}>
      <div style={{ opacity: 0.45, marginBottom: 4 }}>{icone ?? <Inbox size={30} />}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>{titulo}</div>
      {dica && <div style={{ fontSize: 12.5, maxWidth: 320, lineHeight: 1.5 }}>{dica}</div>}
      {acao && <div style={{ marginTop: 8 }}>{acao}</div>}
    </div>
  );
}
