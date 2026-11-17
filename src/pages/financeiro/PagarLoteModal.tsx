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
  contaBancariaId?: string | null;   // conta do lançamento: vira a sugestão quando se paga uma conta só
}

interface Conta { id: string; nome: string; ativa: boolean; }
interface Cartao { id: string; nome: string; ativo: boolean; bandeira?: string | null; }

export const FORMAS_PAGAMENTO: { v: string; t: string }[] = [
  { v: 'pix', t: 'Pix' }, { v: 'boleto', t: 'Boleto' }, { v: 'debito', t: 'Débito' },
  { v: 'dinheiro', t: 'Dinheiro' }, { v: 'transferencia', t: 'Transferência' }, { v: 'outro', t: 'Outro' },
];
export const rotuloForma = (v?: string | null) => FORMAS_PAGAMENTO.find(f => f.v === v)?.t ?? '';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Data de hoje no fuso local (yyyy-MM-dd). toISOString() usaria UTC e viraria o dia depois das 20h em MS.
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Pagar uma ou várias contas: no débito (saindo de uma conta) ou no cartão de crédito (à vista ou parcelado).
// `permitirCartao=false` esconde a opção de cartão (ex.: parcela ou conta fixa, que não devem sair da série).
export function PagarLoteModal({ itens, contas, onClose, onConcluido, permitirCartao = true }: {
  itens: ItemLote[];
  contas: Conta[];
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
  permitirCartao?: boolean;
}) {
  const contasAtivas = contas.filter(c => c.ativa);
  const [forma, setForma] = useState<'conta' | 'cartao'>('conta');
  const contaDoItem = itens.length === 1 ? contasAtivas.find(c => c.id === itens[0].contaBancariaId)?.id : undefined;
  const [contaId, setContaId] = useState(contaDoItem ?? contasAtivas[0]?.id ?? '');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cartaoId, setCartaoId] = useState('');
  const [tipoCartao, setTipoCartao] = useState<'vista' | 'parcelado'>('vista');
  const [parcelas, setParcelas] = useState(2);
  const [data, setData] = useState(hojeLocal);
  const [dividir, setDividir] = useState(false);   // pagar uma conta saindo de mais de uma conta bancária
  const [partes, setPartes] = useState<{ contaId: string; valor: string }[]>([]);
  const [formaPag, setFormaPag] = useState('');   // como pagou (opcional, só pagando pela conta)
  const [juros, setJuros] = useState('');   // juros/multa/taxa pagos além do valor da conta (texto digitado)
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
  const acrescimo = Math.max(0, Number(juros.replace(',', '.')) || 0);
  const podeDividir = forma === 'conta' && itens.length === 1 && permitirCartao && contasAtivas.length > 1;
  const dividindo = podeDividir && dividir;
  const somaPartes = partes.reduce((s, p) => s + (Number(p.valor.replace(',', '.')) || 0), 0);
  const diferenca = Math.round((total - somaPartes) * 100) / 100;
  const nParcelas = forma === 'cartao' && tipoCartao === 'parcelado' ? parcelas : 1;

  function ativarDivisao(ligar: boolean) {
    setDividir(ligar);
    if (ligar && partes.length === 0) {
      const outra = contasAtivas.find(c => c.id !== contaId)?.id ?? '';
      setPartes([{ contaId, valor: '' }, { contaId: outra, valor: '' }]);
    }
  }
  const mudarParte = (i: number, campo: 'contaId' | 'valor', v: string) =>
    setPartes(ps => ps.map((p, k) => k === i ? { ...p, [campo]: v } : p));

  async function confirmar() {
    setErro('');
    if (dividindo) {
      if (partes.some(p => !p.contaId)) { setErro('Escolha a conta de cada parte.'); return; }
      if (partes.some(p => !(Number(p.valor.replace(',', '.')) > 0))) { setErro('Informe o valor de cada parte.'); return; }
      if (diferenca !== 0) { setErro(`A soma das partes deve ser ${fmt(total)} (${diferenca > 0 ? 'faltam' : 'sobram'} ${fmt(Math.abs(diferenca))}).`); return; }
    }
    if (forma === 'conta' && !contaId) { setErro('Escolha a conta de onde sai o pagamento.'); return; }
    if (forma === 'cartao' && !cartaoId) { setErro('Escolha o cartão de crédito.'); return; }
    if (!data) { setErro('Informe a data.'); return; }
    if (juros.trim() && !(Number(juros.replace(',', '.')) >= 0)) { setErro('Informe um valor válido para juros/multa.'); return; }
    setSalvando(true);
    try {
      await api.post('/api/financeiro/lancamentos/pagar-lote', {
        ids: itens.map(i => i.id),
        forma,
        contaBancariaId: forma === 'conta' && !dividindo ? contaId : null,
        ...(dividindo ? { divisoes: partes.map(p => ({ contaBancariaId: p.contaId, valor: Number(p.valor.replace(',', '.')) })) } : {}),
        cartaoId: forma === 'cartao' ? cartaoId : null,
        parcelas: nParcelas,
        data,
        ...(acrescimo > 0 ? { acrescimo } : {}),
        ...(forma === 'conta' && formaPag ? { formaPagamento: formaPag } : {}),
      });
      const qtd = itens.length;
      const extra = acrescimo > 0 ? ` + ${fmt(acrescimo)} de juros` : '';
      onConcluido(forma === 'conta'
        ? (qtd === 1 ? `Conta paga: ${fmt(total)}` : `${qtd} conta(s) paga(s): ${fmt(total)}`) + extra
        : `${qtd} conta(s) lançada(s) no cartão${nParcelas > 1 ? ` em ${nParcelas}x` : ' à vista'}: ${fmt(total)}${extra}`);
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{itens.length === 1 ? 'Pagar conta' : `Pagar ${itens.length} contas`}</h2>
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
              {permitirCartao && botaoForma('cartao', <CreditCard size={14} />, 'Cartão de crédito')}
            </div>
            {!permitirCartao && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Parcelas e contas fixas são pagas pela conta, para não quebrar a série. Para lançar no cartão, use Financeiro → Cartões.
              </p>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">{forma === 'cartao' ? 'Data da compra' : 'Data do pagamento'}</label>
            <input type="date" value={data} max={hojeLocal()} onChange={e => setData(e.target.value)} />
          </div>

          {forma === 'conta' ? (
            dividindo ? (
              <div className="form-group">
                <label className="form-label">Dividir entre as contas</label>
                {partes.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select value={p.contaId} onChange={e => mudarParte(i, 'contaId', e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                      <option value="">Conta...</option>
                      {contasAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={p.valor}
                      onChange={e => mudarParte(i, 'valor', e.target.value)} style={{ width: 110, flexShrink: 0 }} />
                    {partes.length > 2 && (
                      <button type="button" className="btn-ghost" onClick={() => setPartes(ps => ps.filter((_, k) => k !== i))}><X size={14} /></button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  {partes.length < 5
                    ? <button type="button" className="btn-secondary" onClick={() => setPartes(ps => [...ps, { contaId: '', valor: '' }])}>+ Adicionar conta</button>
                    : <span />}
                  <span style={{ color: diferenca === 0 ? 'var(--green)' : 'var(--text-2)' }}>
                    {diferenca === 0 ? 'Soma confere' : diferenca > 0 ? `Faltam ${fmt(diferenca)}` : `Sobram ${fmt(-diferenca)}`}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                  A conta é registrada em partes, cada uma paga pela sua conta bancária. Se houver juros, ele sai da primeira conta.
                </p>
                <button type="button" className="btn-ghost" style={{ marginTop: 4, fontSize: 12 }} onClick={() => ativarDivisao(false)}>Pagar com uma conta só</button>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Pagar com a conta</label>
                <select value={contaId} onChange={e => setContaId(e.target.value)}>
                  {contasAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>As contas são marcadas como pagas e o valor sai desta conta.</p>
                {podeDividir && (
                  <button type="button" className="btn-ghost" style={{ marginTop: 4, fontSize: 12 }} onClick={() => ativarDivisao(true)}>Dividir em mais de uma conta</button>
                )}
              </div>
            )
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
          {forma === 'conta' && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Forma de pagamento (opcional)</label>
              <select value={formaPag} onChange={e => setFormaPag(e.target.value)}>
                <option value="">Não informar</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f.v} value={f.v}>{f.t}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Juros / multa / taxa (opcional)</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={juros} onChange={e => setJuros(e.target.value)} />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Se pagou a mais que o valor da conta, informe a diferença: ela é lançada à parte na categoria "Juros"{forma === 'cartao' ? ', como compra à vista no cartão' : ''}.
            </p>
          </div>
          {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={salvando || (forma === 'cartao' && cartoes.length === 0)}>
            {salvando ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : `Pagar ${fmt(total + acrescimo)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
