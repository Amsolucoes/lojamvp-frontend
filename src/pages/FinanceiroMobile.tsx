import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet, Menu, X, LogOut, HelpCircle, Settings, Plus, Check, Trash2, ChevronLeft, ChevronRight, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { setMobileShellOverride } from '../utils/mobileShellOverride';
import { BankBadge } from '../utils/bancos';
import './FinanceiroMobile.css';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface Conta { id: string; nome: string; saldoAtual: number; ativa: boolean; banco?: string | null; limite: number; }
interface ResumoTipo { totalPago: number; qtdPago: number; totalPendente: number; qtdPendente: number; totalVencido: number; qtdVencido: number; }
interface Alerta { id: string; descricao: string; tipo: string; valor: number; vencimento: string; origem: string; }
interface LinhaPagar {
  id: string; descricao: string; observacao?: string | null;
  categoriaNome: string | null; categoriaId: string | null; contaBancariaId: string | null;
  modo: string; valor: number; vencimento: string; status: string;
  numeroParcela: number | null; totalParcelas: number | null;
  origem: string; cartaoId: string | null; cartaoNome: string | null;
}
interface LinhaReceber {
  id: string; descricao: string; observacao?: string | null;
  categoriaNome: string | null; categoriaId: string | null; contaBancariaId: string | null;
  modo: string; valor: number; vencimento: string; status: string;
  numeroParcela: number | null; totalParcelas: number | null;
  origem: string; // avulso | plano
}
interface Categoria { id: string; nome: string; tipo: string; icone: string | null; }
interface ItemCategoriaBalanco { nome: string; icone: string; valor: number; }
interface Balanco { receitas: ItemCategoriaBalanco[]; despesas: ItemCategoriaBalanco[]; totalReceitas: number; totalDespesas: number; saldo: number; }

const CORES_BALANCO = ['#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#06b6d4'];
function corParaCategoria(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return CORES_BALANCO[Math.abs(hash) % CORES_BALANCO.length];
}

function ehVencido(l: { status: string; vencimento: string }) {
  if (!l.vencimento) return false;
  return l.status === 'pendente' && new Date(l.vencimento) < new Date(new Date().toDateString());
}
function agruparPorData<T extends { vencimento: string }>(lista: T[]) {
  const grupos: Record<string, T[]> = {};
  lista.forEach(l => {
    const chave = l.vencimento ? l.vencimento.slice(0, 10) : 'sem-data';
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(l);
  });
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

const ABAS = [
  { key: 'visao', label: 'Visão geral', Icon: LayoutDashboard },
  { key: 'pagar', label: 'A Pagar', Icon: ArrowDownCircle },
  { key: 'receber', label: 'A Receber', Icon: ArrowUpCircle },
  { key: 'cartoes', label: 'Cartões', Icon: CreditCard },
  { key: 'contas', label: 'Contas', Icon: Wallet },
] as const;

export function FinanceiroMobile() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const [tela, setTela] = useState<'visao' | 'pagar' | 'receber'>('visao');
  const [linhasPagar, setLinhasPagar] = useState<LinhaPagar[]>([]);
  const [carregandoPagar, setCarregandoPagar] = useState(true);
  const [categoriasPagar, setCategoriasPagar] = useState<Categoria[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'vencido' | 'pago'>('todos');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [paginaLista, setPaginaLista] = useState(1);
  const [mesBalanco, setMesBalanco] = useState(new Date().getMonth());
  const [anoBalanco, setAnoBalanco] = useState(new Date().getFullYear());
  const [abaBalanco, setAbaBalanco] = useState<'categoria' | 'conta'>('categoria');
  const [balanco, setBalanco] = useState<Balanco | null>(null);
  const [carregandoBalanco, setCarregandoBalanco] = useState(true);

  const [mesPagar, setMesPagar] = useState(new Date().getMonth());
  const [anoPagar, setAnoPagar] = useState(new Date().getFullYear());
  const [periodoTipo, setPeriodoTipo] = useState<'mes' | 'personalizado'>('mes');
  const [periodoDe, setPeriodoDe] = useState(new Date().toISOString().slice(0, 10));
  const [periodoAte, setPeriodoAte] = useState(new Date().toISOString().slice(0, 10));
  const itensPorPagina = 20;
  const [confirmExcluir, setConfirmExcluir] = useState<LinhaPagar | null>(null);
  const [editandoLancamento, setEditandoLancamento] = useState<LinhaPagar | null>(null);
  const [formEdit, setFormEdit] = useState({ contaBancariaId: '', categoriaId: '', descricao: '', valor: '', vencimento: '', observacao: '' });
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const [linhasReceber, setLinhasReceber] = useState<LinhaReceber[]>([]);
  const [carregandoReceber, setCarregandoReceber] = useState(true);
  const [categoriasReceber, setCategoriasReceber] = useState<Categoria[]>([]);
  const [filtroStatusReceber, setFiltroStatusReceber] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [catFiltroReceber, setCatFiltroReceber] = useState('todas');
  const [paginaListaReceber, setPaginaListaReceber] = useState(1);
  const [mesReceber, setMesReceber] = useState(new Date().getMonth());
  const [anoReceber, setAnoReceber] = useState(new Date().getFullYear());
  const [periodoTipoReceber, setPeriodoTipoReceber] = useState<'mes' | 'personalizado'>('mes');
  const [periodoDeReceber, setPeriodoDeReceber] = useState(new Date().toISOString().slice(0, 10));
  const [periodoAteReceber, setPeriodoAteReceber] = useState(new Date().toISOString().slice(0, 10));
  const [confirmExcluirReceber, setConfirmExcluirReceber] = useState<LinhaReceber | null>(null);
  const [editandoReceber, setEditandoReceber] = useState<LinhaReceber | null>(null);
  const [formEditReceber, setFormEditReceber] = useState({ contaBancariaId: '', categoriaId: '', descricao: '', valor: '', vencimento: '', observacao: '' });
  const [salvandoEditReceber, setSalvandoEditReceber] = useState(false);

  useEffect(() => {
    setMobileShellOverride(true);
    return () => setMobileShellOverride(false);
  }, []);

  function periodoQueryPagar() {
    if (periodoTipo === 'personalizado') return `de=${periodoDe}&ate=${periodoAte}`;
    return `ano=${anoPagar}&mes=${mesPagar + 1}`;
  }

  function recarregarPagar() {
    setCarregandoPagar(true);
    api.get<LinhaPagar[]>(`/api/financeiro/pagar-unificado?${periodoQueryPagar()}&modo=agrupado`)
      .then(setLinhasPagar).catch(() => {}).finally(() => setCarregandoPagar(false));
  }

  function navMesPagar(delta: number) {
    let nm = mesPagar + delta, na = anoPagar;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesPagar(nm); setAnoPagar(na);
  }

  function periodoQueryReceber() {
    if (periodoTipoReceber === 'personalizado') {
      return { de: new Date(periodoDeReceber).toISOString(), ate: new Date(periodoAteReceber).toISOString() };
    }
    return { de: new Date(anoReceber, mesReceber, 1).toISOString(), ate: new Date(anoReceber, mesReceber + 1, 0).toISOString() };
  }

  function recarregarReceber() {
    setCarregandoReceber(true);
    const { de, ate } = periodoQueryReceber();
    api.get<LinhaReceber[]>(`/api/financeiro/receber-unificado?de=${de}&ate=${ate}`)
      .then(setLinhasReceber).catch(() => {}).finally(() => setCarregandoReceber(false));
  }

  function navMesReceber(delta: number) {
    let nm = mesReceber + delta, na = anoReceber;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesReceber(nm); setAnoReceber(na);
  }

  useEffect(() => {
    if (tela !== 'receber') return;
    recarregarReceber();
    api.get<Categoria[]>('/api/financeiro/categorias').then(cats => setCategoriasReceber(cats.filter(c => c.tipo === 'receber' || c.tipo === 'ambos'))).catch(() => {});
  }, [tela, mesReceber, anoReceber, periodoTipoReceber, periodoDeReceber, periodoAteReceber]);

  useEffect(() => { setPaginaListaReceber(1); }, [tela, filtroStatusReceber, catFiltroReceber, mesReceber, anoReceber, periodoTipoReceber, periodoDeReceber, periodoAteReceber]);

  async function marcarRecebimentoLocal(l: LinhaReceber, pago: boolean) {
    try {
      await api.post(`/api/financeiro/lancamentos/${l.id}/pagamento`, { pago });
      recarregarReceber();
    } catch {}
  }

  function abrirEditarReceber(l: LinhaReceber) {
    setEditandoReceber(l);
    setFormEditReceber({
      contaBancariaId: l.contaBancariaId ?? '',
      categoriaId: l.categoriaId ?? '',
      descricao: l.descricao,
      valor: String(l.valor),
      vencimento: l.vencimento ? l.vencimento.slice(0, 10) : '',
      observacao: l.observacao ?? '',
    });
  }

  async function salvarEdicaoReceber(modo: 'unica' | 'todas') {
    if (!editandoReceber) return;
    setSalvandoEditReceber(true);
    try {
      await api.put(`/api/financeiro/lancamentos/${editandoReceber.id}?modo=${modo}`, {
        descricao: formEditReceber.descricao.trim(),
        categoriaId: formEditReceber.categoriaId || null,
        contaBancariaId: formEditReceber.contaBancariaId,
        valor: parseFloat(formEditReceber.valor),
        vencimento: formEditReceber.vencimento,
        observacao: formEditReceber.observacao || null,
      });
      setEditandoReceber(null);
      recarregarReceber();
    } catch {} finally { setSalvandoEditReceber(false); }
  }

  async function excluirReceber(modo: 'unica' | 'todas' = 'unica') {
    if (!confirmExcluirReceber) return;
    try {
      await api.delete(`/api/financeiro/lancamentos/${confirmExcluirReceber.id}?modo=${modo}`);
      setConfirmExcluirReceber(null);
      recarregarReceber();
    } catch {}
  }

  useEffect(() => {
    if (tela !== 'pagar') return;
    recarregarPagar();
    api.get<Categoria[]>('/api/financeiro/categorias').then(cats => setCategoriasPagar(cats.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos'))).catch(() => {});
  }, [tela, mesPagar, anoPagar, periodoTipo, periodoDe, periodoAte]);

  useEffect(() => { setPaginaLista(1); }, [tela, filtroStatus, catFiltro, mesPagar, anoPagar, periodoTipo, periodoDe, periodoAte]);

  async function marcarPagamentoLocal(l: LinhaPagar, pago: boolean) {
    const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada';
    try {
      if (ehCartao && l.cartaoId) {
        const agora = new Date();
        await api.post(`/api/financeiro/cartoes/${l.cartaoId}/fatura/pagamento?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`, { modo: pago ? 'total' : 'desfazer' });
      } else {
        await api.post(`/api/financeiro/lancamentos/${l.id}/pagamento`, { pago });
      }
      recarregarPagar();
    } catch {}
  }

  function abrirEditar(l: LinhaPagar) {
    setEditandoLancamento(l);
    setFormEdit({
      contaBancariaId: l.contaBancariaId ?? '',
      categoriaId: l.categoriaId ?? '',
      descricao: l.descricao,
      valor: String(l.valor),
      vencimento: l.vencimento ? l.vencimento.slice(0, 10) : '',
      observacao: l.observacao ?? '',
    });
  }

  async function salvarEdicao(modo: 'unica' | 'todas') {
    if (!editandoLancamento) return;
    setSalvandoEdit(true);
    try {
      await api.put(`/api/financeiro/lancamentos/${editandoLancamento.id}?modo=${modo}`, {
        descricao: formEdit.descricao.trim(),
        categoriaId: formEdit.categoriaId || null,
        contaBancariaId: formEdit.contaBancariaId,
        valor: parseFloat(formEdit.valor),
        vencimento: formEdit.vencimento,
        observacao: formEdit.observacao || null,
      });
      setEditandoLancamento(null);
      recarregarPagar();
    } catch {} finally { setSalvandoEdit(false); }
  }

  async function excluirLinha(modo: 'unica' | 'todas' = 'unica') {
    if (!confirmExcluir) return;
    try {
      await api.delete(`/api/financeiro/lancamentos/${confirmExcluir.id}?modo=${modo}`);
      setConfirmExcluir(null);
      recarregarPagar();
    } catch {}
  }

  const [contas, setContas] = useState<Conta[]>([]);
  const [carregandoVisao, setCarregandoVisao] = useState(true);
  const [resumo, setResumo] = useState<{ pagar: ResumoTipo; receber: ResumoTipo } | null>(null);
  const [resumoAnual, setResumoAnual] = useState<{ mes: number; pagar: number; receber: number; saldo: number }[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [mostrarMesAMes, setMostrarMesAMes] = useState(false);
  const anoRef = new Date().getFullYear();

  useEffect(() => {
    setCarregandoVisao(true);
    Promise.all([
      api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {}),
      api.get<any>(`/api/financeiro/resumo-mensal?ano=${anoRef}&mes=${new Date().getMonth() + 1}`).then(setResumo).catch(() => {}),
      api.get<any[]>(`/api/financeiro/resumo-anual?ano=${anoRef}`).then(setResumoAnual).catch(() => {}),
      api.get<Alerta[]>('/api/financeiro/alertas-vencimento?dias=7').then(setAlertas).catch(() => {}),
    ]).finally(() => setCarregandoVisao(false));
  }, []);

  useEffect(() => {
    setCarregandoBalanco(true);
    api.get<Balanco>(`/api/financeiro/balanco-por-categoria?ano=${anoBalanco}&mes=${mesBalanco + 1}`)
      .then(setBalanco).catch(() => setBalanco(null)).finally(() => setCarregandoBalanco(false));
  }, [anoBalanco, mesBalanco]);

  function navMesBalanco(delta: number) {
    let nm = mesBalanco + delta, na = anoBalanco;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesBalanco(nm); setAnoBalanco(na);
  }

  const saldoTotal = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);
  const pagarAberto = (resumo?.pagar.totalPendente ?? 0) + (resumo?.pagar.totalVencido ?? 0);
  const receberAberto = (resumo?.receber.totalPendente ?? 0) + (resumo?.receber.totalVencido ?? 0);
  const totalVencidoQtd = (resumo?.pagar.qtdVencido ?? 0) + (resumo?.receber.qtdVencido ?? 0);
  const totalVencidoValor = (resumo?.pagar.totalVencido ?? 0) + (resumo?.receber.totalVencido ?? 0);

  const anoPago = resumoAnual.reduce((s, m) => s + m.pagar, 0);
  const anoRecebido = resumoAnual.reduce((s, m) => s + m.receber, 0);
  const anoSaldo = anoRecebido - anoPago;

  const proximos = alertas.slice(0, 4);

  function irPara(destino: typeof ABAS[number]['key']) {
    if (destino === 'visao' || destino === 'pagar' || destino === 'receber') { setTela(destino); return; }
    navigate('/financeiro'); // Cartões/Contas: fase 4/5 — por ora usa os botoes do topo daquela tela
  }

  return (
    <div className="fm-shell">
      <div className="fm-topbar">
        <div>
          <h1 className="fm-titulo">Financeiro</h1>
          <p className="fm-subtitulo">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="btn-ghost" onClick={() => setMenuAberto(true)}><Menu size={22} /></button>
      </div>

      <div className="fm-content">
      {tela === 'visao' && (
        carregandoVisao ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="layout-spinner" /></div>
        ) : (
      <>
        <div className="card fm-card">
          <div className="fm-card-kicker">Saldo por conta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {contas.filter(c => c.ativa).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BankBadge bancoId={c.banco} tamanho={16} /> {c.nome}
                </span>
                <strong style={{ color: c.saldoAtual >= 0 ? 'var(--text-1)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>Total</span>
              <strong style={{ color: saldoTotal >= 0 ? 'var(--text-1)' : 'var(--red)' }}>{fmt(saldoTotal)}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
          <div className="card fm-card">
            <div className="fm-card-kicker">A pagar</div>
            <div className="fm-valor-destaque" style={{ color: 'var(--red)' }}>{fmt(pagarAberto)}</div>
            <div className="fm-card-meta">{resumo?.pagar.qtdPendente ?? 0} lançamento(s)</div>
          </div>
          <div className="card fm-card">
            <div className="fm-card-kicker">A receber</div>
            <div className="fm-valor-destaque" style={{ color: 'var(--green)' }}>{fmt(receberAberto)}</div>
            <div className="fm-card-meta">{resumo?.receber.qtdPendente ?? 0} lançamento(s)</div>
          </div>
        </div>

        {totalVencidoQtd > 0 && (
          <div className="card fm-card" style={{ borderColor: 'rgba(248,113,113,0.4)', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>Vencidos</span>
              <span className="badge badge-red">{fmt(totalVencidoValor)}</span>
            </div>
          </div>
        )}

        <div className="card fm-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="fm-card-kicker">Balanço mensal</div>
            <button className="fm-link-btn" onClick={() => navigate('/financeiro/balanco')}>Ver completo ›</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '10px 0' }}>
            <button className="btn-secondary" onClick={() => navMesBalanco(-1)} style={{ padding: '4px 8px' }}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{MESES[mesBalanco]} {anoBalanco}</span>
            <button className="btn-secondary" onClick={() => navMesBalanco(1)} style={{ padding: '4px 8px' }}><ChevronRight size={14} /></button>
          </div>

          <div className="cx-tipo-toggle" style={{ marginBottom: 10 }}>
            <button className={abaBalanco === 'categoria' ? 'active' : ''} onClick={() => setAbaBalanco('categoria')}>Por categoria</button>
            <button className={abaBalanco === 'conta' ? 'active' : ''} onClick={() => setAbaBalanco('conta')}>Saldo por conta</button>
          </div>

          <div className="fm-balanco-scroll">
            {abaBalanco === 'categoria' ? (
              carregandoBalanco ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><div className="layout-spinner" style={{ width: 24, height: 24 }} /></div>
              ) : !balanco ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Não foi possível carregar.</p>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Balanço</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: balanco.saldo >= 0 ? 'var(--green)' : 'var(--red)', margin: '4px 0 10px' }}>
                      {balanco.saldo >= 0 ? '+' : '-'}{fmt(Math.abs(balanco.saldo))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <TrendingUp size={12} /> Receitas
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{fmt(balanco.totalReceitas)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <TrendingDown size={12} /> Despesas
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>{fmt(balanco.totalDespesas)}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      {balanco.receitas.map(r => (
                        <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: corParaCategoria(r.nome), flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>+{fmt(r.valor)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      {balanco.despesas.map(d => (
                        <div key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: corParaCategoria(d.nome), flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nome}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>-{fmt(d.valor)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            ) : (
              contas.filter(c => c.ativa).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><BankBadge bancoId={c.banco} tamanho={16} /> {c.nome}</span>
                  <strong style={{ fontSize: 13, color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card fm-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="fm-card-kicker">Resumo do ano · {anoRef}</div>
            <button className="fm-link-btn" onClick={() => setMostrarMesAMes(v => !v)}>
              {mostrarMesAMes ? 'Ocultar mês a mês' : 'Ver mês a mês'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <div className="fm-label-fraco">Pago no ano</div>
              <div className="fm-valor-medio">{fmt(anoPago)}</div>
            </div>
            <div>
              <div className="fm-label-fraco">Recebido no ano</div>
              <div className="fm-valor-medio">{fmt(anoRecebido)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>Saldo do ano</span>
            <strong style={{ color: anoSaldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(anoSaldo)}</strong>
          </div>
          {mostrarMesAMes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {resumoAnual.map(m => {
                const saldo = m.receber - m.pagar;
                return (
                  <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-2)', textTransform: 'capitalize', width: 40 }}>{MESES_ABREV[m.mes - 1]}</span>
                    <span style={{ color: 'var(--green)' }}>{fmt(m.receber)}</span>
                    <span style={{ color: 'var(--text-3)' }}>−</span>
                    <span style={{ color: 'var(--red)' }}>{fmt(m.pagar)}</span>
                    <strong style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)', minWidth: 74, textAlign: 'right' }}>
                      {saldo >= 0 ? '+' : ''}{fmt(saldo)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <h3 className="fm-secao-titulo">Próximos vencimentos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {proximos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nada vencendo nos próximos dias.</p>
          ) : proximos.map(p => (
            <div key={p.id} className="card fm-card-linha">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(p.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
              </div>
              <div style={{ fontSize: 14, color: p.tipo === 'pagar' ? 'var(--red)' : 'var(--green)', whiteSpace: 'nowrap' }}>
                {fmt(p.valor)}
              </div>
            </div>
          ))}
        </div>
      </>
        )
      )}

      {tela === 'pagar' && (
        <>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--red)', opacity: 0.7, marginBottom: 14 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>A Pagar</h2>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => navigate('/financeiro?aba=pagar&novo=pagar')}>
              <Plus size={14} /> Novo
            </button>
          </div>
          <div className="card fm-card fm-pagar-filtro" style={{ marginBottom: 14 }}>
            <div className="cx-tipo-toggle" style={{ marginBottom: 10, display: 'flex' }}>
              <button className={periodoTipo === 'mes' ? 'active' : ''} onClick={() => setPeriodoTipo('mes')}>Mês</button>
              <button className={periodoTipo === 'personalizado' ? 'active' : ''} onClick={() => {
                setPeriodoTipo('personalizado');
                setPeriodoDe(new Date(anoPagar, mesPagar, 1).toISOString().slice(0, 10));
                setPeriodoAte(new Date(anoPagar, mesPagar + 1, 0).toISOString().slice(0, 10));
              }}>Personalizado</button>
            </div>
            {periodoTipo === 'mes' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <button className="btn-secondary" onClick={() => navMesPagar(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{MESES[mesPagar]} {anoPagar}</span>
                <button className="btn-secondary" onClick={() => navMesPagar(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="date" value={periodoDe} onChange={e => setPeriodoDe(e.target.value)} />
                <span style={{ color: 'var(--text-3)' }}>até</span>
                <input type="date" value={periodoAte} onChange={e => setPeriodoAte(e.target.value)} />
              </div>
            )}
          </div>

          {carregandoPagar ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
          ) : (() => {
            const totalPago = linhasPagar.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0);
            const totalAberto = linhasPagar.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0);
            const totalMes = totalPago + totalAberto;
            const contasAberto = linhasPagar.filter(l => l.status !== 'pago' && l.origem === 'avulso').reduce((s, l) => s + l.valor, 0);
            const cartoesAberto = Object.entries(
              linhasPagar
                .filter(l => l.status !== 'pago' && (l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada'))
                .reduce((acc, l) => { const nome = l.cartaoNome ?? 'Cartão'; acc[nome] = (acc[nome] ?? 0) + l.valor; return acc; }, {} as Record<string, number>)
            );
            return (
              <div className="card fm-card" style={{ marginBottom: 14 }}>
                <div className="fm-card-kicker" style={{ textAlign: 'center' }}>Total a pagar</div>
                <div className="fm-valor-destaque" style={{ color: 'var(--red)', fontSize: 26, textAlign: 'center' }}>{fmt(totalAberto)}</div>

                {(contasAberto > 0 || cartoesAberto.length > 0) && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    {contasAberto > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-3)' }}>Contas</span>
                        <span style={{ color: 'var(--text-2)' }}>{fmt(contasAberto)}</span>
                      </div>
                    )}
                    {cartoesAberto.map(([nome, valor]) => (
                      <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-3)' }}>💳 {nome}</span>
                        <span style={{ color: 'var(--text-2)' }}>{fmt(valor)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Pago</div>
                    <strong style={{ fontSize: 14, color: 'var(--green)' }}>{fmt(totalPago)}</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Total do mês</div>
                    <strong style={{ fontSize: 14 }}>{fmt(totalMes)}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="fm-pills">
            {(['todos', 'pendente', 'vencido', 'pago'] as const).map(f => (
              <button key={f} className={`fm-pill${filtroStatus === f ? ' active' : ''}`} onClick={() => setFiltroStatus(f)}>
                {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendente' : f === 'vencido' ? 'Vencido' : 'Pago'}
              </button>
            ))}
          </div>
          {categoriasPagar.length > 0 && (
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="todas">Todas categorias</option>
              {categoriasPagar.map(c => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          )}

          {carregandoPagar ? null : (() => {
            const filtrada = linhasPagar.filter(l => {
              const catOk = catFiltro === 'todas' || l.categoriaNome === catFiltro;
              const statusReal = ehVencido(l) ? 'vencido' : l.status;
              const statusOk = filtroStatus === 'todos' || statusReal === filtroStatus;
              return catOk && statusOk;
            });
            if (filtrada.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nada encontrado com esse filtro.</p>;
            const totalPaginas = Math.max(1, Math.ceil(filtrada.length / itensPorPagina));
            const paginaAtual = Math.min(paginaLista, totalPaginas);
            const pagina = filtrada.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
            return (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{filtrada.length} lançamento{filtrada.length !== 1 ? 's' : ''}</p>
                {agruparPorData(pagina).map(([dia, itens]) => (
                  <div key={dia} style={{ marginBottom: 12 }}>
                    <div className="fm-dia-header">
                      <span>{dia !== 'sem-data' ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                      <strong>{fmt(itens.reduce((s, i) => s + i.valor, 0))}</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {itens.map(l => {
                        const status = ehVencido(l) ? 'vencido' : l.status;
                        return (
                          <div key={l.id} className="card fm-card-linha-completa">
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{l.descricao}</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                  {l.categoriaNome && <span className="fm-tag-neutra">{l.categoriaNome}</span>}
                                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{new Date(l.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmt(l.valor)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <span className={`badge badge-${status === 'pago' ? 'green' : status === 'vencido' ? 'red' : 'yellow'}`} style={{ fontSize: 10 }}>
                                {status === 'pago' ? 'Pago' : status === 'vencido' ? 'Vencido' : 'Pendente'}
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => marcarPagamentoLocal(l, l.status !== 'pago')}>
                                  {l.status === 'pago' ? 'Desfazer' : 'Pagar'}
                                </button>
                                {l.origem === 'avulso' && (
                                  <>
                                    <button className="btn-ghost" onClick={() => abrirEditar(l)}>Editar</button>
                                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluir(l)}><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {totalPaginas > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                    <button className="btn-secondary" disabled={paginaAtual <= 1} onClick={() => setPaginaLista(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtual} / {totalPaginas}</span>
                    <button className="btn-secondary" disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaLista(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
      </div>

      <nav className="bottom-nav">
        {ABAS.slice(0, 2).map(({ key, label, Icon }) => (
          <button key={key} className={`bottom-nav-item${key === tela ? ' active' : ''}`} onClick={() => irPara(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        {ABAS.slice(2).map(({ key, label, Icon }) => (
          <button key={key} className={`bottom-nav-item${key === tela ? ' active' : ''}`} onClick={() => irPara(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {editandoLancamento && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditandoLancamento(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar lançamento</h2>
              <button className="btn-ghost" onClick={() => setEditandoLancamento(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Conta bancária *</label>
                  <select value={formEdit.contaBancariaId} onChange={e => setFormEdit(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select value={formEdit.categoriaId} onChange={e => setFormEdit(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categoriasPagar.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input value={formEdit.descricao} onChange={e => setFormEdit(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <input type="number" step={0.01} value={formEdit.valor} onChange={e => setFormEdit(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vencimento</label>
                    <input type="date" value={formEdit.vencimento} onChange={e => setFormEdit(f => ({ ...f, vencimento: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={formEdit.observacao} onChange={e => setFormEdit(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                {(editandoLancamento.modo === 'fixa' || editandoLancamento.modo === 'parcelada') && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {editandoLancamento.modo === 'fixa'
                      ? 'Esse é um lançamento fixo. Pode alterar só este mês, ou também os próximos.'
                      : 'Essa é uma parcela. Pode alterar só esta, ou também as demais ainda não pagas.'}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditandoLancamento(null)}>Cancelar</button>
              {(editandoLancamento.modo === 'fixa' || editandoLancamento.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" disabled={salvandoEdit} onClick={() => salvarEdicao('unica')}>Só esta</button>
                  <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicao('todas')}>
                    {editandoLancamento.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicao('unica')}>Salvar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir lançamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluir.descricao}</strong>?
              </p>
              {(confirmExcluir.modo === 'fixa' || confirmExcluir.modo === 'parcelada') && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                  {confirmExcluir.modo === 'fixa'
                    ? 'É um lançamento fixo. Pode excluir só este mês, ou parar de gerar os próximos.'
                    : 'É uma parcela. Pode excluir só esta, ou todas as futuras ainda não pagas.'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              {(confirmExcluir.modo === 'fixa' || confirmExcluir.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" onClick={() => excluirLinha('unica')}>Só esta</button>
                  <button className="btn-danger" onClick={() => excluirLinha('todas')}>
                    {confirmExcluir.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => excluirLinha('unica')}>Excluir</button>
              )}
            </div>
          </div>
        </div>
      )}

      {editandoReceber && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditandoReceber(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar lançamento</h2>
              <button className="btn-ghost" onClick={() => setEditandoReceber(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Conta bancária *</label>
                  <select value={formEditReceber.contaBancariaId} onChange={e => setFormEditReceber(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select value={formEditReceber.categoriaId} onChange={e => setFormEditReceber(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categoriasReceber.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input value={formEditReceber.descricao} onChange={e => setFormEditReceber(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <input type="number" step={0.01} value={formEditReceber.valor} onChange={e => setFormEditReceber(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vencimento</label>
                    <input type="date" value={formEditReceber.vencimento} onChange={e => setFormEditReceber(f => ({ ...f, vencimento: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={formEditReceber.observacao} onChange={e => setFormEditReceber(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                {(editandoReceber.modo === 'fixa' || editandoReceber.modo === 'parcelada') && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {editandoReceber.modo === 'fixa'
                      ? 'Esse é um lançamento fixo. Pode alterar só este mês, ou também os próximos.'
                      : 'Essa é uma parcela. Pode alterar só esta, ou também as demais ainda não pagas.'}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditandoReceber(null)}>Cancelar</button>
              {(editandoReceber.modo === 'fixa' || editandoReceber.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" disabled={salvandoEditReceber} onClick={() => salvarEdicaoReceber('unica')}>Só esta</button>
                  <button className="btn-primary" disabled={salvandoEditReceber} onClick={() => salvarEdicaoReceber('todas')}>
                    {editandoReceber.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-primary" disabled={salvandoEditReceber} onClick={() => salvarEdicaoReceber('unica')}>Salvar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmExcluirReceber && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirReceber(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir lançamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirReceber(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirReceber.descricao}</strong>?
              </p>
              {(confirmExcluirReceber.modo === 'fixa' || confirmExcluirReceber.modo === 'parcelada') && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                  {confirmExcluirReceber.modo === 'fixa'
                    ? 'É um lançamento fixo. Pode excluir só este mês, ou parar de gerar os próximos.'
                    : 'É uma parcela. Pode excluir só esta, ou todas as futuras ainda não pagas.'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirReceber(null)}>Cancelar</button>
              {(confirmExcluirReceber.modo === 'fixa' || confirmExcluirReceber.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" onClick={() => excluirReceber('unica')}>Só esta</button>
                  <button className="btn-danger" onClick={() => excluirReceber('todas')}>
                    {confirmExcluirReceber.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => excluirReceber('unica')}>Excluir</button>
              )}
            </div>
          </div>
        </div>
      )}

      {menuAberto && (
        <div className="modal-overlay" onClick={() => setMenuAberto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}>Menu</span>
              <button className="btn-ghost" onClick={() => setMenuAberto(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="sidebar-link" onClick={() => { setMenuAberto(false); navigate('/ajuda'); }}>
                <HelpCircle size={16} /> <span>Central de Ajuda</span>
              </button>
              <button className="sidebar-link" onClick={() => { setMenuAberto(false); navigate('/configuracoes'); }}>
                <Settings size={16} /> <span>Configurações</span>
              </button>
              <button className="sidebar-link" onClick={logout} style={{ marginTop: 8, color: 'var(--red)' }}>
                <LogOut size={16} /> <span>Sair ({usuario?.nome})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tela === 'receber' && (
        <>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--green)', opacity: 0.7, marginBottom: 14 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>A Receber</h2>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => navigate('/financeiro?aba=receber&novo=receber')}>
              <Plus size={14} /> Novo
            </button>
          </div>

          <div className="card fm-card" style={{ marginBottom: 14, overflow: 'visible', padding: '14px 10px' }}>
            <div className="cx-tipo-toggle" style={{ marginBottom: 10 }}>
              <button className={periodoTipoReceber === 'mes' ? 'active' : ''} onClick={() => setPeriodoTipoReceber('mes')}>Mês</button>
              <button className={periodoTipoReceber === 'personalizado' ? 'active' : ''} onClick={() => {
                setPeriodoTipoReceber('personalizado');
                setPeriodoDeReceber(new Date(anoReceber, mesReceber, 1).toISOString().slice(0, 10));
                setPeriodoAteReceber(new Date(anoReceber, mesReceber + 1, 0).toISOString().slice(0, 10));
              }}>Personalizado</button>
            </div>
            {periodoTipoReceber === 'mes' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <button className="btn-secondary" onClick={() => navMesReceber(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{MESES[mesReceber]} {anoReceber}</span>
                <button className="btn-secondary" onClick={() => navMesReceber(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="date" value={periodoDeReceber} onChange={e => setPeriodoDeReceber(e.target.value)} />
                <span style={{ color: 'var(--text-3)' }}>até</span>
                <input type="date" value={periodoAteReceber} onChange={e => setPeriodoAteReceber(e.target.value)} />
              </div>
            )}
          </div>

          {carregandoReceber ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
          ) : (() => {
            const totalRecebido = linhasReceber.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0);
            const totalAberto = linhasReceber.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0);
            const totalMes = totalRecebido + totalAberto;
            return (
              <div className="card fm-card" style={{ marginBottom: 14 }}>
                <div className="fm-card-kicker" style={{ textAlign: 'center' }}>Total a receber</div>
                <div className="fm-valor-destaque" style={{ color: 'var(--green)', fontSize: 26, textAlign: 'center' }}>{fmt(totalAberto)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Recebido</div>
                    <strong style={{ fontSize: 14, color: 'var(--green)' }}>{fmt(totalRecebido)}</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Total do mês</div>
                    <strong style={{ fontSize: 14 }}>{fmt(totalMes)}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="fm-pills">
            {(['todos', 'pendente', 'pago'] as const).map(f => (
              <button key={f} className={`fm-pill${filtroStatusReceber === f ? ' active' : ''}`} onClick={() => setFiltroStatusReceber(f)}>
                {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendente' : 'Recebido'}
              </button>
            ))}
          </div>
          {categoriasReceber.length > 0 && (
            <select value={catFiltroReceber} onChange={e => setCatFiltroReceber(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="todas">Todas categorias</option>
              <option value="__plano__">💳 Mensalidades (Planos)</option>
              {categoriasReceber.map(c => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          )}

          {carregandoReceber ? null : (() => {
            const filtrada = linhasReceber.filter(l => {
              const catOk = catFiltroReceber === 'todas'
                ? true
                : catFiltroReceber === '__plano__'
                ? l.origem === 'plano'
                : l.origem === 'avulso' && l.categoriaNome === catFiltroReceber;
              const statusOk = filtroStatusReceber === 'todos' || l.status === filtroStatusReceber;
              return catOk && statusOk;
            });
            if (filtrada.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nada encontrado com esse filtro.</p>;
            const totalPaginas = Math.max(1, Math.ceil(filtrada.length / itensPorPagina));
            const paginaAtual = Math.min(paginaListaReceber, totalPaginas);
            const pagina = filtrada.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
            return (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{filtrada.length} lançamento{filtrada.length !== 1 ? 's' : ''}</p>
                {agruparPorData(pagina).map(([dia, itens]) => (
                  <div key={dia} style={{ marginBottom: 12 }}>
                    <div className="fm-dia-header" style={{ color: 'var(--green)', background: 'var(--green-bg)', borderColor: 'rgba(74,222,128,0.3)' }}>
                      <span>{dia !== 'sem-data' ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                      <strong>{fmt(itens.reduce((s, i) => s + i.valor, 0))}</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {itens.map(l => {
                        const vencida = l.status === 'pendente' && new Date(l.vencimento) < new Date(new Date().toDateString());
                        return (
                          <div key={l.id} className="card fm-card-linha-completa">
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{l.descricao}</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                                  {l.categoriaNome && <span className="fm-tag-neutra">{l.categoriaNome}</span>}
                                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{new Date(l.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                  {l.origem === 'plano' && <span className="fm-tag-neutra">Plano</span>}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmt(l.valor)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <span className={`badge badge-${l.status === 'pago' ? 'green' : vencida ? 'red' : 'yellow'}`} style={{ fontSize: 10 }}>
                                {l.status === 'pago' ? 'Recebido' : vencida ? 'Vencido' : 'Pendente'}
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {l.origem === 'avulso' ? (
                                  <>
                                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => marcarRecebimentoLocal(l, l.status !== 'pago')}>
                                      {l.status === 'pago' ? 'Desfazer' : 'Receber'}
                                    </button>
                                    <button className="btn-ghost" onClick={() => abrirEditarReceber(l)}>Editar</button>
                                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluirReceber(l)}><Trash2 size={14} /></button>
                                  </>
                                ) : (
                                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => navigate('/planos?aba=assinantes')}>Ver em Planos</button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {totalPaginas > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                    <button className="btn-secondary" disabled={paginaAtual <= 1} onClick={() => setPaginaListaReceber(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtual} / {totalPaginas}</span>
                    <button className="btn-secondary" disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaListaReceber(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}