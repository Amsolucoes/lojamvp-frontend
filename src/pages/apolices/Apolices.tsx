import { useState, useEffect } from 'react';
import { Plus, X, Trash2, AlertTriangle, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import './Apolices.css';

interface Apolice {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  seguradoraNome: string;
  nomePlano: string;
  numeroApolice: string | null;
  valorPremio: number;
  valorComissao: number;
  percentualComissao: number | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: string;
  diasParaVencer: number;
}

interface Cliente { id: string; nome: string; telefone: string; }
interface Seguradora { id: string; nome: string; }
interface Conta { id: string; nome: string; ativa: boolean; }

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDataUTC(iso: string) {
  if (!iso) return '';
  const [datePart] = iso.split('T');
  const [ano, mes, dia] = datePart.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function Apolices() {
  const { sucesso, erro } = useToast();
  const { temFinanceiro } = useApp();

  const [apolices, setApolices] = useState<Apolice[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'vencida' | 'renovada' | 'cancelada'>('todas');
  const [buscaTexto, setBuscaTexto] = useState('');

  const [modalNova, setModalNova] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [showBuscaCliente, setShowBuscaCliente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    clienteId: '', clienteNome: '', seguradoraId: '', nomePlano: '', numeroApolice: '',
    valorPremio: '', valorComissao: '', percentualComissao: '',
    vigenciaInicio: new Date().toISOString().slice(0, 10),
    vigenciaFim: '', contaBancariaId: '', gerarNoFinanceiro: true,
  });

  const [confirmExcluir, setConfirmExcluir] = useState<Apolice | null>(null);

  function carregar() {
    api.get<Apolice[]>('/api/corretora/apolices').then(setApolices).catch(() => {});
  }

  useEffect(() => {
    carregar();
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    api.get<Seguradora[]>('/api/corretora/seguradoras').then(setSeguradoras).catch(() => {});
    if (temFinanceiro) {
      api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
    }
  }, []);

  function abrirNova() {
    setForm({
      clienteId: '', clienteNome: '', seguradoraId: '', nomePlano: '', numeroApolice: '',
      valorPremio: '', valorComissao: '', percentualComissao: '',
      vigenciaInicio: new Date().toISOString().slice(0, 10),
      vigenciaFim: '', contaBancariaId: contas.find(c => c.ativa)?.id ?? '', gerarNoFinanceiro: temFinanceiro,
    });
    setBuscaCliente('');
    setModalNova(true);
  }

  function calcularComissaoPorPercentual(valorPremio: string, percentual: string) {
    const premio = parseFloat(valorPremio) || 0;
    const pct = parseFloat(percentual) || 0;
    if (pct > 0) return ((premio * pct) / 100).toFixed(2);
    return '';
  }

  async function salvar() {
    if (!form.clienteId) { erro('Selecione um cliente.'); return; }
    if (!form.seguradoraId) { erro('Selecione a seguradora.'); return; }
    if (!form.nomePlano.trim()) { erro('Informe o nome do plano.'); return; }
    if (!form.vigenciaFim) { erro('Informe o fim da vigência.'); return; }
    setSalvando(true);
    try {
      await api.post('/api/corretora/apolices', {
        clienteId: form.clienteId,
        oportunidadeId: null,
        seguradoraId: form.seguradoraId,
        nomePlano: form.nomePlano.trim(),
        numeroApolice: form.numeroApolice || null,
        valorPremio: parseFloat(form.valorPremio) || 0,
        valorComissao: parseFloat(form.valorComissao) || 0,
        percentualComissao: form.percentualComissao ? parseFloat(form.percentualComissao) : null,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim,
        contaBancariaId: form.gerarNoFinanceiro ? (form.contaBancariaId || null) : null,
        gerarNoFinanceiro: form.gerarNoFinanceiro && !!form.contaBancariaId,
      });
      setModalNova(false);
      carregar();
      sucesso('Apólice registrada!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(ap: Apolice, novoStatus: string) {
    try {
      await api.patch(`/api/corretora/apolices/${ap.id}/status`, { nome: novoStatus });
      carregar();
      sucesso('Status atualizado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const clientesFiltrados = clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()));

  const apolicesFiltradas = apolices.filter(a => {
    const statusOk = filtroStatus === 'todas' || a.status === filtroStatus;
    const textoOk = !buscaTexto || a.clienteNome.toLowerCase().includes(buscaTexto.toLowerCase()) || a.nomePlano.toLowerCase().includes(buscaTexto.toLowerCase());
    return statusOk && textoOk;
  });

  const vencendoEm30 = apolices.filter(a => a.status === 'ativa' && a.diasParaVencer <= 30 && a.diasParaVencer >= 0);
  const totalPremiosAtivos = apolices.filter(a => a.status === 'ativa').reduce((s, a) => s + a.valorPremio, 0);
  const totalComissoesAtivas = apolices.filter(a => a.status === 'ativa').reduce((s, a) => s + a.valorComissao, 0);

  function badgeStatus(a: Apolice) {
    if (a.status === 'cancelada') return <span className="badge badge-red">Cancelada</span>;
    if (a.status === 'renovada') return <span className="badge badge-accent">Renovada</span>;
    if (a.status === 'vencida' || (a.status === 'ativa' && a.diasParaVencer < 0)) return <span className="badge badge-red">Vencida</span>;
    if (a.diasParaVencer <= 30) return <span className="badge badge-yellow">Vence em {a.diasParaVencer}d</span>;
    return <span className="badge badge-green">Ativa</span>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Apólices</h1>
          <p className="page-subtitle">Vigência dos planos vendidos</p>
        </div>
        <button className="btn-primary" onClick={abrirNova}><Plus size={15} /> Nova apólice</button>
      </div>

      <div className="apolices-stats">
        <div className="stat-card">
          <div className="stat-label">Apólices ativas</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{apolices.filter(a => a.status === 'ativa').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total em prêmios</div>
          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 20 }}>{fmt(totalPremiosAtivos)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total em comissões</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: 20 }}>{fmt(totalComissoesAtivas)}</div>
        </div>
        {vencendoEm30.length > 0 && (
          <div className="stat-card" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
            <div className="stat-label"><AlertTriangle size={12} style={{ verticalAlign: -1 }} /> Vencendo em 30 dias</div>
            <div className="stat-value" style={{ color: 'var(--yellow, #d97706)', fontSize: 20 }}>{vencendoEm30.length}</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar por cliente ou plano..." value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="todas">Todos os status</option>
          <option value="ativa">Ativas</option>
          <option value="vencida">Vencidas</option>
          <option value="renovada">Renovadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      {apolicesFiltradas.length === 0 ? (
        <div className="card"><div className="empty"><p>Nenhuma apólice encontrada.</p></div></div>
      ) : (
        <>
          <div className="table-wrap apolices-desktop">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Seguradora / Plano</th><th>Prêmio</th><th>Comissão</th><th>Vigência</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {apolicesFiltradas.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.clienteNome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.clienteTelefone}</div>
                    </td>
                    <td>
                      <div>{a.seguradoraNome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.nomePlano}{a.numeroApolice ? ` · Nº ${a.numeroApolice}` : ''}</div>
                    </td>
                    <td>{fmt(a.valorPremio)}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(a.valorComissao)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDataUTC(a.vigenciaInicio)} — {fmtDataUTC(a.vigenciaFim)}</td>
                    <td>{badgeStatus(a)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {a.status === 'ativa' && (
                          <>
                            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => alterarStatus(a, 'renovada')}>Renovar</button>
                            <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => alterarStatus(a, 'cancelada')}>Cancelar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="apolices-cards-mobile">
            {apolicesFiltradas.map(a => (
              <div key={a.id} className="apolice-card-mobile">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.seguradoraNome} · {a.nomePlano}</div>
                  </div>
                  {badgeStatus(a)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                  <span>Prêmio: {fmt(a.valorPremio)}</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>Comissão: {fmt(a.valorComissao)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{fmtDataUTC(a.vigenciaInicio)} — {fmtDataUTC(a.vigenciaFim)}</div>
                {a.status === 'ativa' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn-secondary" style={{ fontSize: 12, flex: 1 }} onClick={() => alterarStatus(a, 'renovada')}>Renovar</button>
                    <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => alterarStatus(a, 'cancelada')}>Cancelar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal nova apólice */}
      {modalNova && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNova(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Nova apólice</h2>
              <button className="btn-ghost" onClick={() => setModalNova(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Cliente *</label>
                  {form.clienteId ? (
                    <div className="cx-cliente-sel">
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{form.clienteNome}</div>
                      <button className="btn-ghost" onClick={() => setForm(f => ({ ...f, clienteId: '', clienteNome: '' }))}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <input placeholder="Buscar cliente..." value={buscaCliente}
                        onChange={e => { setBuscaCliente(e.target.value); setShowBuscaCliente(true); }}
                        onFocus={() => setShowBuscaCliente(true)}
                        onBlur={() => setTimeout(() => setShowBuscaCliente(false), 150)} />
                      {showBuscaCliente && buscaCliente && (
                        <div className="cx-dropdown">
                          {clientesFiltrados.length === 0 ? (
                            <div className="cx-dropdown-empty">Nenhum cliente encontrado</div>
                          ) : clientesFiltrados.slice(0, 6).map(c => (
                            <button key={c.id} className="cx-dropdown-item" onMouseDown={() => { setForm(f => ({ ...f, clienteId: c.id, clienteNome: c.nome })); setBuscaCliente(''); }}>
                              <div className="cx-drop-nome">{c.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Seguradora *</label>
                    <select value={form.seguradoraId} onChange={e => setForm(f => ({ ...f, seguradoraId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nº da apólice</label>
                    <input value={form.numeroApolice} onChange={e => setForm(f => ({ ...f, numeroApolice: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nome do plano *</label>
                  <input value={form.nomePlano} onChange={e => setForm(f => ({ ...f, nomePlano: e.target.value }))} placeholder="Ex: Plano Familiar Premium" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor do prêmio (R$) *</label>
                    <input type="number" min={0} step={0.01} value={form.valorPremio}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => ({ ...f, valorPremio: v, valorComissao: f.percentualComissao ? calcularComissaoPorPercentual(v, f.percentualComissao) : f.valorComissao }));
                      }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">% comissão <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input type="number" min={0} step={0.01} value={form.percentualComissao}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => ({ ...f, percentualComissao: v, valorComissao: calcularComissaoPorPercentual(f.valorPremio, v) || f.valorComissao }));
                      }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Valor da comissão (R$) *</label>
                  <input type="number" min={0} step={0.01} value={form.valorComissao} onChange={e => setForm(f => ({ ...f, valorComissao: e.target.value }))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Início da vigência *</label>
                    <input type="date" value={form.vigenciaInicio} onChange={e => setForm(f => ({ ...f, vigenciaInicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fim da vigência *</label>
                    <input type="date" value={form.vigenciaFim} onChange={e => setForm(f => ({ ...f, vigenciaFim: e.target.value }))} />
                  </div>
                </div>

                {temFinanceiro && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.gerarNoFinanceiro} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setForm(f => ({ ...f, gerarNoFinanceiro: e.target.checked }))} />
                      Gerar comissão como "a receber" no Financeiro
                    </label>
                    {form.gerarNoFinanceiro && (
                      <div className="form-group">
                        <label className="form-label">Conta de recebimento</label>
                        <select value={form.contaBancariaId} onChange={e => setForm(f => ({ ...f, contaBancariaId: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNova(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Registrar apólice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}