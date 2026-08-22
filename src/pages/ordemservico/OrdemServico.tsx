import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Wrench, ClipboardList, Check, Ban, PackageCheck, Edit2, Mail, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { InputMoeda } from '../../components/InputMoeda';
import './OrdemServico.css';

// ── Tipos ─────────────────────────────────────────────────────────
interface Cliente { id: string; nome: string; telefone: string; }
interface Produto { id: string; nome: string; precoVenda: number; estoque: number; }
interface Profissional { id: string; nome: string; comissaoPadraoPercentual?: number | null; }
interface ContaBancaria { id: string; nome: string; }

interface ChecklistItemDef { id: string; nome: string; ordem: number; ativo: boolean; }
interface ChecklistCategoriaDef { id: string; nome: string; ordem: number; ativa: boolean; itens: ChecklistItemDef[]; }

interface ItemOrcamento {
  tipo: 'peca' | 'servico';
  produtoId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}
interface MecanicoForm { profissionalId: string; comissaoPercentual: number; }
interface ChecklistRespostaForm { checklistItemId: string; estado: string; observacao: string }

interface OrcamentoResumo {
  id: string;
  clienteId: string;
  veiculoDescricao: string | null;
  placa: string | null;
  status: string;
  valorTotal: number;
  criadoEm: string;
  aprovadoEm: string | null;
  concluidoEm: string | null;
  qtdMecanicos: number;
}

interface OrcamentoDetalhe extends OrcamentoResumo {
  observacoes: string | null;
  itens: { id: string; tipo: string; produtoId: string | null; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
  mecanicos: { id: string; profissionalId: string; nomeProfissional: string; comissaoPercentual: number }[];
  checklist: { id: string; checklistItemId: string; nomeItem: string; estado: string; observacao: string | null }[];
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
const STATUS_BADGE: Record<string, string> = {
  pendente: 'badge-accent',
  em_andamento: 'badge-yellow',
  concluido: 'badge-green',
  cancelado: 'badge-red',
};
const ESTADOS_CHECKLIST = ['bom', 'regular', 'ruim', 'precisa_trocar'];
const ESTADO_LABEL: Record<string, string> = {
  bom: 'Bom', regular: 'Regular', ruim: 'Ruim', precisa_trocar: 'Precisa trocar',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ITEM_VAZIO: ItemOrcamento = { tipo: 'servico', produtoId: null, descricao: '', quantidade: 1, valorUnitario: 0 };

export function OrdemServico() {
  const { sucesso, erro } = useToast();
  const [aba, setAba] = useState<'ordens' | 'checklist'>('ordens');

  // ── Dados auxiliares ─────────────────────────────────────────
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categoriasChecklist, setCategoriasChecklist] = useState<ChecklistCategoriaDef[]>([]);

  // ── Lista de orçamentos ──────────────────────────────────────
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [buscaPlaca, setBuscaPlaca] = useState('');

  // ── Modal novo orçamento ─────────────────────────────────────
  const [modalNovo, setModalNovo] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [veiculo, setVeiculo] = useState('');
  const [placa, setPlaca] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemOrcamento[]>([{ ...ITEM_VAZIO }]);
  const [mecanicos, setMecanicos] = useState<MecanicoForm[]>([]);
  const [checklistForm, setChecklistForm] = useState<Record<string, ChecklistRespostaForm>>({});
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // ── Modal detalhe ────────────────────────────────────────────
  const [detalhe, setDetalhe] = useState<OrcamentoDetalhe | null>(null);
  const [modalConcluir, setModalConcluir] = useState(false);
  const [contaConclusaoId, setContaConclusaoId] = useState('');
  const [vencimentoConclusao, setVencimentoConclusao] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState<OrcamentoResumo | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // ── Modal checklist (config) ─────────────────────────────────
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [novoItemPorCategoria, setNovoItemPorCategoria] = useState<Record<string, string>>({});
  const [editandoCategoriaId, setEditandoCategoriaId] = useState<string | null>(null);
  const [editCategoriaNome, setEditCategoriaNome] = useState('');
  const [confirmExcluirCategoria, setConfirmExcluirCategoria] = useState<ChecklistCategoriaDef | null>(null);
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editItemNome, setEditItemNome] = useState('');
  const [confirmExcluirItem, setConfirmExcluirItem] = useState<{ categoriaId: string; item: ChecklistItemDef } | null>(null);

  useEffect(() => {
    carregarOrcamentos();
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    api.get<Produto[]>('/api/produtos').then(setProdutos).catch(() => {});
    api.get<Profissional[]>('/api/funcionarios/ativos').then(setProfissionais).catch(() => {});
    api.get<ContaBancaria[]>('/api/financeiro/contas').then(setContas).catch(() => {});
    carregarChecklist();
  }, []);

  useEffect(() => { carregarOrcamentos(); }, [statusFiltro, buscaPlaca]);

  function carregarOrcamentos() {
    const params = new URLSearchParams();
    if (statusFiltro !== 'todos') params.set('status', statusFiltro);
    if (buscaPlaca.trim()) params.set('placa', buscaPlaca.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';
    api.get<OrcamentoResumo[]>(`/api/ordemservico/orcamentos${qs}`).then(setOrcamentos).catch(() => {});
  }

  function carregarChecklist() {
    api.get<ChecklistCategoriaDef[]>('/api/ordemservico/checklist-categorias').then(setCategoriasChecklist).catch(() => {});
  }

  // ── Novo orçamento ────────────────────────────────────────────
  function abrirNovo() {
    setEditandoId(null);
    setClienteSelecionado(null);
    setBuscaCliente('');
    setVeiculo('');
    setPlaca('');
    setObservacoes('');
    setItens([{ ...ITEM_VAZIO }]);
    setMecanicos([]);
    setChecklistForm({});
    setCategoriasSelecionadas([]);
    setModalNovo(true);
  }

  async function abrirEditarOrcamento(o: OrcamentoResumo) {
    try {
      const d = await api.get<OrcamentoDetalhe>(`/api/ordemservico/orcamentos/${o.id}`);

      setEditandoId(d.id);
      setClienteSelecionado(clientes.find(c => c.id === d.clienteId) ?? null);
      setBuscaCliente('');
      setVeiculo(d.veiculoDescricao ?? '');
      setPlaca(d.placa ?? '');
      setObservacoes(d.observacoes ?? '');
      setItens(d.itens.map(i => ({
        tipo: i.tipo as 'peca' | 'servico',
        produtoId: i.produtoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
      })));
      setMecanicos(d.mecanicos.map(m => ({
        profissionalId: m.profissionalId,
        comissaoPercentual: m.comissaoPercentual,
      })));

      const novoChecklistForm: Record<string, ChecklistRespostaForm> = {};
      d.checklist.forEach(c => {
        novoChecklistForm[c.checklistItemId] = {
          checklistItemId: c.checklistItemId,
          estado: c.estado,
          observacao: c.observacao ?? '',
        };
      });
      setChecklistForm(novoChecklistForm);

      const itemIdsComResposta = new Set(d.checklist.map(c => c.checklistItemId));
      const categoriasComResposta = categoriasChecklist
        .filter(cat => cat.itens.some(i => itemIdsComResposta.has(i.id)))
        .map(cat => cat.id);
      setCategoriasSelecionadas(categoriasComResposta);

      setDetalhe(null);
      setModalNovo(true);
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const clienteOptions = clientes.map(c => ({ value: `${c.nome} — ${c.telefone}` }));

  function handleBuscaClienteChange(value: string) {
    const encontrado = clientes.find(c => `${c.nome} — ${c.telefone}` === value);
    if (encontrado) {
      setClienteSelecionado(encontrado);
      setBuscaCliente('');
    } else {
      setBuscaCliente(value);
    }
  }

  function addItem() {
    setItens(list => [...list, { ...ITEM_VAZIO }]);
  }
  function removeItem(i: number) {
    setItens(list => list.filter((_, idx) => idx !== i));
  }
  function atualizarItem(i: number, patch: Partial<ItemOrcamento>) {
    setItens(list => list.map((item, idx) => idx === i ? { ...item, ...patch } : item));
  }
  function selecionarProdutoNoItem(i: number, produtoId: string) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) { atualizarItem(i, { produtoId: null }); return; }
    atualizarItem(i, { produtoId: produto.id, descricao: produto.nome, valorUnitario: produto.precoVenda });
  }

  function addMecanico() {
    if (profissionais.length === 0) { erro('Cadastre um profissional em Funcionários primeiro.'); return; }
    const primeiro = profissionais.find(p => !mecanicos.some(m => m.profissionalId === p.id));
    if (!primeiro) return;
    setMecanicos(list => [...list, { profissionalId: primeiro.id, comissaoPercentual: primeiro.comissaoPadraoPercentual ?? 0 }]);
  }
  function removeMecanico(i: number) {
    setMecanicos(list => list.filter((_, idx) => idx !== i));
  }
  function atualizarMecanico(i: number, patch: Partial<MecanicoForm>) {
    setMecanicos(list => list.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  }
  function selecionarProfissionalNoMecanico(i: number, profissionalId: string) {
    const p = profissionais.find(x => x.id === profissionalId);
    atualizarMecanico(i, { profissionalId, comissaoPercentual: p?.comissaoPadraoPercentual ?? 0 });
  }

  function atualizarChecklistResposta(itemId: string, patch: Partial<ChecklistRespostaForm>) {
    setChecklistForm(f => {
      const atual = f[itemId] ?? { checklistItemId: itemId, estado: 'bom', observacao: '' };
      return { ...f, [itemId]: { ...atual, ...patch } };
    });
  }

  function toggleCategoriaSelecionada(categoriaId: string) {
    setCategoriasSelecionadas(list =>
      list.includes(categoriaId) ? list.filter(id => id !== categoriaId) : [...list, categoriaId]
    );
  }

  const totalOrcamento = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);

  async function salvarOrcamento() {
    if (!clienteSelecionado) { erro('Selecione o cliente.'); return; }
    if (itens.some(i => !i.descricao.trim() || i.valorUnitario <= 0)) {
      erro('Preencha descrição e valor de todos os itens.');
      return;
    }
    setSalvando(true);
    const payload = {
      clienteId: clienteSelecionado.id,
      veiculoDescricao: veiculo.trim() || null,
      placa: placa.trim() || null,
      observacoes: observacoes.trim() || null,
      itens: itens.map(i => ({
        tipo: i.tipo,
        produtoId: i.produtoId,
        descricao: i.descricao.trim(),
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
      })),
      mecanicos: mecanicos.map(m => ({
        profissionalId: m.profissionalId,
        comissaoPercentual: m.comissaoPercentual,
      })),
      checklistRespostas: Object.values(checklistForm).map(r => ({
        checklistItemId: r.checklistItemId,
        estado: r.estado,
        observacao: r.observacao.trim() || null,
      })),
    };
    try {
      if (editandoId) {
        await api.put(`/api/ordemservico/orcamentos/${editandoId}`, payload);
        sucesso('Orçamento atualizado.');
      } else {
        await api.post('/api/ordemservico/orcamentos', payload);
        sucesso('Orçamento criado.');
      }
      setModalNovo(false);
      setEditandoId(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // ── Detalhe / ações ──────────────────────────────────────────
  async function abrirDetalhe(o: OrcamentoResumo) {
    try {
      const d = await api.get<OrcamentoDetalhe>(`/api/ordemservico/orcamentos/${o.id}`);
      setDetalhe(d);
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function aprovar() {
    if (!detalhe) return;
    try {
      await api.patch(`/api/ordemservico/orcamentos/${detalhe.id}/aprovar`, {});
      sucesso('Orçamento aprovado — ordem em andamento.');
      setDetalhe(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function cancelar() {
    if (!detalhe) return;
    try {
      await api.patch(`/api/ordemservico/orcamentos/${detalhe.id}/cancelar`, {});
      sucesso('Ordem cancelada.');
      setDetalhe(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function reabrir() {
    if (!detalhe) return;
    try {
      await api.patch(`/api/ordemservico/orcamentos/${detalhe.id}/reabrir`, {});
      sucesso('Ordem reaberta — voltou para em andamento.');
      setDetalhe(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function enviarPorEmail() {
    if (!detalhe) return;
    setEnviandoEmail(true);
    try {
      await api.post(`/api/ordemservico/orcamentos/${detalhe.id}/enviar-email`, {});
      sucesso('Orçamento enviado por e-mail.');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setEnviandoEmail(false);
    }
  }

  function enviarPorWhatsapp() {
    if (!detalhe) return;
    const cliente = clientes.find(c => c.id === detalhe.clienteId);
    const digitos = (cliente?.telefone ?? '').replace(/\D/g, '');

    if (!digitos) {
      erro('Este cliente não tem telefone cadastrado. Cadastre o telefone em Clientes antes de enviar por WhatsApp.');
      return;
    }

    const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
    const veiculo = [detalhe.veiculoDescricao, detalhe.placa].filter(Boolean).join(' · ');
    const itensTexto = detalhe.itens.map(i => `- ${i.descricao} (${i.quantidade}x): ${fmt(i.valorTotal)}`).join('\n');
    const texto = `Orçamento${veiculo ? ` — ${veiculo}` : ''}\n\n${itensTexto}\n\nTotal: ${fmt(detalhe.valorTotal)}`;
    window.open(`https://wa.me/${comDdi}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  function abrirConcluir() {
    setContaConclusaoId(contas[0]?.id ?? '');
    setVencimentoConclusao('');
    setModalConcluir(true);
  }

  async function concluir() {
    if (!detalhe) return;
    if (!contaConclusaoId) { erro('Selecione a conta bancária de recebimento.'); return; }
    try {
      await api.patch(`/api/ordemservico/orcamentos/${detalhe.id}/concluir`, {
        contaBancariaId: contaConclusaoId,
        vencimento: vencimentoConclusao || null,
      });
      sucesso('Ordem concluída — lançamento gerado no Financeiro.');
      setModalConcluir(false);
      setDetalhe(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluir() {
    if (!confirmExcluir) return;
    try {
      await api.delete(`/api/ordemservico/orcamentos/${confirmExcluir.id}`);
      sucesso('Orçamento excluído.');
      setConfirmExcluir(null);
      carregarOrcamentos();
    } catch (e) {
      erro((e as Error).message);
      setConfirmExcluir(null);
    }
  }

  // ── Config checklist ─────────────────────────────────────────
  async function criarCategoria() {
    if (!novaCategoriaNome.trim()) return;
    try {
      await api.post('/api/ordemservico/checklist-categorias', {
        nome: novaCategoriaNome.trim(),
        ordem: categoriasChecklist.length,
        ativa: true,
      });
      setNovaCategoriaNome('');
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function criarItem(categoriaId: string) {
    const nome = novoItemPorCategoria[categoriaId]?.trim();
    if (!nome) return;
    const categoria = categoriasChecklist.find(c => c.id === categoriaId);
    try {
      await api.post('/api/ordemservico/checklist-itens', {
        categoriaId,
        nome,
        ordem: categoria?.itens.length ?? 0,
        ativo: true,
      });
      setNovoItemPorCategoria(f => ({ ...f, [categoriaId]: '' }));
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function iniciarEdicaoCategoria(cat: ChecklistCategoriaDef) {
    setEditandoCategoriaId(cat.id);
    setEditCategoriaNome(cat.nome);
  }
  async function salvarEdicaoCategoria(cat: ChecklistCategoriaDef) {
    if (!editCategoriaNome.trim()) return;
    try {
      await api.put(`/api/ordemservico/checklist-categorias/${cat.id}`, {
        nome: editCategoriaNome.trim(),
        ordem: cat.ordem,
        ativa: cat.ativa,
      });
      setEditandoCategoriaId(null);
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function excluirCategoria() {
    if (!confirmExcluirCategoria) return;
    try {
      await api.delete(`/api/ordemservico/checklist-categorias/${confirmExcluirCategoria.id}`);
      sucesso('Categoria excluída.');
      setConfirmExcluirCategoria(null);
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
      setConfirmExcluirCategoria(null);
    }
  }

  function iniciarEdicaoItem(item: ChecklistItemDef) {
    setEditandoItemId(item.id);
    setEditItemNome(item.nome);
  }
  async function salvarEdicaoItem(categoriaId: string, item: ChecklistItemDef) {
    if (!editItemNome.trim()) return;
    try {
      await api.put(`/api/ordemservico/checklist-itens/${item.id}`, {
        categoriaId,
        nome: editItemNome.trim(),
        ordem: item.ordem,
        ativo: item.ativo,
      });
      setEditandoItemId(null);
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function excluirItem() {
    if (!confirmExcluirItem) return;
    try {
      const res = await api.delete<{ mensagem: string }>(`/api/ordemservico/checklist-itens/${confirmExcluirItem.item.id}`);
      sucesso(res?.mensagem ?? 'Item removido.');
      setConfirmExcluirItem(null);
      carregarChecklist();
    } catch (e) {
      erro((e as Error).message);
      setConfirmExcluirItem(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ordem de Serviço</h1>
          <p className="page-subtitle">Orçamentos, checklist de inspeção e comissão de mecânicos</p>
        </div>
        {aba === 'ordens' && (
          <button className="btn-primary" onClick={abrirNovo}><Plus size={15} /> Novo orçamento</button>
        )}
      </div>

      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'ordens' ? ' ativo' : ''}`} onClick={() => setAba('ordens')}>
          <Wrench size={15} /> Ordens
        </button>
        <button className={`planos-tab${aba === 'checklist' ? ' ativo' : ''}`} onClick={() => setAba('checklist')}>
          <ClipboardList size={15} /> Checklist
        </button>
      </div>

      {/* ── ABA ORDENS ── */}
      {aba === 'ordens' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div className="cat-tabs" style={{ margin: 0 }}>
              <button className={`cat-tab${statusFiltro === 'todos' ? ' active' : ''}`} onClick={() => setStatusFiltro('todos')}>Todos</button>
              {Object.keys(STATUS_LABEL).map(s => (
                <button key={s} className={`cat-tab${statusFiltro === s ? ' active' : ''}`} onClick={() => setStatusFiltro(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <input placeholder="Buscar por placa..." value={buscaPlaca}
              onChange={e => setBuscaPlaca(e.target.value.toUpperCase())}
              style={{ maxWidth: 180, marginLeft: 'auto' }} />
          </div>

          {orcamentos.length === 0 ? (
            <div className="card"><div className="empty"><Wrench size={32} /><p>Nenhum orçamento encontrado.</p></div></div>
          ) : (
            <div className="os-grid">
              {orcamentos.map(o => {
                const cliente = clientes.find(c => c.id === o.clienteId);
                return (
                  <div key={o.id} className="card os-card" onClick={() => abrirDetalhe(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{cliente?.nome ?? 'Cliente'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {o.veiculoDescricao ?? 'Veículo não informado'}
                          {o.placa && <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--text-2)' }}>· {o.placa}</span>}
                        </div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{o.qtdMecanicos} mecânico(s)</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(o.valorTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ABA CHECKLIST ── */}
      {aba === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Nova categoria (ex: Suspensão, Freios...)" value={novaCategoriaNome}
              onChange={e => setNovaCategoriaNome(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={criarCategoria}><Plus size={14} /> Adicionar</button>
          </div>

          {categoriasChecklist.map(cat => (
            <div key={cat.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {editandoCategoriaId === cat.id ? (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input value={editCategoriaNome} autoFocus
                      onChange={e => setEditCategoriaNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') salvarEdicaoCategoria(cat); }}
                      style={{ flex: 1 }} />
                    <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => salvarEdicaoCategoria(cat)}>Salvar</button>
                    <button className="btn-ghost" onClick={() => setEditandoCategoriaId(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>{cat.nome}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" title="Editar categoria" onClick={() => iniciarEdicaoCategoria(cat)}><Edit2 size={14} /></button>
                      <button className="btn-ghost" title="Excluir categoria" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluirCategoria(cat)}><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {cat.itens.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6, fontSize: 13 }}>
                    {editandoItemId === item.id ? (
                      <>
                        <input value={editItemNome} autoFocus
                          onChange={e => setEditItemNome(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') salvarEdicaoItem(cat.id, item); }}
                          style={{ flex: 1, fontSize: 13 }} />
                        <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => salvarEdicaoItem(cat.id, item)}>Salvar</button>
                        <button className="btn-ghost" onClick={() => setEditandoItemId(null)}><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{item.nome}{!item.ativo && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>(inativo)</span>}</span>
                        <button className="btn-ghost" title="Editar item" onClick={() => iniciarEdicaoItem(item)}><Edit2 size={13} /></button>
                        <button className="btn-ghost" title="Excluir item" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluirItem({ categoriaId: cat.id, item })}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                ))}
                {cat.itens.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum item nessa categoria ainda.</p>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Novo item (ex: Bandeja, Pivô...)"
                  value={novoItemPorCategoria[cat.id] ?? ''}
                  onChange={e => setNovoItemPorCategoria(f => ({ ...f, [cat.id]: e.target.value }))}
                  style={{ flex: 1 }} />
                <button className="btn-secondary" onClick={() => criarItem(cat.id)}>Adicionar item</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL NOVO ORÇAMENTO ── */}
      {modalNovo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovo(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editandoId ? 'Editar orçamento' : 'Novo orçamento'}</h2>
              <button className="btn-ghost" onClick={() => setModalNovo(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Cliente */}
                <div className="form-group">
                  <label className="form-label">Cliente *</label>
                  {clienteSelecionado ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <span>{clienteSelecionado.nome} — {clienteSelecionado.telefone}</span>
                      <button className="btn-ghost" onClick={() => setClienteSelecionado(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <AutocompleteInput
                      value={buscaCliente}
                      options={clienteOptions}
                      onChange={handleBuscaClienteChange}
                      placeholder="Buscar cliente..."
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Veículo</label>
                    <input value={veiculo} onChange={e => setVeiculo(e.target.value)} placeholder="Ex: Gol 2015" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Placa</label>
                    <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={10} />
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Itens do orçamento</label>
                    <button className="btn-ghost" onClick={addItem}><Plus size={13} /> Item</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {itens.map((item, i) => (
                      <div key={i} className="os-item-card">
                        <div className="os-item-linha-topo">
                          <select value={item.tipo} onChange={e => atualizarItem(i, { tipo: e.target.value as 'peca' | 'servico', produtoId: null })}>
                            <option value="servico">Serviço</option>
                            <option value="peca">Peça</option>
                          </select>

                          {item.tipo === 'peca' && (
                            <select value={item.produtoId ?? ''} onChange={e => selecionarProdutoNoItem(i, e.target.value)}>
                              <option value="">Peça avulsa (fora do estoque)</option>
                              {produtos.map(p => (
                                <option key={p.id} value={p.id}>{p.nome} (estoque: {p.estoque})</option>
                              ))}
                            </select>
                          )}

                          <button className="btn-ghost" onClick={() => removeItem(i)} style={{ color: 'var(--red)', marginLeft: 'auto' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <input placeholder="Descrição do item (ex: Pneu 185/60/15 - NeuPar)" value={item.descricao}
                          onChange={e => atualizarItem(i, { descricao: e.target.value })}
                          className="os-item-descricao" />

                        <div className="os-item-linha-valores">
                          <div>
                            <label>Qtd</label>
                            <input type="number" min={1} value={item.quantidade}
                              onChange={e => atualizarItem(i, { quantidade: +e.target.value || 1 })}
                              placeholder="Qtd" title="Quantidade" />
                          </div>
                          <div>
                            <label>Valor unitário</label>
                            <InputMoeda value={item.valorUnitario} onChange={v => atualizarItem(i, { valorUnitario: v })} placeholder="Valor" />
                          </div>
                          <div>
                            <label>Total</label>
                            <span className="os-item-total">{fmt(item.quantidade * item.valorUnitario)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600 }}>
                    Total: <span style={{ color: 'var(--accent)' }}>{fmt(totalOrcamento)}</span>
                  </div>
                </div>

                {/* Mecânicos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Mecânicos</label>
                    <button className="btn-ghost" onClick={addMecanico}><Plus size={13} /> Mecânico</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mecanicos.map((m, i) => (
                      <div key={i} className="os-mecanico-row">
                        <select value={m.profissionalId} onChange={e => selecionarProfissionalNoMecanico(i, e.target.value)}>
                          {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        <input type="number" min={0} max={100} step={0.5} value={m.comissaoPercentual}
                          onChange={e => atualizarMecanico(i, { comissaoPercentual: +e.target.value || 0 })} />
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>%</span>
                        <button className="btn-ghost" onClick={() => removeMecanico(i)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {mecanicos.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum mecânico vinculado ainda.</p>}
                  </div>
                </div>

                {/* Checklist */}
                {categoriasChecklist.length > 0 && (
                  <div>
                    <label className="form-label">Checklist de inspeção</label>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -6, marginBottom: 10 }}>
                      Marque só as categorias relacionadas ao serviço feito nessa ordem.
                    </p>
                    <div className="cat-tabs" style={{ marginBottom: 12 }}>
                      {categoriasChecklist.filter(c => c.ativa).map(cat => (
                        <button key={cat.id} type="button"
                          className={`cat-tab${categoriasSelecionadas.includes(cat.id) ? ' active' : ''}`}
                          onClick={() => toggleCategoriaSelecionada(cat.id)}>
                          {cat.nome}
                        </button>
                      ))}
                    </div>

                    {categoriasSelecionadas.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhuma categoria selecionada — nada aparece no checklist desta ordem.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {categoriasChecklist.filter(c => c.ativa && categoriasSelecionadas.includes(c.id)).map(cat => (
                          <div key={cat.id}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{cat.nome}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {cat.itens.filter(i => i.ativo).map(item => {
                                const resp = checklistForm[item.id];
                                return (
                                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, flex: 1 }}>{item.nome}</span>
                                    <select value={resp?.estado ?? 'bom'} onChange={e => atualizarChecklistResposta(item.id, { estado: e.target.value })} style={{ width: 130 }}>
                                      {ESTADOS_CHECKLIST.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNovo(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarOrcamento} disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALHE ── */}
      {detalhe && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalhe(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {clientes.find(c => c.id === detalhe.clienteId)?.nome ?? 'Orçamento'}
              </h2>
              <button className="btn-ghost" onClick={() => setDetalhe(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={`badge ${STATUS_BADGE[detalhe.status]}`}>{STATUS_LABEL[detalhe.status]}</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(detalhe.valorTotal)}</span>
              </div>
              {(detalhe.veiculoDescricao || detalhe.placa) && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
                  {detalhe.veiculoDescricao}{detalhe.veiculoDescricao && detalhe.placa ? ' · ' : ''}{detalhe.placa}
                </p>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Itens</div>
                {detalhe.itens.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{i.descricao} ({i.quantidade}x)</span>
                    <span>{fmt(i.valorTotal)}</span>
                  </div>
                ))}
              </div>

              {detalhe.mecanicos.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Mecânicos</div>
                  {detalhe.mecanicos.map(m => (
                    <div key={m.id} style={{ fontSize: 13, padding: '3px 0' }}>{m.nomeProfissional} — {m.comissaoPercentual}%</div>
                  ))}
                </div>
              )}

              {detalhe.checklist.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Checklist</div>
                  {detalhe.checklist.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span>{c.nomeItem}</span>
                      <span style={{ color: 'var(--text-3)' }}>{ESTADO_LABEL[c.estado] ?? c.estado}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn-secondary" onClick={enviarPorEmail} disabled={enviandoEmail} title="Enviar orçamento por e-mail">
                <Mail size={14} /> {enviandoEmail ? 'Enviando...' : 'E-mail'}
              </button>
              <button className="btn-secondary" onClick={enviarPorWhatsapp} title="Enviar orçamento por WhatsApp">
                <MessageCircle size={14} /> WhatsApp
              </button>
              {detalhe.status === 'pendente' && (
                <>
                  <button className="btn-danger" onClick={() => setConfirmExcluir(detalhe)}><Trash2 size={14} /> Excluir</button>
                  <button className="btn-secondary" onClick={() => abrirEditarOrcamento(detalhe)}><Edit2 size={14} /> Editar</button>
                  <button className="btn-secondary" onClick={cancelar}><Ban size={14} /> Cancelar</button>
                  <button className="btn-primary" onClick={aprovar}><Check size={14} /> Aprovar</button>
                </>
              )}
              {detalhe.status === 'em_andamento' && (
                <>
                  <button className="btn-secondary" onClick={() => abrirEditarOrcamento(detalhe)}><Edit2 size={14} /> Editar</button>
                  <button className="btn-secondary" onClick={cancelar}><Ban size={14} /> Cancelar</button>
                  <button className="btn-primary" onClick={abrirConcluir}><PackageCheck size={14} /> Concluir</button>
                </>
              )}
              {detalhe.status === 'cancelado' && (
                <button className="btn-primary" onClick={reabrir}><Check size={14} /> Reabrir</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONCLUIR ── */}
      {modalConcluir && detalhe && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalConcluir(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Concluir ordem de serviço</h2>
              <button className="btn-ghost" onClick={() => setModalConcluir(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                Isso vai gerar um lançamento a receber de <strong>{fmt(detalhe.valorTotal)}</strong> no Financeiro,
                dar baixa nas peças do estoque e gerar a comissão de cada mecânico vinculado.
              </p>
              <div className="form-group">
                <label className="form-label">Conta bancária (recebimento) *</label>
                <select value={contaConclusaoId} onChange={e => setContaConclusaoId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vencimento <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional — padrão hoje)</span></label>
                <input type="date" value={vencimentoConclusao} onChange={e => setVencimentoConclusao(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalConcluir(false)}>Cancelar</button>
              <button className="btn-primary" onClick={concluir}>Concluir ordem</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão categoria checklist ── */}
      {confirmExcluirCategoria && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirCategoria(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir categoria</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirCategoria(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirCategoria.nome}</strong> e todos os seus itens?
                Se algum item já foi usado num orçamento, a exclusão será bloqueada.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirCategoria(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirCategoria}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão item checklist ── */}
      {confirmExcluirItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirItem(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir item</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirItem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirItem.item.nome}</strong>?
                Se já foi usado num orçamento, ele será apenas desativado em vez de excluído.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirItem(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirItem}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão ── */}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir orçamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>Tem certeza que deseja excluir este orçamento?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}