import { useEffect, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

interface Item { origem: string; descricao: string; valor: number; data: string; status: string; cartaoNome?: string | null; contaNome?: string | null; id?: string | null; modo?: string | null; }
interface CategoriaOpcao { id: string; nome: string; tipo: string; icone: string | null; }
interface Detalhe { categoria: string; valorBalanco: number; totalItens: number; itens: Item[]; }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export function DetalheCategoriaModal({ ano, mes, categoria, desmembrar, onClose, onAlterado }: {
  ano: number; mes: number; categoria: string; desmembrar: boolean; onClose: () => void; onAlterado?: () => void;
}) {
  const { sucesso, erro: toastErro } = useToast();
  const [opcoes, setOpcoes] = useState<CategoriaOpcao[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [novaCat, setNovaCat] = useState('');
  const [todasParcelas, setTodasParcelas] = useState(false);
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [recarga, setRecarga] = useState(0);
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
  }, [ano, mes, categoria, desmembrar, recarga]);

  async function abrirEdicao(id: string) {
    setEditando(id); setNovaCat(''); setTodasParcelas(false);
    if (opcoes.length === 0) {
      try { setOpcoes(await api.get<CategoriaOpcao[]>('/api/financeiro/categorias')); } catch { /* segue sem lista */ }
    }
  }

  async function salvarCategoria(i: Item) {
    if (!i.id) return;
    setSalvandoCat(true);
    try {
      const corpo = { categoriaId: novaCat || null, todasParcelas };
      if (i.cartaoNome) await api.patch(`/api/financeiro/cartoes/lancamentos/${i.id}/categoria`, corpo);
      else await api.patch(`/api/financeiro/lancamentos/${i.id}/categoria`, corpo);
      sucesso('Categoria alterada.');
      setEditando(null);
      setRecarga(n => n + 1);
      onAlterado?.();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoCat(false);
    }
  }

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
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.descricao}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      {fmtData(i.data)} · {i.cartaoNome ? `💳 Cartão de crédito: ${i.cartaoNome}` : `🏦 Débito/avulso${i.contaNome ? `: ${i.contaNome}` : ''}`} · {i.status === 'cartao' ? 'compra no cartão' : <span style={{ color: i.status === 'pago' ? 'var(--green)' : 'var(--text-3)' }}>{i.status === 'pago' ? 'pago' : 'pendente'}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <strong style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>{fmt(i.valor)}</strong>
                    {i.id && (i.origem === 'avulso' || i.origem === 'cartao_item') && (
                      <button className="btn-ghost" title="Editar categoria" onClick={() => abrirEdicao(i.id!)} style={{ padding: 4 }}><Pencil size={13} /></button>
                    )}
                  </div>
                  {editando && editando === i.id && (
                    <div style={{ flexBasis: '100%', background: 'var(--bg-3)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label className="form-label" style={{ margin: 0 }}>Mover para a categoria</label>
                      <select value={novaCat} onChange={e => setNovaCat(e.target.value)}>
                        <option value="">Sem categoria</option>
                        {opcoes.filter(o => o.tipo !== 'receber').map(o => <option key={o.id} value={o.id}>{o.icone ? `${o.icone} ` : ''}{o.nome}</option>)}
                      </select>
                      {i.modo === 'fixa' && (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
                          🔁 Conta fixa: a nova categoria vale para <strong>todos os meses</strong> (passados e futuros) e para os próximos lançamentos.
                        </p>
                      )}
                      {i.modo === 'parcelada' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={todasParcelas} onChange={e => setTodasParcelas(e.target.checked)} style={{ width: 16, height: 16, flex: 'none', padding: 0 }} />
                          Aplicar a todas as parcelas desta compra
                        </label>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={() => setEditando(null)} style={{ width: 'auto' }}>Cancelar</button>
                        <button className="btn-primary" onClick={() => salvarCategoria(i)} disabled={salvandoCat} style={{ width: 'auto' }}>{salvandoCat ? 'Salvando...' : 'Salvar'}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(() => {
                const cartao = dados.itens.filter(i => i.cartaoNome).reduce((t, i) => t + i.valor, 0);
                const debito = dados.itens.filter(i => !i.cartaoNome).reduce((t, i) => t + i.valor, 0);
                return cartao > 0 && debito > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)', paddingTop: 10 }}>
                    <span>💳 Cartão de crédito: <strong style={{ color: 'var(--text-2)' }}>{fmt(cartao)}</strong></span>
                    <span>🏦 Débito/avulso: <strong style={{ color: 'var(--text-2)' }}>{fmt(debito)}</strong></span>
                  </div>
                ) : null;
              })()}
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
