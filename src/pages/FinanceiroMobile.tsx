import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet, Menu, X, LogOut, HelpCircle, Settings, Plus, Check, Trash2, ChevronLeft, ChevronRight, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { setMobileShellOverride } from '../utils/mobileShellOverride';
import { BankBadge, BANCOS } from '../utils/bancos';
import './FinanceiroMobile.css';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface Conta { id: string; nome: string; saldoInicial: number; saldoAtual: number; ativa: boolean; banco?: string | null; limite: number; }
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
interface Cartao { id: string; nome: string; limite: number; diaFechamento: number; diaVencimento: number; contaBancariaId: string; ativo: boolean; taxaJurosMensal: number; }
interface ItemFaturaDetalhe { id: string; descricao: string; valor: number; dataCompra: string; categoriaNome: string | null; categoriaId: string | null; modo: string; observacao: string | null; }
interface AntecipadoItem { id: string; valor: number; data: string; contaBancariaId: string; observacao: string | null; }
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
function iconeCategoria(categorias: { nome: string; icone: string | null }[], nome: string | null) {
  if (!nome) return null;
  return categorias.find(c => c.nome === nome)?.icone ?? null;
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
  const [tela, setTela] = useState<'visao' | 'pagar' | 'receber' | 'cartoes' | 'contas'>('visao');
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

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cartoesResumo, setCartoesResumo] = useState<Record<string, { usado: number; disponivel: number; qtdCompras: number; status: string }>>({});
  const [carregandoListaCartoes, setCarregandoListaCartoes] = useState(true);
  const [carregandoResumoCartoes, setCarregandoResumoCartoes] = useState(true);
  const [modalNovoCartao, setModalNovoCartao] = useState(false);
  const [formCartao, setFormCartao] = useState({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: '', taxaJurosMensal: '' });
  const [salvandoCartao, setSalvandoCartao] = useState(false);
  const [faturaAberta, setFaturaAberta] = useState<Cartao | null>(null);
  const [faturaDados, setFaturaDados] = useState<{ vencimento: string; total: number; totalAntecipado?: number; restante?: number; status: string; itens: ItemFaturaDetalhe[]; antecipados?: AntecipadoItem[] } | null>(null);  const [carregandoFatura, setCarregandoFatura] = useState(false);
  const [faturaAno, setFaturaAno] = useState(new Date().getFullYear());
  const [faturaMes, setFaturaMes] = useState(new Date().getMonth() + 1);
  const [referenciasFatura, setReferenciasFatura] = useState<{ aberta: { ano: number; mes: number }; fechada: { ano: number; mes: number; total: number; status: string } } | null>(null);
  const [modalLancarCompra, setModalLancarCompra] = useState(false);
  const [descricoesRecentesCartao, setDescricoesRecentesCartao] = useState<string[]>([]);
  const [formCompra, setFormCompra] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10),
    categoriaId: '', totalParcelas: '2',
  });
  const [editandoItemCartao, setEditandoItemCartao] = useState<ItemFaturaDetalhe | null>(null);
  const [formEditItemCartao, setFormEditItemCartao] = useState({ descricao: '', valor: '', dataCompra: '', categoriaId: '' });
  const [confirmExcluirItemCartao, setConfirmExcluirItemCartao] = useState<ItemFaturaDetalhe | null>(null);
  const [modalPagarFatura, setModalPagarFatura] = useState(false);
  const [formPagFatura, setFormPagFatura] = useState({
    modo: 'total' as 'total' | 'parcial' | 'parcelado', valorPago: '', totalParcelas: '3',
    valorEntrada: '', contaBancariaId: '',
  });
  const [modalAntecipado, setModalAntecipado] = useState(false);
  const [formAntecipado, setFormAntecipado] = useState({ valor: '', data: new Date().toISOString().slice(0, 10), contaBancariaId: '', observacao: '' });
  const [confirmExcluirAntecipado, setConfirmExcluirAntecipado] = useState<AntecipadoItem | null>(null);
  const [mostrarFormConta, setMostrarFormConta] = useState(false);
  const [editandoConta, setEditandoConta] = useState<Conta | null>(null);
  const [formConta, setFormConta] = useState({ nome: '', saldoInicial: '', banco: '', limite: '' });
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [modalAjuste, setModalAjuste] = useState<Conta | null>(null);
  const [formAjuste, setFormAjuste] = useState({ tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', valor: '', novoSaldo: '', observacao: '' });
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [formTransf, setFormTransf] = useState({ contaOrigemId: '', contaDestinoId: '', valor: '', registrar: true, observacao: '' });
  const [modalNovoLanc, setModalNovoLanc] = useState<'pagar' | 'receber' | null>(null);
  const [descricoesRecentesLanc, setDescricoesRecentesLanc] = useState<string[]>([]);
  const [salvandoNovoLanc, setSalvandoNovoLanc] = useState(false);
  const [formNovoLanc, setFormNovoLanc] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    contaBancariaId: '', categoriaId: '', descricao: '', valor: '', observacao: '',
    vencimento: new Date().toISOString().slice(0, 10),
    totalParcelas: '2', diaVencimento: '10',
    tipoParcelamento: 'quantidade' as 'quantidade' | 'dataFim',
    dataFim: new Date().toISOString().slice(0, 10),
    jaPago: false, dataInicio: new Date().toISOString().slice(0, 10), avisar: true,
  });
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

  function carregarCartoes() {
    setCarregandoListaCartoes(true);
    setCarregandoResumoCartoes(true);
    api.get<Cartao[]>('/api/financeiro/cartoes').then(setCartoes).catch(() => {}).finally(() => setCarregandoListaCartoes(false));
    api.get<any[]>('/api/financeiro/cartoes-resumo').then(lista => {
      const mapa: Record<string, any> = {};
      lista.forEach(c => { mapa[c.id] = { usado: c.usado, disponivel: c.disponivel, qtdCompras: c.qtdCompras, status: c.status }; });
      setCartoesResumo(mapa);
    }).catch(() => {}).finally(() => setCarregandoResumoCartoes(false));
  }

  useEffect(() => {
    if (tela !== 'cartoes') return;
    carregarCartoes();
  }, [tela]);

  async function salvarNovoCartao() {
    if (!formCartao.nome.trim() || !formCartao.contaBancariaId) return;
    setSalvandoCartao(true);
    try {
      await api.post('/api/financeiro/cartoes', {
        nome: formCartao.nome.trim(),
        limite: parseFloat(formCartao.limite) || 0,
        diaFechamento: parseInt(formCartao.diaFechamento) || 10,
        diaVencimento: parseInt(formCartao.diaVencimento) || 15,
        contaBancariaId: formCartao.contaBancariaId,
        taxaJurosMensal: parseFloat(formCartao.taxaJurosMensal) || 0,
      });
      setModalNovoCartao(false);
      setFormCartao({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: '', taxaJurosMensal: '' });
      carregarCartoes();
    } catch {} finally { setSalvandoCartao(false); }
  }

  async function carregarFatura(cartaoId: string, ano: number, mes: number) {
    setFaturaDados(null);
    setCarregandoFatura(true);
    try {
      const res = await api.get<any>(`/api/financeiro/cartoes/${cartaoId}/fatura?ano=${ano}&mes=${mes}`);
      setFaturaDados(res);
    } catch {
      setFaturaDados({ vencimento: '', total: 0, status: 'pendente', itens: [] });
    } finally {
      setCarregandoFatura(false);
    }
  }

  function abrirFatura(c: Cartao) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    setFaturaAberta(c);
    setFaturaAno(ano);
    setFaturaMes(mes);
    carregarFatura(c.id, ano, mes);
    api.get<any>(`/api/financeiro/cartoes/${c.id}/faturas-referencia`).then(setReferenciasFatura).catch(() => {});
  }

  function navFaturaMes(delta: number) {
    if (!faturaAberta) return;
    let novoMes = faturaMes + delta, novoAno = faturaAno;
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    setFaturaMes(novoMes);
    setFaturaAno(novoAno);
    carregarFatura(faturaAberta.id, novoAno, novoMes);
  }

  function irParaReferenciaFatura(tipo: 'aberta' | 'fechada') {
    if (!faturaAberta || !referenciasFatura) return;
    const ref = referenciasFatura[tipo];
    setFaturaAno(ref.ano);
    setFaturaMes(ref.mes);
    carregarFatura(faturaAberta.id, ref.ano, ref.mes);
  }

  async function pagarFaturaSimples(pago: boolean) {
    if (!faturaAberta) return;
    try {
      await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fatura/pagamento?ano=${faturaAno}&mes=${faturaMes}`, { modo: pago ? 'total' : 'desfazer' });
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
    } catch {}
  }

  function abrirLancarCompra() {
    setFormCompra({ modo: 'avulsa', descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10), categoriaId: '', totalParcelas: '2' });
    setModalLancarCompra(true);
    api.get<string[]>('/api/financeiro/cartoes/lancamentos/descricoes').then(setDescricoesRecentesCartao).catch(() => {});
  }

  async function lancarCompra() {
    if (!faturaAberta) return;
    if (!formCompra.descricao.trim() || !formCompra.valor) return;
    try {
      if (formCompra.modo === 'avulsa') {
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/lancamentos`, {
          descricao: formCompra.descricao.trim(), valor: parseFloat(formCompra.valor),
          dataCompra: formCompra.dataCompra, categoriaId: formCompra.categoriaId || null,
        });
      } else if (formCompra.modo === 'parcelada') {
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/lancamentos/parcelado`, {
          descricao: formCompra.descricao.trim(), valorParcela: parseFloat(formCompra.valor),
          totalParcelas: parseInt(formCompra.totalParcelas) || 2,
          dataCompra: formCompra.dataCompra, categoriaId: formCompra.categoriaId || null,
        });
      } else {
        const diaEscolhido = formCompra.dataCompra ? parseInt(formCompra.dataCompra.split('-')[2]) : 1;
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fixos`, {
          descricao: formCompra.descricao.trim(), valor: parseFloat(formCompra.valor),
          categoriaId: formCompra.categoriaId || null, diaCompra: diaEscolhido,
        });
      }
      setModalLancarCompra(false);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
    } catch {}
  }

  function abrirEditarItemCartao(item: ItemFaturaDetalhe) {
    setEditandoItemCartao(item);
    setFormEditItemCartao({
      descricao: item.descricao.replace(/\s\(\d+\/\d+\)$/, ''),
      valor: String(item.valor),
      dataCompra: item.dataCompra.slice(0, 10),
      categoriaId: item.categoriaId ?? '',
    });
  }

  async function salvarEdicaoItemCartao(modo: 'unica' | 'todas') {
    if (!editandoItemCartao || !faturaAberta) return;
    try {
      await api.put(`/api/financeiro/cartoes/lancamentos/${editandoItemCartao.id}?modo=${modo}`, {
        descricao: formEditItemCartao.descricao.trim(),
        valor: parseFloat(formEditItemCartao.valor),
        dataCompra: formEditItemCartao.dataCompra,
        categoriaId: formEditItemCartao.categoriaId || null,
      });
      setEditandoItemCartao(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
    } catch {}
  }

  async function excluirItemCartao(modo: 'unica' | 'todas') {
    if (!confirmExcluirItemCartao || !faturaAberta) return;
    try {
      await api.delete(`/api/financeiro/cartoes/lancamentos/${confirmExcluirItemCartao.id}?modo=${modo}`);
      setConfirmExcluirItemCartao(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
    } catch {}
  }

  async function pagarFaturaModal(modo: string, extra?: any) {
    if (!faturaAberta) return;
    try {
      await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fatura/pagamento?ano=${faturaAno}&mes=${faturaMes}`, { modo, ...extra });
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
      setModalPagarFatura(false);
    } catch {}
  }

  function abrirNovoAntecipado() {
    setFormAntecipado({ valor: '', data: new Date().toISOString().slice(0, 10), contaBancariaId: faturaAberta?.contaBancariaId ?? '', observacao: '' });
    setModalAntecipado(true);
  }

  async function lancarAntecipado() {
    if (!faturaAberta) return;
    if (!formAntecipado.valor || parseFloat(formAntecipado.valor) <= 0 || !formAntecipado.contaBancariaId) return;
    try {
      await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fatura/antecipado?ano=${faturaAno}&mes=${faturaMes}`, {
        valor: parseFloat(formAntecipado.valor), data: formAntecipado.data,
        contaBancariaId: formAntecipado.contaBancariaId, observacao: formAntecipado.observacao || null,
      });
      setModalAntecipado(false);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
    } catch {}
  }

  async function excluirAntecipado() {
    if (!confirmExcluirAntecipado || !faturaAberta) return;
    try {
      await api.delete(`/api/financeiro/cartoes/fatura/antecipado/${confirmExcluirAntecipado.id}`);
      setConfirmExcluirAntecipado(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarCartoes();
    } catch {}
  }

  function recarregarContas() {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }

  function abrirNovaConta() {
    setEditandoConta(null);
    setFormConta({ nome: '', saldoInicial: '', banco: '', limite: '' });
    setMostrarFormConta(true);
  }

  function abrirEditarConta(c: Conta) {
    setEditandoConta(c);
    setFormConta({ nome: c.nome, saldoInicial: String(c.saldoInicial), banco: c.banco ?? '', limite: String(c.limite ?? '') });
    setMostrarFormConta(true);
  }

  async function salvarConta() {
    if (!formConta.nome.trim()) return;
    setSalvandoConta(true);
    try {
      const payload = { nome: formConta.nome.trim(), saldoInicial: parseFloat(formConta.saldoInicial) || 0, banco: formConta.banco || null, limite: parseFloat(formConta.limite) || 0 };
      if (editandoConta) await api.put(`/api/financeiro/contas/${editandoConta.id}`, payload);
      else await api.post('/api/financeiro/contas', payload);
      setMostrarFormConta(false);
      setEditandoConta(null);
      recarregarContas();
    } catch {} finally { setSalvandoConta(false); }
  }

  async function alternarConta(c: Conta) {
    try {
      await api.patch(`/api/financeiro/contas/${c.id}/ativo`, {});
      recarregarContas();
    } catch {}
  }

  function abrirAjuste(c: Conta) {
    setModalAjuste(c);
    setFormAjuste({ tipo: 'entrada', valor: '', novoSaldo: String(c.saldoAtual), observacao: '' });
  }

  async function salvarAjuste() {
    if (!modalAjuste) return;
    try {
      await api.post(`/api/financeiro/contas/${modalAjuste.id}/ajuste`, {
        tipo: formAjuste.tipo,
        valor: formAjuste.tipo !== 'ajuste' ? parseFloat(formAjuste.valor) || 0 : null,
        novoSaldo: parseFloat(formAjuste.novoSaldo) || 0,
        observacao: formAjuste.observacao || null,
      });
      setModalAjuste(null);
      recarregarContas();
    } catch {}
  }

  async function salvarTransferencia() {
    if (!formTransf.contaOrigemId || !formTransf.contaDestinoId || formTransf.contaOrigemId === formTransf.contaDestinoId) return;
    if (!formTransf.valor || parseFloat(formTransf.valor) <= 0) return;
    try {
      await api.post('/api/financeiro/contas/transferencia', {
        contaOrigemId: formTransf.contaOrigemId,
        contaDestinoId: formTransf.contaDestinoId,
        valor: parseFloat(formTransf.valor),
        registrar: formTransf.registrar,
        observacao: formTransf.observacao || null,
      });
      setModalTransferencia(false);
      setFormTransf({ contaOrigemId: '', contaDestinoId: '', valor: '', registrar: true, observacao: '' });
      recarregarContas();
    } catch {}
  }

  function abrirNovoLancamento(aba: 'pagar' | 'receber') {
    setFormNovoLanc({
      modo: 'avulsa', contaBancariaId: contas[0]?.id ?? '', categoriaId: '', descricao: '', valor: '', observacao: '',
      vencimento: new Date().toISOString().slice(0, 10), totalParcelas: '2', diaVencimento: '10',
      tipoParcelamento: 'quantidade', dataFim: new Date().toISOString().slice(0, 10),
      jaPago: false, dataInicio: new Date().toISOString().slice(0, 10), avisar: true,
    });
    setModalNovoLanc(aba);
    api.get<string[]>(`/api/financeiro/lancamentos/descricoes?tipo=${aba}`).then(setDescricoesRecentesLanc).catch(() => {});
  }

  async function salvarNovoLancamento() {
    if (!modalNovoLanc) return;
    if (!formNovoLanc.contaBancariaId || !formNovoLanc.descricao.trim() || !formNovoLanc.valor) return;
    setSalvandoNovoLanc(true);
    try {
      if (formNovoLanc.modo === 'avulsa') {
        await api.post('/api/financeiro/lancamentos/avulso', {
          contaBancariaId: formNovoLanc.contaBancariaId, tipo: modalNovoLanc,
          descricao: formNovoLanc.descricao.trim(), categoriaId: formNovoLanc.categoriaId || null,
          observacao: formNovoLanc.observacao || null, valor: parseFloat(formNovoLanc.valor), vencimento: formNovoLanc.vencimento,
          jaPago: formNovoLanc.jaPago, avisar: formNovoLanc.avisar,
        });
      } else if (formNovoLanc.modo === 'parcelada') {
        await api.post('/api/financeiro/lancamentos/parcelado', {
          contaBancariaId: formNovoLanc.contaBancariaId, tipo: modalNovoLanc,
          descricao: formNovoLanc.descricao.trim(), categoriaId: formNovoLanc.categoriaId || null,
          observacao: formNovoLanc.observacao || null, valorParcela: parseFloat(formNovoLanc.valor),
          totalParcelas: formNovoLanc.tipoParcelamento === 'quantidade' ? (parseInt(formNovoLanc.totalParcelas) || 2) : null,
          dataFim: formNovoLanc.tipoParcelamento === 'dataFim' ? formNovoLanc.dataFim : null,
          primeiroVencimento: formNovoLanc.vencimento, jaPago: formNovoLanc.jaPago, avisar: formNovoLanc.avisar,
        });
      } else {
        await api.post('/api/financeiro/fixos', {
          contaBancariaId: formNovoLanc.contaBancariaId, tipo: modalNovoLanc,
          descricao: formNovoLanc.descricao.trim(), categoriaId: formNovoLanc.categoriaId || null,
          observacao: formNovoLanc.observacao || null, valor: parseFloat(formNovoLanc.valor),
          diaVencimento: parseInt(formNovoLanc.diaVencimento) || 10, jaPago: formNovoLanc.jaPago,
          dataInicio: formNovoLanc.dataInicio || null, avisar: formNovoLanc.avisar,
        });
      }
      const abaFechada = modalNovoLanc;
      setModalNovoLanc(null);
      if (abaFechada === 'pagar') recarregarPagar(); else recarregarReceber();
      recarregarContas();
    } catch {} finally { setSalvandoNovoLanc(false); }
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
  const [carregandoContas, setCarregandoContas] = useState(true);
  const [carregandoResumoAnual, setCarregandoResumoAnual] = useState(true);
  const [carregandoAlertas, setCarregandoAlertas] = useState(true);
  const [resumo, setResumo] = useState<{ pagar: ResumoTipo; receber: ResumoTipo } | null>(null);
  const [resumoAnual, setResumoAnual] = useState<{ mes: number; pagar: number; receber: number; saldo: number }[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [mostrarMesAMes, setMostrarMesAMes] = useState(false);
  const anoRef = new Date().getFullYear();

  useEffect(() => {
    setCarregandoContas(true);
    Promise.all([
      api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {}),
      api.get<any>(`/api/financeiro/resumo-mensal?ano=${anoRef}&mes=${new Date().getMonth() + 1}`).then(setResumo).catch(() => {}),
    ]).finally(() => setCarregandoContas(false));
  }, []);

  useEffect(() => {
    setCarregandoResumoAnual(true);
    api.get<any[]>(`/api/financeiro/resumo-anual?ano=${anoRef}`).then(setResumoAnual).catch(() => {}).finally(() => setCarregandoResumoAnual(false));
  }, []);

  useEffect(() => {
    setCarregandoAlertas(true);
    api.get<Alerta[]>('/api/financeiro/alertas-vencimento?dias=7').then(setAlertas).catch(() => {}).finally(() => setCarregandoAlertas(false));
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
    setTela(destino);
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
      <>
        <div className="card fm-card">
          <div className="fm-card-kicker">Saldo por conta</div>
          {carregandoContas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><div className="layout-spinner" style={{ width: 22, height: 22 }} /></div>
          ) : (
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
          )}
        </div>

        {carregandoContas ? (
          <div className="card fm-card" style={{ margin: '14px 0', display: 'flex', justifyContent: 'center', padding: 20 }}><div className="layout-spinner" /></div>
        ) : (
        <>
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
        </>
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
            {!carregandoResumoAnual && (
            <button className="fm-link-btn" onClick={() => setMostrarMesAMes(v => !v)}>
              {mostrarMesAMes ? 'Ocultar mês a mês' : 'Ver mês a mês'}
            </button>
            )}
          </div>
          {carregandoResumoAnual ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><div className="layout-spinner" style={{ width: 24, height: 24 }} /></div>
          ) : (
          <>
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
          </>
          )}
        </div>

        <h3 className="fm-secao-titulo">Próximos vencimentos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {carregandoAlertas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><div className="layout-spinner" style={{ width: 22, height: 22 }} /></div>
          ) : proximos.length === 0 ? (
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
      )}

      {tela === 'pagar' && (
        <>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--red)', opacity: 0.7, marginBottom: 14 }} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <button className="fm-fab-novo" style={{ background: 'var(--red-bg)', borderColor: 'var(--red)', color: 'var(--red)' }}
              onClick={() => abrirNovoLancamento('pagar')}>
              <Plus size={20} />
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
                                <div style={{ fontSize: 14, color: 'var(--text-1)' }}>
                                  {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                                  {l.descricao}
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                  {l.categoriaNome && <span className="fm-tag-neutra">{iconeCategoria(categoriasPagar, l.categoriaNome)} {l.categoriaNome}</span>}
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

      {tela === 'receber' && (
        <>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--green)', opacity: 0.7, marginBottom: 14 }} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <button className="fm-fab-novo" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)', color: 'var(--green)' }}
              onClick={() => abrirNovoLancamento('receber')}>
              <Plus size={20} />
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
                                <div style={{ fontSize: 14, color: 'var(--text-1)' }}>
                                  {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                                  {l.descricao}
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                                  {l.categoriaNome && <span className="fm-tag-neutra">{iconeCategoria(categoriasReceber, l.categoriaNome)} {l.categoriaNome}</span>}
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

      {tela === 'cartoes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Cartões</h2>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => setModalNovoCartao(true)}>
              <Plus size={14} /> Novo cartão
            </button>
          </div>

          {carregandoListaCartoes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
          ) : cartoes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nenhum cartão cadastrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cartoes.map(c => {
                const r = cartoesResumo[c.id];
                const pct = r && c.limite > 0 ? Math.min(100, (r.usado / c.limite) * 100) : 0;
                return (
                  <div key={c.id} className="card fm-card" style={{ cursor: 'pointer', borderColor: pct > 85 ? 'rgba(248,113,113,0.4)' : undefined }}
                    onClick={() => abrirFatura(c)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', minWidth: 0 }}>{c.nome}</span>
                      {r && r.qtdCompras > 0 && <span className="fm-tag-neutra" style={{ flexShrink: 0 }}>{r.qtdCompras} compra{r.qtdCompras > 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Fecha dia {c.diaFechamento} · Vence dia {c.diaVencimento}</div>
                    {!r && carregandoResumoCartoes && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><div className="layout-spinner" style={{ width: 18, height: 18 }} /></div>
                    )}
                    {r && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                          <strong style={{ fontSize: 17, color: pct > 85 ? 'var(--red)' : 'var(--text-1)' }}>{fmt(r.usado)}</strong>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/ {fmt(c.limite)}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow, #d97706)' : 'var(--accent)', borderRadius: 3 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Disponível</span>
                          <strong style={{ fontSize: 13, color: r.disponivel >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(r.disponivel)}</strong>
                        </div>
                      </>
                    )}
                  </div>
               );
              })}
            </div>
          )}
        </>
      )}

      {tela === 'contas' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Contas</h2>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} onClick={abrirNovaConta}>
              <Plus size={14} /> Nova conta
            </button>
          </div>

          {carregandoContas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
          ) : contas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nenhuma conta cadastrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contas.map(c => (
                <div key={c.id} className="card fm-card" style={{ opacity: c.ativa ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-1)', minWidth: 0 }}>
                      <BankBadge bancoId={c.banco} tamanho={18} /> {c.nome}
                    </span>
                    <strong style={{ fontSize: 15, color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
                  </div>

                  {c.limite > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(100, (Math.abs(Math.min(0, c.saldoAtual)) / c.limite) * 100)}%`,
                          background: Math.abs(Math.min(0, c.saldoAtual)) >= c.limite ? 'var(--red)' : 'var(--yellow, #d97706)',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                        <span style={{ color: 'var(--text-3)' }}>Disponível</span>
                        <span style={{ color: 'var(--text-2)' }}>{fmt(Math.max(0, c.limite - Math.abs(Math.min(0, c.saldoAtual))))}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirAjuste(c)}>Ajustar</button>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirEditarConta(c)}>Editar</button>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => alternarConta(c)}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 4px', fontWeight: 600 }}>
                <span>Total</span>
                <strong style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotal)}</strong>
              </div>

              {contas.filter(c => c.ativa).length >= 2 && (
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setModalTransferencia(true)}>
                  🔁 Transferir entre contas
                </button>
              )}
            </div>
          )}
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

      {modalNovoCartao && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovoCartao(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Novo cartão</h2>
              <button className="btn-ghost" onClick={() => setModalNovoCartao(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Santander" />
                </div>
                <div className="form-group">
                  <label className="form-label">Conta de pagamento *</label>
                  <select value={formCartao.contaBancariaId} onChange={e => setFormCartao(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Limite (R$)</label>
                    <input type="number" step={0.01} value={formCartao.limite} onChange={e => setFormCartao(f => ({ ...f, limite: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taxa juros (%/mês)</label>
                    <input type="number" step={0.01} value={formCartao.taxaJurosMensal} onChange={e => setFormCartao(f => ({ ...f, taxaJurosMensal: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dia fechamento</label>
                    <input type="number" min={1} max={28} value={formCartao.diaFechamento} onChange={e => setFormCartao(f => ({ ...f, diaFechamento: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dia vencimento</label>
                    <input type="number" min={1} max={28} value={formCartao.diaVencimento} onChange={e => setFormCartao(f => ({ ...f, diaVencimento: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNovoCartao(false)}>Cancelar</button>
              <button className="btn-primary" disabled={salvandoCartao} onClick={salvarNovoCartao}>{salvandoCartao ? 'Salvando...' : 'Adicionar cartão'}</button>
            </div>
          </div>
        </div>
      )}

      {faturaAberta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFaturaAberta(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Fatura — {faturaAberta.nome}</h2>
              <button className="btn-ghost" onClick={() => setFaturaAberta(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <button className="fm-fab-novo" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={abrirLancarCompra}>
                  <Plus size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                <button className="btn-secondary" onClick={() => navFaturaMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{MESES[faturaMes - 1]} {faturaAno}</span>
                <button className="btn-secondary" onClick={() => navFaturaMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
              </div>

              {referenciasFatura && (
                <div className="cx-tipo-toggle" style={{ marginBottom: 12 }}>
                  <button className={faturaAno === referenciasFatura.fechada.ano && faturaMes === referenciasFatura.fechada.mes ? 'active' : ''}
                    onClick={() => irParaReferenciaFatura('fechada')}>
                    Fechada {referenciasFatura.fechada.status === 'pago' ? '(paga)' : '(a pagar)'}
                  </button>
                  <button className={faturaAno === referenciasFatura.aberta.ano && faturaMes === referenciasFatura.aberta.mes ? 'active' : ''}
                    onClick={() => irParaReferenciaFatura('aberta')}>
                    Aberta
                  </button>
                </div>
              )}

              {carregandoFatura ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}><div className="layout-spinner" /></div>
              ) : faturaDados && (
                <>
                  <div className="card fm-card" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Total do ciclo</div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(faturaDados.total)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${faturaDados.status === 'pago' ? 'badge-green' : faturaDados.status === 'parcial' ? 'badge-yellow' : 'badge-accent'}`}>
                          {faturaDados.status === 'pago' ? 'Paga' : faturaDados.status === 'parcial' ? 'Parcial' : 'Pendente'}
                        </span>
                        {faturaDados.total > 0 && (
                          faturaDados.status === 'pendente'
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                                setFormPagFatura(f => ({ ...f, contaBancariaId: faturaAberta.contaBancariaId }));
                                setModalPagarFatura(true);
                              }}>Pagar</button>
                            : <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => pagarFaturaModal('desfazer')}>Desfazer</button>
                        )}
                      </div>
                    </div>

                    {faturaDados.status === 'pendente' && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>💸 Antecipados</span>
                          <button className="btn-ghost" style={{ fontSize: 11 }} onClick={abrirNovoAntecipado}><Plus size={12} /> Adiantar</button>
                        </div>
                        {faturaDados.antecipados && faturaDados.antecipados.length > 0 ? (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                              {faturaDados.antecipados.map(a => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                  <span style={{ color: 'var(--text-2)' }}>{new Date(a.data).toLocaleDateString('pt-BR')} {a.observacao ? `— ${a.observacao}` : ''}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {fmt(a.valor)}
                                    <button className="btn-ghost" style={{ padding: 2, color: 'var(--red)' }} onClick={() => setConfirmExcluirAntecipado(a)}><Trash2 size={12} /></button>
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text-3)' }}>Falta pagar</span>
                              <strong>{fmt(faturaDados.restante ?? faturaDados.total)}</strong>
                            </div>
                          </>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Nenhum adiantamento ainda.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {faturaDados.itens.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhuma compra neste ciclo.</p>
                  ) : (
                    agruparPorData(faturaDados.itens.map(i => ({ ...i, vencimento: i.dataCompra }))).map(([dia, itens]) => (
                      <div key={dia} style={{ marginBottom: 12 }}>
                        <div className="fm-dia-header">
                          <span>{dia !== 'sem-data' ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                          <strong>{fmt(itens.reduce((s, i) => s + i.valor, 0))}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {itens.map(i => (
                            <div key={i.id} className="fm-card-linha" style={{ background: 'var(--bg-3)' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>
                                  {i.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                                  {i.descricao}
                                </div>
                                {i.categoriaNome && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{iconeCategoria(categoriasPagar, i.categoriaNome)} {i.categoriaNome}</div>}
                              </div>
                              <div style={{ fontSize: 14, color: 'var(--text-1)', marginRight: 8 }}>{fmt(i.valor)}</div>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={() => abrirEditarItemCartao(i)}>✎</button>
                                <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => setConfirmExcluirItemCartao(i)}><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setFaturaAberta(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {modalLancarCompra && faturaAberta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalLancarCompra(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Lançar compra — {faturaAberta.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalLancarCompra(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'avulsa', t: 'Avulsa' }, { v: 'parcelada', t: 'Parcelada' }, { v: 'fixa', t: 'Fixa/mensal' }].map(op => (
                    <button key={op.v} type="button" className={op.v === formCompra.modo ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                      onClick={() => setFormCompra(f => ({ ...f, modo: op.v as any }))}>{op.t}</button>
                  ))}
                </div>
                <input value={formCompra.descricao} onChange={e => setFormCompra(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Netflix" list="fm-desc-cartao" />
                <datalist id="fm-desc-cartao">
                  {descricoesRecentesCartao.map(d => <option key={d} value={d} />)}
                </datalist>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input type="number" step={0.01} value={formCompra.valor} onChange={e => setFormCompra(f => ({ ...f, valor: e.target.value }))}
                    placeholder={formCompra.modo === 'parcelada' ? 'Valor da parcela' : 'Valor'} />
                  {formCompra.modo === 'parcelada' ? (
                    <input type="number" min={2} max={24} value={formCompra.totalParcelas} onChange={e => setFormCompra(f => ({ ...f, totalParcelas: e.target.value }))} placeholder="Parcelas" />
                  ) : (
                    <input type="date" value={formCompra.dataCompra} onChange={e => setFormCompra(f => ({ ...f, dataCompra: e.target.value }))} />
                  )}
                </div>
                <select value={formCompra.categoriaId} onChange={e => setFormCompra(f => ({ ...f, categoriaId: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categoriasPagar.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                </select>
                {formCompra.modo === 'fixa' && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Repete todo mês no dia escolhido, até desativar.</p>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalLancarCompra(false)}>Cancelar</button>
              <button className="btn-primary" onClick={lancarCompra}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {editandoItemCartao && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditandoItemCartao(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar compra</h2>
              <button className="btn-ghost" onClick={() => setEditandoItemCartao(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <input value={formEditItemCartao.descricao} onChange={e => setFormEditItemCartao(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select value={formEditItemCartao.categoriaId} onChange={e => setFormEditItemCartao(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categoriasPagar.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$)</label>
                    <input type="number" step={0.01} value={formEditItemCartao.valor} onChange={e => setFormEditItemCartao(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data</label>
                    <input type="date" value={formEditItemCartao.dataCompra} onChange={e => setFormEditItemCartao(f => ({ ...f, dataCompra: e.target.value }))} />
                  </div>
                </div>
                {(editandoItemCartao.modo === 'fixa' || editandoItemCartao.modo === 'parcelada') && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {editandoItemCartao.modo === 'fixa' ? 'Compra fixa: pode alterar só este mês, ou também os próximos.' : 'Parcela: pode alterar só esta, ou também as futuras.'}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditandoItemCartao(null)}>Cancelar</button>
              {(editandoItemCartao.modo === 'fixa' || editandoItemCartao.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" onClick={() => salvarEdicaoItemCartao('unica')}>Só esta</button>
                  <button className="btn-primary" onClick={() => salvarEdicaoItemCartao('todas')}>
                    {editandoItemCartao.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => salvarEdicaoItemCartao('unica')}>Salvar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmExcluirItemCartao && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirItemCartao(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir compra</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirItemCartao(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirItemCartao.descricao}</strong>?</p>
              {(confirmExcluirItemCartao.modo === 'fixa' || confirmExcluirItemCartao.modo === 'parcelada') && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                  {confirmExcluirItemCartao.modo === 'fixa' ? 'Compra fixa: pode excluir só este mês, ou parar de gerar os próximos.' : 'Parcela: pode excluir só esta, ou todas as futuras.'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirItemCartao(null)}>Cancelar</button>
              {(confirmExcluirItemCartao.modo === 'fixa' || confirmExcluirItemCartao.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" onClick={() => excluirItemCartao('unica')}>Só esta</button>
                  <button className="btn-danger" onClick={() => excluirItemCartao('todas')}>
                    {confirmExcluirItemCartao.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => excluirItemCartao('unica')}>Excluir</button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalPagarFatura && faturaAberta && faturaDados && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPagarFatura(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Pagar fatura — {fmt(faturaDados.total)}</h2>
              <button className="btn-ghost" onClick={() => setModalPagarFatura(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Pagar com a conta</label>
                <select value={formPagFatura.contaBancariaId} onChange={e => setFormPagFatura(f => ({ ...f, contaBancariaId: e.target.value }))}>
                  {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[{ v: 'total', t: 'Pagar tudo' }, { v: 'parcial', t: 'Parcial' }, { v: 'parcelado', t: 'Parcelar' }].map(op => (
                  <button key={op.v} type="button" className={op.v === formPagFatura.modo ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                    onClick={() => setFormPagFatura(f => ({ ...f, modo: op.v as any }))}>{op.t}</button>
                ))}
              </div>

              {formPagFatura.modo === 'total' && (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Vai debitar {fmt(faturaDados.restante ?? faturaDados.total)} agora.</p>
              )}
              {formPagFatura.modo === 'parcial' && (
                <div className="form-group">
                  <label className="form-label">Quanto vai pagar agora (R$)</label>
                  <input type="number" step={0.01} value={formPagFatura.valorPago} onChange={e => setFormPagFatura(f => ({ ...f, valorPago: e.target.value }))} placeholder="0,00" />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>O restante entra na próxima fatura, com os juros do cartão.</p>
                </div>
              )}
              {formPagFatura.modo === 'parcelado' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Entrada (R$) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input type="number" step={0.01} value={formPagFatura.valorEntrada} onChange={e => setFormPagFatura(f => ({ ...f, valorEntrada: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Em quantas parcelas</label>
                    <input type="number" min={2} max={24} value={formPagFatura.totalParcelas} onChange={e => setFormPagFatura(f => ({ ...f, totalParcelas: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPagarFatura(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                if (formPagFatura.modo === 'total') pagarFaturaModal('total', { contaBancariaId: formPagFatura.contaBancariaId || null });
                else if (formPagFatura.modo === 'parcial') pagarFaturaModal('parcial', { valorPago: parseFloat(formPagFatura.valorPago) || 0, contaBancariaId: formPagFatura.contaBancariaId || null });
                else pagarFaturaModal('parcelado', {
                  totalParcelas: parseInt(formPagFatura.totalParcelas) || 3,
                  valorEntrada: parseFloat(formPagFatura.valorEntrada) || 0,
                  contaBancariaId: formPagFatura.contaBancariaId || null,
                });
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalAntecipado && faturaAberta && faturaDados && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAntecipado(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Adiantar pagamento</h2>
              <button className="btn-ghost" onClick={() => setModalAntecipado(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                Falta pagar: <strong style={{ color: 'var(--text-1)' }}>{fmt(faturaDados.restante ?? faturaDados.total)}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Valor adiantado (R$)</label>
                  <input type="number" step={0.01} value={formAntecipado.valor} onChange={e => setFormAntecipado(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data</label>
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={formAntecipado.data} onChange={e => setFormAntecipado(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Conta de origem</label>
                  <select value={formAntecipado.contaBancariaId} onChange={e => setFormAntecipado(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAntecipado(false)}>Cancelar</button>
              <button className="btn-primary" onClick={lancarAntecipado}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {confirmExcluirAntecipado && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirAntecipado(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir adiantamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirAntecipado(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir o adiantamento de <strong style={{ color: 'var(--text-1)' }}>{fmt(confirmExcluirAntecipado.valor)}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirAntecipado(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirAntecipado}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {mostrarFormConta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMostrarFormConta(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editandoConta ? 'Editar conta' : 'Nova conta'}</h2>
              <button className="btn-ghost" onClick={() => setMostrarFormConta(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={formConta.nome} onChange={e => setFormConta(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Conta corrente" />
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo inicial</label>
                  <input type="number" step={0.01} value={formConta.saldoInicial} onChange={e => setFormConta(f => ({ ...f, saldoInicial: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Limite (cheque especial) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="number" min={0} step={0.01} value={formConta.limite} onChange={e => setFormConta(f => ({ ...f, limite: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <button type="button" onClick={() => setFormConta(f => ({ ...f, banco: '' }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: formConta.banco === '' ? 'var(--accent-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}>
                      Nenhum
                    </button>
                    {BANCOS.map(b => (
                      <button key={b.id} type="button" onClick={() => setFormConta(f => ({ ...f, banco: b.id }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: formConta.banco === b.id ? 'var(--accent-bg)' : 'transparent', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}>
                        <BankBadge bancoId={b.id} tamanho={18} /> {b.nome}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarFormConta(false)}>Cancelar</button>
              <button className="btn-primary" disabled={salvandoConta} onClick={salvarConta}>{editandoConta ? 'Salvar' : 'Adicionar conta'}</button>
            </div>
          </div>
        </div>
      )}

      {modalAjuste && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAjuste(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Ajustar saldo — {modalAjuste.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalAjuste(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>Saldo atual: <strong style={{ color: 'var(--text-1)' }}>{fmt(modalAjuste.saldoAtual)}</strong></p>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Tipo de ajuste</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'entrada', t: 'Entrada' }, { v: 'saida', t: 'Saída' }, { v: 'ajuste', t: 'Definir saldo' }].map(op => (
                    <button key={op.v} type="button" className={op.v === formAjuste.tipo ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                      onClick={() => setFormAjuste(f => ({ ...f, tipo: op.v as any }))}>{op.t}</button>
                  ))}
                </div>
              </div>
              {formAjuste.tipo === 'ajuste' ? (
                <div className="form-group">
                  <label className="form-label">Novo saldo (R$)</label>
                  <input type="number" step={0.01} value={formAjuste.novoSaldo} onChange={e => setFormAjuste(f => ({ ...f, novoSaldo: e.target.value }))} />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input type="number" min={0} step={0.01} value={formAjuste.valor} onChange={e => setFormAjuste(f => ({ ...f, valor: e.target.value }))} />
                </div>
              )}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Observação</label>
                <input value={formAjuste.observacao} onChange={e => setFormAjuste(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: Conferência de extrato" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAjuste(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarAjuste}>Salvar ajuste</button>
            </div>
          </div>
        </div>
      )}

      {modalTransferencia && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalTransferencia(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Transferir entre contas</h2>
              <button className="btn-ghost" onClick={() => setModalTransferencia(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">De</label>
                  <select value={formTransf.contaOrigemId} onChange={e => setFormTransf(f => ({ ...f, contaOrigemId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(c.saldoAtual)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Para</label>
                  <select value={formTransf.contaDestinoId} onChange={e => setFormTransf(f => ({ ...f, contaDestinoId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa && c.id !== formTransf.contaOrigemId).map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(c.saldoAtual)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input type="number" min={0.01} step={0.01} value={formTransf.valor} onChange={e => setFormTransf(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formTransf.registrar} style={{ width: 16, height: 16, margin: 0 }}
                    onChange={e => setFormTransf(f => ({ ...f, registrar: e.target.checked }))} />
                  Registrar no histórico
                </label>
                {formTransf.registrar && (
                  <div className="form-group">
                    <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input value={formTransf.observacao} onChange={e => setFormTransf(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: repasse mensal" />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalTransferencia(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarTransferencia}>Transferir</button>
            </div>
          </div>
        </div>
      )}

      {modalNovoLanc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovoLanc(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ borderBottom: `2px solid ${modalNovoLanc === 'pagar' ? 'var(--red)' : 'var(--green)'}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: modalNovoLanc === 'pagar' ? 'var(--red)' : 'var(--green)' }}>
                {modalNovoLanc === 'pagar' ? '↓ Nova conta a pagar' : '↑ Nova conta a receber'}
              </h2>
              <button className="btn-ghost" onClick={() => setModalNovoLanc(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="cx-tipo-toggle" style={{ marginBottom: 14 }}>
                <button type="button" className={!formNovoLanc.jaPago ? 'active' : ''}
                  onClick={() => setFormNovoLanc(f => ({ ...f, jaPago: false }))}>Pendente</button>
                <button type="button" className={formNovoLanc.jaPago ? 'active' : ''}
                  onClick={() => setFormNovoLanc(f => ({ ...f, jaPago: true, avisar: false }))}>
                  {modalNovoLanc === 'pagar' ? '✓ Já paguei' : '✓ Já recebi'}
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: formNovoLanc.jaPago ? 'not-allowed' : 'pointer', marginBottom: 14, opacity: formNovoLanc.jaPago ? 0.5 : 1 }}>
                <input type="checkbox" checked={formNovoLanc.avisar} disabled={formNovoLanc.jaPago} style={{ width: 16, height: 16, margin: 0 }}
                  onChange={e => setFormNovoLanc(f => ({ ...f, avisar: e.target.checked }))} />
                🔔 Me avisar por e-mail no vencimento
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'avulsa', t: 'Avulsa' }, { v: 'parcelada', t: 'Parcelada' }, { v: 'fixa', t: 'Fixa/recorrente' }].map(op => (
                      <button key={op.v} type="button" className={op.v === formNovoLanc.modo ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                        onClick={() => setFormNovoLanc(f => ({ ...f, modo: op.v as any }))}>{op.t}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Conta bancária *</label>
                  <select value={formNovoLanc.contaBancariaId} onChange={e => setFormNovoLanc(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select value={formNovoLanc.categoriaId} onChange={e => setFormNovoLanc(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {(modalNovoLanc === 'pagar' ? categoriasPagar : categoriasReceber).map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input value={formNovoLanc.descricao} onChange={e => setFormNovoLanc(f => ({ ...f, descricao: e.target.value }))}
                    placeholder={modalNovoLanc === 'pagar' ? 'Ex: Aluguel' : 'Ex: Venda avulsa'} list="fm-desc-lanc" />
                  <datalist id="fm-desc-lanc">
                    {descricoesRecentesLanc.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={formNovoLanc.observacao} onChange={e => setFormNovoLanc(f => ({ ...f, observacao: e.target.value }))} placeholder="Notas internas" />
                </div>

                <div style={{ display: formNovoLanc.modo === 'parcelada' ? 'block' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {formNovoLanc.modo === 'parcelada' ? (
                    <div className="form-group">
                      <label className="form-label">Valor da parcela (R$) *</label>
                      <input type="number" step={0.01} value={formNovoLanc.valor} onChange={e => setFormNovoLanc(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Valor (R$) *</label>
                        <input type="number" step={0.01} value={formNovoLanc.valor} onChange={e => setFormNovoLanc(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                      </div>
                      {formNovoLanc.modo === 'fixa' ? (
                        <div className="form-group">
                          <label className="form-label">Dia do vencimento</label>
                          <input type="number" min={1} max={28} value={formNovoLanc.diaVencimento} onChange={e => setFormNovoLanc(f => ({ ...f, diaVencimento: e.target.value }))} />
                        </div>
                      ) : (
                        <div className="form-group">
                          <label className="form-label">Vencimento</label>
                          <input type="date" value={formNovoLanc.vencimento} onChange={e => setFormNovoLanc(f => ({ ...f, vencimento: e.target.value }))} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {formNovoLanc.modo === 'parcelada' && (
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        {formNovoLanc.tipoParcelamento === 'quantidade' ? 'Total de parcelas' : 'Até quando'}
                      </label>
                      <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={() => setFormNovoLanc(f => ({ ...f, tipoParcelamento: f.tipoParcelamento === 'quantidade' ? 'dataFim' : 'quantidade' }))}>
                        {formNovoLanc.tipoParcelamento === 'quantidade' ? 'usar data fim' : 'usar quantidade'}
                      </button>
                    </div>
                    {formNovoLanc.tipoParcelamento === 'quantidade' ? (
                      <input type="number" min={2} max={120} value={formNovoLanc.totalParcelas} onChange={e => setFormNovoLanc(f => ({ ...f, totalParcelas: e.target.value }))} />
                    ) : (
                      <input type="date" value={formNovoLanc.dataFim} onChange={e => setFormNovoLanc(f => ({ ...f, dataFim: e.target.value }))} />
                    )}
                  </div>
                )}
                {formNovoLanc.modo === 'parcelada' && (
                  <div className="form-group">
                    <label className="form-label">Data da 1ª parcela</label>
                    <input type="date" value={formNovoLanc.vencimento} onChange={e => setFormNovoLanc(f => ({ ...f, vencimento: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      Gera {formNovoLanc.totalParcelas || 0} parcelas de {fmt(parseFloat(formNovoLanc.valor) || 0)}, uma por mês.
                    </p>
                  </div>
                )}
                {formNovoLanc.modo === 'fixa' && (
                  <div className="form-group">
                    <label className="form-label">Data de início <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input type="date" value={formNovoLanc.dataInicio} onChange={e => setFormNovoLanc(f => ({ ...f, dataInicio: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Repete todo mês até desativar.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNovoLanc(null)}>Cancelar</button>
              <button className="btn-primary" disabled={salvandoNovoLanc} onClick={salvarNovoLancamento}>
                {salvandoNovoLanc ? 'Salvando...' : 'Criar lançamento'}
              </button>
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
    </div>
  );
}