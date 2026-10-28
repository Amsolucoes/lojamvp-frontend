import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, CreditCard, Users, Check, Power, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import './Planos.css';

interface Plano {
  id: string;
  nome: string;
  valor: number;
  servicosIds: string | null;
  ativo: boolean;
  limiteUsosMes: number | null;
  diasSemanaPermitidos: string | null; // "1,2,3,4,5" (0 = domingo ... 6 = sábado); nulo = todos
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function textoRegrasPlano(p: { limiteUsosMes: number | null; diasSemanaPermitidos: string | null }) {
  const partes: string[] = [];
  if (p.limiteUsosMes) partes.push(`até ${p.limiteUsosMes} uso(s)/mês`);
  const dias = (p.diasSemanaPermitidos ?? '').split(',').filter(Boolean).map(Number);
  if (dias.length > 0 && dias.length < 7) {
    const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    partes.push(seguidos && dias.length > 2 ? `${DIAS_SEMANA[dias[0]]} a ${DIAS_SEMANA[dias[dias.length - 1]]}` : dias.map(d => DIAS_SEMANA[d]).join(', '));
  }
  return partes.join(' · ');
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
}

interface Assinante {
  assinaturaId: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  planoId: string;
  planoNome: string;
  valor: number;
  diaVencimento: number;
  pagoNoMes: boolean;
  mesesEmAtraso: number; 
  valorTotalAtraso: number;
  totalConsumos: number;
  usosNoMes?: number;
  limiteUsosMes?: number | null;
  diasSemanaPermitidos?: string | null;
}

interface PagamentoHistorico {
  id: string;
  mesReferencia: string;
  valor: number;
  valorPago?: number | null;
  status: string;
  pagoEm: string | null;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function rotuloMes(iso: string) {
  const d = new Date(iso);
  return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

interface ConsumoServico {
  id: string;
  servicoId: string;
  nomeServico: string;
  criadoEm: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Planos() {
  const { clientes, recarregar, temTurmas, temProdutos, temServicos } = useApp();
  const ehTurma = temTurmas && !temProdutos && !temServicos;
  const placeholderPlano = ehTurma ? 'Ex: Pilates 2x por semana' : 'Ex: Cabelo + Barba';
  const [aba, setAbaState] = useState<'planos' | 'assinantes'>(() => {
    try { return sessionStorage.getItem('loja:planos-aba') === 'assinantes' ? 'assinantes' : 'planos'; } catch { return 'planos'; }
  });
  function setAba(a: 'planos' | 'assinantes') {
    setAbaState(a);
    try { sessionStorage.setItem('loja:planos-aba', a); } catch { /* sem armazenamento */ }
  }

  const [planos, setPlanos] = useState<Plano[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Modal de plano
  const [modalPlano, setModalPlano] = useState<'novo' | 'editar' | null>(null);
  const [planoEdit, setPlanoEdit] = useState<Plano | null>(null);
  const [formPlano, setFormPlano] = useState({ nome: '', valor: '', servicosIds: [] as string[], limiteUsosMes: '', diasSemana: [] as number[] });

  // Modal de vincular assinante
  const [modalAssinante, setModalAssinante] = useState(false);
  const [formAssinante, setFormAssinante] = useState({ clienteId: '', planoId: '', diaVencimento: '10' });
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [assinanteEditando, setAssinanteEditando] = useState<Assinante | null>(null);
  const [confirmExcluirPlano, setConfirmExcluirPlano] = useState<Plano | null>(null);
  const [confirmCancelarAssinante, setConfirmCancelarAssinante] = useState<Assinante | null>(null);
  const [buscaAssinante, setBuscaAssinante] = useState('');
  const [filtroAssinante, setFiltroAssinante] = useState<'todos' | 'pago' | 'pendente' | 'atraso' | 'naoIniciou'>('todos');

  const [historicoAssinante, setHistoricoAssinante] = useState<Assinante | null>(null);
  const [historico, setHistorico] = useState<PagamentoHistorico[]>([]);

  const [consumos, setConsumos] = useState<ConsumoServico[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const [pls, svs, ass] = await Promise.all([
        api.get<Plano[]>('/api/planos'),
        api.get<Servico[]>('/api/servicos'),
        api.get<Assinante[]>('/api/planos/assinantes'),
      ]);
      setPlanos(pls);
      setServicos(svs);
      setAssinantes(ass);
    } catch (e) {
      showToast('Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  // ── Planos ──────────────────────────────────────────────────────
  function abrirNovoPlano() {
    setFormPlano({ nome: '', valor: '', servicosIds: [], limiteUsosMes: '', diasSemana: [] });
    setPlanoEdit(null);
    setErroModal('');
    setModalPlano('novo');
  }

  function abrirEditarPlano(p: Plano) {
    setFormPlano({
      nome: p.nome,
      valor: String(p.valor),
      servicosIds: p.servicosIds ? p.servicosIds.split(',').filter(Boolean) : [],
      limiteUsosMes: p.limiteUsosMes ? String(p.limiteUsosMes) : '',
      diasSemana: (p.diasSemanaPermitidos ?? '').split(',').filter(Boolean).map(Number),
    });
    setPlanoEdit(p);
    setErroModal('');
    setModalPlano('editar');
  }

  async function salvarPlano() {
    const valor = parseFloat(formPlano.valor);
    if (!formPlano.nome.trim() || !valor || valor <= 0) {
      setErroModal('Informe nome e valor válidos.');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: formPlano.nome.trim(),
        valor,
        servicosIds: formPlano.servicosIds.join(',') || null,
        limiteUsosMes: parseInt(formPlano.limiteUsosMes) > 0 ? parseInt(formPlano.limiteUsosMes) : null,
        diasSemana: formPlano.diasSemana,
      };
      if (modalPlano === 'novo') {
        await api.post('/api/planos', payload);
      } else if (planoEdit) {
        await api.put(`/api/planos/${planoEdit.id}`, payload);
      }
      setModalPlano(null);
      await carregar();
      showToast(modalPlano === 'novo' ? 'Plano criado!' : 'Plano atualizado!');
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Plano) {
    try {
      await api.patch(`/api/planos/${p.id}/ativo`, {});
      await carregar();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  function excluirPlano(p: Plano) {
    setConfirmExcluirPlano(p);
  }

  async function confirmarExcluirPlano() {
    if (!confirmExcluirPlano) return;
    try {
      await api.delete(`/api/planos/${confirmExcluirPlano.id}`);
      await carregar();
      showToast('Plano excluído');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setConfirmExcluirPlano(null);
    }
  }

  function toggleDia(d: number) {
    setFormPlano(f => ({
      ...f,
      diasSemana: f.diasSemana.includes(d) ? f.diasSemana.filter(x => x !== d) : [...f.diasSemana, d].sort(),
    }));
  }

  function toggleServico(id: string) {
    setFormPlano(f => ({
      ...f,
      servicosIds: f.servicosIds.includes(id)
        ? f.servicosIds.filter(s => s !== id)
        : [...f.servicosIds, id],
    }));
  }

  // ── Assinantes ──────────────────────────────────────────────────
  function abrirVincular() {
    setFormAssinante({ clienteId: '', planoId: '', diaVencimento: '10' });
    setAssinanteEditando(null);
    setErroModal('');
    setModalAssinante(true);
  }

  function abrirEditarAssinante(a: Assinante) {
    setFormAssinante({ clienteId: a.clienteId, planoId: a.planoId, diaVencimento: String(a.diaVencimento) });
    setAssinanteEditando(a);
    setErroModal('');
    setModalAssinante(true);
  }

  async function vincular() {
    if (!formAssinante.clienteId || !formAssinante.planoId) {
      setErroModal('Escolha o cliente e o plano.');
      return;
    }
    setSalvando(true);
    try {
      if (assinanteEditando) {
        await api.put(`/api/planos/assinantes/${assinanteEditando.assinaturaId}`, {
          planoId: formAssinante.planoId,
          diaVencimento: parseInt(formAssinante.diaVencimento) || 10,
        });
        showToast('Assinatura atualizada!');
      } else {
        await api.post('/api/planos/assinantes', {
          clienteId: formAssinante.clienteId,
          planoId: formAssinante.planoId,
          diaVencimento: parseInt(formAssinante.diaVencimento) || 10,
        });
        showToast('Cliente vinculado ao plano!');
      }
      setModalAssinante(false);
      setAssinanteEditando(null);
      await carregar();
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function abrirHistorico(a: Assinante) {
    setHistoricoAssinante(a);
    try {
      const [hist, cons] = await Promise.all([
        api.get<PagamentoHistorico[]>(`/api/planos/assinantes/${a.assinaturaId}/historico`),
        api.get<ConsumoServico[]>(`/api/planos/assinantes/${a.assinaturaId}/consumos`),
      ]);
      setHistorico(hist);
      setConsumos(cons);
    } catch {
      setHistorico([]);
      setConsumos([]);
    }
  }

  async function marcarPagamento(a: Assinante, pago: boolean) {
    try {
      await api.post(`/api/planos/assinantes/${a.assinaturaId}/pagamento`, { pago });
      await carregar();
      await recarregar(true);   // silencioso: não pisca a tela inteira nem volta para a aba "Planos"
      showToast(pago ? 'Marcado como pago' : 'Marcado como pendente');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  // ── Pagar meses escolhidos (com valor pago editável: juros/multa ou desconto) ──
  const [pagarAssinante, setPagarAssinante] = useState<Assinante | null>(null);
  const [mesesPagar, setMesesPagar] = useState<{ id: string; mesReferencia: string; valor: number; selecionado: boolean; valorPago: string }[]>([]);
  const [carregandoMeses, setCarregandoMeses] = useState(false);
  const [pagando, setPagando] = useState(false);

  async function abrirPagar(a: Assinante) {
    setPagarAssinante(a);
    setMesesPagar([]);
    setErroModal('');
    setCarregandoMeses(true);
    try {
      const hist = await api.get<PagamentoHistorico[]>(`/api/planos/assinantes/${a.assinaturaId}/historico`);
      const pendentes = hist.filter(h => h.status === 'pendente').sort((x, y) => x.mesReferencia.localeCompare(y.mesReferencia));
      setMesesPagar(pendentes.map((h, i) => ({
        id: h.id, mesReferencia: h.mesReferencia, valor: h.valor,
        selecionado: i === 0, valorPago: h.valor.toFixed(2).replace('.', ','),
      })));
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setCarregandoMeses(false);
    }
  }

  const numeroDe = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));
  const selecionados = mesesPagar.filter(m => m.selecionado);
  const totalSelecionado = selecionados.reduce((t, m) => t + (numeroDe(m.valorPago) || 0), 0);

  async function confirmarPagar() {
    if (!pagarAssinante) return;
    if (selecionados.length === 0) { setErroModal('Selecione ao menos um mês.'); return; }
    if (selecionados.some(m => !(numeroDe(m.valorPago) > 0))) { setErroModal('Informe um valor pago válido em todos os meses selecionados.'); return; }
    setPagando(true);
    setErroModal('');
    try {
      await api.post(`/api/planos/assinantes/${pagarAssinante.assinaturaId}/pagar`, {
        meses: selecionados.map(m => ({ pagamentoId: m.id, valorPago: numeroDe(m.valorPago) })),
      });
      setPagarAssinante(null);
      await carregar();
      await recarregar(true);   // silencioso: continua na aba de assinantes
      showToast(`Pagamento registrado: ${fmt(totalSelecionado)}`);
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setPagando(false);
    }
  }

  function cancelarAssinatura(a: Assinante) {
    setConfirmCancelarAssinante(a);
  }

  async function confirmarCancelarAssinatura() {
    if (!confirmCancelarAssinante) return;
    try {
      await api.patch(`/api/planos/assinantes/${confirmCancelarAssinante.assinaturaId}/cancelar`, {});
      await carregar();
      showToast('Plano cancelado');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setConfirmCancelarAssinante(null);
    }
  }

  const [paginaPlanos, setPaginaPlanos] = useState(1);
  const [porPaginaPlanos, setPorPaginaPlanos] = useState(10);
  const [paginaAssinantes, setPaginaAssinantes] = useState(1);
  const [porPaginaAssinantes, setPorPaginaAssinantes] = useState(10);

  useEffect(() => { setPaginaPlanos(1); }, [porPaginaPlanos]);
  useEffect(() => { setPaginaAssinantes(1); }, [porPaginaAssinantes, buscaAssinante, filtroAssinante]);

  const totalPaginasPlanos = Math.max(1, Math.ceil(planos.length / porPaginaPlanos));
  const paginaPlanosSegura = Math.min(paginaPlanos, totalPaginasPlanos);
  const planosPaginados = planos.slice((paginaPlanosSegura - 1) * porPaginaPlanos, paginaPlanosSegura * porPaginaPlanos);

 const assinantesFiltrados = assinantes.filter(a => {
    const buscaOk = a.clienteNome.toLowerCase().includes(buscaAssinante.toLowerCase());
    if (!buscaOk) return false;
    if (filtroAssinante === 'todos') return true;
    if (filtroAssinante === 'atraso') return a.mesesEmAtraso > 0;
    if (filtroAssinante === 'naoIniciou') return (a as any).aindaNaoIniciou === true;
    if (filtroAssinante === 'pago') return a.mesesEmAtraso === 0 && a.pagoNoMes;
    if (filtroAssinante === 'pendente') return a.mesesEmAtraso === 0 && !a.pagoNoMes && !(a as any).aindaNaoIniciou;
    return true;
  });

  const resumoAssinantes = {
    totalPago: assinantes.filter(a => a.mesesEmAtraso === 0 && a.pagoNoMes).reduce((s, a) => s + a.valor, 0),
    qtdPago: assinantes.filter(a => a.mesesEmAtraso === 0 && a.pagoNoMes).length,
    totalPendente: assinantes.filter(a => a.mesesEmAtraso === 0 && !a.pagoNoMes && !(a as any).aindaNaoIniciou).reduce((s, a) => s + a.valor, 0),
    qtdPendente: assinantes.filter(a => a.mesesEmAtraso === 0 && !a.pagoNoMes && !(a as any).aindaNaoIniciou).length,
    totalAtraso: assinantes.reduce((s, a) => s + a.valorTotalAtraso, 0),
    qtdAtraso: assinantes.filter(a => a.mesesEmAtraso > 0).length,
  };

  const totalPaginasAssinantes = Math.max(1, Math.ceil(assinantesFiltrados.length / porPaginaAssinantes));
  const paginaAssinantesSegura = Math.min(paginaAssinantes, totalPaginasAssinantes);
  const assinantesPaginados = assinantesFiltrados.slice((paginaAssinantesSegura - 1) * porPaginaAssinantes, paginaAssinantesSegura * porPaginaAssinantes);

  const planosAtivos = planos.filter(p => p.ativo);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planos</h1>
          <p className="page-subtitle">Planos de assinatura e clientes vinculados</p>
        </div>
        {aba === 'planos'
          ? <button className="btn-primary" onClick={abrirNovoPlano}><Plus size={15} style={{ verticalAlign: -2 }} /> Novo plano</button>
          : <button className="btn-primary" onClick={abrirVincular}><Plus size={15} style={{ verticalAlign: -2 }} /> Vincular cliente</button>}
      </div>

      {/* Abas */}
      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'planos' ? ' ativo' : ''}`} onClick={() => setAba('planos')}>
          <CreditCard size={15} /> Planos
        </button>
        <button className={`planos-tab${aba === 'assinantes' ? ' ativo' : ''}`} onClick={() => setAba('assinantes')}>
          <Users size={15} /> Assinantes ({assinantes.length})
        </button>
      </div>

      {carregando ? (
        <div className="card"><div className="empty"><p>Carregando...</p></div></div>
      ) : aba === 'planos' ? (
        // ── ABA PLANOS ──
        planos.length === 0 ? (
          <div className="card">
            <div className="empty">
              <CreditCard size={36} />
              <p>Nenhum plano cadastrado.</p>
              <button className="btn-primary" onClick={abrirNovoPlano} style={{ marginTop: 12 }}>Criar primeiro plano</button>
            </div>
          </div>
        ) : (
          <>
            <div className="planos-grid">
              {planosPaginados.map(p => {
                const svs = p.servicosIds ? p.servicosIds.split(',').filter(Boolean) : [];
                return (
                  <div key={p.id} className={`plano-card${!p.ativo ? ' inativo' : ''}`}>
                    <div className="plano-card-top">
                      <div className="plano-nome">{p.nome}</div>
                      <div className="plano-acoes">
                        <button className="btn-ghost" title="Editar" onClick={() => abrirEditarPlano(p)}><Edit2 size={13} /></button>
                        <button className="btn-ghost" title={p.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternarAtivo(p)}><Power size={13} /></button>
                        <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => excluirPlano(p)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="plano-valor">{fmt(p.valor)}<span>/mês</span></div>
                    {textoRegrasPlano(p) && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{textoRegrasPlano(p)}</div>}
                    {svs.length > 0 && (
                      <div className="plano-servicos">
                        {svs.map(sid => {
                          const s = servicos.find(x => x.id === sid);
                          return s ? <span key={sid} className="plano-servico-tag">{s.nome}</span> : null;
                        })}
                      </div>
                    )}
                    {!p.ativo && <div className="plano-inativo-badge">Inativo</div>}
                  </div>
                );
              })}
            </div>
            {planos.length > 0 && (
              <div className="prod-paginacao">
                <div className="prod-pag-info">
                  Mostrando {(paginaPlanosSegura - 1) * porPaginaPlanos + 1}–{Math.min(paginaPlanosSegura * porPaginaPlanos, planos.length)} de {planos.length}
                </div>
                <div className="prod-pag-controles">
                  <select value={porPaginaPlanos} onChange={e => setPorPaginaPlanos(+e.target.value)} className="prod-pag-select">
                    <option value={5}>5 por página</option>
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                  </select>
                  <div className="prod-pag-botoes">
                    <button className="btn-secondary" disabled={paginaPlanosSegura <= 1} onClick={() => setPaginaPlanos(p => Math.max(1, p - 1))}>Anterior</button>
                    <span className="prod-pag-atual">{paginaPlanosSegura} / {totalPaginasPlanos}</span>
                    <button className="btn-secondary" disabled={paginaPlanosSegura >= totalPaginasPlanos} onClick={() => setPaginaPlanos(p => Math.min(totalPaginasPlanos, p + 1))}>Próxima</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        // ── ABA ASSINANTES ──
        assinantes.length === 0 ? (
          <div className="card">
            <div className="empty">
              <Users size={36} />
              <p>Nenhum cliente com plano ainda.</p>
              <button className="btn-primary" onClick={abrirVincular} style={{ marginTop: 12 }}>Vincular cliente</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div className="search-wrap" style={{ maxWidth: 280 }}>
                <Search size={14} className="search-icon" />
                <input className="search-input" placeholder="Buscar assinante..."
                  value={buscaAssinante} onChange={e => setBuscaAssinante(e.target.value)} />
              </div>
              <div className="cat-tabs">
                <button className={`cat-tab${filtroAssinante === 'todos' ? ' active' : ''}`} onClick={() => setFiltroAssinante('todos')}>Todos</button>
                <button className={`cat-tab${filtroAssinante === 'pago' ? ' active' : ''}`} onClick={() => setFiltroAssinante('pago')}>Pagos</button>
                <button className={`cat-tab${filtroAssinante === 'pendente' ? ' active' : ''}`} onClick={() => setFiltroAssinante('pendente')}>Pendentes</button>
                <button className={`cat-tab${filtroAssinante === 'atraso' ? ' active' : ''}`} onClick={() => setFiltroAssinante('atraso')}>Em atraso</button>
                <button className={`cat-tab${filtroAssinante === 'naoIniciou' ? ' active' : ''}`} onClick={() => setFiltroAssinante('naoIniciou')}>Ainda não iniciou</button>
              </div>
            </div>

            <div className="planos-resumo" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="stat-card">
                <div className="stat-label">Pago este mês</div>
                <div className="stat-value" style={{ color: 'var(--green)', fontSize: 18 }}>{fmt(resumoAssinantes.totalPago)}</div>
                <div className="stat-sub">{resumoAssinantes.qtdPago} assinante(s)</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pendente (mês atual)</div>
                <div className="stat-value" style={{ color: 'var(--yellow, #d97706)', fontSize: 18 }}>{fmt(resumoAssinantes.totalPendente)}</div>
                <div className="stat-sub">{resumoAssinantes.qtdPendente} assinante(s)</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Em atraso</div>
                <div className="stat-value" style={{ color: 'var(--red)', fontSize: 18 }}>{fmt(resumoAssinantes.totalAtraso)}</div>
                <div className="stat-sub">{resumoAssinantes.qtdAtraso} assinante(s)</div>
              </div>
            </div>

            {assinantesFiltrados.length === 0 ? (
              <div className="card">
                <div className="empty">
                  <Users size={36} />
                  <p>Nenhum assinante encontrado com esse filtro.</p>
                  <button className="btn-secondary" onClick={() => { setFiltroAssinante('todos'); setBuscaAssinante(''); }} style={{ marginTop: 12 }}>
                    Limpar filtros
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="card">
                  {/* Desktop */}
                  <div className="table-wrap planos-desktop">
                    <table>
                      <thead>
                        <tr><th>Cliente</th><th>Plano</th><th>Valor</th><th>Venc.</th><th>Este mês</th><th></th></tr>
                      </thead>
                      <tbody>
                        {assinantesPaginados.map(a => (
                          <tr key={a.assinaturaId}>
                            <td>
                              <div style={{ fontWeight: 500 }}>{a.clienteNome}</div>
                              {a.clienteTelefone && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.clienteTelefone}</div>}
                            </td>
                            <td style={{ fontSize: 13 }}>
                              {a.planoNome}
                              {a.totalConsumos > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.totalConsumos}x utilizado</div>
                              )}
                              {a.limiteUsosMes ? (
                                <div style={{ fontSize: 11, color: (a.usosNoMes ?? 0) >= a.limiteUsosMes ? 'var(--red)' : 'var(--text-3)' }}>
                                  {a.usosNoMes ?? 0}/{a.limiteUsosMes} usos neste mês
                                </div>
                              ) : null}
                            </td>
                            <td style={{ fontSize: 13 }}>{fmt(a.valor)}</td>
                            <td style={{ fontSize: 13 }}>Dia {a.diaVencimento}</td>
                            <td>
                              {a.mesesEmAtraso > 1 ? (
                                <span className="badge badge-red">{a.mesesEmAtraso} meses em atraso · {fmt(a.valorTotalAtraso)}</span>
                              ) : a.mesesEmAtraso === 1 ? (
                                <span className="badge badge-yellow">1 mês em atraso · {fmt(a.valorTotalAtraso)}</span>
                              ) : a.pagoNoMes ? (
                                <span className="badge badge-green">Pago</span>
                              ) : (
                                <span className="badge badge-accent">Pendente</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                {a.mesesEmAtraso === 0 && a.pagoNoMes ? (
                                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => marcarPagamento(a, false)}>Desfazer</button>
                                ) : (
                                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} onClick={() => abrirPagar(a)}><Check size={13} /> Pagar</button>
                                )}
                                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => abrirEditarAssinante(a)}><Edit2 size={12} /> Editar</button>
                                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => abrirHistorico(a)}>Histórico</button>
                                <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => cancelarAssinatura(a)}>Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="planos-mobile">
                    {assinantesPaginados.map(a => (
                      <div key={a.assinaturaId} className="assinante-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{a.clienteNome}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              {a.planoNome} · {fmt(a.valor)}{a.totalConsumos > 0 ? ` · ${a.totalConsumos}x usado` : ''}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Vencimento dia {a.diaVencimento}</div>
                          </div>
                          {a.mesesEmAtraso > 1 ? (
                            <span className="badge badge-red">{a.mesesEmAtraso}x atraso</span>
                          ) : a.mesesEmAtraso === 1 ? (
                            <span className="badge badge-yellow">1 mês atraso</span>
                          ) : a.pagoNoMes ? (
                            <span className="badge badge-green">Pago</span>
                          ) : (
                            <span className="badge badge-accent">Pendente</span>
                          )}
                        </div>
                        {a.mesesEmAtraso > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                            Total em atraso: {fmt(a.valorTotalAtraso)}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          {a.mesesEmAtraso === 0 && a.pagoNoMes ? (
                            <button className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => marcarPagamento(a, false)}>Desfazer</button>
                          ) : (
                            <button className="btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => abrirPagar(a)}>Pagar…</button>
                          )}
                          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirEditarAssinante(a)}><Edit2 size={12} /></button>
                          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirHistorico(a)}>Histórico</button>
                          <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => cancelarAssinatura(a)}>Cancelar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="prod-paginacao">
                  <div className="prod-pag-info">
                    Mostrando {(paginaAssinantesSegura - 1) * porPaginaAssinantes + 1}–{Math.min(paginaAssinantesSegura * porPaginaAssinantes, assinantesFiltrados.length)} de {assinantesFiltrados.length}
                  </div>
                  <div className="prod-pag-controles">
                    <select value={porPaginaAssinantes} onChange={e => setPorPaginaAssinantes(+e.target.value)} className="prod-pag-select">
                      <option value={5}>5 por página</option>
                      <option value={10}>10 por página</option>
                      <option value={20}>20 por página</option>
                      <option value={50}>50 por página</option>
                    </select>
                    <div className="prod-pag-botoes">
                      <button className="btn-secondary" disabled={paginaAssinantesSegura <= 1} onClick={() => setPaginaAssinantes(p => Math.max(1, p - 1))}>Anterior</button>
                      <span className="prod-pag-atual">{paginaAssinantesSegura} / {totalPaginasAssinantes}</span>
                      <button className="btn-secondary" disabled={paginaAssinantesSegura >= totalPaginasAssinantes} onClick={() => setPaginaAssinantes(p => Math.min(totalPaginasAssinantes, p + 1))}>Próxima</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}

      {/* Modal pagar meses */}
      {pagarAssinante && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPagarAssinante(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Pagar — {pagarAssinante.clienteNome}</h2>
              <button className="btn-ghost" onClick={() => setPagarAssinante(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {carregandoMeses ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Carregando meses...</p>
              ) : mesesPagar.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Não há meses pendentes para esta assinatura.</p>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    Escolha os meses que o cliente está pagando. Se houver juros ou multa, ajuste o valor pago do mês.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button type="button" className="btn-ghost" style={{ fontSize: 11 }}
                      onClick={() => setMesesPagar(ms => ms.map(m => ({ ...m, selecionado: true })))}>Selecionar todos</button>
                    <button type="button" className="btn-ghost" style={{ fontSize: 11 }}
                      onClick={() => setMesesPagar(ms => ms.map(m => ({ ...m, selecionado: false })))}>Limpar</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {mesesPagar.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: m.selecionado ? 'var(--accent-bg)' : 'transparent' }}>
                        <input type="checkbox" checked={m.selecionado} style={{ width: 16, height: 16, margin: 0 }}
                          onChange={e => setMesesPagar(ms => ms.map(x => x.id === m.id ? { ...x, selecionado: e.target.checked } : x))} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{rotuloMes(m.mesReferencia)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Mensalidade {fmt(m.valor)}</div>
                        </div>
                        <div style={{ width: 120 }}>
                          <input value={m.valorPago} disabled={!m.selecionado} inputMode="decimal" style={{ textAlign: 'right' }}
                            onChange={e => setMesesPagar(ms => ms.map(x => x.id === m.id ? { ...x, valorPago: e.target.value } : x))} />
                          <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>valor pago</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 14 }}>
                    <span>Total a receber ({selecionados.length} mês(es))</span>
                    <strong>{fmt(totalSelecionado)}</strong>
                  </div>
                </>
              )}
              {erroModal && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroModal}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPagarAssinante(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarPagar} disabled={pagando || carregandoMeses || selecionados.length === 0}>
                {pagando ? 'Registrando...' : 'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar plano */}
      {modalPlano && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPlano(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modalPlano === 'novo' ? 'Novo plano' : 'Editar plano'}</h2>
              <button className="btn-ghost" onClick={() => setModalPlano(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Nome do plano *</label>
                <input value={formPlano.nome} onChange={e => setFormPlano(f => ({ ...f, nome: e.target.value }))}
                  placeholder={placeholderPlano} autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Valor mensal (R$) *</label>
                <input type="number" min={0} step={0.01} value={formPlano.valor}
                  onChange={e => setFormPlano(f => ({ ...f, valor: e.target.value }))}
                  placeholder="159,90" />
              </div>
              {servicos.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Serviços incluídos <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <div className="plano-svc-list">
                    {servicos.map(s => (
                      <label key={s.id} className="plano-svc-check">
                        <input type="checkbox" checked={formPlano.servicosIds.includes(s.id)}
                          onChange={() => toggleServico(s.id)} />
                        <span>{s.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Máximo de usos por mês <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                <input type="number" min={1} step={1} value={formPlano.limiteUsosMes}
                  onChange={e => setFormPlano(f => ({ ...f, limiteUsosMes: e.target.value }))}
                  placeholder="Ex: 4 — vazio = ilimitado" />
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Quantas vezes no mês o cliente pode usar os serviços incluídos. Depois disso, o serviço é cobrado normalmente.</p>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Dias da semana permitidos <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DIAS_SEMANA.map((nome, d) => (
                    <button key={d} type="button" onClick={() => toggleDia(d)}
                      className={formPlano.diasSemana.includes(d) ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 0', width: 46, fontSize: 12 }}>{nome}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setFormPlano(f => ({ ...f, diasSemana: [1, 2, 3, 4, 5] }))}>Segunda a sexta</button>
                  <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setFormPlano(f => ({ ...f, diasSemana: [] }))}>Todos os dias</button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Sem nenhum dia marcado, o plano vale todos os dias.</p>
              </div>
              {erroModal && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroModal}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPlano(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarPlano} disabled={salvando}>
                {salvando ? 'Salvando...' : (modalPlano === 'novo' ? 'Criar plano' : 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular cliente */}
      {modalAssinante && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAssinante(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{assinanteEditando ? 'Editar assinatura' : 'Vincular cliente a um plano'}</h2>
              <button className="btn-ghost" onClick={() => { setModalAssinante(false); setAssinanteEditando(null); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Cliente *</label>
                <select value={formAssinante.clienteId} disabled={!!assinanteEditando}
                  onChange={e => setFormAssinante(f => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Plano *</label>
                <select value={formAssinante.planoId} onChange={e => setFormAssinante(f => ({ ...f, planoId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {planosAtivos.map(p => <option key={p.id} value={p.id}>{p.nome} — {fmt(p.valor)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dia do vencimento</label>
                <input type="number" min={1} max={28} value={formAssinante.diaVencimento}
                  onChange={e => setFormAssinante(f => ({ ...f, diaVencimento: e.target.value }))} />
              </div>
              {erroModal && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroModal}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setModalAssinante(false); setAssinanteEditando(null); }}>Cancelar</button>
              <button className="btn-primary" onClick={vincular} disabled={salvando}>
                {salvando ? 'Salvando...' : (assinanteEditando ? 'Salvar alterações' : 'Vincular')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão de plano */}
      {confirmExcluirPlano && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirPlano(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir plano</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirPlano(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir o plano <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirPlano.nome}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirPlano(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarExcluirPlano}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar cancelamento de assinatura */}
      {confirmCancelarAssinante && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmCancelarAssinante(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Cancelar plano</h2>
              <button className="btn-ghost" onClick={() => setConfirmCancelarAssinante(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja cancelar o plano de <strong style={{ color: 'var(--text-1)' }}>{confirmCancelarAssinante.clienteNome}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmCancelarAssinante(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarCancelarAssinatura}>Confirmar cancelamento</button>
            </div>
          </div>
        </div>
      )}

      {historicoAssinante && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistoricoAssinante(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Histórico — {historicoAssinante.clienteNome}</h2>
              <button className="btn-ghost" onClick={() => setHistoricoAssinante(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {historico.length === 0 ? (
                <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhum pagamento registrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historico.map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {new Date(h.mesReferencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </div>
                        {h.pagoEm && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Pago em {new Date(h.pagoEm).toLocaleDateString('pt-BR')}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{fmt(h.valor)}</div>
                        <span className={`badge ${h.status === 'pago' ? 'badge-green' : 'badge-accent'}`} style={{ fontSize: 10 }}>
                          {h.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {consumos.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 0 8px' }}>
                    Serviços utilizados ({consumos.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {consumos.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{c.nomeServico}</span>
                        <span style={{ color: 'var(--text-3)' }}>{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setHistoricoAssinante(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-2)', border: '1px solid var(--accent-border)',
          color: 'var(--text-1)', padding: '12px 24px', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)', zIndex: 200, fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--green)' }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}