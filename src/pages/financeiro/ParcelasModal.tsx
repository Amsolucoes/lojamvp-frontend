import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Trash2, Check, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';

interface Parcela { id: string; numero: number | null; vencimento: string; valor: number; status: string; pagoEm: string | null; }

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Gerencia as parcelas de um lançamento parcelado (empréstimo, financiamento...): mudar o total, excluir
// parcelas e marcar quais já foram pagas.
export function ParcelasModal({ lancamentoId, titulo, onClose, onAlterado }: {
  lancamentoId: string;
  titulo: string;
  onClose: () => void;
  onAlterado: (mensagem: string) => void;
}) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [totalInput, setTotalInput] = useState('');
  const [ultimasN, setUltimasN] = useState('4');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    setCarregando(true);
    try {
      const r = await api.get<{ total: number; itens: Parcela[] }>(`/api/financeiro/lancamentos/${lancamentoId}/parcelas`);
      setParcelas(r.itens);
      setTotalInput(String(r.total));
      setSelecionadas(new Set());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, [lancamentoId]);

  const pagas = parcelas.filter(p => p.status === 'pago').length;
  const pendentes = parcelas.length - pagas;
  const selecionadasLista = useMemo(() => parcelas.filter(p => selecionadas.has(p.id)), [parcelas, selecionadas]);
  const selPendentes = selecionadasLista.filter(p => p.status !== 'pago');
  const selPagas = selecionadasLista.filter(p => p.status === 'pago');
  const totalSel = selecionadasLista.reduce((s, p) => s + p.valor, 0);

  function alternar(id: string) {
    setConfirmaExcluir(false);
    setSelecionadas(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function selecionarUltimas() {
    const n = Math.max(1, parseInt(ultimasN) || 0);
    setConfirmaExcluir(false);
    setSelecionadas(new Set(parcelas.slice(-n).map(p => p.id)));
  }

  async function executar(chave: string, fn: () => Promise<string>) {
    setOcupado(chave); setErro(''); setMensagem('');
    try {
      const msg = await fn();
      setMensagem(msg);
      setConfirmaExcluir(false);
      await carregar();
      onAlterado(msg);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const base = `/api/financeiro/lancamentos/${lancamentoId}/parcelas`;
  const aplicarTotal = () => executar('total', async () => {
    const t = parseInt(totalInput);
    if (!t || t < 1) throw new Error('Informe um total de parcelas válido.');
    await api.post(`${base}/total`, { total: t });
    return `Total de parcelas alterado para ${t}.`;
  });
  const excluir = () => executar('excluir', async () => {
    await api.post(`${base}/excluir`, { ids: selPendentes.map(p => p.id) });
    return `${selPendentes.length} parcela(s) excluída(s).`;
  });
  const marcar = (pago: boolean) => executar(pago ? 'pagar' : 'desfazer', async () => {
    const alvo = pago ? selPendentes : selPagas;
    await api.post(`${base}/pagamento`, { ids: alvo.map(p => p.id), pago });
    return pago ? `${alvo.length} parcela(s) marcada(s) como paga(s).` : `${alvo.length} parcela(s) voltaram para pendente.`;
  });

  const botao = (chave: string, texto: React.ReactNode, onClick: () => void, desabilitado: boolean, classe = 'btn-secondary') => (
    <button className={classe} disabled={desabilitado || ocupado !== null} onClick={onClick} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {ocupado === chave ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : texto}
    </button>
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }} onClick={e => e.target === e.currentTarget && ocupado === null && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Parcelas — {titulo}</h2>
          <button className="btn-ghost" onClick={onClose} disabled={ocupado !== null}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {carregando && parcelas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>Carregando parcelas...</p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                {parcelas.length} parcela(s) · <strong style={{ color: 'var(--text-2)' }}>{pagas}</strong> paga(s) · <strong style={{ color: 'var(--text-2)' }}>{pendentes}</strong> pendente(s)
              </p>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Total de parcelas</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min={1} max={360} value={totalInput} onChange={e => setTotalInput(e.target.value)} style={{ maxWidth: 110 }} />
                  {botao('total', 'Aplicar', aplicarTotal, parseInt(totalInput) === parcelas.length, 'btn-primary')}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
                  Diminuir remove as últimas parcelas (que ainda estejam pendentes); aumentar acrescenta parcelas no fim, mês a mês, com o mesmo valor.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>Selecionar as últimas</span>
                <input type="number" min={1} value={ultimasN} onChange={e => setUltimasN(e.target.value)} style={{ width: 64, padding: '4px 8px' }} />
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={selecionarUltimas}>Selecionar</button>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setConfirmaExcluir(false); setSelecionadas(new Set(parcelas.filter(p => p.status !== 'pago').map(p => p.id))); }}>Todas pendentes</button>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setConfirmaExcluir(false); setSelecionadas(new Set()); }}>Limpar</button>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {parcelas.map((p, i) => (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                    borderTop: i ? '1px solid var(--border)' : 'none', background: selecionadas.has(p.id) ? 'var(--accent-bg)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={selecionadas.has(p.id)} onChange={() => alternar(p.id)} style={{ width: 16, height: 16, margin: 0 }} />
                    <span style={{ minWidth: 54, fontWeight: 500 }}>{p.numero}/{parcelas.length}</span>
                    <span style={{ flex: 1, color: 'var(--text-2)' }}>{new Date(p.vencimento).toLocaleDateString('pt-BR')}</span>
                    <span>{fmt(p.valor)}</span>
                    <span className={`badge ${p.status === 'pago' ? 'badge-neutro' : 'badge-yellow'}`} style={{ fontSize: 10, minWidth: 54, textAlign: 'center' }}>{p.status === 'pago' ? 'Paga' : 'Pendente'}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 2px 10px', fontSize: 12, color: 'var(--text-2)' }}>
                <span>{selecionadasLista.length} selecionada(s)</span>
                <span>{fmt(totalSel)}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {botao('pagar', <><Check size={13} /> Marcar como pagas</>, () => marcar(true), selPendentes.length === 0)}
                {botao('desfazer', <><RotateCcw size={13} /> Desmarcar pagamento</>, () => marcar(false), selPagas.length === 0)}
                {!confirmaExcluir
                  ? botao('excluir-pedir', <><Trash2 size={13} /> Excluir selecionadas</>, () => setConfirmaExcluir(true), selPendentes.length === 0, 'btn-secondary')
                  : (
                    <>
                      {botao('excluir', <>Confirmar exclusão de {selPendentes.length}</>, excluir, false, 'btn-danger')}
                      <button className="btn-ghost" style={{ fontSize: 12 }} disabled={ocupado !== null} onClick={() => setConfirmaExcluir(false)}>Cancelar</button>
                    </>
                  )}
              </div>
              {selPagas.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                  {selPagas.length} parcela(s) paga(s) selecionada(s): elas não são excluídas; use "Desmarcar pagamento" se quiser voltá-las para pendente.
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
                Dica: pagou as últimas parcelas por fora? Selecione-as e escolha <strong>Marcar como pagas</strong> para manter o total original, ou <strong>Excluir selecionadas</strong> (ou diminua o total) para reduzir o número de parcelas.
              </p>
              {mensagem && <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 8 }}>{mensagem}</p>}
              {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{erro}</p>}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={ocupado !== null}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
