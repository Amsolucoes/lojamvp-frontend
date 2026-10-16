import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';

interface Item { origem: string; descricao: string; valor: number; data: string; status: string; cartaoNome?: string | null; }
interface Detalhe { categoria: string; valorBalanco: number; totalItens: number; itens: Item[]; }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export function DetalheCategoriaModal({ ano, mes, categoria, desmembrar, onClose }: {
  ano: number; mes: number; categoria: string; desmembrar: boolean; onClose: () => void;
}) {
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    api.get<Detalhe>(`/api/financeiro/balanco-detalhe?ano=${ano}&mes=${mes}&categoria=${encodeURIComponent(categoria)}&desmembrar=${desmembrar}`)
      .then(r => { if (ativo) setDados(r); })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [ano, mes, categoria, desmembrar]);

  const diferente = dados && Math.abs(dados.valorBalanco - dados.totalItens) >= 0.02;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{categoria}</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {carregando ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="layout-spinner" /></div>
          ) : erro || !dados ? (
            <p style={{ color: 'var(--text-3)', textAlign: 'center' }}>Não foi possível carregar o detalhe.</p>
          ) : dados.itens.length === 0 ? (
            <p style={{ color: 'var(--text-3)', textAlign: 'center' }}>Nenhum lançamento encontrado.</p>
          ) : (
            <>
              {dados.itens.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.descricao}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      {fmtData(i.data)}{i.cartaoNome ? ` · 💳 ${i.cartaoNome}` : ''} · {i.status === 'cartao' ? 'compra no cartão' : <span style={{ color: i.status === 'pago' ? 'var(--green)' : 'var(--text-3)' }}>{i.status === 'pago' ? 'pago' : 'pendente'}</span>}
                    </div>
                  </div>
                  <strong style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>{fmt(i.valor)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontWeight: 700 }}>
                <span>Total ({dados.itens.length})</span><span>{fmt(dados.totalItens)}</span>
              </div>
              {diferente && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  Esta lista mostra o que foi lançado em {MESES[mes - 1]} (avulsos pelo vencimento e compras do cartão pela data da compra). O balanço mostra {fmt(dados.valorBalanco)}, pois nesta visão o cartão entra pelas faturas que vencem no mês.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
