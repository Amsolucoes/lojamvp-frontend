import { useState, useEffect } from 'react';
import { X, DollarSign, Users, ChevronDown, RotateCcw, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ResumoProfissional {
  profissionalId: string;
  profissionalNome: string;
  diaPagamentoPadrao: number | null;
  qtdAtendimentos: number;
  valorTotal: number;
}

interface ComissaoDetalhe {
  id: string;
  valorServico: number;
  comissaoPercentual: number;
  valorComissao: number;
  status: string;
  pagoEm: string | null;
  criadoEm: string;
  nomeServico: string | null;
  nomeCliente: string | null;
  dataAtendimento: string | null;
}

interface Fechamento {
  id: string;
  profissionalId: string;
  profissionalNome: string;
  periodoInicio: string;
  periodoFim: string;
  valorTotal: number;
  qtdAtendimentos: number;
  pagoEm: string;
}

interface Conta {
  id: string;
  nome: string;
}

interface ProfissionalFiltro {
  id: string;
  nome: string;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function hojeInput() {
  return new Date().toISOString().slice(0, 10);
}

function primeiroDiaMesInput() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function vencimentoSugerido(diaPagamentoPadrao: number | null) {
  const d = new Date();
  const dia = diaPagamentoPadrao && diaPagamentoPadrao >= 1 && diaPagamentoPadrao <= 28 ? diaPagamentoPadrao : d.getDate();
  const proximoMes = new Date(d.getFullYear(), d.getMonth() + 1, dia);
  return proximoMes.toISOString().slice(0, 10);
}

export function Comissoes() {
  const { sucesso, erro } = useToast();
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes');

  // Resumo (pendentes)
  const [resumo, setResumo] = useState<ResumoProfissional[]>([]);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [profissionaisFiltro, setProfissionaisFiltro] = useState<ProfissionalFiltro[]>([]);

  // Paginação — Pendentes
  const [paginaPendentes, setPaginaPendentes] = useState(1);
  const [itensPorPaginaPendentes, setItensPorPaginaPendentes] = useState(15);

  // Filtro + paginação — Histórico
  const [profissionalFiltroHistorico, setProfissionalFiltroHistorico] = useState('');
  const [periodoDeHistorico, setPeriodoDeHistorico] = useState('');
  const [periodoAteHistorico, setPeriodoAteHistorico] = useState('');
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [itensPorPaginaHistorico, setItensPorPaginaHistorico] = useState(15);

  // Detalhe do profissional
  const [modalDetalhe, setModalDetalhe] = useState<ResumoProfissional | null>(null);
  const [detalhes, setDetalhes] = useState<ComissaoDetalhe[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  // Fechar/pagar
  const [modalFechar, setModalFechar] = useState<ResumoProfissional | null>(null);
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaMesInput());
  const [periodoFim, setPeriodoFim] = useState(hojeInput());
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [vencimento, setVencimento] = useState(hojeInput());
  const [fechando, setFechando] = useState(false);

  // Histórico
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [confirmDesfazer, setConfirmDesfazer] = useState<Fechamento | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);

  function carregarResumo() {
    setLoadingResumo(true);
    api.get<ResumoProfissional[]>('/api/comissoes/resumo').then(setResumo).catch(() => {}).finally(() => setLoadingResumo(false));
  }

  function carregarHistorico() {
    setLoadingHistorico(true);
    api.get<Fechamento[]>('/api/comissoes/fechamentos').then(setFechamentos).catch(() => {}).finally(() => setLoadingHistorico(false));
  }

  useEffect(() => {
    carregarResumo();
    carregarHistorico();
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
    api.get<ProfissionalFiltro[]>('/api/funcionarios/ativos').then(setProfissionaisFiltro).catch(() => {});
  }, []);

  useEffect(() => {
    function aoReceberPullToRefresh() {
      carregarResumo();
      carregarHistorico();
    }
    window.addEventListener('pullToRefresh', aoReceberPullToRefresh);
    return () => window.removeEventListener('pullToRefresh', aoReceberPullToRefresh);
  }, []);

  useEffect(() => { setPaginaPendentes(1); }, [itensPorPaginaPendentes]);
  useEffect(() => { setPaginaHistorico(1); }, [profissionalFiltroHistorico, periodoDeHistorico, periodoAteHistorico, itensPorPaginaHistorico]);

  async function abrirDetalhe(p: ResumoProfissional) {
    setModalDetalhe(p);
    setLoadingDetalhe(true);
    try {
      const lista = await api.get<ComissaoDetalhe[]>(`/api/comissoes/profissional/${p.profissionalId}?status=pendente`);
      setDetalhes(lista);
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setLoadingDetalhe(false);
    }
  }

  function abrirFechar(p: ResumoProfissional) {
    setPeriodoInicio(primeiroDiaMesInput());
    setPeriodoFim(hojeInput());
    setContaBancariaId('');
    setVencimento(vencimentoSugerido(p.diaPagamentoPadrao));
    setModalFechar(p);
  }

  async function confirmarFechamento() {
    if (!modalFechar) return;
    setFechando(true);
    try {
      const res = await api.post<any>('/api/comissoes/fechar', {
        profissionalId: modalFechar.profissionalId,
        periodoInicio,
        periodoFim,
        contaBancariaId: contaBancariaId || null,
        vencimento: contaBancariaId ? vencimento : null,
      });
      sucesso(`Fechamento gerado: ${fmt(res.valorTotal)} para ${res.profissionalNome}.`);
      setModalFechar(null);
      carregarResumo();
      carregarHistorico();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setFechando(false);
    }
  }

  async function desfazer() {
    if (!confirmDesfazer) return;
    setDesfazendo(true);
    try {
      await api.post(`/api/comissoes/fechamentos/${confirmDesfazer.id}/desfazer`, {});
      sucesso('Fechamento desfeito. Comissões voltaram para pendente.');
      setConfirmDesfazer(null);
      carregarResumo();
      carregarHistorico();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setDesfazendo(false);
    }
  }

  const totalPendente = resumo.reduce((s, r) => s + r.valorTotal, 0);

  const totalPaginasPendentes = Math.max(1, Math.ceil(resumo.length / itensPorPaginaPendentes));
  const paginaAtualPendentes = Math.min(paginaPendentes, totalPaginasPendentes);
  const resumoPaginado = resumo.slice((paginaAtualPendentes - 1) * itensPorPaginaPendentes, paginaAtualPendentes * itensPorPaginaPendentes);

  const fechamentosFiltrados = fechamentos.filter(f => {
    const passaProfissional = !profissionalFiltroHistorico || f.profissionalId === profissionalFiltroHistorico;
    const passaDe = !periodoDeHistorico || f.periodoFim.slice(0, 10) >= periodoDeHistorico;
    const passaAte = !periodoAteHistorico || f.periodoInicio.slice(0, 10) <= periodoAteHistorico;
    return passaProfissional && passaDe && passaAte;
  });
  const totalPaginasHistorico = Math.max(1, Math.ceil(fechamentosFiltrados.length / itensPorPaginaHistorico));
  const paginaAtualHistorico = Math.min(paginaHistorico, totalPaginasHistorico);
  const fechamentosPaginados = fechamentosFiltrados.slice((paginaAtualHistorico - 1) * itensPorPaginaHistorico, paginaAtualHistorico * itensPorPaginaHistorico);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">Acompanhe e feche os pagamentos de comissão por profissional</p>
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${aba === 'pendentes' ? ' active' : ''}`} onClick={() => setAba('pendentes')}>Pendentes</button>
          <button className={`cat-tab${aba === 'historico' ? ' active' : ''}`} onClick={() => setAba('historico')}>Histórico</button>
        </div>
      </div>

      {/* ── ABA PENDENTES ── */}
      {aba === 'pendentes' && (
        <>
          {!loadingResumo && resumo.length > 0 && (
            <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <DollarSign size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 14 }}>
                Total pendente de todos os profissionais: <strong>{fmt(totalPendente)}</strong>
              </span>
            </div>
          )}

          {loadingResumo ? (
            <div className="card"><div className="empty"><div className="spinner" /></div></div>
          ) : resumo.length === 0 ? (
            <div className="card">
              <div className="empty">
                <Users size={36} />
                <p>Nenhuma comissão pendente no momento.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumoPaginado.map(r => (
                <div key={r.profissionalId} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{r.profissionalNome}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                        {r.qtdAtendimentos} atendimento(s) · <strong style={{ color: 'var(--text-1)' }}>{fmt(r.valorTotal)}</strong> pendente(s)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => abrirDetalhe(r)}>
                        <ChevronDown size={13} style={{ verticalAlign: -2 }} /> Ver detalhes
                      </button>
                      <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => abrirFechar(r)}>
                        <DollarSign size={13} style={{ verticalAlign: -2 }} /> Fechar e pagar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingResumo && resumo.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <select value={itensPorPaginaPendentes} onChange={e => setItensPorPaginaPendentes(parseInt(e.target.value))} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}>
                <option value={15}>15 por página</option>
                <option value={30}>30 por página</option>
                <option value={50}>50 por página</option>
              </select>
              {totalPaginasPendentes > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn-secondary" disabled={paginaAtualPendentes <= 1} onClick={() => setPaginaPendentes(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtualPendentes} / {totalPaginasPendentes}</span>
                  <button className="btn-secondary" disabled={paginaAtualPendentes >= totalPaginasPendentes} onClick={() => setPaginaPendentes(p => Math.min(totalPaginasPendentes, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── ABA HISTÓRICO ── */}
      {aba === 'historico' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={profissionalFiltroHistorico} onChange={e => setProfissionalFiltroHistorico(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
              <option value="">Todos os profissionais</option>
              {profissionaisFiltro.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input type="date" value={periodoDeHistorico} onChange={e => setPeriodoDeHistorico(e.target.value)} style={{ width: 'auto' }} />
            <span style={{ color: 'var(--text-3)' }}>até</span>
            <input type="date" value={periodoAteHistorico} onChange={e => setPeriodoAteHistorico(e.target.value)} style={{ width: 'auto' }} />
            {(profissionalFiltroHistorico || periodoDeHistorico || periodoAteHistorico) && (
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setProfissionalFiltroHistorico(''); setPeriodoDeHistorico(''); setPeriodoAteHistorico(''); }}>
                Limpar filtros
              </button>
            )}
          </div>

          {loadingHistorico ? (
            <div className="card"><div className="empty"><div className="spinner" /></div></div>
          ) : fechamentos.length === 0 ? (
            <div className="card">
              <div className="empty">
                <Calendar size={36} />
                <p>Nenhum fechamento de comissão registrado ainda.</p>
              </div>
            </div>
          ) : fechamentosFiltrados.length === 0 ? (
            <div className="card">
              <div className="empty">
                <Calendar size={36} />
                <p>Nenhum fechamento encontrado com esse filtro.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fechamentosPaginados.map(f => (
                <div key={f.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{f.profissionalNome}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                        Período {fmtData(f.periodoInicio)} — {fmtData(f.periodoFim)} · {f.qtdAtendimentos} atendimento(s)
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        Pago em {fmtData(f.pagoEm)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(f.valorTotal)}</span>
                      <button className="btn-ghost" title="Desfazer fechamento" style={{ color: 'var(--red)' }} onClick={() => setConfirmDesfazer(f)}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
               </div>
              ))}
            </div>
          )}

          {!loadingHistorico && fechamentosFiltrados.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <select value={itensPorPaginaHistorico} onChange={e => setItensPorPaginaHistorico(parseInt(e.target.value))} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}>
                <option value={15}>15 por página</option>
                <option value={30}>30 por página</option>
                <option value={50}>50 por página</option>
              </select>
              {totalPaginasHistorico > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn-secondary" disabled={paginaAtualHistorico <= 1} onClick={() => setPaginaHistorico(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtualHistorico} / {totalPaginasHistorico}</span>
                  <button className="btn-secondary" disabled={paginaAtualHistorico >= totalPaginasHistorico} onClick={() => setPaginaHistorico(p => Math.min(totalPaginasHistorico, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal detalhe */}
      {modalDetalhe && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalDetalhe(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Comissões pendentes — {modalDetalhe.profissionalNome}</h2>
              <button className="btn-ghost" onClick={() => setModalDetalhe(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {loadingDetalhe ? (
                <div className="empty"><div className="spinner" /></div>
              ) : detalhes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma comissão pendente.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detalhes.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{d.nomeServico ?? 'Serviço'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {d.nomeCliente || 'Sem cliente'} · {d.dataAtendimento ? fmtData(d.dataAtendimento) : '—'} · {d.comissaoPercentual}% de {fmt(d.valorServico)}
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0, marginLeft: 8 }}>{fmt(d.valorComissao)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fechar/pagar */}
      {modalFechar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalFechar(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Fechar comissão — {modalFechar.profissionalNome}</h2>
              <button className="btn-ghost" onClick={() => setModalFechar(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Isso vai marcar como pagas todas as comissões pendentes deste profissional dentro do período escolhido.
              </p>
              <div className="agenda-form-row" style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">De</label>
                  <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Até</label>
                  <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Lançar como conta a pagar no Financeiro <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                <select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)}>
                  <option value="">Não lançar no Financeiro</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {contaBancariaId && (
                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Vencimento no Financeiro</label>
                  <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalFechar(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarFechamento} disabled={fechando}>
                {fechando ? 'Fechando...' : 'Confirmar e marcar como pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar desfazer */}
      {confirmDesfazer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDesfazer(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Desfazer fechamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmDesfazer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Desfazer o fechamento de <strong style={{ color: 'var(--text-1)' }}>{confirmDesfazer.profissionalNome}</strong> no valor de <strong style={{ color: 'var(--text-1)' }}>{fmt(confirmDesfazer.valorTotal)}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                As comissões desse período voltarão para "pendente" e poderão ser fechadas novamente depois.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDesfazer(null)}>Cancelar</button>
              <button className="btn-danger" onClick={desfazer} disabled={desfazendo}>
                {desfazendo ? 'Desfazendo...' : 'Desfazer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}