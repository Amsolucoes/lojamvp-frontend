import { useState, useEffect, useRef } from 'react';
import { useFiltrando } from '../../hooks/useFiltrando';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, X, Wallet, Tag, Trash2, Check, ChevronLeft, ChevronRight, Settings, TrendingUp, TrendingDown, CreditCard, BarChart3, RotateCcw, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { InputMoeda } from '../../components/InputMoeda';
import { useToast } from '../../context/ToastContext';
import { setBottomNavAction } from '../../utils/bottomNavAction';
import { BANCOS, BankBadge } from '../../utils/bancos';
import './Financeiro.css';
import { useApp } from '@/context/AppContext';

interface Conta {
  id: string;
  nome: string;
  saldoInicial: number;
  saldoAtual: number;
  ativa: boolean;
  banco?: string | null;
  limite: number;
}

interface Categoria {
  id: string;
  nome: string;
  tipo: string; // pagar | receber | ambos
  icone: string | null;
}

interface Lancamento {
  id: string;
  contaBancariaId: string;
  descricao: string;
  categoriaNome: string | null;
  modo: string; // avulsa | parcelada | fixa
  valor: number;
  vencimento: string;
  status: string; // pendente | pago
  pagoEm: string | null;
  numeroParcela: number | null;
  totalParcelas: number | null;
  origem: string; // lancamento | plano
}

interface Resumo {
  totalPago: number; qtdPago: number;
  totalPendente: number; qtdPendente: number;
  totalVencido: number; qtdVencido: number;
}

interface Cartao {
  id: string;
  nome: string;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  contaBancariaId: string;
  ativo: boolean;
  taxaJurosMensal: number;
}

interface LinhaPagar {
  id: string;
  descricao: string;
  observacao?: string | null;
  categoriaNome: string | null;
  categoriaId: string | null;
  contaBancariaId: string | null;
  modo: string;
  valor: number;
  vencimento: string;
  status: string;
  pagoEm: string | null;
  numeroParcela: number | null;
  totalParcelas: number | null;
  origem: string; // avulso | cartao_item | cartao_fatura
  cartaoId: string | null;
  cartaoNome: string | null;
}

interface ItemFaturaDetalhe {
  id: string;
  descricao: string;
  valor: number;
  dataCompra: string;
  categoriaNome: string | null;
  categoriaId: string | null;
  modo: string;
  observacao: string | null;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function ehVencido(l: { status: string; vencimento: string }) {
  if (!l.vencimento) return false;
  return l.status === 'pendente' && new Date(l.vencimento) < new Date(new Date().toDateString());
}

interface FinanceiroProps {
  // Modo embutido: usado pela tela de Cartões para abrir a fatura por cima dela, sem trocar de página.
  apenasFatura?: boolean;
  cartaoParaFatura?: string | null;
  aoFecharFatura?: () => void;
}

export function Financeiro({ apenasFatura = false, cartaoParaFatura = null, aoFecharFatura }: FinanceiroProps = {}) {
  const navigate = useNavigate();
  const { sucesso, erro } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const veioComAbaEspecifica = searchParams.get('aba') === 'pagar' || searchParams.get('aba') === 'receber' || searchParams.get('novo');
  const [aba, setAba] = useState<'pagar' | 'receber'>(() => {
    const p = searchParams.get('aba') || searchParams.get('novo');
    return p === 'receber' ? 'receber' : 'pagar';
  });
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(() => {
    const m = searchParams.get('mes');
    return m ? parseInt(m) - 1 : hoje.getMonth();
  });
  const [anoRef, setAnoRef] = useState(() => {
    const a = searchParams.get('ano');
    return a ? parseInt(a) : hoje.getFullYear();
  });

  const [contas, setContas] = useState<Conta[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregandoCategorias, setCarregandoCategorias] = useState(true);
  const [descricoesRecentes, setDescricoesRecentes] = useState<string[]>([]);
  const [descricoesRecentesCartao, setDescricoesRecentesCartao] = useState<string[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [receberUnificado, setReceberUnificado] = useState<any[]>([]);
  const [resumo, setResumo] = useState<{ pagar: Resumo; receber: Resumo } | null>(null);
  const [catFiltro, setCatFiltro] = useState(() => searchParams.get('categoria') || 'todas');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pago' | 'pendente'>('todos');
  const [modoFiltro, setModoFiltro] = useState<'todos' | 'avulsa' | 'parcelada' | 'fixa'>('todos');
  const [buscaDescricao, setBuscaDescricao] = useState('');
  const [paginaLista, setPaginaLista] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(15);
  const listaRef = useRef<HTMLDivElement>(null);

  // Troca de página na lista — além de atualizar o estado, rola até o topo da
  // tabela/lista (não a página inteira), já que senão a tela ficava parada lá
  // embaixo (onde o botão "Próxima" foi clicado) mostrando o fim da página nova.
  function irParaPaginaLista(pagina: number) {
    setPaginaLista(pagina);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const [periodoTipo, setPeriodoTipo] = useState<'mes' | 'personalizado'>('mes');
  const [periodoDe, setPeriodoDe] = useState(new Date().toISOString().slice(0, 10));
  const [periodoAte, setPeriodoAte] = useState(new Date().toISOString().slice(0, 10));
  const [modoPagar, setModoPagar] = useState<'agrupado' | 'detalhado'>('agrupado');
  const [linhasPagar, setLinhasPagar] = useState<LinhaPagar[]>([]);

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cartoesResumo, setCartoesResumo] = useState<Record<string, { usado: number; disponivel: number; qtdCompras: number; status: string }>>({});
  const [carregandoCartoes, setCarregandoCartoes] = useState(true);

  const [faturaAberta, setFaturaAberta] = useState<Cartao | null>(null);
  const [modalLancarCompra, setModalLancarCompra] = useState(false);
  const [carregandoFatura, setCarregandoFatura] = useState(false);
  const [carregandoLancamentos, setCarregandoLancamentos] = useState(true);
  const novoSentinelaRef = useRef<HTMLDivElement>(null);
  const [novoFixo, setNovoFixo] = useState(false);
  useEffect(() => {
    const el = novoSentinelaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => setNovoFixo(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const filtrandoLista = useFiltrando([aba, catFiltro, statusFiltro, modoFiltro, buscaDescricao, itensPorPagina]);
  const [faturaDados, setFaturaDados] = useState<{
    vencimento: string; total: number; totalAntecipado?: number; restante?: number; status: string; valorEntrada?: number | null; itens: ItemFaturaDetalhe[];
    parcelasFinanciamento?: {
      id: string; descricao: string; valor: number; vencimento: string; status: string;
      numeroParcela: number; totalParcelas: number; contaBancariaId: string; categoriaId: string | null;
      observacao: string | null; modo: string; mesOrigemFatura: number | null; anoOrigemFatura: number | null;
    }[];
    antecipados?: { id: string; valor: number; data: string; contaBancariaId: string; observacao: string | null }[];
  } | null>(null);
  const [faturaAno, setFaturaAno] = useState(new Date().getFullYear());
  const [faturaMes, setFaturaMes] = useState(new Date().getMonth() + 1);
  const [buscaFatura, setBuscaFatura] = useState('');
  const [paginaFatura, setPaginaFatura] = useState(1);
  const [referenciasFatura, setReferenciasFatura] = useState<{ aberta: { ano: number; mes: number }; fechada: { ano: number; mes: number; total: number; status: string } } | null>(null);
  const [formCompra, setFormCompra] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10),
    categoriaId: '', categoriaTexto: '', totalParcelas: '2', observacao: '',
  });

  const [modalLancamento, setModalLancamento] = useState(false);
  const [processandoPagamento, setProcessandoPagamento] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<LinhaPagar | null>(null);
  const [excluindoLancamento, setExcluindoLancamento] = useState(false);
  const [editandoLancamento, setEditandoLancamento] = useState<LinhaPagar | null>(null);
  const [formEdit, setFormEdit] = useState({ contaBancariaId: '', categoriaId: '', categoriaTexto: '', descricao: '', valor: '', vencimento: '', observacao: '' });
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [escopoEdit, setEscopoEdit] = useState<'unica' | 'todas' | null>(null);

  const [formLanc, setFormLanc] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    contaBancariaId: '', categoriaId: '', categoriaTexto: '', descricao: '', valor: '', observacao: '',
    vencimento: new Date().toISOString().slice(0, 10),
    totalParcelas: '2', diaVencimento: '10',
    tipoParcelamento: 'quantidade' as 'quantidade' | 'dataFim',
    dataFim: new Date().toISOString().slice(0, 10),
    jaPago: false,
    dataInicio: new Date().toISOString().slice(0, 10),
    avisar: true,
  });

  const [salvandoLanc, setSalvandoLanc] = useState(false);




  async function carregarContas() {
    await api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {}).finally(() => setCarregandoContas(false));
  }

  async function carregarCategorias() {
    api.get<Categoria[]>('/api/financeiro/categorias').then(setCategorias).catch(() => {}).finally(() => setCarregandoCategorias(false));
  }

  function periodoQuery() {
    if (periodoTipo === 'personalizado') {
      return `de=${periodoDe}&ate=${periodoAte}`;
    }
    return `ano=${anoRef}&mes=${mesRef + 1}`;
  }

  async function carregarLancamentos() {
    setCarregandoLancamentos(true);
    try {
    if (aba === 'pagar') {
      await api.get<LinhaPagar[]>(`/api/financeiro/pagar-unificado?${periodoQuery()}&modo=${modoPagar}`)
        .then(setLinhasPagar).catch(() => {});
    } else {
      let de: string, ate: string;
      if (periodoTipo === 'personalizado') {
        de = new Date(periodoDe).toISOString();
        ate = new Date(periodoAte).toISOString();
      } else {
        de = new Date(anoRef, mesRef, 1).toISOString();
        ate = new Date(anoRef, mesRef + 1, 0).toISOString();
      }
      await api.get<any[]>(`/api/financeiro/receber-unificado?de=${de}&ate=${ate}`)
        .then(setReceberUnificado).catch(() => {});
    }
    } finally {
      setCarregandoLancamentos(false);
    }
  }

  function carregarCartoes() {
    setCarregandoCartoes(true);
    Promise.all([
      api.get<Cartao[]>('/api/financeiro/cartoes').then(setCartoes).catch(() => {}),
      api.get<any[]>('/api/financeiro/cartoes-resumo').then(lista => {
        const mapa: Record<string, any> = {};
        lista.forEach(c => { mapa[c.id] = { usado: c.usado, disponivel: c.disponivel, qtdCompras: c.qtdCompras, status: c.status }; });
        setCartoesResumo(mapa);
      }).catch(() => {}),
    ]).finally(() => setCarregandoCartoes(false));
  }

  async function carregarResumo() {
    await api.get<any>(`/api/financeiro/resumo-mensal?ano=${anoRef}&mes=${mesRef + 1}`)
      .then(setResumo).catch(() => {});
  }

  useEffect(() => { carregarContas(); carregarCategorias(); carregarCartoes(); }, []);

  useEffect(() => {
    if (apenasFatura) return;
    setBottomNavAction({
      tipo: 'unica',
      corBg: aba === 'pagar' ? 'var(--red-bg)' : 'var(--green-bg)',
      corBorda: aba === 'pagar' ? 'var(--red)' : 'var(--green)',
      aoClicar: abrirNovoLancamento,
    });
    return () => setBottomNavAction(null);
  }, [aba]);

  useEffect(() => {
    function aoReceberPullToRefresh() {
      carregarContas();
      carregarCategorias();
      carregarCartoes();
      carregarLancamentos();
      carregarResumo();
    }
    window.addEventListener('pullToRefresh', aoReceberPullToRefresh);
    return () => window.removeEventListener('pullToRefresh', aoReceberPullToRefresh);
  }, [aba, mesRef, anoRef, modoPagar, periodoTipo, periodoDe, periodoAte]);

  useEffect(() => { if (apenasFatura) return; carregarLancamentos(); carregarResumo(); }, [aba, mesRef, anoRef, modoPagar, periodoTipo, periodoDe, periodoAte]);
  const primeiraCargaFiltro = useRef(true);
  
  useEffect(() => {
    if (primeiraCargaFiltro.current) { primeiraCargaFiltro.current = false; return; }
    setCatFiltro('todas');
    setBuscaDescricao('');
  }, [aba]);
  useEffect(() => { setPaginaLista(1); }, [aba, mesRef, anoRef, catFiltro, statusFiltro, modoFiltro, buscaDescricao, periodoTipo, periodoDe, periodoAte, itensPorPagina]);
  useEffect(() => {
    const novo = searchParams.get('novo');
    if (novo === 'pagar' || novo === 'receber') {
      setAba(novo);
      abrirNovoLancamento();

      // Limpa só o "novo" (pra não reabrir o modal se recarregar a página),
      // mas preserva o "aba" (necessário pro botão Voltar continuar aparecendo).
      const abaAtual = searchParams.get('aba');
      const novosParams: Record<string, string> = {};
      if (abaAtual) novosParams.aba = abaAtual;
      setSearchParams(novosParams, { replace: true });
    }
  }, []);

  // Veio do Dashboard clicando num cartão específico — abre a fatura dele direto
  useEffect(() => {
    const cartaoId = searchParams.get('abrirFatura');
    if (!cartaoId || cartoes.length === 0) return;
    const cartao = cartoes.find(c => c.id === cartaoId);
    if (cartao) {
      abrirFatura(cartao);
      const novosParams = new URLSearchParams(searchParams);
      novosParams.delete('abrirFatura');
      setSearchParams(novosParams, { replace: true });
    }
  }, [cartoes, searchParams]);

  // Modo embutido (tela de Cartões): abre a fatura do cartão pedido uma única vez...
  const abriuFaturaEmbutida = useRef(false);
  useEffect(() => {
    if (!apenasFatura || !cartaoParaFatura || abriuFaturaEmbutida.current || cartoes.length === 0) return;
    const cartao = cartoes.find(c => c.id === cartaoParaFatura);
    if (cartao) {
      abriuFaturaEmbutida.current = true;
      abrirFatura(cartao);
    }
  }, [apenasFatura, cartaoParaFatura, cartoes]);

  // ...e avisa a tela de origem quando a fatura for fechada.
  const faturaJaFoiAberta = useRef(false);
  useEffect(() => {
    if (!apenasFatura) return;
    if (faturaAberta) faturaJaFoiAberta.current = true;
    else if (faturaJaFoiAberta.current) {
      faturaJaFoiAberta.current = false;
      aoFecharFatura?.();
    }
  }, [apenasFatura, faturaAberta]);

  function navMes(delta: number) {
    let nm = mesRef + delta, na = anoRef;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesRef(nm); setAnoRef(na);
  }

  const categoriasDaAba = categorias.filter(c => c.tipo === aba || c.tipo === 'ambos');

  function iconeCategoria(nome: string | null) {
    if (!nome) return null;
    return categorias.find(c => c.nome === nome)?.icone ?? null;
  }

  function nomeConta(contaId: string | null) {
    if (!contaId) return '—';
    return contas.find(c => c.id === contaId)?.nome ?? '—';
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

  function passaStatus(status: string) {
    if (statusFiltro === 'todos') return true;
    return status === statusFiltro;
  }
  function passaModo(modo: string | undefined) {
    if (modoFiltro === 'todos') return true;
    return modo === modoFiltro;
  }

  function passaBusca(descricao: string) {
    return !buscaDescricao || descricao.toLowerCase().includes(buscaDescricao.toLowerCase());
  }

  const listaPagarCompleta = linhasPagar.filter(l =>
    (catFiltro === 'todas' || l.categoriaNome === catFiltro) && passaStatus(l.status) && passaModo(l.modo) && passaBusca(l.descricao)
  );
  const listaReceberCompleta = receberUnificado.filter((l: any) => {
    const catOk = catFiltro === 'todas'
      ? true
      : catFiltro === '__plano__'
      ? l.origem === 'plano'
      : l.origem === 'avulso' && l.categoriaNome === catFiltro;
    return catOk && passaStatus(l.status) && passaModo(l.modo) && passaBusca(l.descricao);
  });

  const listaCompletaAtual = aba === 'pagar' ? listaPagarCompleta : listaReceberCompleta;
  const totalPaginas = Math.max(1, Math.ceil(listaCompletaAtual.length / itensPorPagina));
  const paginaAtual = Math.min(paginaLista, totalPaginas);
  const inicioSlice = (paginaAtual - 1) * itensPorPagina;

  const listaPagar = (aba === 'pagar' ? listaPagarCompleta : []).slice(inicioSlice, inicioSlice + itensPorPagina);
  const listaReceber = (aba === 'receber' ? listaReceberCompleta : []).slice(inicioSlice, inicioSlice + itensPorPagina);

  // Quando algum filtro (categoria ou status) está ativo, recalcula os totais
  // com base na lista já filtrada, em vez do resumo geral do backend.
  const filtroAtivo = catFiltro !== 'todas' || statusFiltro !== 'todos' || modoFiltro !== 'todos' || buscaDescricao !== '' || periodoTipo === 'personalizado';
  const hoje0h = new Date(new Date().toDateString());

  function resumoDaLista(lista: any[]) {
    const pagos = lista.filter(l => l.status === 'pago');
    const pendentesFuturos = lista.filter(l => l.status === 'pendente' && l.vencimento && new Date(l.vencimento) >= hoje0h);
    const vencidos = lista.filter(l => l.status === 'pendente' && l.vencimento && new Date(l.vencimento) < hoje0h);
    return {
      totalPago: pagos.reduce((s, l) => s + l.valor, 0), qtdPago: pagos.length,
      totalPendente: pendentesFuturos.reduce((s, l) => s + l.valor, 0), qtdPendente: pendentesFuturos.length,
      totalVencido: vencidos.reduce((s, l) => s + l.valor, 0), qtdVencido: vencidos.length,
    };
  }

  const resumoAba = filtroAtivo
    ? resumoDaLista(aba === 'pagar' ? listaPagarCompleta : listaReceberCompleta)
    : (resumo ? resumo[aba] : null);

  // ── Lançamento ──────────────────────────────────────────────────
  function abrirNovoLancamento() {
    setFormLanc({
      modo: 'avulsa', contaBancariaId: contas[0]?.id ?? '', categoriaId: '', categoriaTexto: '',
      descricao: '', valor: '', observacao: '',
      vencimento: new Date().toISOString().slice(0, 10),
      totalParcelas: '2', diaVencimento: '10',
      tipoParcelamento: 'quantidade', dataFim: new Date().toISOString().slice(0, 10),
      jaPago: false,
      dataInicio: new Date().toISOString().slice(0, 10),
      avisar: true,
    });
    setModalLancamento(true);
    api.get<string[]>(`/api/financeiro/lancamentos/descricoes?tipo=${aba}`).then(setDescricoesRecentes).catch(() => {});
  }

  async function salvarLancamento() {
    if (!formLanc.contaBancariaId) { erro('Cadastre uma conta bancária primeiro.'); return; }
    if (!formLanc.descricao.trim() || !formLanc.valor) { erro('Preencha descrição e valor.'); return; }
    setSalvandoLanc(true);
    try {
      if (formLanc.modo === 'avulsa') {
        await api.post('/api/financeiro/lancamentos/avulso', {
          contaBancariaId: formLanc.contaBancariaId, tipo: aba,
          descricao: formLanc.descricao.trim(),
          categoriaId: formLanc.categoriaId || null,
          observacao: formLanc.observacao || null,
          valor: parseFloat(formLanc.valor), vencimento: formLanc.vencimento,
          jaPago: formLanc.jaPago,
          avisar: formLanc.avisar,
        });
      } else if (formLanc.modo === 'parcelada') {
        await api.post('/api/financeiro/lancamentos/parcelado', {
          contaBancariaId: formLanc.contaBancariaId, tipo: aba,
          descricao: formLanc.descricao.trim(),
          categoriaId: formLanc.categoriaId || null,
          observacao: formLanc.observacao || null,
          valorParcela: parseFloat(formLanc.valor),
          totalParcelas: formLanc.tipoParcelamento === 'quantidade' ? (parseInt(formLanc.totalParcelas) || 2) : null,
          dataFim: formLanc.tipoParcelamento === 'dataFim' ? formLanc.dataFim : null,
          primeiroVencimento: formLanc.vencimento,
          jaPago: formLanc.jaPago,
          avisar: formLanc.avisar,
        });
      } else {
        await api.post('/api/financeiro/fixos', {
          contaBancariaId: formLanc.contaBancariaId, tipo: aba,
          descricao: formLanc.descricao.trim(),
          categoriaId: formLanc.categoriaId || null,
          observacao: formLanc.observacao || null,
          valor: parseFloat(formLanc.valor),
          diaVencimento: parseInt(formLanc.diaVencimento) || 10,
          jaPago: formLanc.jaPago,
          dataInicio: formLanc.dataInicio || null,
          avisar: formLanc.avisar,
        });
      }
      await Promise.all([carregarLancamentos(), carregarResumo(), carregarContas()]);
      setModalLancamento(false);
      sucesso('Lançamento criado!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoLanc(false);
    }
  }

  async function marcarPagamento(l: Lancamento, pago: boolean) {
    setProcessandoPagamento(l.id);
    try {
      await api.post(`/api/financeiro/lancamentos/${l.id}/pagamento`, { pago });
      await Promise.all([carregarLancamentos(), carregarResumo(), carregarContas()]);
      sucesso(pago ? 'Marcado como pago' : 'Marcado como pendente');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setProcessandoPagamento(null);
    }
  }

  async function excluirLancamento(modo: 'unica' | 'todas' = 'unica') {
    if (!confirmExcluir) return;
    setExcluindoLancamento(true);
    try {
      await api.delete(`/api/financeiro/lancamentos/${confirmExcluir.id}?modo=${modo}`);
      await Promise.all([carregarLancamentos(), carregarResumo()]);
      setConfirmExcluir(null);
      sucesso('Lançamento excluído');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setExcluindoLancamento(false);
    }
  }

  function abrirEditarLancamento(l: LinhaPagar) {
    setEditandoLancamento(l);
    setEscopoEdit(null);
    setFormEdit({
      contaBancariaId: l.contaBancariaId ?? '',
      categoriaId: l.categoriaId ?? '',
      categoriaTexto: l.categoriaNome ?? '',
      descricao: l.descricao,
      valor: String(l.valor),
      vencimento: l.vencimento ? l.vencimento.slice(0, 10) : '',
      observacao: l.observacao ?? '',
    });
    api.get<string[]>(`/api/financeiro/lancamentos/descricoes?tipo=${aba}`).then(setDescricoesRecentes).catch(() => {});
  }

  async function salvarEdicaoLancamento(modo: 'unica' | 'todas') {
    if (!editandoLancamento) return;
    if (!formEdit.descricao.trim() || !formEdit.valor || !formEdit.contaBancariaId) {
      erro('Preencha descrição, valor e conta.');
      return;
    }
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
      await Promise.all([carregarLancamentos(), carregarResumo()]);
      setEditandoLancamento(null);
      sucesso('Lançamento atualizado!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoEdit(false);
    }
  }

// ── Fatura do cartão (pagar/desfazer) ──────────────────────────
  async function marcarPagamentoCartaoFatura(l: LinhaPagar, pago: boolean) {
    if (!l.cartaoId) return;
    setProcessandoPagamento(l.id);
    try {
      await api.post(`/api/financeiro/cartoes/${l.cartaoId}/fatura/pagamento?ano=${anoRef}&mes=${mesRef + 1}`, {
        modo: pago ? 'total' : 'desfazer',
      });
      await Promise.all([carregarLancamentos(), carregarResumo(), carregarContas()]);
      sucesso(pago ? 'Fatura marcada como paga' : 'Fatura marcada como pendente');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setProcessandoPagamento(null);
    }
  }

  // Marca uma parcela de financiamento ESPECÍFICA como paga, sem mexer no resto da
  // fatura do mês — diferente de "Pagar fatura", que sempre trata o ciclo inteiro.
  // Útil quando só uma parcela foi quitada à parte (ex: negociação com o banco).
  async function marcarParcelaFinanciamentoPaga(id: string) {
    try {
      // absorvidaSemConta=true: essa marcação é pra casos onde a parcela foi resolvida
      // por fora (negociação, quitação junto com outra dívida etc.) — não deve reduzir
      // o saldo de nenhuma conta bancária, já que o dinheiro não saiu dela de verdade.
      await api.post(`/api/financeiro/lancamentos/${id}/pagamento`, { pago: true, absorvidaSemConta: true });
      if (faturaAberta) carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso('Parcela marcada como quitada (sem afetar saldo de conta).');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // Reverte a marcação acima — volta a parcela pra pendente. O saldo de conta já se
  // corrige sozinho (é sempre recalculado na hora), não precisa ajustar nada manualmente.
  async function desfazerParcelaFinanciamento(id: string) {
    try {
      await api.post(`/api/financeiro/lancamentos/${id}/pagamento`, { pago: false });
      if (faturaAberta) carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso('Parcela voltou para pendente.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // ── Cartões de crédito ──────────────────────────────────────────
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
    setBuscaFatura('');
    setPaginaFatura(1);
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
    setPaginaFatura(1);
    carregarFatura(faturaAberta.id, novoAno, novoMes);
  }

  function irParaReferencia(tipo: 'aberta' | 'fechada') {
    if (!faturaAberta || !referenciasFatura) return;
    const ref = referenciasFatura[tipo];
    setFaturaAno(ref.ano);
    setFaturaMes(ref.mes);
    setPaginaFatura(1);
    carregarFatura(faturaAberta.id, ref.ano, ref.mes);
  }

  async function lancarCompra() {
    if (!faturaAberta) return;
    if (!formCompra.descricao.trim() || !formCompra.valor) { erro('Preencha descrição e valor.'); return; }
    try {
      if (formCompra.modo === 'avulsa') {
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/lancamentos`, {
          descricao: formCompra.descricao.trim(),
          valor: parseFloat(formCompra.valor),
          dataCompra: formCompra.dataCompra,
          categoriaId: formCompra.categoriaId || null,
        });
      } else if (formCompra.modo === 'parcelada') {
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/lancamentos/parcelado`, {
          descricao: formCompra.descricao.trim(),
          valorParcela: parseFloat(formCompra.valor),
          totalParcelas: parseInt(formCompra.totalParcelas) || 2,
          dataCompra: formCompra.dataCompra,
          categoriaId: formCompra.categoriaId || null,
        });
      } else {
        const diaEscolhido = formCompra.dataCompra ? parseInt(formCompra.dataCompra.split('-')[2]) : 1;
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fixos`, {
          descricao: formCompra.descricao.trim(),
          valor: parseFloat(formCompra.valor),
          categoriaId: formCompra.categoriaId || null,
          diaCompra: diaEscolhido,
        });
      }
      setFormCompra({ modo: 'avulsa', descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10), categoriaId: '', categoriaTexto: '', totalParcelas: '2', observacao: '' });
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      sucesso('Compra lançada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function abrirEditarItemCartao(item: ItemFaturaDetalhe) {
    setEditandoItemCartao(item);
    setFormEditItemCartao({
      descricao: item.descricao.replace(/\s\(\d+\/\d+\)$/, ''),
      valor: String(item.valor),
      dataCompra: item.dataCompra.slice(0, 10),
      categoriaId: item.categoriaId ?? '',
      observacao: item.observacao ?? '',
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
        observacao: formEditItemCartao.observacao || null,
      });
      setEditandoItemCartao(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      sucesso('Compra atualizada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirItemCartao(modo: 'unica' | 'todas') {
    if (!confirmExcluirItemCartao || !faturaAberta) return;
    try {
      await api.delete(`/api/financeiro/cartoes/lancamentos/${confirmExcluirItemCartao.id}?modo=${modo}`);
      setConfirmExcluirItemCartao(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      sucesso('Compra excluída!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const [modalPagarFatura, setModalPagarFatura] = useState(false);
  const [formPagFatura, setFormPagFatura] = useState({
    modo: 'total' as 'total' | 'parcial' | 'parcelado', valorPago: '', totalParcelas: '3',
    valorEntrada: '', primeiraParcela: '', contaBancariaId: '', dataPagamento: new Date().toISOString().slice(0, 10),
  });
  const [modalAntecipado, setModalAntecipado] = useState(false);
  const [formAntecipado, setFormAntecipado] = useState({ valor: '', data: new Date().toISOString().slice(0, 10), contaBancariaId: '', observacao: '' });
  const [confirmExcluirAntecipado, setConfirmExcluirAntecipado] = useState<{ id: string; valor: number } | null>(null);
  const [editandoItemCartao, setEditandoItemCartao] = useState<ItemFaturaDetalhe | null>(null);
  const [formEditItemCartao, setFormEditItemCartao] = useState({ descricao: '', valor: '', dataCompra: '', categoriaId: '', observacao: '' });
  const [confirmExcluirItemCartao, setConfirmExcluirItemCartao] = useState<ItemFaturaDetalhe | null>(null);

  async function pagarFaturaModal(modo: string, extra?: any) {
    if (!faturaAberta) return;
    try {
      await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fatura/pagamento?ano=${faturaAno}&mes=${faturaMes}`, { modo, ...extra });
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      setModalPagarFatura(false);
      sucesso('Fatura atualizada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function abrirNovoAntecipado() {
    setFormAntecipado({ valor: '', data: new Date().toISOString().slice(0, 10), contaBancariaId: faturaAberta?.contaBancariaId ?? '', observacao: '' });
    setModalAntecipado(true);
  }

  async function lancarAntecipado() {
    if (!faturaAberta) return;
    if (!formAntecipado.valor || parseFloat(formAntecipado.valor) <= 0) { erro('Informe um valor válido.'); return; }
    const limiteAntecipado = (faturaDados?.restante ?? faturaDados?.total ?? 0) - 0.01;
    if (parseFloat(formAntecipado.valor) > limiteAntecipado) { erro(`O valor não pode passar de ${fmt(limiteAntecipado)}.`); return; }
    if (!formAntecipado.contaBancariaId) { erro('Escolha a conta de origem.'); return; }
    try {
      await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fatura/antecipado?ano=${faturaAno}&mes=${faturaMes}`, {
        valor: parseFloat(formAntecipado.valor),
        data: formAntecipado.data,
        contaBancariaId: formAntecipado.contaBancariaId,
        observacao: formAntecipado.observacao || null,
      });
      setModalAntecipado(false);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso('Pagamento antecipado registrado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirAntecipado() {
    if (!confirmExcluirAntecipado || !faturaAberta) return;
    try {
      await api.delete(`/api/financeiro/cartoes/fatura/antecipado/${confirmExcluirAntecipado.id}`);
      setConfirmExcluirAntecipado(null);
      carregarFatura(faturaAberta.id, faturaAno, faturaMes);
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso('Pagamento antecipado excluído!');
    } catch (e) {
      erro((e as Error).message);
    }
  }


  const saldoTotal = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);

  return (
    <div className={`page fin-page${apenasFatura ? ' fin-embutido' : ''}`}>
      {veioComAbaEspecifica && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="fin-voltar-mobile" onClick={() => navigate(-1)} style={{
            alignItems: 'center', gap: 6, justifyContent: 'center',
            background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text-1)', fontSize: 14, fontWeight: 500,
            padding: '8px 20px', marginBottom: 12, cursor: 'pointer',
          }}>
            <ChevronLeft size={18} /> Voltar
          </button>
        </div>
      )}
      <div style={{ height: 4, borderRadius: 4, background: aba === 'pagar' ? 'var(--red)' : 'var(--green)', marginBottom: 16, opacity: 0.7 }} />

      {/* Botão Novo lançamento: centralizado, acompanha a rolagem (translúcido) */}
      <div ref={novoSentinelaRef} className="fin-novo-sentinela" />
      <div className={`fin-novo-sticky${novoFixo ? ' fixo' : ''}`}>
        <button className="btn-primary fin-novo-lanc-desktop" onClick={abrirNovoLancamento}><Plus size={15} /> Novo lançamento</button>
      </div>

      {/* Abas */}
      {!veioComAbaEspecifica && (
      <div className="planos-tabs fin-abas">
        <button className={`planos-tab${aba === 'pagar' ? ' ativo' : ''}`}
          style={aba === 'pagar' ? { color: 'var(--red)', borderBottomColor: 'var(--red)' } : {}}
          onClick={() => setAba('pagar')}>
          <TrendingDown size={15} /> A Pagar
        </button>
        <button className={`planos-tab${aba === 'receber' ? ' ativo' : ''}`}
          style={aba === 'receber' ? { color: 'var(--green)', borderBottomColor: 'var(--green)' } : {}}
          onClick={() => setAba('receber')}>
          <TrendingUp size={15} /> A Receber
        </button>
      </div>
      )}

      {/* Período (logo abaixo das abas, acima dos cards) */}
      <div className="fin-periodo">
        <div className="cx-tipo-toggle fin-sutil">
          <button className={periodoTipo === 'mes' ? 'active' : ''} onClick={() => setPeriodoTipo('mes')}>Mês</button>
          <button className={periodoTipo === 'personalizado' ? 'active' : ''} onClick={() => {
            setPeriodoTipo('personalizado');
            const primeiroDia = new Date(anoRef, mesRef, 1).toISOString().slice(0, 10);
            const ultimoDia = new Date(anoRef, mesRef + 1, 0).toISOString().slice(0, 10);
            setPeriodoDe(primeiroDia);
            setPeriodoAte(ultimoDia);
          }}>Personalizado</button>
        </div>
        <div className="fin-mes-linha">
          {periodoTipo === 'mes' ? (
            <>
              <button className="btn-secondary" onClick={() => navMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{MESES[mesRef]} {anoRef}</span>
              <button className="btn-secondary" onClick={() => navMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
            </>
          ) : (
            <>
              <input type="date" value={periodoDe} onChange={e => setPeriodoDe(e.target.value)} style={{ width: 'auto' }} />
              <span style={{ color: 'var(--text-3)' }}>até</span>
              <input type="date" value={periodoAte} onChange={e => setPeriodoAte(e.target.value)} style={{ width: 'auto' }} />
            </>
          )}
        </div>
      </div>

      {/* Saldo geral */}
      <div className="fin-stats">
        <div className="stat-card fin-saldo-conta-card">
          <div className="stat-label"><Wallet size={12} style={{ verticalAlign: -1 }} /> Saldo por conta</div>
          {contas.filter(c => c.ativa).length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {contas.filter(c => c.ativa).map(c => (
                <div key={c.id} style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 6 }}>
                    <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BankBadge bancoId={c.banco} tamanho={16} /> {c.nome}
                    </span>
                    <strong style={{ color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
                  </div>
                  {c.limite > 0 && (() => {
                    const usado = Math.abs(Math.min(0, c.saldoAtual));
                    const disponivel = Math.max(0, c.limite - usado);
                    return (
                      <div style={{ marginTop: 3 }}>
                        <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(100, (usado / c.limite) * 100)}%`,
                            background: usado >= c.limite ? 'var(--red)' : 'var(--yellow, #d97706)',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                          <span style={{ color: 'var(--text-3)' }}>Cheque especial</span>
                          <span>
                            <strong style={{ color: disponivel <= c.limite * 0.1 ? 'var(--red)' : 'var(--green)' }}>
                              {fmt(disponivel)}
                            </strong>
                            <span style={{ color: 'var(--text-3)' }}> / {fmt(c.limite)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>Total</span>
                <strong style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotal)}</strong>
              </div>
            </div>
          ) : (
            <div className="stat-value" style={{ fontSize: 20 }}>{fmt(0)}</div>
          )}
        </div>
        {resumoAba && (
          <div className="stat-card fin-resumo-card" style={resumoAba.qtdVencido > 0 ? { borderColor: 'rgba(248,113,113,0.3)' } : {}}>
            <div className="stat-label" style={{ textAlign: 'center' }}>{aba === 'pagar' ? 'A pagar' : 'A receber'}</div>
            <div className="stat-value" style={{ color: aba === 'pagar' ? 'var(--red)' : 'var(--green)', fontSize: 22, textAlign: 'center' }}>
              {fmt(resumoAba.totalPendente + resumoAba.totalVencido)}
            </div>

            {aba === 'pagar' && (() => {
              const listaBase = filtroAtivo ? listaPagarCompleta : null;
              const detalheBackend = (resumo as any)?.detalhePagar;
              if (!listaBase && !detalheBackend) return null;

              const totalContas = listaBase
                ? listaBase.filter(l => l.origem === 'avulso').reduce((s, l) => s + l.valor, 0)
                : detalheBackend?.lancamentos ?? 0;

              const cartoes = listaBase
                ? Object.entries(
                    listaBase
                      .filter(l => l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada')
                      .reduce((acc, l) => {
                        const nome = l.cartaoNome ?? 'Cartão';
                        acc[nome] = (acc[nome] ?? 0) + l.valor;
                        return acc;
                      }, {} as Record<string, number>)
                  ).map(([nome, valor]) => ({ nome, valor }))
                : (detalheBackend?.cartoes ?? []);

              if (totalContas === 0 && cartoes.length === 0) return null;

              return (
                <div className="fin-resumo-detalhe-cartoes" style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>Contas</span>
                    <span style={{ color: 'var(--text-2)' }}>{fmt(totalContas)}</span>
                  </div>
                  {cartoes.map((c: any) => (
                    <div key={c.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-3)' }}>💳 {c.nome}</span>
                      <span style={{ color: 'var(--text-2)' }}>{fmt(c.valor)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="fin-resumo-pago-vencido" style={{ display: 'flex', justifyContent: 'center', gap: 28, fontSize: 13, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--green)' }}>{aba === 'pagar' ? 'Pago' : 'Recebido'}</div>
                <strong style={{ color: 'var(--green)' }}>{fmt(resumoAba.totalPago)}</strong>
              </div>
              {resumoAba.qtdVencido > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--red)' }}>Vencido</div>
                  <strong style={{ color: 'var(--red)' }}>{fmt(resumoAba.totalVencido)}</strong>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, marginTop: 8, paddingTop: 8 }}>
              <div style={{ color: 'var(--text-3)' }}>Total do mês</div>
              <strong>{fmt(resumoAba.totalPago + resumoAba.totalPendente + resumoAba.totalVencido)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Busca, cartões e filtros (abaixo dos cards) */}
      <div className="card fin-filtros-wrap" style={{ padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="fin-topbar">
          <div className="fin-topbar-esq">
            <input type="text" placeholder="Buscar por descrição..." value={buscaDescricao} onChange={e => setBuscaDescricao(e.target.value)} />
          </div>
          <div className="fin-topbar-dir">
          {aba === 'pagar' && (
            <>
              <span className="fin-topbar-label">Cartões:</span>
              <div className="cx-tipo-toggle fin-sutil">
                <button className={modoPagar === 'agrupado' ? 'active' : ''} onClick={() => setModoPagar('agrupado')}>Agrupado</button>
                <button className={modoPagar === 'detalhado' ? 'active' : ''} onClick={() => setModoPagar('detalhado')}>Detalhado</button>
              </div>
            </>
          )}
          </div>
        </div>
        <div className="fin-filtros-linha" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {categoriasDaAba.length > 0 && (
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
              <option value="todas">Todas as categorias</option>
              {aba === 'receber' && <option value="__plano__">💳 Mensalidades (Planos)</option>}
              {categoriasDaAba.map(c => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          )}
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as any)} style={{ width: 'auto', minWidth: 130 }}>
            <option value="todos">Todos os status</option>
            <option value="pago">Só pagos</option>
            <option value="pendente">Só pendentes</option>
          </select>
          <select value={modoFiltro} onChange={e => setModoFiltro(e.target.value as any)} style={{ width: 'auto', minWidth: 130 }}>
            <option value="todos">Todos os tipos</option>
            <option value="avulsa">Avulsa</option>
            <option value="parcelada">Parcelada</option>
            <option value="fixa">Fixa</option>
          </select>
          {(catFiltro !== 'todas' || statusFiltro !== 'todos' || modoFiltro !== 'todos' || buscaDescricao !== '' || periodoTipo === 'personalizado') && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => {
              setCatFiltro('todas');
              setStatusFiltro('todos');
              setModoFiltro('todos');
              setBuscaDescricao('');
              setPeriodoTipo('mes');
            }}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Controles de paginação */}
      {listaCompletaAtual.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {listaCompletaAtual.length} lançamento{listaCompletaAtual.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select value={itensPorPagina} onChange={e => setItensPorPagina(parseInt(e.target.value))} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}>
              <option value={15}>15 por página</option>
              <option value={30}>30 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-secondary" disabled={paginaAtual <= 1} onClick={() => irParaPaginaLista(Math.max(1, paginaAtual - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtual} / {totalPaginas}</span>
                <button className="btn-secondary" disabled={paginaAtual >= totalPaginas} onClick={() => irParaPaginaLista(Math.min(totalPaginas, paginaAtual + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      <div ref={listaRef} className="card" style={{ borderLeft: `3px solid ${aba === 'pagar' ? 'var(--red)' : 'var(--green)'}` }}>
        {carregandoLancamentos || filtrandoLista ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
        ) : aba === 'pagar' ? (
          listaPagar.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}><p>Nenhuma conta a pagar neste mês.</p></div>
          ) : (
            <>
              <div className="table-wrap fin-table-desktop">
                <table>
                  <thead>
                    <tr><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {agruparPorData(listaPagar).map(([data, itens]) => (
                      <>
                        <tr key={`grupo-${data}`}>
                          <td colSpan={7} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '8px 12px', background: 'var(--accent-bg)', borderTop: '1px solid var(--accent-border)', borderBottom: '1px solid var(--accent-border)' }}>
                            {data !== 'sem-data' ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}
                            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
                              {fmt(itens.reduce((s, i) => s + i.valor, 0))}
                            </span>
                          </td>
                        </tr>
                        {itens.map(l => {
                          const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada';
                          const ehFinanciada = l.origem === 'cartao_fatura_financiada';
                          const pagar = () => ehCartao ? marcarPagamentoCartaoFatura(l, true) : marcarPagamento(l as any, true);
                          const desfazer = () => ehCartao ? marcarPagamentoCartaoFatura(l, false) : marcarPagamento(l as any, false);
                          const processandoEste = processandoPagamento === l.id;
                          return (
                            <tr key={l.id} className={l.status === 'pago' ? 'fin-row-pago' : undefined}>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {l.origem === 'cartao_fatura' && <CreditCard size={12} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />}
                              {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                              {l.descricao}
                            </div>
                            {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                            {l.observacao && (
                              <span className="badge badge-accent" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                                💬 {l.observacao}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                            {l.categoriaNome ? <>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</> : '—'}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{nomeConta(l.contaBancariaId)}</td>
                          <td style={{ fontSize: 13 }}>
                            {l.vencimento ? new Date(l.vencimento).toLocaleDateString('pt-BR') : '—'}
                            {l.pagoEm && (
                              <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
                                Pago em {new Date(l.pagoEm).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{fmt(l.valor)}</td>
                          <td>
                            {ehFinanciada ? <span className="badge badge-blue">Financiada</span>
                              : l.status === 'parcial' ? <span className="badge badge-yellow">Pago parcialmente</span>
                              : l.status === 'pago' ? <span className="badge badge-green">Pago</span>
                              : ehVencido(l as any) ? <span className="badge badge-red">Vencido</span>
                              : <span className="badge badge-yellow">Pendente</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {(ehFinanciada || l.status === 'parcial')
                                ? <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} disabled={processandoEste} onClick={desfazer}>
                                    {processandoEste ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                                  </button>
                                : l.status === 'pago'
                                ? <button className="btn-ghost" style={{ fontSize: 11 }} disabled={processandoEste} onClick={desfazer}>
                                    {processandoEste ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                                  </button>
                                : <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} disabled={processandoEste} onClick={pagar}>
                                    {processandoEste ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><Check size={13} /> Pagar</>}
                                  </button>}
                              {l.origem === 'avulso' && (
                                <>
                                  <button className="btn-ghost" style={{ fontSize: 11 }} disabled={processandoEste} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} disabled={processandoEste} onClick={() => setConfirmExcluir(l as any)}><Trash2 size={13} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fin-cards-mobile">
                {agruparPorData(listaPagar).map(([data, itens]) => (
                  <div key={`m-grupo-${data}`}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '8px 16px', background: 'var(--accent-bg)', borderTop: '1px solid var(--accent-border)', borderBottom: '1px solid var(--accent-border)' }}>
                      {data !== 'sem-data' ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}
                      <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 8 }}>
                        {fmt(itens.reduce((s, i) => s + i.valor, 0))}
                      </span>
                    </div>
                    {itens.map(l => {
                      const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada';
                      const ehFinanciada = l.origem === 'cartao_fatura_financiada';
                      const pagar = () => ehCartao ? marcarPagamentoCartaoFatura(l, true) : marcarPagamento(l as any, true);
                      const desfazer = () => ehCartao ? marcarPagamentoCartaoFatura(l, false) : marcarPagamento(l as any, false);
                      const processandoEste = processandoPagamento === l.id;
                      return (
                        <div key={l.id} className={`fin-card-mobile${l.status === 'pago' ? ' fin-row-pago' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {l.origem === 'cartao_fatura' && <CreditCard size={12} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />}
                            {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                            {l.descricao}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {l.categoriaNome ? <>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</> : '—'} · {nomeConta(l.contaBancariaId)} · {l.vencimento ? new Date(l.vencimento).toLocaleDateString('pt-BR') : '—'}
                          </div>
                          {l.pagoEm && <div style={{ fontSize: 11, color: 'var(--green)' }}>Pago em {new Date(l.pagoEm).toLocaleDateString('pt-BR')}</div>}
                          {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                        </div>
                        <span style={{ fontWeight: 600 }}>{fmt(l.valor)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        {ehFinanciada ? <span className="badge badge-blue">Financiada</span>
                          : l.status === 'parcial' ? <span className="badge badge-yellow">Pago parcialmente</span>
                          : l.status === 'pago' ? <span className="badge badge-green">Pago</span>
                          : ehVencido(l as any) ? <span className="badge badge-red">Vencido</span>
                          : <span className="badge badge-yellow">Pendente</span>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(ehFinanciada || l.status === 'parcial')
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} disabled={processandoEste} onClick={desfazer}>
                                {processandoEste ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                              </button>
                            : l.status === 'pago'
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} disabled={processandoEste} onClick={desfazer}>
                                {processandoEste ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                              </button>
                            : <button className="btn-primary" style={{ fontSize: 12 }} disabled={processandoEste} onClick={pagar}>
                                {processandoEste ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Pagar'}
                              </button>}
                          {l.origem === 'avulso' && (
                            <>
                              <button className="btn-ghost" disabled={processandoEste} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                              <button className="btn-ghost" style={{ color: 'var(--red)' }} disabled={processandoEste} onClick={() => setConfirmExcluir(l as any)}><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          listaReceber.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}><p>Nenhuma conta a receber neste mês.</p></div>
          ) : (
            <>
              <div className="table-wrap fin-table-desktop">
                <table>
                  <thead>
                    <tr><th>Descrição</th><th>Conta</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Origem</th><th></th></tr>
                  </thead>
                  <tbody>
                    {agruparPorData(listaReceber).map(([data, itens]) => (
                      <>
                        <tr key={`grupo-r-${data}`}>
                          <td colSpan={7} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '8px 12px', background: 'var(--accent-bg)', borderTop: '1px solid var(--accent-border)', borderBottom: '1px solid var(--accent-border)' }}>
                            {data !== 'sem-data' ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}
                            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
                              {fmt(itens.reduce((s: number, i: any) => s + i.valor, 0))}
                            </span>
                          </td>
                        </tr>
                        {itens.map((l: any) => (
                      <tr key={l.id} className={l.status === 'pago' ? 'fin-row-pago' : undefined}>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                            {l.descricao}
                          </div>
                          {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                          {l.categoriaNome && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</div>
                          )}
                          {l.observacao && (
                            <span className="badge badge-accent" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                              💬 {l.observacao}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{nomeConta(l.contaBancariaId)}</td>
                        <td style={{ fontSize: 13 }}>
                          {new Date(l.vencimento).toLocaleDateString('pt-BR')}
                          {l.pagoEm && (
                            <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
                              Recebido em {new Date(l.pagoEm).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmt(l.valor)}</td>
                        <td>
                          {l.status === 'pago' ? <span className="badge badge-green">Recebido</span>
                            : new Date(l.vencimento) < new Date(new Date().toDateString()) ? <span className="badge badge-red">Vencido</span>
                            : <span className="badge badge-yellow">Pendente</span>}
                        </td>
                        <td><span className="badge badge-accent" style={{ fontSize: 10 }}>{l.origem === 'plano' ? 'Plano' : 'Avulso'}</span></td>
                        <td>
                          {l.origem === 'avulso' ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {l.status === 'pago'
                                ? <button className="btn-ghost" style={{ fontSize: 11 }} disabled={processandoPagamento === l.id} onClick={() => marcarPagamento(l, false)}>
                                    {processandoPagamento === l.id ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                                  </button>
                                : <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} disabled={processandoPagamento === l.id} onClick={() => marcarPagamento(l, true)}>
                                    {processandoPagamento === l.id ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><Check size={13} /> Receber</>}
                                  </button>}
                              <button className="btn-ghost" style={{ fontSize: 11 }} disabled={processandoPagamento === l.id} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                              <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} disabled={processandoPagamento === l.id} onClick={() => setConfirmExcluir(l)}><Trash2 size={13} /></button>
                            </div>
                          ) : (
                            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/planos?aba=assinantes')}>
                              Ver em Planos →
                            </button>
                          )}
                        </td>
                      </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fin-cards-mobile">
                {agruparPorData(listaReceber).map(([data, itens]) => (
                  <div key={`m-grupo-r-${data}`}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '8px 16px', background: 'var(--accent-bg)', borderTop: '1px solid var(--accent-border)', borderBottom: '1px solid var(--accent-border)' }}>
                      {data !== 'sem-data' ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}
                      <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 8 }}>
                        {fmt(itens.reduce((s: number, i: any) => s + i.valor, 0))}
                      </span>
                    </div>
                    {itens.map((l: any) => (
                      <div key={l.id} className={`fin-card-mobile${l.status === 'pago' ? ' fin-row-pago' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                        {l.modo === 'fixa' && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                        {l.descricao}
                      </div>
                      {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                      {l.categoriaNome && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{nomeConta(l.contaBancariaId)} · {new Date(l.vencimento).toLocaleDateString('pt-BR')}</div>
                      {l.pagoEm && <div style={{ fontSize: 11, color: 'var(--green)' }}>Recebido em {new Date(l.pagoEm).toLocaleDateString('pt-BR')}</div>}
                      </div>
                      <span style={{ fontWeight: 600 }}>{fmt(l.valor)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      {l.status === 'pago' ? <span className="badge badge-green">Recebido</span>
                        : new Date(l.vencimento) < new Date(new Date().toDateString()) ? <span className="badge badge-red">Vencido</span>
                        : <span className="badge badge-yellow">Pendente</span>}
                      {l.origem === 'avulso' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {l.status === 'pago'
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} disabled={processandoPagamento === l.id} onClick={() => marcarPagamento(l, false)}>
                                {processandoPagamento === l.id ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Desfazer'}
                              </button>
                            : <button className="btn-primary" style={{ fontSize: 12 }} disabled={processandoPagamento === l.id} onClick={() => marcarPagamento(l, true)}>
                                {processandoPagamento === l.id ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Receber'}
                              </button>}
                          <button className="btn-ghost" disabled={processandoPagamento === l.id} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                          <button className="btn-ghost" style={{ color: 'var(--red)' }} disabled={processandoPagamento === l.id} onClick={() => setConfirmExcluir(l)}><Trash2 size={14} /></button>
                        </div>
                      ) : (
                        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => navigate('/planos?aba=assinantes')}>
                          Ver em Planos
                        </button>
                      )}
                    </div>
                  </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

      {/* Modal novo lançamento */}
      {modalLancamento && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvandoLanc && setModalLancamento(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ borderBottom: `2px solid ${aba === 'pagar' ? 'var(--red)' : 'var(--green)'}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: aba === 'pagar' ? 'var(--red)' : 'var(--green)' }}>
                {aba === 'pagar' ? '↓ Nova conta a pagar' : '↑ Nova conta a receber'}
              </h2>
              <button className="btn-ghost" disabled={salvandoLanc} onClick={() => setModalLancamento(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="cx-tipo-toggle" style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
                <button type="button" className={!formLanc.jaPago ? 'active' : ''}
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                  onClick={() => setFormLanc(f => ({ ...f, jaPago: false }))}>
                  Pendente
                </button>
                <button type="button" className={formLanc.jaPago ? 'active' : ''}
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                  onClick={() => setFormLanc(f => ({ ...f, jaPago: true, avisar: false }))}>
                  {aba === 'pagar' ? '✓ Já paguei' : '✓ Já recebi'}
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: formLanc.jaPago ? 'not-allowed' : 'pointer', marginBottom: 14, opacity: formLanc.jaPago ? 0.5 : 1 }}>
                <input type="checkbox" checked={formLanc.avisar} disabled={formLanc.jaPago} style={{ width: 16, height: 16, margin: 0 }}
                  onChange={e => setFormLanc(f => ({ ...f, avisar: e.target.checked }))} />
                🔔 Me avisar por e-mail no dia do vencimento
              </label>
              {formLanc.jaPago && (formLanc.modo === 'parcelada' || formLanc.modo === 'fixa') && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -8, marginBottom: 14 }}>
                  {formLanc.modo === 'parcelada' ? 'Marca só a 1ª parcela como paga.' : 'Marca só este mês como pago.'}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Tipo de lançamento</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { v: 'avulsa', t: 'Avulsa' },
                      { v: 'parcelada', t: 'Parcelada' },
                      { v: 'fixa', t: 'Fixa/recorrente' },
                    ].map(op => (
                      <button key={op.v} type="button"
                        className={op.v === formLanc.modo ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                        onClick={() => setFormLanc(f => ({ ...f, modo: op.v as any }))}>
                        {op.t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Conta bancária *</label>
                  <select value={formLanc.contaBancariaId} onChange={e => setFormLanc(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <AutocompleteInput
                    value={categoriasDaAba.find(c => c.id === formLanc.categoriaId)?.nome ?? formLanc.categoriaTexto ?? ''}
                    options={categoriasDaAba.map(c => ({ value: c.nome, icone: c.icone }))}
                    onChange={texto => {
                      const encontrada = categoriasDaAba.find(c => c.nome.toLowerCase() === texto.toLowerCase());
                      setFormLanc(f => ({ ...f, categoriaTexto: texto, categoriaId: encontrada?.id ?? '' }));
                    }}
                    placeholder="Digite ou escolha..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <AutocompleteInput value={formLanc.descricao} options={descricoesRecentes}
                    onChange={v => setFormLanc(f => ({ ...f, descricao: v }))}
                    placeholder={aba === 'pagar' ? 'Ex: Aluguel do estúdio' : 'Ex: Venda avulsa'} />
                </div>

                <div className="form-group">
                  <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={formLanc.observacao} onChange={e => setFormLanc(f => ({ ...f, observacao: e.target.value }))} placeholder="Notas internas" />
                </div>

                <div style={{ display: formLanc.modo === 'parcelada' ? 'block' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {formLanc.modo === 'parcelada' ? (
                    <div className="form-group">
                      <label className="form-label">Valor da parcela (R$) *</label>
                      <InputMoeda value={parseFloat(formLanc.valor) || 0} onChange={v => setFormLanc(f => ({ ...f, valor: String(v) }))} placeholder="0,00" />
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Valor (R$) *</label>
                        <InputMoeda value={parseFloat(formLanc.valor) || 0} onChange={v => setFormLanc(f => ({ ...f, valor: String(v) }))} placeholder="0,00" />
                      </div>

                      {formLanc.modo === 'fixa' ? (
                        <div className="form-group">
                          <label className="form-label">Dia do vencimento</label>
                          <input type="number" min={1} max={28} value={formLanc.diaVencimento}
                            onChange={e => setFormLanc(f => ({ ...f, diaVencimento: e.target.value }))} />
                        </div>
                      ) : (
                        <div className="form-group">
                          <label className="form-label">Vencimento</label>
                          <input type="date" value={formLanc.vencimento}
                            onChange={e => setFormLanc(f => ({ ...f, vencimento: e.target.value }))} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {formLanc.modo === 'parcelada' && (
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        {formLanc.tipoParcelamento === 'quantidade' ? 'Total de parcelas' : 'Até quando'}
                      </label>
                      <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={() => setFormLanc(f => ({ ...f, tipoParcelamento: f.tipoParcelamento === 'quantidade' ? 'dataFim' : 'quantidade' }))}>
                        {formLanc.tipoParcelamento === 'quantidade' ? 'usar data fim' : 'usar quantidade'}
                      </button>
                    </div>
                    {formLanc.tipoParcelamento === 'quantidade' ? (
                      <input type="number" min={2} max={120} value={formLanc.totalParcelas}
                        onChange={e => setFormLanc(f => ({ ...f, totalParcelas: e.target.value }))} />
                    ) : (
                      <input type="date" value={formLanc.dataFim}
                        onChange={e => setFormLanc(f => ({ ...f, dataFim: e.target.value }))} />
                    )}
                  </div>
                )}

                {formLanc.modo === 'parcelada' && (
                  <div className="form-group">
                    <label className="form-label">Data da 1ª parcela</label>
                    <input type="date" value={formLanc.vencimento}
                      onChange={e => setFormLanc(f => ({ ...f, vencimento: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      Vai gerar {formLanc.totalParcelas || 0} parcelas de {fmt(parseFloat(formLanc.valor) || 0)}, uma por mês.
                    </p>
                  </div>
                )}
                {formLanc.modo === 'fixa' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Data de início <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                      <input type="date" value={formLanc.dataInicio}
                        onChange={e => setFormLanc(f => ({ ...f, dataInicio: e.target.value }))} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Se deixar em branco, começa a partir deste mês. Esse lançamento se repete todo mês automaticamente, até você desativar em "Contas" ou nas configurações fixas.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" disabled={salvandoLanc} onClick={() => setModalLancamento(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarLancamento} disabled={salvandoLanc}>
                {salvandoLanc ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Criar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fatura do cartão */}
      {faturaAberta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFaturaAberta(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn-ghost" style={{ padding: 4 }} title="Voltar para Cartões"
                  onClick={() => { setFaturaAberta(null); navigate('/financeiro/cartoes'); }}>
                  <ChevronLeft size={18} />
                </button>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Fatura — {faturaAberta.nome}</h2>
              </div>
              <button className="btn-ghost" onClick={() => setFaturaAberta(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ position: 'sticky', bottom: 8, zIndex: 5, display: 'flex', justifyContent: 'center', marginBottom: 8, pointerEvents: 'none' }}>
                <button onClick={() => {
                  setModalLancarCompra(true);
                  api.get<string[]>('/api/financeiro/cartoes/lancamentos/descricoes').then(setDescricoesRecentesCartao).catch(() => {});
                }} title="Lançar compra" style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-lg)', cursor: 'pointer', pointerEvents: 'auto',
                }}>
                  <Plus size={24} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                <button className="btn-secondary" onClick={() => navFaturaMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{MESES[faturaMes - 1]} {faturaAno}</span>
                <button className="btn-secondary" onClick={() => navFaturaMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
              </div>

              {referenciasFatura && (() => {
                const mesmoMes = referenciasFatura.fechada.ano === referenciasFatura.aberta.ano && referenciasFatura.fechada.mes === referenciasFatura.aberta.mes;
                if (mesmoMes) {
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
                      Nenhuma fatura fechada pendente — mostrando ciclo em aberto
                    </div>
                  );
                }
                return (
                  <div className="cx-tipo-toggle" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                    <button
                      className={faturaAno === referenciasFatura.fechada.ano && faturaMes === referenciasFatura.fechada.mes ? 'active' : ''}
                      style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                      onClick={() => irParaReferencia('fechada')}>
                      Fechada {referenciasFatura.fechada.status === 'pago' ? '(paga)' : '(a pagar)'}
                    </button>
                    <button
                      className={faturaAno === referenciasFatura.aberta.ano && faturaMes === referenciasFatura.aberta.mes ? 'active' : ''}
                      style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                      onClick={() => irParaReferencia('aberta')}>
                      Aberta (em andamento)
                    </button>
                  </div>
                );
              })()}

              {carregandoFatura && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                  <div className="layout-spinner" />
                </div>
              )}
              {faturaDados && (
                <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Total do ciclo</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(faturaDados.total)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${
                        faturaDados.status === 'pago' ? 'badge-green'
                        : faturaDados.status === 'financiada' ? 'badge-blue'
                        : faturaDados.status === 'parcial' ? 'badge-yellow'
                        : 'badge-accent'
                      }`}>
                        {faturaDados.status === 'pago' ? 'Fatura paga'
                          : faturaDados.status === 'financiada' ? 'Parcelada'
                          : faturaDados.status === 'parcial' ? 'Paga parcialmente'
                          : 'Pendente'}
                      </span>
                      {faturaDados.total > 0 && (
                        faturaDados.status === 'pendente'
                          ? <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                              setFormPagFatura(f => ({ ...f, contaBancariaId: faturaAberta.contaBancariaId, dataPagamento: new Date().toISOString().slice(0, 10) }));
                              setModalPagarFatura(true);
                            }}>Pagar</button>
                          : <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => pagarFaturaModal('desfazer')}>Desfazer</button>
                      )}
                    </div>
                  </div>

                  {faturaDados.status === 'pendente' && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>💸 Pagamentos antecipados</span>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={abrirNovoAntecipado}><Plus size={12} /> Adiantar</button>
                      </div>
                      {faturaDados.antecipados && faturaDados.antecipados.length > 0 ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                            {faturaDados.antecipados.map(a => (
                              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                <span style={{ color: 'var(--text-2)' }}>
                                  {new Date(a.data).toLocaleDateString('pt-BR')} {a.observacao ? `— ${a.observacao}` : ''}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {fmt(a.valor)}
                                  <button className="btn-ghost" style={{ padding: 2, color: 'var(--red)' }} onClick={() => setConfirmExcluirAntecipado({ id: a.id, valor: a.valor })}><Trash2 size={12} /></button>
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
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Nenhum adiantamento nesta fatura ainda.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {faturaDados && ((faturaDados.itens.length > 0) || ((faturaDados.parcelasFinanciamento?.length ?? 0) > 0)) && (
                <input placeholder="Buscar por descrição..." value={buscaFatura}
                  onChange={e => { setBuscaFatura(e.target.value); setPaginaFatura(1); }}
                  style={{ marginBottom: 12 }} />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {(() => {
                  const itensCompra: any[] = (faturaDados?.itens ?? []).map(i => ({ ...i, vencimento: i.dataCompra, origemLinha: 'compra' as const }));
                  const itensFinanciamento: any[] = (faturaDados?.parcelasFinanciamento ?? []).map(p => ({
                    id: p.id, descricao: p.descricao, valor: p.valor, vencimento: p.vencimento,
                    categoriaNome: null, categoriaId: p.categoriaId, modo: p.modo, observacao: p.observacao,
                    numeroParcela: p.numeroParcela, totalParcelas: p.totalParcelas,
                    origemLinha: 'financiamento' as const, status: p.status, contaBancariaId: p.contaBancariaId,
                    mesOrigemFatura: p.mesOrigemFatura, anoOrigemFatura: p.anoOrigemFatura,
                  }));
                  const todosItens: any[] = [...itensCompra, ...itensFinanciamento];
                  const itensFiltrados = todosItens.filter(i => !buscaFatura || i.descricao.toLowerCase().includes(buscaFatura.toLowerCase()));
                  if (itensFiltrados.length === 0) {
                    return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma compra neste ciclo.</p>;
                  }
                  const totalPagFatura = Math.max(1, Math.ceil(itensFiltrados.length / 15));
                  const pagAtualFatura = Math.min(paginaFatura, totalPagFatura);
                  const itensPaginados = itensFiltrados.slice((pagAtualFatura - 1) * 15, pagAtualFatura * 15);
                  return agruparPorData(itensPaginados).map(([dia, itens]) => (
                    <div key={dia}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: '4px 8px', marginBottom: 6 }}>
                        <span>{dia !== 'sem-data' ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                        <span>{fmt(itens.reduce((s, i: any) => s + i.valor, 0))}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {itens.map((i: any) => (
                          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div>
                                {i.origemLinha === 'financiamento' && <span title="Parcela de financiamento" style={{ marginRight: 4 }}>💳</span>}
                                {i.descricao}
                                {i.modo === 'fixa' && <span className="badge badge-accent" style={{ fontSize: 9, marginLeft: 6 }}>🔁 Fixo</span>}
                                {i.numeroParcela && (
                                  <span className="badge badge-accent" style={{ fontSize: 9, marginLeft: 6 }}>{i.numeroParcela}/{i.totalParcelas}</span>
                                )}
                                {i.origemLinha === 'financiamento' && (
                                  <span className={`badge ${i.status === 'pago' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 9, marginLeft: 6 }}>
                                    {i.status === 'pago' ? 'Paga' : 'Pendente'}
                                  </span>
                                )}
                              </div>
                              {i.categoriaNome && (
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{iconeCategoria(i.categoriaNome)} {i.categoriaNome}</div>
                              )}
                              {i.origemLinha === 'financiamento' && i.mesOrigemFatura && i.anoOrigemFatura && (
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>da fatura de {MESES[i.mesOrigemFatura - 1]}/{i.anoOrigemFatura}</div>
                              )}
                              {i.observacao && (
                                <span className="badge badge-accent" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                                  💬 {i.observacao}
                                </span>
                              )}
                            </div>
                            <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmt(i.valor)}</span>
                            {i.origemLinha === 'financiamento' ? (
                              i.status !== 'pago' ? (
                                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                  <button className="btn-ghost" style={{ padding: 4, color: 'var(--green)' }} title="Marcar como quitada — não afeta saldo de nenhuma conta"
                                    onClick={() => marcarParcelaFinanciamentoPaga(i.id)}>
                                    <Check size={12} />
                                  </button>
                                  <button className="btn-ghost" style={{ padding: 4 }} title="Editar"
                                    onClick={() => abrirEditarLancamento({
                                      id: i.id, descricao: i.descricao, observacao: i.observacao ?? undefined,
                                      categoriaNome: null, categoriaId: i.categoriaId, contaBancariaId: i.contaBancariaId,
                                      modo: i.modo, valor: i.valor, vencimento: i.vencimento, status: i.status,
                                      pagoEm: null, numeroParcela: i.numeroParcela, totalParcelas: i.totalParcelas,
                                      origem: 'avulso', cartaoId: null, cartaoNome: null,
                                    } as any)}>
                                    <span style={{ fontSize: 11 }}>✎</span>
                                  </button>
                                  <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} title="Excluir"
                                    onClick={() => setConfirmExcluir({
                                      id: i.id, descricao: i.descricao, observacao: i.observacao ?? undefined,
                                      categoriaNome: null, categoriaId: i.categoriaId, contaBancariaId: i.contaBancariaId,
                                      modo: i.modo, valor: i.valor, vencimento: i.vencimento, status: i.status,
                                      pagoEm: null, numeroParcela: i.numeroParcela, totalParcelas: i.totalParcelas,
                                      origem: 'avulso', cartaoId: null, cartaoNome: null,
                                    } as any)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button className="btn-ghost" style={{ padding: 4, flexShrink: 0 }} title="Desfazer — volta essa parcela para pendente"
                                  onClick={() => desfazerParcelaFinanciamento(i.id)}>
                                  <RotateCcw size={12} />
                                </button>
                              )
                            ) : (
                              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={() => abrirEditarItemCartao(i)}>✎</button>
                                <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => setConfirmExcluirItemCartao(i)}><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {(() => {
                const itensCompra: any[] = (faturaDados?.itens ?? []).map(i => ({ ...i, vencimento: i.dataCompra }));
                const itensFinanciamento: any[] = faturaDados?.parcelasFinanciamento ?? [];
                const todosItens: any[] = [...itensCompra, ...itensFinanciamento];
                const itensFiltrados = todosItens.filter(i => !buscaFatura || i.descricao.toLowerCase().includes(buscaFatura.toLowerCase()));
                const totalPagFatura = Math.max(1, Math.ceil(itensFiltrados.length / 15));
                const pagAtualFatura = Math.min(paginaFatura, totalPagFatura);
                if (itensFiltrados.length <= 15) return null;
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <button className="btn-secondary" disabled={pagAtualFatura <= 1} onClick={() => setPaginaFatura(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{pagAtualFatura} / {totalPagFatura}</span>
                    <button className="btn-secondary" disabled={pagAtualFatura >= totalPagFatura} onClick={() => setPaginaFatura(p => Math.min(totalPagFatura, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setFaturaAberta(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lançar compra no cartão */}
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
                  {[
                    { v: 'avulsa', t: 'Avulsa' },
                    { v: 'parcelada', t: 'Parcelada' },
                    { v: 'fixa', t: 'Fixa/mensal' },
                  ].map(op => (
                    <button key={op.v} type="button"
                      className={op.v === formCompra.modo ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                      onClick={() => setFormCompra(f => ({ ...f, modo: op.v as any }))}>
                      {op.t}
                    </button>
                  ))}
                </div>

                <AutocompleteInput value={formCompra.descricao} options={descricoesRecentesCartao}
                  onChange={v => setFormCompra(f => ({ ...f, descricao: v }))} placeholder="Ex: Netflix" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InputMoeda value={parseFloat(formCompra.valor) || 0} onChange={v => setFormCompra(f => ({ ...f, valor: String(v) }))}
                    placeholder={formCompra.modo === 'parcelada' ? 'Valor da parcela' : 'Valor'} />

                  {formCompra.modo === 'parcelada' ? (
                    <input type="number" min={2} max={24} value={formCompra.totalParcelas}
                      onChange={e => setFormCompra(f => ({ ...f, totalParcelas: e.target.value }))} placeholder="Parcelas" />
                  ) : (
                    <input type="date" value={formCompra.dataCompra} onChange={e => setFormCompra(f => ({ ...f, dataCompra: e.target.value }))} />
                  )}
                </div>

                {formCompra.modo === 'parcelada' && (
                  <div className="form-group">
                    <label className="form-label">Data da 1ª parcela</label>
                    <input type="date" value={formCompra.dataCompra} onChange={e => setFormCompra(f => ({ ...f, dataCompra: e.target.value }))} />
                  </div>
                )}

                <AutocompleteInput
                  value={categorias.find(c => c.id === formCompra.categoriaId)?.nome ?? formCompra.categoriaTexto ?? ''}
                  options={categorias.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos').map(c => ({ value: c.nome, icone: c.icone }))}
                  onChange={texto => {
                    const encontrada = categorias.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos').find(c => c.nome.toLowerCase() === texto.toLowerCase());
                    setFormCompra(f => ({ ...f, categoriaTexto: texto, categoriaId: encontrada?.id ?? '' }));
                  }}
                  placeholder="Categoria (digite ou escolha)..."
                />
                <input value={formCompra.observacao} onChange={e => setFormCompra(f => ({ ...f, observacao: e.target.value }))} placeholder="Observação (opcional)" />

                {formCompra.modo === 'fixa' && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Repete todo mês no dia escolhido, até você desativar.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalLancarCompra(false)}>Cancelar</button>
              <button className="btn-primary" onClick={async () => { await lancarCompra(); setModalLancarCompra(false); }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lançar pagamento antecipado da fatura */}
      {modalAntecipado && faturaAberta && faturaDados && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAntecipado(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Adiantar pagamento — {faturaAberta.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalAntecipado(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                Falta pagar: <strong style={{ color: 'var(--text-1)' }}>{fmt(faturaDados.restante ?? faturaDados.total)}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Valor adiantado (R$)</label>
                  <InputMoeda value={parseFloat(formAntecipado.valor) || 0} onChange={v => setFormAntecipado(f => ({ ...f, valor: String(v) }))} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data do pagamento</label>
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={formAntecipado.data}
                    onChange={e => setFormAntecipado(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Conta de origem</label>
                  <select value={formAntecipado.contaBancariaId} onChange={e => setFormAntecipado(f => ({ ...f, contaBancariaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={formAntecipado.observacao} onChange={e => setFormAntecipado(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: adiantei parte porque recebi um extra" />
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

      {/* Confirmar exclusão de pagamento antecipado */}
      {confirmExcluirAntecipado && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirAntecipado(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir adiantamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirAntecipado(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir o adiantamento de <strong style={{ color: 'var(--text-1)' }}>{fmt(confirmExcluirAntecipado.valor)}</strong>? O valor volta a compor o saldo da conta.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirAntecipado(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirAntecipado}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal escolher forma de pagar a fatura */}
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
                  <option value="">Nenhuma (não afeta saldo de conta)</option>
                  {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {!formPagFatura.contaBancariaId && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Use quando a dívida foi resolvida por fora (negociação com o banco, absorvida em outro financiamento etc.) — não vai debitar de nenhuma conta cadastrada.
                  </p>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Data do pagamento</label>
                <input type="date" max={new Date().toISOString().slice(0, 10)} value={formPagFatura.dataPagamento}
                  onChange={e => setFormPagFatura(f => ({ ...f, dataPagamento: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { v: 'total', t: 'Pagar tudo' },
                  { v: 'parcial', t: 'Parcial' },
                  { v: 'parcelado', t: 'Parcelar' },
                ].map(op => (
                  <button key={op.v} type="button"
                    className={op.v === formPagFatura.modo ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                    onClick={() => setFormPagFatura(f => ({ ...f, modo: op.v as any }))}>
                    {op.t}
                  </button>
                ))}
              </div>

              {faturaDados.totalAntecipado ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                  Já foi antecipado {fmt(faturaDados.totalAntecipado)}. Falta {fmt(faturaDados.restante ?? faturaDados.total)}.
                </p>
              ) : null}

              {formPagFatura.modo === 'total' && (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Vai debitar {fmt(faturaDados.restante ?? faturaDados.total)} da conta escolhida agora.
                </p>
              )}

              {formPagFatura.modo === 'parcial' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Quanto vai pagar agora (R$)</label>
                    <InputMoeda value={parseFloat(formPagFatura.valorPago) || 0} onChange={v => setFormPagFatura(f => ({ ...f, valorPago: String(v) }))} placeholder="0,00" />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    O restante (com os juros do cartão) entra automaticamente na próxima fatura.
                  </p>
                </>
              )}

              {formPagFatura.modo === 'parcelado' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Valor de entrada (R$) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional, paga agora)</span></label>
                    <InputMoeda value={parseFloat(formPagFatura.valorEntrada) || 0} onChange={v => setFormPagFatura(f => ({ ...f, valorEntrada: String(v) }))} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Em quantas parcelas</label>
                    <input type="number" min={2} max={24} value={formPagFatura.totalParcelas}
                      onChange={e => setFormPagFatura(f => ({ ...f, totalParcelas: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data da 1ª parcela</label>
                    <input type="date" value={formPagFatura.primeiraParcela}
                      onChange={e => setFormPagFatura(f => ({ ...f, primeiraParcela: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      Padrão: mês seguinte ao vencimento desta fatura. Ajuste se precisar.
                    </p>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    Gera parcelas mensais em Contas a Pagar, já com os juros do cartão aplicados sobre o valor restante (após entrada).
                  </p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPagarFatura(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                const naoAfetaSaldo = !formPagFatura.contaBancariaId;
                if (formPagFatura.modo === 'total') pagarFaturaModal('total', { contaBancariaId: formPagFatura.contaBancariaId || null, dataPagamento: formPagFatura.dataPagamento || null, naoAfetaSaldo });
                else if (formPagFatura.modo === 'parcial') {
                  const valorParcial = parseFloat(formPagFatura.valorPago) || 0;
                  const limiteParcial = (faturaDados?.restante ?? faturaDados?.total ?? 0) - 0.01;
                  if (valorParcial <= 0 || valorParcial > limiteParcial) {
                    erro(`Informe um valor entre R$ 0,01 e ${fmt(limiteParcial)}.`);
                    return;
                  }
                  pagarFaturaModal('parcial', { valorPago: valorParcial, contaBancariaId: formPagFatura.contaBancariaId || null, dataPagamento: formPagFatura.dataPagamento || null, naoAfetaSaldo });
                }
                else pagarFaturaModal('parcelado', {
                  totalParcelas: parseInt(formPagFatura.totalParcelas) || 3,
                  valorEntrada: parseFloat(formPagFatura.valorEntrada) || 0,
                  primeiraParcela: formPagFatura.primeiraParcela || null,
                  contaBancariaId: formPagFatura.contaBancariaId || null,
                  dataPagamento: formPagFatura.dataPagamento || null,
                  naoAfetaSaldo,
                });
              }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar item do cartão */}
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
                    {categorias.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos').map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={formEditItemCartao.observacao} onChange={e => setFormEditItemCartao(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$)</label>
                    <InputMoeda value={parseFloat(formEditItemCartao.valor) || 0} onChange={v => setFormEditItemCartao(f => ({ ...f, valor: String(v) }))} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data</label>
                    <input type="date" value={formEditItemCartao.dataCompra} onChange={e => setFormEditItemCartao(f => ({ ...f, dataCompra: e.target.value }))} />
                  </div>
                </div>
                {(editandoItemCartao.modo === 'fixa' || editandoItemCartao.modo === 'parcelada') && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {editandoItemCartao.modo === 'fixa'
                      ? 'Essa é uma compra fixa. Você pode alterar só este mês, ou os próximos meses também.'
                      : 'Essa é uma parcela. Você pode alterar só esta, ou as demais parcelas futuras.'}
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

      {/* Confirmar exclusão de item do cartão */}
      {confirmExcluirItemCartao && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirItemCartao(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir compra</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirItemCartao(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirItemCartao.descricao}</strong>?
              </p>
              {(confirmExcluirItemCartao.modo === 'fixa' || confirmExcluirItemCartao.modo === 'parcelada') && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                  {confirmExcluirItemCartao.modo === 'fixa'
                    ? 'Essa é uma compra fixa. Você pode excluir só este mês, ou parar de gerar os próximos.'
                    : 'Essa é uma parcela. Você pode excluir só esta, ou todas as parcelas futuras.'}
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

      {/* Modal editar lançamento */}
      {editandoLancamento && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvandoEdit && setEditandoLancamento(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar lançamento</h2>
              <button className="btn-ghost" disabled={salvandoEdit} onClick={() => setEditandoLancamento(null)}><X size={16} /></button>
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
                  <AutocompleteInput
                    value={categorias.find(c => c.id === formEdit.categoriaId)?.nome ?? formEdit.categoriaTexto ?? ''}
                    options={categorias.map(c => ({ value: c.nome, icone: c.icone }))}
                    onChange={texto => {
                      const encontrada = categorias.find(c => c.nome.toLowerCase() === texto.toLowerCase());
                      setFormEdit(f => ({ ...f, categoriaTexto: texto, categoriaId: encontrada?.id ?? '' }));
                    }}
                    placeholder="Digite ou escolha..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <AutocompleteInput value={formEdit.descricao} options={descricoesRecentes}
                    onChange={v => setFormEdit(f => ({ ...f, descricao: v }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={formEdit.observacao} onChange={e => setFormEdit(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <InputMoeda value={parseFloat(formEdit.valor) || 0} onChange={v => setFormEdit(f => ({ ...f, valor: String(v) }))} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vencimento</label>
                    <input type="date" value={formEdit.vencimento} onChange={e => setFormEdit(f => ({ ...f, vencimento: e.target.value }))} />
                  </div>
                </div>

                {(editandoLancamento.modo === 'fixa' || editandoLancamento.modo === 'parcelada') && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {editandoLancamento.modo === 'fixa'
                      ? 'Esse é um lançamento fixo. Você pode alterar só este mês, ou aplicar a mudança nos próximos meses também.'
                      : 'Essa é uma parcela. Você pode alterar só esta, ou aplicar a mudança nas demais parcelas ainda não pagas.'}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" disabled={salvandoEdit} onClick={() => setEditandoLancamento(null)}>Cancelar</button>
              {(editandoLancamento.modo === 'fixa' || editandoLancamento.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('unica')}>
                    {salvandoEdit ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Só esta'}
                  </button>
                  <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('todas')}>
                    {salvandoEdit ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : (editandoLancamento.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas')}
                  </button>
                </>
              ) : (
                <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('unica')}>
                  {salvandoEdit ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !excluindoLancamento && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir lançamento</h2>
              <button className="btn-ghost" disabled={excluindoLancamento} onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluir.descricao}</strong>?
              </p>
              {(confirmExcluir.modo === 'fixa' || confirmExcluir.modo === 'parcelada') && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                  {confirmExcluir.modo === 'fixa'
                    ? 'Esse é um lançamento fixo (recorrente). Você pode excluir só este mês, ou parar de gerar os próximos.'
                    : 'Essa é uma parcela. Você pode excluir só esta, ou todas as parcelas futuras ainda não pagas.'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" disabled={excluindoLancamento} onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              {(confirmExcluir.modo === 'fixa' || confirmExcluir.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" disabled={excluindoLancamento} onClick={() => excluirLancamento('unica')}>
                    {excluindoLancamento ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Só esta'}
                  </button>
                  <button className="btn-danger" disabled={excluindoLancamento} onClick={() => excluirLancamento('todas')}>
                    {excluindoLancamento ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : (confirmExcluir.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas')}
                  </button>
                </>
              ) : (
                <button className="btn-danger" disabled={excluindoLancamento} onClick={() => excluirLancamento('unica')}>
                  {excluindoLancamento ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Excluir'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {listaCompletaAtual.length > 0 && totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" disabled={paginaAtual <= 1} onClick={() => irParaPaginaLista(Math.max(1, paginaAtual - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtual} / {totalPaginas}</span>
          <button className="btn-secondary" disabled={paginaAtual >= totalPaginas} onClick={() => irParaPaginaLista(Math.min(totalPaginas, paginaAtual + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
        </div>
      )}

      </div>
  );
}