import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Landmark, CreditCard } from 'lucide-react';
import { api } from '../../services/api';
import { BandeiraBadge } from '../../utils/bandeiras';

export interface ItemLote {
  id: string;
  descricao: string;
  valor: number;
  categoriaNome: string | null;
  vencimento: string;
}

interface Conta { id: string; nome: string; ativa: boolean; }
interface Cartao { id: string; nome: string; ativo: boolean; bandeira?: string | null; }

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Pagar várias contas de uma vez: no débito (saindo de uma conta) ou no cartão de crédito (à vista ou parcelado).
export function PagarLoteModal({ itens, contas, onClose, onConcluido }: {
  itens: ItemLote[];
  contas: Conta[];
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const contasAtivas = contas.filter(c => c.ativa);
  const [forma, setForma] = useState<'conta' | 'cartao'>('conta');
  const [contaId, setContaId] = useState(contasAtivas[0]?.id ?? '');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cartaoId, setCartaoId] = useState('');
  const [tipoCartao, setTipoCartao] = useState<'vista' | 'parcelado'>('vista');
  const [parcelas, setParcelas] = useState(2);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cartao[]>('/api/financeiro/cartoes').then(l => {
      const ativos = l.filter(c => c.ativo);
      setCartoes(ativos);
      if (ativos.length > 0) setCartaoId(id => id || ativos[0].id);
    }).catch(() => {});
  }, []);

  const total = useMemo(() => itens.reduce((s, i) => s + i.valor, 0), [itens]);
  const nParcelas = forma === 'cartao' && tipoCartao === 'parcelado' ? parcelas : 1;

  async function confirmar() {
    setErro('');
    if (forma === 'conta' && !contaId) { setErro('Escolha a conta de onde sai o pagamento.'); return; }
    if (forma === 'cartao' && !cartaoId) { setErro('Escolha o cartão de crédito.'); return; }
    setSalvando(true);
    try {
      await api.post('/api/financeiro/lancamentos/pagar-lote', {
        ids: itens.map(i => i.id),
        forma,
        contaBancariaId: forma === 'conta' ? contaId : null,
        cartaoId: forma === 'cartao' ? cartaoId : null,
        parcelas: nParcelas,
      });
      const qtd = itens.length;
      onConcluido(forma === 'conta'
        ? `${qtd} conta(s) paga(s): ${fmt(total)}`
        : `${qtd} conta(s) lançada(s) no cartão${nParcelas > 1 ? ` em ${nParcelas}x` : ' à vista'}: ${fmt(total)}`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const botaoForma = (id: 'conta' | 'cartao', icone: React.ReactNode, texto: string) => (
    <button type="button" className={forma === id ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, display: 'inline-flex', gap: 6, justifyContent: 'center' }}
      onClick={() => setForma(id)}>{icone}{texto}</button>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Pagar {itens.length} conta(s)</h2>
          <button className="btn-ghost" onClick={onClose} disabled={salvando}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {itens.map((i, idx) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderTop: idx ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.descricao}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {i.categoriaNome ?? 'Sem categoria'}{i.vencimento ? ` · vence ${new Date(i.vencimento).toLocaleDateString('pt-BR')}` : ''}
                  </div>
                </div>
                <strong style={{ flexShrink: 0 }}>{fmt(i.valor)}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 2px 14px', fontSize: 15 }}>
            <span>Total</span><strong>{fmt(total)}</strong>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Como vai pagar?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {botaoForma('conta', <Landmark size={14} />, 'Débito / conta')}
              {botaoForma('cartao', <CreditCard size={14} />, 'Cartão de crédito')}
            </div>
          </div>

          {forma === 'conta' ? (
            <div className="form-group">
              <label className="form-label">Pagar com a conta</label>
              <select value={contaId} onChange={e => setContaId(e.target.value)}>
                {contasAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>As contas são marcadas como pagas e o valor sai desta conta.</p>
            </div>
          ) : cartoes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum cartão de crédito cadastrado. Cadastre em Financeiro → Cartões.</p>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Cartão</label>
                <select value={cartaoId} onChange={e => setCartaoId(e.target.value)}>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {cartaoId && <div style={{ marginTop: 6 }}><BandeiraBadge bandeira={cartoes.find(c => c.id === cartaoId)?.bandeira} tamanho={22} /></div>}
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label">Pagamento no cartão</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className={tipoCartao === 'vista' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => setTipoCartao('vista')}>À vista</button>
                  <button type="button" className={tipoCartao === 'parcelado' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }} onClick={() => setTipoCartao('parcelado')}>Parcelado</button>
                  {tipoCartao === 'parcelado' && (
                    <select value={parcelas} onChange={e => setParcelas(+e.target.value)} style={{ width: 'auto' }}>
                      {Array.from({ length: 23 }, (_, k) => k + 2).map(n => <option key={n} value={n}>{n}x</option>)}
                    </select>
                  )}
                </div>
              </div>
              {tipoCartao === 'parcelado' && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0' }}>
                  Cada conta é dividida em {parcelas}x (≈ {fmt(total / parcelas)} por mês no total das contas selecionadas).
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
                As contas viram compras no cartão, com a mesma descrição, categoria e observação, e saem de Contas a Pagar. O valor passa a fazer parte da fatura do cartão.
              </p>
            </>
          )}
          {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={salvando || (forma === 'cartao' && cartoes.length === 0)}>
            {salvando ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : `Pagar ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
