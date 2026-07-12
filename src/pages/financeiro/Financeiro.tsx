import { useState, useEffect } from 'react';
import { Plus, X, Wallet, Tag, Trash2, Check, ChevronLeft, ChevronRight, Settings, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Financeiro.css';

interface Conta {
  id: string;
  nome: string;
  saldoInicial: number;
  saldoAtual: number;
  ativa: boolean;
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
}

interface LinhaPagar {
  id: string;
  descricao: string;
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
  modo: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ICONES_CATEGORIA = ['🏷️','💵','💰','🤑','$','🏠','💧','💡','📶','📦','👤','🧾','💳','🛒','📁','🍽️','🚗','🎓','🏥','🎮'
    ,'✈️','🐾','🎁','📱','💊','⛽','🧹','🎬','📈','📉','🔧','🛠️','🎉','👶','💇','🐶'];

function ehVencido(l: { status: string; vencimento: string }) {
  if (!l.vencimento) return false;
  return l.status === 'pendente' && new Date(l.vencimento) < new Date(new Date().toDateString());
}

export function Financeiro() {
  const { sucesso, erro } = useToast();
  const [aba, setAba] = useState<'pagar' | 'receber'>('pagar');
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(hoje.getMonth());
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());

  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [receberUnificado, setReceberUnificado] = useState<any[]>([]);
  const [resumo, setResumo] = useState<{ pagar: Resumo; receber: Resumo } | null>(null);
  const [catFiltro, setCatFiltro] = useState('todas');
  const [modoPagar, setModoPagar] = useState<'agrupado' | 'detalhado'>('agrupado');
  const [linhasPagar, setLinhasPagar] = useState<LinhaPagar[]>([]);

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [modalCartoes, setModalCartoes] = useState(false);
  const [formCartao, setFormCartao] = useState({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: '' });
  const [editandoCartao, setEditandoCartao] = useState<Cartao | null>(null);

  const [faturaAberta, setFaturaAberta] = useState<Cartao | null>(null);
  const [faturaDados, setFaturaDados] = useState<{ vencimento: string; total: number; status: string; itens: ItemFaturaDetalhe[] } | null>(null);
  const [faturaAno, setFaturaAno] = useState(new Date().getFullYear());
  const [faturaMes, setFaturaMes] = useState(new Date().getMonth() + 1);
  const [formCompra, setFormCompra] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10),
    categoriaId: '', totalParcelas: '2',
  });

  const [modalLancamento, setModalLancamento] = useState(false);
  const [modalContas, setModalContas] = useState(false);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [modalAjuste, setModalAjuste] = useState<Conta | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<LinhaPagar | null>(null);
  const [editandoLancamento, setEditandoLancamento] = useState<LinhaPagar | null>(null);
  const [formEdit, setFormEdit] = useState({ contaBancariaId: '', categoriaId: '', descricao: '', valor: '', vencimento: '' });
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [escopoEdit, setEscopoEdit] = useState<'unica' | 'todas' | null>(null);

  const [formLanc, setFormLanc] = useState({
    modo: 'avulsa' as 'avulsa' | 'parcelada' | 'fixa',
    contaBancariaId: '', categoriaId: '', descricao: '', valor: '',
    vencimento: new Date().toISOString().slice(0, 10),
    totalParcelas: '2', diaVencimento: '10',
  });
  const [salvandoLanc, setSalvandoLanc] = useState(false);

  const [formConta, setFormConta] = useState({ nome: '', saldoInicial: '' });
  const [editandoConta, setEditandoConta] = useState<Conta | null>(null);

  const [formCat, setFormCat] = useState({ nome: '', tipo: 'ambos', icone: '' });
  const [filtroCatModal, setFiltroCatModal] = useState<'todas' | 'pagar' | 'receber' | 'ambos'>('todas');

  const [formAjuste, setFormAjuste] = useState({ tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', valor: '', novoSaldo: '', observacao: '' });

  async function carregarContas() {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }
  async function carregarCategorias() {
    api.get<Categoria[]>('/api/financeiro/categorias').then(setCategorias).catch(() => {});
  }
  async function carregarLancamentos() {
    if (aba === 'pagar') {
      api.get<LinhaPagar[]>(`/api/financeiro/pagar-unificado?ano=${anoRef}&mes=${mesRef + 1}&modo=${modoPagar}`)
        .then(setLinhasPagar).catch(() => {});
    } else {
      const inicio = new Date(anoRef, mesRef, 1).toISOString();
      const fim = new Date(anoRef, mesRef + 1, 0).toISOString();
      api.get<any[]>(`/api/financeiro/receber-unificado?de=${inicio}&ate=${fim}`)
        .then(setReceberUnificado).catch(() => {});
    }
  }

  function carregarCartoes() {
    api.get<Cartao[]>('/api/financeiro/cartoes').then(setCartoes).catch(() => {});
  }
  async function carregarResumo() {
    api.get<any>(`/api/financeiro/resumo-mensal?ano=${anoRef}&mes=${mesRef + 1}`)
      .then(setResumo).catch(() => {});
  }

  useEffect(() => { carregarContas(); carregarCategorias(); carregarCartoes(); }, []);
  useEffect(() => { carregarLancamentos(); carregarResumo(); }, [aba, mesRef, anoRef, modoPagar]);
  useEffect(() => { setCatFiltro('todas'); }, [aba]);

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

  const listaPagar = linhasPagar.filter(l => catFiltro === 'todas' || l.categoriaNome === catFiltro);
  const listaReceber = receberUnificado.filter((l: any) => {
    if (catFiltro === 'todas') return true;
    if (catFiltro === '__plano__') return l.origem === 'plano';
    return l.origem === 'avulso' && l.categoriaNome === catFiltro;
  });

  const resumoAba = resumo ? resumo[aba] : null;

  // ── Lançamento ──────────────────────────────────────────────────
  function abrirNovoLancamento() {
    setFormLanc({
      modo: 'avulsa', contaBancariaId: contas[0]?.id ?? '', categoriaId: '',
      descricao: '', valor: '', vencimento: new Date().toISOString().slice(0, 10),
      totalParcelas: '2', diaVencimento: '10',
    });
    setModalLancamento(true);
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
          valor: parseFloat(formLanc.valor), vencimento: formLanc.vencimento,
        });
      } else if (formLanc.modo === 'parcelada') {
        await api.post('/api/financeiro/lancamentos/parcelado', {
          contaBancariaId: formLanc.contaBancariaId, tipo: aba,
          descricao: formLanc.descricao.trim(),
          categoriaId: formLanc.categoriaId || null,
          valorParcela: parseFloat(formLanc.valor),
          totalParcelas: parseInt(formLanc.totalParcelas) || 2,
          primeiroVencimento: formLanc.vencimento,
        });
      } else {
        await api.post('/api/financeiro/fixos', {
          contaBancariaId: formLanc.contaBancariaId, tipo: aba,
          descricao: formLanc.descricao.trim(),
          categoriaId: formLanc.categoriaId || null,
          valor: parseFloat(formLanc.valor),
          diaVencimento: parseInt(formLanc.diaVencimento) || 10,
        });
      }
      setModalLancamento(false);
      carregarLancamentos();
      carregarResumo();
      sucesso('Lançamento criado!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoLanc(false);
    }
  }

  async function marcarPagamento(l: Lancamento, pago: boolean) {
    try {
      await api.post(`/api/financeiro/lancamentos/${l.id}/pagamento`, { pago });
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso(pago ? 'Marcado como pago' : 'Marcado como pendente');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirLancamento(modo: 'unica' | 'todas' = 'unica') {
    if (!confirmExcluir) return;
    try {
      await api.delete(`/api/financeiro/lancamentos/${confirmExcluir.id}?modo=${modo}`);
      setConfirmExcluir(null);
      carregarLancamentos();
      carregarResumo();
      sucesso('Lançamento excluído');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function abrirEditarLancamento(l: LinhaPagar) {
    setEditandoLancamento(l);
    setEscopoEdit(null);
    setFormEdit({
      contaBancariaId: l.contaBancariaId ?? '',
      categoriaId: l.categoriaId ?? '',
      descricao: l.descricao,
      valor: String(l.valor),
      vencimento: l.vencimento ? l.vencimento.slice(0, 10) : '',
    });
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
      });
      setEditandoLancamento(null);
      carregarLancamentos();
      carregarResumo();
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
    try {
      await api.post(`/api/financeiro/cartoes/${l.cartaoId}/fatura/pagamento?ano=${anoRef}&mes=${mesRef + 1}`, {
        modo: pago ? 'total' : 'desfazer',
      });
      carregarLancamentos();
      carregarResumo();
      carregarContas();
      sucesso(pago ? 'Fatura marcada como paga' : 'Fatura marcada como pendente');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // ── Cartões de crédito ──────────────────────────────────────────
  function abrirNovoCartao() {
    setEditandoCartao(null);
    setFormCartao({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: contas[0]?.id ?? '' });
  }
  function abrirEditarCartao(c: Cartao) {
    setEditandoCartao(c);
    setFormCartao({
      nome: c.nome, limite: String(c.limite),
      diaFechamento: String(c.diaFechamento), diaVencimento: String(c.diaVencimento),
      contaBancariaId: c.contaBancariaId,
    });
  }
  async function salvarCartao() {
    if (!formCartao.nome.trim() || !formCartao.contaBancariaId) { erro('Preencha nome e conta vinculada.'); return; }
    try {
      const payload = {
        nome: formCartao.nome.trim(),
        limite: parseFloat(formCartao.limite) || 0,
        diaFechamento: parseInt(formCartao.diaFechamento) || 10,
        diaVencimento: parseInt(formCartao.diaVencimento) || 15,
        contaBancariaId: formCartao.contaBancariaId,
      };
      if (editandoCartao) await api.put(`/api/financeiro/cartoes/${editandoCartao.id}`, payload);
      else await api.post('/api/financeiro/cartoes', payload);
      setEditandoCartao(null);
      setFormCartao({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: '' });
      carregarCartoes();
      carregarLancamentos();
      sucesso('Cartão salvo!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function carregarFatura(cartaoId: string, ano: number, mes: number) {
    setFaturaDados(null);
    try {
      const res = await api.get<any>(`/api/financeiro/cartoes/${cartaoId}/fatura?ano=${ano}&mes=${mes}`);
      setFaturaDados(res);
    } catch {
      setFaturaDados({ vencimento: '', total: 0, status: 'pendente', itens: [] });
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
        await api.post(`/api/financeiro/cartoes/${faturaAberta.id}/fixos`, {
          descricao: formCompra.descricao.trim(),
          valor: parseFloat(formCompra.valor),
          categoriaId: formCompra.categoriaId || null,
        });
      }
      setFormCompra({ modo: 'avulsa', descricao: '', valor: '', dataCompra: new Date().toISOString().slice(0, 10), categoriaId: '', totalParcelas: '2' });
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
      descricao: item.descricao.replace(/\s\(\d+\/\d+\)$/, ''), // remove sufixo "(2/10)" pra editar só o nome base
      valor: String(item.valor),
      dataCompra: item.dataCompra.slice(0, 10),
      categoriaId: '',
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
  const [formPagFatura, setFormPagFatura] = useState({ modo: 'total' as 'total' | 'parcial' | 'parcelado', valorPago: '', totalParcelas: '3' });
  const [editandoItemCartao, setEditandoItemCartao] = useState<ItemFaturaDetalhe | null>(null);
  const [formEditItemCartao, setFormEditItemCartao] = useState({ descricao: '', valor: '', dataCompra: '', categoriaId: '' });
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

  // ── Contas bancárias ────────────────────────────────────────────
  function abrirNovaConta() {
    setEditandoConta(null);
    setFormConta({ nome: '', saldoInicial: '' });
  }
  function abrirEditarConta(c: Conta) {
    setEditandoConta(c);
    setFormConta({ nome: c.nome, saldoInicial: String(c.saldoInicial) });
  }
  async function salvarConta() {
    if (!formConta.nome.trim()) { erro('Digite o nome da conta.'); return; }
    try {
      const payload = { nome: formConta.nome.trim(), saldoInicial: parseFloat(formConta.saldoInicial) || 0 };
      if (editandoConta) await api.put(`/api/financeiro/contas/${editandoConta.id}`, payload);
      else await api.post('/api/financeiro/contas', payload);
      setEditandoConta(null);
      setFormConta({ nome: '', saldoInicial: '' });
      carregarContas();
      sucesso('Conta salva!');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function alternarConta(c: Conta) {
    await api.patch(`/api/financeiro/contas/${c.id}/ativo`, {});
    carregarContas();
  }

  // ── Ajuste de saldo ─────────────────────────────────────────────
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
      carregarContas();
      sucesso('Saldo ajustado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // ── Categorias ──────────────────────────────────────────────────
  async function salvarCategoria() {
    if (!formCat.nome.trim()) { erro('Digite o nome da categoria.'); return; }
    try {
      await api.post('/api/financeiro/categorias', { nome: formCat.nome.trim(), tipo: formCat.tipo, icone: formCat.icone || null });
      setFormCat({ nome: '', tipo: 'ambos', icone: '' });
      carregarCategorias();
      sucesso('Categoria criada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function excluirCategoria(c: Categoria) {
    try {
      const res = await api.delete<any>(`/api/financeiro/categorias/${c.id}`);
      carregarCategorias();
      sucesso(res?.mensagem ?? 'Categoria removida.');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function seedCategoriasPadrao() {
    try {
      await api.post('/api/financeiro/categorias/seed-padrao', {});
      carregarCategorias();
      sucesso('Categorias padrão criadas!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const saldoTotal = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Contas a pagar e a receber</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => setModalContas(true)}><Wallet size={14} /> Contas</button>
          <button className="btn-secondary" onClick={() => setModalCartoes(true)}><CreditCard size={14} /> Cartões</button>
          <button className="btn-secondary" onClick={() => setModalCategorias(true)}><Tag size={14} /> Categorias</button>
          <button className="btn-primary" onClick={abrirNovoLancamento}><Plus size={15} /> Novo lançamento</button>
        </div>
      </div>

      {/* Saldo geral */}
      <div className="fin-stats">
        <div className="stat-card">
          <div className="stat-label"><Wallet size={12} style={{ verticalAlign: -1 }} /> Saldo total</div>
          <div className="stat-value" style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotal)}</div>
          <div className="stat-sub">{contas.filter(c => c.ativa).length} conta(s)</div>
        </div>
        {resumoAba && (
          <>
            <div className="stat-card">
              <div className="stat-label">Pago no mês</div>
              <div className="stat-value" style={{ color: 'var(--green)', fontSize: 20 }}>{fmt(resumoAba.totalPago)}</div>
              <div className="stat-sub">{resumoAba.qtdPago} lançamento(s)</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendente</div>
              <div className="stat-value" style={{ color: 'var(--yellow, #d97706)', fontSize: 20 }}>{fmt(resumoAba.totalPendente)}</div>
              <div className="stat-sub">{resumoAba.qtdPendente} lançamento(s)</div>
            </div>
            <div className="stat-card" style={resumoAba.qtdVencido > 0 ? { borderColor: 'rgba(248,113,113,0.3)' } : {}}>
              <div className="stat-label">Vencido</div>
              <div className="stat-value" style={{ color: 'var(--red)', fontSize: 20 }}>{fmt(resumoAba.totalVencido)}</div>
              <div className="stat-sub">{resumoAba.qtdVencido} lançamento(s)</div>
            </div>
          </>
        )}
      </div>

      {/* Abas */}
      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'pagar' ? ' ativo' : ''}`} onClick={() => setAba('pagar')}>
          <TrendingDown size={15} /> A Pagar
        </button>
        <button className={`planos-tab${aba === 'receber' ? ' ativo' : ''}`} onClick={() => setAba('receber')}>
          <TrendingUp size={15} /> A Receber
        </button>
      </div>

      {/* Navegação de mês */}
      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-secondary" onClick={() => navMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{MESES[mesRef]} {anoRef}</span>
          <button className="btn-secondary" onClick={() => navMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
        </div>
        {aba === 'pagar' ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="cx-tipo-toggle">
              <button className={modoPagar === 'agrupado' ? 'active' : ''} onClick={() => setModoPagar('agrupado')}>Agrupado</button>
              <button className={modoPagar === 'detalhado' ? 'active' : ''} onClick={() => setModoPagar('detalhado')}>Detalhado</button>
            </div>
            {categoriasDaAba.length > 0 && (
              <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
                <option value="todas">Todas as categorias</option>
                {categoriasDaAba.map(c => (
                  <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          categoriasDaAba.length > 0 && (
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
              <option value="todas">Todas as categorias</option>
              <option value="__plano__">💳 Mensalidades (Planos)</option>
              {categoriasDaAba.map(c => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          )
        )}
      </div>

      {/* Lista */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {aba === 'pagar' ? (
          listaPagar.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}><p>Nenhuma conta a pagar neste mês.</p></div>
          ) : (
            <>
              <div className="table-wrap fin-table-desktop">
                <table>
                  <thead>
                    <tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {listaPagar.map(l => {
                      const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item';
                      const pagar = () => ehCartao ? marcarPagamentoCartaoFatura(l, true) : marcarPagamento(l as any, true);
                      const desfazer = () => ehCartao ? marcarPagamentoCartaoFatura(l, false) : marcarPagamento(l as any, false);
                      return (
                        <tr key={l.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {l.origem === 'cartao_fatura' && <CreditCard size={12} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />}
                              {l.descricao}
                            </div>
                            {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                            {l.categoriaNome ? <>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</> : '—'}
                          </td>
                          <td style={{ fontSize: 13 }}>{l.vencimento ? new Date(l.vencimento).toLocaleDateString('pt-BR') : '—'}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(l.valor)}</td>
                          <td>
                            {l.status === 'pago' ? <span className="badge badge-green">Pago</span>
                              : ehVencido(l as any) ? <span className="badge badge-red">Vencido</span>
                              : <span className="badge badge-accent">Pendente</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {l.status === 'pago'
                                ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={desfazer}>Desfazer</button>
                                : <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} onClick={pagar}><Check size={13} /> Pagar</button>}
                              {l.origem === 'avulso' && (
                                <>
                                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => setConfirmExcluir(l as any)}><Trash2 size={13} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="fin-cards-mobile">
                {listaPagar.map(l => {
                  const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item';
                  const pagar = () => ehCartao ? marcarPagamentoCartaoFatura(l, true) : marcarPagamento(l as any, true);
                  const desfazer = () => ehCartao ? marcarPagamentoCartaoFatura(l, false) : marcarPagamento(l as any, false);
                  return (
                    <div key={l.id} className="fin-card-mobile">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {l.origem === 'cartao_fatura' && <CreditCard size={12} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />}
                            {l.descricao}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {l.categoriaNome ? <>{iconeCategoria(l.categoriaNome)} {l.categoriaNome}</> : '—'} · {l.vencimento ? new Date(l.vencimento).toLocaleDateString('pt-BR') : '—'}
                          </div>
                          {l.numeroParcela && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Parcela {l.numeroParcela}/{l.totalParcelas}</div>}
                        </div>
                        <span style={{ fontWeight: 600 }}>{fmt(l.valor)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        {l.status === 'pago' ? <span className="badge badge-green">Pago</span>
                          : ehVencido(l as any) ? <span className="badge badge-red">Vencido</span>
                          : <span className="badge badge-accent">Pendente</span>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {l.status === 'pago'
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} onClick={desfazer}>Desfazer</button>
                            : <button className="btn-primary" style={{ fontSize: 12 }} onClick={pagar}>Pagar</button>}
                          {l.origem === 'avulso' && (
                            <>
                              <button className="btn-ghost" onClick={() => abrirEditarLancamento(l)}>Editar</button>
                              <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluir(l as any)}><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                    <tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Origem</th><th></th></tr>
                  </thead>
                  <tbody>
                    {listaReceber.map((l: any) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 500 }}>{l.descricao}</td>
                        <td style={{ fontSize: 13 }}>{new Date(l.vencimento).toLocaleDateString('pt-BR')}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(l.valor)}</td>
                        <td>
                          {l.status === 'pago' ? <span className="badge badge-green">Pago</span>
                            : new Date(l.vencimento) < new Date(new Date().toDateString()) ? <span className="badge badge-red">Vencido</span>
                            : <span className="badge badge-accent">Pendente</span>}
                        </td>
                        <td><span className="badge badge-accent" style={{ fontSize: 10 }}>{l.origem === 'plano' ? 'Plano' : 'Avulso'}</span></td>
                        <td>
                          {l.origem === 'avulso' ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {l.status === 'pago'
                                ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => marcarPagamento(l, false)}>Desfazer</button>
                                : <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} onClick={() => marcarPagamento(l, true)}><Check size={13} /> Receber</button>}
                              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => abrirEditarLancamento(l)}>Editar</button>
                              <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => setConfirmExcluir(l)}><Trash2 size={13} /></button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Gerenciado em Planos</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fin-cards-mobile">
                {listaReceber.map((l: any) => (
                  <div key={l.id} className="fin-card-mobile">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{l.descricao}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(l.vencimento).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <span style={{ fontWeight: 600 }}>{fmt(l.valor)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      {l.status === 'pago' ? <span className="badge badge-green">Pago</span> : <span className="badge badge-accent">Pendente</span>}
                      {l.origem === 'avulso' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {l.status === 'pago'
                            ? <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => marcarPagamento(l, false)}>Desfazer</button>
                            : <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => marcarPagamento(l, true)}>Receber</button>}
                          <button className="btn-ghost" onClick={() => abrirEditarLancamento(l)}>Editar</button>
                          <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluir(l)}><Trash2 size={14} /></button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Ver em Planos</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

      {/* Modal novo lançamento */}
      {modalLancamento && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalLancamento(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Novo lançamento — {aba === 'pagar' ? 'a pagar' : 'a receber'}</h2>
              <button className="btn-ghost" onClick={() => setModalLancamento(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
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
                  <select value={formLanc.categoriaId} onChange={e => setFormLanc(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categoriasDaAba.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input value={formLanc.descricao} onChange={e => setFormLanc(f => ({ ...f, descricao: e.target.value }))}
                    placeholder={aba === 'pagar' ? 'Ex: Aluguel do estúdio' : 'Ex: Venda avulsa'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">{formLanc.modo === 'parcelada' ? 'Valor da parcela' : 'Valor'} (R$) *</label>
                    <input type="number" min={0} step={0.01} value={formLanc.valor}
                      onChange={e => setFormLanc(f => ({ ...f, valor: e.target.value }))} />
                  </div>

                  {formLanc.modo === 'fixa' ? (
                    <div className="form-group">
                      <label className="form-label">Dia do vencimento</label>
                      <input type="number" min={1} max={28} value={formLanc.diaVencimento}
                        onChange={e => setFormLanc(f => ({ ...f, diaVencimento: e.target.value }))} />
                    </div>
                  ) : formLanc.modo === 'parcelada' ? (
                    <div className="form-group">
                      <label className="form-label">Total de parcelas</label>
                      <input type="number" min={2} max={60} value={formLanc.totalParcelas}
                        onChange={e => setFormLanc(f => ({ ...f, totalParcelas: e.target.value }))} />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Vencimento</label>
                      <input type="date" value={formLanc.vencimento}
                        onChange={e => setFormLanc(f => ({ ...f, vencimento: e.target.value }))} />
                    </div>
                  )}
                </div>

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
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Esse lançamento se repete todo mês automaticamente, até você desativar em "Contas" ou nas configurações fixas.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalLancamento(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarLancamento} disabled={salvandoLanc}>
                {salvandoLanc ? 'Salvando...' : 'Criar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contas bancárias */}
      {modalContas && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalContas(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Contas bancárias</h2>
              <button className="btn-ghost" onClick={() => setModalContas(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {contas.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma conta cadastrada.</p>
                ) : contas.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, opacity: c.ativa ? 1 : 0.5 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                      <div style={{ fontSize: 13, color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" title="Ajustar saldo" onClick={() => abrirAjuste(c)}><Settings size={14} /></button>
                      <button className="btn-ghost" title="Editar" onClick={() => abrirEditarConta(c)}>Editar</button>
                      <button className="btn-ghost" title={c.ativa ? 'Desativar' : 'Ativar'} onClick={() => alternarConta(c)}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{editandoConta ? 'Editar conta' : 'Nova conta'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Nome</label>
                    <input value={formConta.nome} onChange={e => setFormConta(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Itaú" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Saldo inicial</label>
                    <input type="number" step={0.01} value={formConta.saldoInicial} onChange={e => setFormConta(f => ({ ...f, saldoInicial: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-primary" onClick={salvarConta}>{editandoConta ? 'Salvar' : 'Adicionar conta'}</button>
                  {editandoConta && <button className="btn-secondary" onClick={abrirNovaConta}>Cancelar edição</button>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalContas(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajuste de saldo */}
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
                  {[
                    { v: 'entrada', t: 'Entrada' },
                    { v: 'saida', t: 'Saída' },
                    { v: 'ajuste', t: 'Definir saldo' },
                  ].map(op => (
                    <button key={op.v} type="button"
                      className={op.v === formAjuste.tipo ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                      onClick={() => setFormAjuste(f => ({ ...f, tipo: op.v as any }))}>
                      {op.t}
                    </button>
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

      {/* Modal categorias */}
      {modalCategorias && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCategorias(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Categorias financeiras</h2>
              <button className="btn-ghost" onClick={() => setModalCategorias(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {categorias.length === 0 && (
                <button className="btn-secondary" style={{ width: '100%', marginBottom: 16 }} onClick={seedCategoriasPadrao}>
                  Usar categorias padrão
                </button>
              )}
              {categorias.length > 0 && (
                <div className="cat-tabs" style={{ marginBottom: 12 }}>
                  <button className={`cat-tab${filtroCatModal === 'todas' ? ' active' : ''}`} onClick={() => setFiltroCatModal('todas')}>Todas</button>
                  <button className={`cat-tab${filtroCatModal === 'pagar' ? ' active' : ''}`} onClick={() => setFiltroCatModal('pagar')}>A pagar</button>
                  <button className={`cat-tab${filtroCatModal === 'receber' ? ' active' : ''}`} onClick={() => setFiltroCatModal('receber')}>A receber</button>
                  <button className={`cat-tab${filtroCatModal === 'ambos' ? ' active' : ''}`} onClick={() => setFiltroCatModal('ambos')}>Ambos</button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {categorias.filter(c => filtroCatModal === 'todas' || c.tipo === filtroCatModal).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>{c.icone} {c.nome} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>({c.tipo})</span></span>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => excluirCategoria(c)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Nova categoria</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={formCat.nome} onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Marketing" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select style={{ flex: 1 }} value={formCat.tipo} onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value }))}>
                      <option value="ambos">Pagar e Receber</option>
                      <option value="pagar">Só Pagar</option>
                      <option value="receber">Só Receber</option>
                    </select>
                    <select style={{ width: 90 }} value={formCat.icone} onChange={e => setFormCat(f => ({ ...f, icone: e.target.value }))}>
                      {ICONES_CATEGORIA.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <button className="btn-primary" onClick={salvarCategoria}>Adicionar categoria</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalCategorias(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cartões de crédito */}
      {modalCartoes && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCartoes(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Cartões de crédito</h2>
              <button className="btn-ghost" onClick={() => setModalCartoes(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {cartoes.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhum cartão cadastrado.</p>
                ) : cartoes.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Limite {fmt(c.limite)} · Fecha dia {c.diaFechamento} · Vence dia {c.diaVencimento}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setModalCartoes(false); abrirFatura(c); }}>Ver fatura</button>
                      <button className="btn-ghost" onClick={() => abrirEditarCartao(c)}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{editandoCartao ? 'Editar cartão' : 'Novo cartão'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Santander" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Limite (R$)</label>
                      <input type="number" step={0.01} value={formCartao.limite} onChange={e => setFormCartao(f => ({ ...f, limite: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Conta de pagamento</label>
                      <select value={formCartao.contaBancariaId} onChange={e => setFormCartao(f => ({ ...f, contaBancariaId: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dia de fechamento</label>
                      <input type="number" min={1} max={28} value={formCartao.diaFechamento} onChange={e => setFormCartao(f => ({ ...f, diaFechamento: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dia de vencimento</label>
                      <input type="number" min={1} max={28} value={formCartao.diaVencimento} onChange={e => setFormCartao(f => ({ ...f, diaVencimento: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Taxa de juros (% ao mês)</label>
                      <input type="number" min={0} step={0.01} value={(formCartao as any).taxaJurosMensal ?? ''} onChange={e => setFormCartao(f => ({ ...(f as any), taxaJurosMensal: e.target.value }))} placeholder="Ex: 12.5" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" onClick={salvarCartao}>{editandoCartao ? 'Salvar' : 'Adicionar cartão'}</button>
                    {editandoCartao && <button className="btn-secondary" onClick={abrirNovoCartao}>Cancelar edição</button>}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalCartoes(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fatura do cartão */}
      {faturaAberta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFaturaAberta(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Fatura — {faturaAberta.nome}</h2>
              <button className="btn-ghost" onClick={() => setFaturaAberta(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                <button className="btn-secondary" onClick={() => navFaturaMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{MESES[faturaMes - 1]} {faturaAno}</span>
                <button className="btn-secondary" onClick={() => navFaturaMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
              </div>

              {faturaDados && (
                <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Total do ciclo</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(faturaDados.total)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${faturaDados.status === 'pago' ? 'badge-green' : 'badge-accent'}`}>
                      {faturaDados.status === 'pago' ? 'Fatura paga' : 'Pendente'}
                    </span>
                    {faturaDados.total > 0 && (
                      faturaDados.status === 'pendente'
                        ? <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setModalPagarFatura(true)}>Pagar</button>
                        : <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => pagarFaturaModal('desfazer')}>Desfazer</button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {faturaDados?.itens.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma compra neste ciclo.</p>
                ) : faturaDados?.itens.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        {i.descricao}
                        {i.modo === 'fixa' && <span className="badge badge-accent" style={{ fontSize: 9, marginLeft: 6 }}>Fixo</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(i.dataCompra).toLocaleDateString('pt-BR')}{i.categoriaNome ? ` · ${i.categoriaNome}` : ''}</div>
                    </div>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmt(i.valor)}</span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button className="btn-ghost" style={{ padding: 4 }} onClick={() => abrirEditarItemCartao(i)}>✎</button>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => setConfirmExcluirItemCartao(i)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Lançar compra</p>
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

                  <input value={formCompra.descricao} onChange={e => setFormCompra(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Netflix" />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input type="number" step={0.01} value={formCompra.valor} onChange={e => setFormCompra(f => ({ ...f, valor: e.target.value }))}
                      placeholder={formCompra.modo === 'parcelada' ? 'Valor da parcela' : 'Valor'} />

                    {formCompra.modo === 'parcelada' ? (
                      <input type="number" min={2} max={24} value={formCompra.totalParcelas}
                        onChange={e => setFormCompra(f => ({ ...f, totalParcelas: e.target.value }))} placeholder="Parcelas" />
                    ) : formCompra.modo === 'avulsa' ? (
                      <input type="date" value={formCompra.dataCompra} onChange={e => setFormCompra(f => ({ ...f, dataCompra: e.target.value }))} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-3)' }}>Repete todo mês</div>
                    )}
                  </div>

                  {formCompra.modo === 'parcelada' && (
                    <div className="form-group">
                      <label className="form-label">Data da 1ª parcela</label>
                      <input type="date" value={formCompra.dataCompra} onChange={e => setFormCompra(f => ({ ...f, dataCompra: e.target.value }))} />
                    </div>
                  )}

                  <select value={formCompra.categoriaId} onChange={e => setFormCompra(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categorias.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos').map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>

                  {formCompra.modo === 'fixa' && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Esse valor entra automaticamente em todas as faturas futuras, até você desativar.
                    </p>
                  )}

                  <button className="btn-primary" onClick={lancarCompra}>Adicionar</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setFaturaAberta(null)}>Fechar</button>
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

              {formPagFatura.modo === 'total' && (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Vai debitar {fmt(faturaDados.total)} da conta vinculada ao cartão agora.
                </p>
              )}

              {formPagFatura.modo === 'parcial' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Quanto vai pagar agora (R$)</label>
                    <input type="number" min={0.01} max={faturaDados.total - 0.01} step={0.01}
                      value={formPagFatura.valorPago}
                      onChange={e => setFormPagFatura(f => ({ ...f, valorPago: e.target.value }))} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    O restante (com os juros do cartão) entra automaticamente na próxima fatura.
                  </p>
                </>
              )}

              {formPagFatura.modo === 'parcelado' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Em quantas parcelas</label>
                    <input type="number" min={2} max={24} value={formPagFatura.totalParcelas}
                      onChange={e => setFormPagFatura(f => ({ ...f, totalParcelas: e.target.value }))} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    Gera parcelas mensais em Contas a Pagar, já com os juros do cartão aplicados. Nenhum valor é debitado agora.
                  </p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPagarFatura(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                if (formPagFatura.modo === 'total') pagarFaturaModal('total');
                else if (formPagFatura.modo === 'parcial') pagarFaturaModal('parcial', { valorPago: parseFloat(formPagFatura.valorPago) || 0 });
                else pagarFaturaModal('parcelado', { totalParcelas: parseInt(formPagFatura.totalParcelas) || 3 });
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$)</label>
                    <input type="number" min={0} step={0.01} value={formEditItemCartao.valor} onChange={e => setFormEditItemCartao(f => ({ ...f, valor: e.target.value }))} />
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
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditandoLancamento(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
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
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input value={formEdit.descricao} onChange={e => setFormEdit(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <input type="number" min={0} step={0.01} value={formEdit.valor} onChange={e => setFormEdit(f => ({ ...f, valor: e.target.value }))} />
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
              <button className="btn-secondary" onClick={() => setEditandoLancamento(null)}>Cancelar</button>
              {(editandoLancamento.modo === 'fixa' || editandoLancamento.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('unica')}>Só esta</button>
                  <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('todas')}>
                    {editandoLancamento.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-primary" disabled={salvandoEdit} onClick={() => salvarEdicaoLancamento('unica')}>Salvar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
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
                    ? 'Esse é um lançamento fixo (recorrente). Você pode excluir só este mês, ou parar de gerar os próximos.'
                    : 'Essa é uma parcela. Você pode excluir só esta, ou todas as parcelas futuras ainda não pagas.'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              {(confirmExcluir.modo === 'fixa' || confirmExcluir.modo === 'parcelada') ? (
                <>
                  <button className="btn-secondary" onClick={() => excluirLancamento('unica')}>Só esta</button>
                  <button className="btn-danger" onClick={() => excluirLancamento('todas')}>
                    {confirmExcluir.modo === 'fixa' ? 'Esta e futuras' : 'Todas as parcelas'}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => excluirLancamento('unica')}>Excluir</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}