import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Check, X, FileText, Package, PackagePlus, Search, Trash2, ClipboardList, Pencil } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import { InputMoeda } from '../../components/InputMoeda';
import { Paginacao } from '../../components/Paginacao';
import './ImportarNf.css';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ItemPreview {
  codigoFornecedor: string;
  gtin: string | null;
  descricao: string;
  nomeBase: string;
  cor: string | null;
  tamanho: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  statusMatch: 'gtin' | 'mapeamento' | 'nome_exato' | 'sugestao' | 'novo';
  produtoSugeridoId: string | null;
  produtoSugeridoNome: string | null;
  variacaoJaExiste: boolean;
  estoqueVariacaoAtual: number | null;
  categoriaSugerida: string;
  categoriaJaExiste: boolean;
}

interface Preview {
  cnpjFornecedor: string;
  nomeFornecedor: string;
  numeroNf: string;
  chaveAcesso: string;
  itens: ItemPreview[];
}

interface DecisaoItem {
  acao: 'existente' | 'novo';
  produtoId: string | null;
  precoCusto: number | null;
  precoVenda: number | null;
  categoriaNome: string;
}

const STATUS_LABEL: Record<ItemPreview['statusMatch'], { txt: string; cor: string; icone: any }> = {
  gtin:       { txt: 'Match por código de barras', cor: 'var(--green)', icone: Check },
  mapeamento: { txt: 'Reconhecido de nota anterior', cor: 'var(--green)', icone: Check },
  nome_exato: { txt: 'Produto já cadastrado', cor: 'var(--green)', icone: Check },
  sugestao:   { txt: 'Sugestão (revisar)', cor: 'var(--yellow, #d97706)', icone: Package },
  novo:       { txt: 'Produto novo', cor: 'var(--accent)', icone: PackagePlus },
};

interface NfHistorico {
  id: string;
  numeroNf: string;
  nomeFornecedor: string;
  fornecedorId: string | null;
  origem: 'xml' | 'manual';
  dataEmissao: string | null;
  valorTotal: number | null;
  valorCustoTotal: number | null;
  valorVendaTotal: number | null;
  quantidadeTotal: number | null;
  qtdItens: number;
  importadoEm: string;
  desfeita: boolean;
}

interface ItemNfManual {
  chave: string;
  isNovo: boolean;
  produtoId?: string; // obrigatório quando !isNovo
  nomeProduto: string;
  variacaoId?: string;
  variacaoLabel?: string;
  quantidade: number;
  precoCusto?: number;
  // só usados quando isNovo === true
  categoriaNome?: string;
  cor?: string;
  tamanho?: string;
  precoVenda?: number;
  tipoVenda?: 'unidade' | 'fracionado';
  unidadeMedida?: string;
}

interface NovoProdutoForm {
  nome: string;
  categoriaNome: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  precoCusto: number;
  precoVenda: number;
  tipoVenda: 'unidade' | 'fracionado';
  unidadeMedida: string;
}

const NOVO_PRODUTO_VAZIO: NovoProdutoForm = {
  nome: '', categoriaNome: '', cor: '', tamanho: '', quantidade: 1, precoCusto: 0, precoVenda: 0,
  tipoVenda: 'unidade', unidadeMedida: 'un',
};

interface CategoriaResumo {
  id: string;
  nome: string;
  tipoTamanho: 'letra' | 'numero' | 'personalizado';
  usaTamanho: boolean;
  usaCor: boolean;
  tamanhosPersonalizados: string | null;
}

const TAMANHOS_LETRA = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
const TAMANHOS_NUMERO = ['32', '34', '36', '38', '40', '42', '44', '46'];

interface ItemNfEditavel {
  produtoId: string;
  variacaoId: string | null;
  nomeProduto: string;
  variacaoLabel: string | null;
  quantidade: number;
  precoCusto: number | null;
}

interface EditFormState {
  fornecedorId: string;
  numeroNf: string;
  dataEmissao: string;
  valorTotal: number;
  itens: ItemNfEditavel[];
}

export function ImportarNf() {
  const navigate = useNavigate();
  const { sucesso, erro } = useToast();
  const { recarregar, produtos, fornecedores } = useApp();
  const [modo, setModo] = useState<'xml' | 'manual'>('xml');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, DecisaoItem>>({});
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [historico, setHistorico] = useState<NfHistorico[]>([]);
  const [confirmDesfazer, setConfirmDesfazer] = useState<NfHistorico | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);

  // Lançamento manual
  const [manualFornecedorId, setManualFornecedorId] = useState('');
  const [manualNumeroNf, setManualNumeroNf] = useState('');
  const [manualData, setManualData] = useState('');
  const [manualValorTotal, setManualValorTotal] = useState(0);
  const [manualBusca, setManualBusca] = useState('');
  const [manualShowBusca, setManualShowBusca] = useState(false);
  const [manualItens, setManualItens] = useState<ItemNfManual[]>([]);
  const [modalVariacaoManual, setModalVariacaoManual] = useState<{ produtoId: string; nome: string } | null>(null);
  const [enviandoManual, setEnviandoManual] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaResumo[]>([]);
  const [mostrarNovoProduto, setMostrarNovoProduto] = useState(false);
  const [novoProduto, setNovoProduto] = useState<NovoProdutoForm>(NOVO_PRODUTO_VAZIO);

  // Histórico de NF — paginação client-side
  const [histPagina, setHistPagina] = useState(1);
  const [histPorPagina, setHistPorPagina] = useState(5);

  // Edição de NF manual já lançada
  const [editando, setEditando] = useState<NfHistorico | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    api.get<CategoriaResumo[]>('/api/categorias').then(setCategorias).catch(() => {});
  }, []);

  // Valor total da nota = soma do custo (quantidade × custo unitário) de cada item.
  // Item existente sem custo digitado usa o custo atual do produto. Recalcula sempre
  // que os itens mudam — se precisar de um valor diferente (ex: frete embutido), dá
  // pra ajustar o campo manualmente depois de montar a lista.
  useEffect(() => {
    const total = manualItens.reduce((soma, it) => {
      const custoUnit = it.precoCusto ?? (it.isNovo ? 0 : (produtos.find(p => p.id === it.produtoId)?.precoCusto ?? 0));
      return soma + custoUnit * it.quantidade;
    }, 0);
    setManualValorTotal(total);
  }, [manualItens, produtos]);

  // Categoria digitada/selecionada no mini-formulário de novo produto — os campos Cor e
  // Tamanho só aparecem se a categoria já existente usar cada um deles; quando ela usa
  // tamanho, o campo vira um select com as opções da categoria em vez de texto livre.
  const catNovoProduto = categorias.find(c => c.nome.toLowerCase() === novoProduto.categoriaNome.trim().toLowerCase());
  const catNovoProdutoUsaTamanho = catNovoProduto?.usaTamanho ?? true;
  const catNovoProdutoUsaCor = catNovoProduto?.usaCor ?? true;
  const tamanhosDoNovoProduto = catNovoProduto?.tipoTamanho === 'personalizado' && catNovoProduto.tamanhosPersonalizados
    ? catNovoProduto.tamanhosPersonalizados.split(',').map(t => t.trim()).filter(Boolean)
    : catNovoProduto?.tipoTamanho === 'numero' ? TAMANHOS_NUMERO : TAMANHOS_LETRA;

  // Margem de lucro do novo produto — só um jeito a mais de olhar pro mesmo par
  // custo/venda: editar a margem recalcula o preço de venda, e editar o preço de
  // venda direto já reflete a margem calculada aqui (sem precisar de estado à parte).
  const margemNovoProduto = novoProduto.precoCusto > 0
    ? ((novoProduto.precoVenda - novoProduto.precoCusto) / novoProduto.precoCusto) * 100
    : 0;

  const manualProdsFiltrados = produtos.filter(p =>
    p.ativo && (p.nome.toLowerCase().includes(manualBusca.toLowerCase()) || (p.codigoBarras?.includes(manualBusca) ?? false))
  );

  // Só libera o botão "Lançar nota fiscal" com fornecedor, número da nota e
  // pelo menos um item na lista — mesma checagem que o lancarManual() faz,
  // só que aqui trava o botão em vez de deixar clicar e mostrar erro depois.
  const manualFormValido = manualFornecedorId.trim() !== '' && manualNumeroNf.trim() !== '' && manualItens.length > 0;

  function adicionarItemManual(produtoId: string, nomeProduto: string, variacaoId?: string, variacaoLabel?: string) {
    setManualItens(prev => {
      const existe = prev.find(i => !i.isNovo && i.produtoId === produtoId && i.variacaoId === variacaoId);
      if (existe) {
        return prev.map(i => i === existe ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { chave: crypto.randomUUID(), isNovo: false, produtoId, nomeProduto, variacaoId, variacaoLabel, quantidade: 1 }];
    });
    setManualBusca('');
    setManualShowBusca(false);
  }

  function adicionarNovoProdutoManual() {
    if (!novoProduto.nome.trim()) { erro('Informe o nome do novo produto.'); return; }
    if (novoProduto.quantidade <= 0) { erro('Informe a quantidade do novo produto.'); return; }

    setManualItens(prev => [...prev, {
      chave: crypto.randomUUID(),
      isNovo: true,
      nomeProduto: novoProduto.nome.trim(),
      quantidade: novoProduto.tipoVenda === 'fracionado' ? novoProduto.quantidade : Math.round(novoProduto.quantidade),
      precoCusto: novoProduto.precoCusto,
      precoVenda: novoProduto.precoVenda,
      categoriaNome: novoProduto.categoriaNome.trim() || 'Outro',
      cor: catNovoProdutoUsaCor ? (novoProduto.cor.trim() || undefined) : undefined,
      tamanho: catNovoProdutoUsaTamanho ? (novoProduto.tamanho.trim() || undefined) : undefined,
      tipoVenda: novoProduto.tipoVenda,
      unidadeMedida: novoProduto.tipoVenda === 'fracionado' ? novoProduto.unidadeMedida : undefined,
    }]);
    setNovoProduto(NOVO_PRODUTO_VAZIO);
    setMostrarNovoProduto(false);
  }

  function escolherProdutoManual(produtoId: string) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    const variacoesAtivas = (produto.variacoes ?? []).filter(v => v.ativo);
    if (variacoesAtivas.length > 0) {
      setModalVariacaoManual({ produtoId, nome: produto.nome });
      setManualBusca('');
      setManualShowBusca(false);
      return;
    }
    adicionarItemManual(produtoId, produto.nome);
  }

  function alterarItemManual(idx: number, campo: 'quantidade' | 'precoCusto', valor: number) {
    setManualItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  }

  function removerItemManual(idx: number) {
    setManualItens(prev => prev.filter((_, i) => i !== idx));
  }

  function limparManual() {
    setManualFornecedorId('');
    setManualNumeroNf('');
    setManualData('');
    setManualValorTotal(0);
    setManualItens([]);
  }

  async function lancarManual() {
    if (!manualFornecedorId) { erro('Selecione o fornecedor.'); return; }
    if (!manualNumeroNf.trim()) { erro('Informe o número da nota fiscal.'); return; }
    if (manualItens.length === 0) { erro('Adicione ao menos um item.'); return; }

    setEnviandoManual(true);
    try {
      const res = await api.post<any>('/api/nf-importacao/manual', {
        fornecedorId: manualFornecedorId,
        numeroNf: manualNumeroNf.trim(),
        dataEmissao: manualData || null,
        valorTotal: manualValorTotal > 0 ? manualValorTotal : null,
        itens: manualItens.map(it => it.isNovo ? {
          acao: 'novo',
          nomeBase: it.nomeProduto,
          categoriaNome: it.categoriaNome ?? null,
          cor: it.cor ?? null,
          tamanho: it.tamanho ?? null,
          quantidade: it.quantidade,
          precoCusto: it.precoCusto ?? null,
          precoVenda: it.precoVenda ?? null,
          tipoVenda: it.tipoVenda ?? null,
          unidadeMedida: it.unidadeMedida ?? null,
        } : {
          produtoId: it.produtoId,
          variacaoId: it.variacaoId ?? null,
          quantidade: it.quantidade,
          precoCusto: it.precoCusto ?? null,
        }),
      });
      sucesso(res.mensagem ?? 'Nota fiscal lançada.');
      limparManual();
      recarregar();
      carregarHistorico();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setEnviandoManual(false);
    }
  }

  function carregarHistorico() {
    api.get<NfHistorico[]>('/api/nf-importacao/historico').then(setHistorico).catch(() => {});
  }

  async function desfazer() {
    if (!confirmDesfazer) return;
    setDesfazendo(true);
    try {
      await api.post(`/api/nf-importacao/${confirmDesfazer.id}/desfazer`, {});
      sucesso('Importação desfeita. Você já pode reimportar esta nota.');
      setConfirmDesfazer(null);
      carregarHistorico();
      recarregar();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setDesfazendo(false);
    }
  }

  async function abrirEdicao(h: NfHistorico) {
    setEditando(h);
    setEditForm(null);
    setCarregandoEdicao(true);
    try {
      const detalhe = await api.get<any>(`/api/nf-importacao/${h.id}`);
      setEditForm({
        fornecedorId: detalhe.fornecedorId ?? '',
        numeroNf: detalhe.numeroNf ?? '',
        dataEmissao: detalhe.dataEmissao ? String(detalhe.dataEmissao).slice(0, 10) : '',
        valorTotal: detalhe.valorTotal ?? 0,
        itens: (detalhe.itens ?? []).map((it: any) => ({
          produtoId: it.produtoId,
          variacaoId: it.variacaoId ?? null,
          nomeProduto: it.nomeProduto,
          variacaoLabel: it.variacaoLabel ?? null,
          quantidade: it.quantidade,
          precoCusto: it.precoCusto ?? null,
        })),
      });
    } catch (e) {
      erro((e as Error).message);
      setEditando(null);
    } finally {
      setCarregandoEdicao(false);
    }
  }

  function alterarItemEdicao(idx: number, campo: 'quantidade' | 'precoCusto', valor: number) {
    setEditForm(f => f ? { ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [campo]: valor } : it) } : f);
  }

  async function salvarEdicao() {
    if (!editando || !editForm) return;
    if (!editForm.fornecedorId) { erro('Selecione o fornecedor.'); return; }
    if (!editForm.numeroNf.trim()) { erro('Informe o número da nota fiscal.'); return; }

    setSalvandoEdicao(true);
    try {
      await api.put(`/api/nf-importacao/${editando.id}/editar`, {
        fornecedorId: editForm.fornecedorId,
        numeroNf: editForm.numeroNf.trim(),
        dataEmissao: editForm.dataEmissao || null,
        valorTotal: editForm.valorTotal > 0 ? editForm.valorTotal : null,
        itens: editForm.itens.map(it => ({
          produtoId: it.produtoId,
          variacaoId: it.variacaoId,
          quantidade: it.quantidade,
          precoCusto: it.precoCusto,
        })),
      });
      sucesso('Nota fiscal atualizada.');
      setEditando(null);
      setEditForm(null);
      carregarHistorico();
      recarregar();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function enviarArquivo() {
    if (!arquivo) return;
    setCarregando(true);
    try {
      const form = new FormData();
      form.append('arquivo', arquivo);
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/nf-importacao/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('loja:sessao') || '{}').token ?? ''}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro ?? 'Erro ao processar XML.');

      setPreview(data);

      // Prepara decisões iniciais: se tem match, usa produto existente; se não, cria novo com preço = custo
      const decIni: Record<number, DecisaoItem> = {};
      data.itens.forEach((it: ItemPreview, i: number) => {
        decIni[i] = it.produtoSugeridoId
          ? { acao: 'existente', produtoId: it.produtoSugeridoId, precoCusto: null, precoVenda: null, categoriaNome: it.categoriaSugerida }
          : { acao: 'novo',       produtoId: null, precoCusto: it.valorUnitario, precoVenda: it.valorUnitario, categoriaNome: it.categoriaSugerida };
      });
      setDecisoes(decIni);
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!preview) return;
    setConfirmando(true);
    try {
      const itens = preview.itens.map((it, i) => {
        const dec = decisoes[i];
        return {
          codigoFornecedor: it.codigoFornecedor,
          gtin: it.gtin,
          nomeBase: it.nomeBase,
          cor: it.cor,
          tamanho: it.tamanho,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          acao: dec.acao,
          produtoId: dec.acao === 'existente' ? dec.produtoId : null,
          precoCusto: dec.acao === 'novo' ? dec.precoCusto : null,
          precoVenda: dec.acao === 'novo' ? dec.precoVenda : null,
          categoriaNome: dec.acao === 'novo' ? dec.categoriaNome : null,
        };
      });

      const res = await api.post<any>('/api/nf-importacao/confirmar', {
        cnpjFornecedor: preview.cnpjFornecedor,
        numeroNf: preview.numeroNf,
        chaveAcesso: preview.chaveAcesso,
        nomeFornecedor: preview.nomeFornecedor,
        itens,
      });
      
      sucesso(`${res.mensagem} (${res.produtosNovos} novos, ${res.produtosAtualizados} atualizados${res.categoriasCriadas > 0 ? `, ${res.categoriasCriadas} categoria(s) nova(s)` : ''})`);
      setPreview(null);
      setArquivo(null);
      setDecisoes({});
      recarregar();
      carregarHistorico();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  }

  useEffect(() => { carregarHistorico(); }, []);

  function alterarDecisao(i: number, dec: Partial<DecisaoItem>) {
    setDecisoes(d => ({ ...d, [i]: { ...d[i], ...dec } }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar NF</h1>
          <p className="page-subtitle">Dar entrada em produtos a partir de uma nota fiscal</p>
        </div>
      </div>

      {!preview && (
        <div className="rel-periodo-tabs" style={{ marginBottom: 20 }}>
          <button className={`cat-tab${modo === 'xml' ? ' active' : ''}`} onClick={() => setModo('xml')}>
            Importar XML
          </button>
          <button className={`cat-tab${modo === 'manual' ? ' active' : ''}`} onClick={() => setModo('manual')}>
            Lançar manualmente
          </button>
        </div>
      )}

      {!preview && (
        <div className="nf-layout">
          <div className="nf-layout-form">
            {modo === 'manual' && (
              <>
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dados da nota</div>
                  <div className="form-grid" style={{ gridTemplateColumns: '2.2fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Fornecedor *</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select style={{ flex: 1 }} value={manualFornecedorId} onChange={e => setManualFornecedorId(e.target.value)}>
                          <option value="">Selecione</option>
                          {fornecedores.filter(f => f.ativo).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                        <button type="button" className="btn-secondary" onClick={() => navigate('/fornecedores')}>Gerenciar</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Número da nota *</label>
                      <input value={manualNumeroNf} onChange={e => setManualNumeroNf(e.target.value)} placeholder="Ex: 12345" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Data de emissão <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                      <input type="date" value={manualData} onChange={e => setManualData(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor total da nota <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(calculado)</span></label>
                      <InputMoeda value={manualValorTotal} onChange={setManualValorTotal} placeholder="0,00" />
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        Somado automaticamente pelo custo dos itens abaixo — pode ajustar se precisar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Itens</div>
                  <div style={{ position: 'relative' }}>
                    <div className="search-wrap">
                      <Search size={14} className="search-icon" />
                      <input
                        className="search-input"
                        placeholder="Buscar produto por nome ou código de barras..."
                        value={manualBusca}
                        onChange={e => { setManualBusca(e.target.value); setManualShowBusca(true); }}
                        onFocus={() => setManualShowBusca(true)}
                        onBlur={() => setTimeout(() => setManualShowBusca(false), 150)}
                      />
                    </div>
                    {manualShowBusca && manualBusca && (
                      <div className="cx-dropdown">
                        {manualProdsFiltrados.length === 0 ? (
                          <div className="cx-dropdown-empty">Nenhum produto encontrado</div>
                        ) : manualProdsFiltrados.slice(0, 8).map(p => (
                          <button key={p.id} className="cx-dropdown-item" onMouseDown={() => escolherProdutoManual(p.id)}>
                            <div className="cx-drop-nome">{p.nome}</div>
                            <div className="cx-drop-info">
                              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                                estoque: {p.tipoVenda === 'fracionado'
                                  ? `${p.estoque.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${p.unidadeMedida}`
                                  : `${p.estoque} un.`}
                              </span>
                              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>custo atual: {fmt(p.precoCusto)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {!mostrarNovoProduto ? (
                      <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setMostrarNovoProduto(true)}>
                        <PackagePlus size={13} style={{ verticalAlign: -2 }} /> Criar novo produto
                      </button>
                    ) : (
                      <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-2)' }}>Novo produto</div>
                        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Nome *</label>
                            <input value={novoProduto.nome} onChange={e => setNovoProduto(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Blusa de Renda" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Categoria</label>
                            <input list="nf-categorias" value={novoProduto.categoriaNome}
                              onChange={e => setNovoProduto(f => ({ ...f, categoriaNome: e.target.value }))} placeholder="Outro" />
                            <datalist id="nf-categorias">
                              {categorias.map(c => <option key={c.id} value={c.nome} />)}
                            </datalist>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Tipo de venda</label>
                            <select value={novoProduto.tipoVenda} onChange={e => {
                              const tv = e.target.value as 'unidade' | 'fracionado';
                              setNovoProduto(f => ({
                                ...f, tipoVenda: tv,
                                unidadeMedida: tv === 'unidade' ? 'un' : (f.unidadeMedida === 'un' ? 'kg' : f.unidadeMedida),
                                quantidade: tv === 'unidade' ? Math.round(f.quantidade) : f.quantidade,
                              }));
                            }}>
                              <option value="unidade">Por unidade</option>
                              <option value="fracionado">Fracionado (peso/volume)</option>
                            </select>
                          </div>
                          {novoProduto.tipoVenda === 'fracionado' && (
                            <div className="form-group">
                              <label className="form-label">Unidade de medida</label>
                              <select value={novoProduto.unidadeMedida} onChange={e => setNovoProduto(f => ({ ...f, unidadeMedida: e.target.value }))}>
                                <option value="kg">Quilograma (kg)</option>
                                <option value="g">Grama (g)</option>
                                <option value="L">Litro (L)</option>
                                <option value="ml">Mililitro (ml)</option>
                                <option value="m">Metro (m)</option>
                              </select>
                            </div>
                          )}
                          {catNovoProdutoUsaCor && (
                            <div className="form-group">
                              <label className="form-label">Cor <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                              <input value={novoProduto.cor} onChange={e => setNovoProduto(f => ({ ...f, cor: e.target.value }))} />
                            </div>
                          )}
                          {catNovoProdutoUsaTamanho && (
                            <div className="form-group">
                              <label className="form-label">Tamanho <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                              {catNovoProduto ? (
                                <select value={novoProduto.tamanho} onChange={e => setNovoProduto(f => ({ ...f, tamanho: e.target.value }))}>
                                  <option value="">Selecione</option>
                                  {tamanhosDoNovoProduto.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              ) : (
                                <input value={novoProduto.tamanho} onChange={e => setNovoProduto(f => ({ ...f, tamanho: e.target.value }))} />
                              )}
                            </div>
                          )}
                          <div className="form-group">
                            <label className="form-label">
                              Quantidade * {novoProduto.tipoVenda === 'fracionado' ? `(${novoProduto.unidadeMedida})` : ''}
                            </label>
                            <input type="number" min={0} step={novoProduto.tipoVenda === 'fracionado' ? 0.001 : 1} value={novoProduto.quantidade}
                              onChange={e => {
                                const bruto = parseFloat(e.target.value) || 0;
                                setNovoProduto(f => ({ ...f, quantidade: f.tipoVenda === 'fracionado' ? bruto : Math.round(bruto) }));
                              }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Preço de custo{novoProduto.tipoVenda === 'fracionado' ? ` (por ${novoProduto.unidadeMedida})` : ''}
                            </label>
                            <InputMoeda value={novoProduto.precoCusto} onChange={v => setNovoProduto(f => ({ ...f, precoCusto: v }))} placeholder="0,00" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Preço de venda{novoProduto.tipoVenda === 'fracionado' ? ` (por ${novoProduto.unidadeMedida})` : ''}
                            </label>
                            <InputMoeda value={novoProduto.precoVenda} onChange={v => setNovoProduto(f => ({ ...f, precoVenda: v }))} placeholder="0,00" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Margem de lucro (%)</label>
                            <input type="number" step="0.1" disabled={novoProduto.precoCusto <= 0}
                              value={novoProduto.precoCusto > 0 ? Math.round(margemNovoProduto * 10) / 10 : ''}
                              placeholder={novoProduto.precoCusto <= 0 ? 'informe o custo' : '0,0'}
                              onChange={e => {
                                const margem = parseFloat(e.target.value) || 0;
                                setNovoProduto(f => ({ ...f, precoVenda: Math.round(f.precoCusto * (1 + margem / 100) * 100) / 100 }));
                              }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                          <button className="btn-secondary" onClick={() => { setMostrarNovoProduto(false); setNovoProduto(NOVO_PRODUTO_VAZIO); }}>Cancelar</button>
                          <button className="btn-primary" onClick={adicionarNovoProdutoManual}>Adicionar à nota</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {manualItens.length === 0 ? (
                    <div className="empty" style={{ padding: '24px 0' }}>
                      <ClipboardList size={28} />
                      <p>Busque produtos acima ou crie um novo pra adicionar à nota.</p>
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ marginTop: 14 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Produto</th><th>Tamanho</th><th>Cor</th><th>Tipo</th>
                            <th>Qtd</th><th>Custo unit.</th><th>Venda unit.</th><th>Margem</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualItens.map((it, i) => {
                            const produtoRef = !it.isNovo ? produtos.find(p => p.id === it.produtoId) : null;
                            const variacaoRef = it.variacaoId ? produtoRef?.variacoes?.find(v => v.id === it.variacaoId) : null;
                            const tipoVendaItem = it.isNovo ? (it.tipoVenda ?? 'unidade') : (produtoRef?.tipoVenda ?? 'unidade');
                            const unidadeMedidaItem = it.isNovo ? (it.unidadeMedida ?? 'un') : (produtoRef?.unidadeMedida ?? 'un');
                            const tamanhoItem = it.isNovo ? it.tamanho : variacaoRef?.tamanho;
                            const corItem = it.isNovo ? it.cor : variacaoRef?.cor;
                            const custoUnitItem = it.precoCusto ?? (it.isNovo ? 0 : (produtoRef?.precoCusto ?? 0));
                            const vendaUnitItem = it.isNovo ? (it.precoVenda ?? 0) : (produtoRef?.precoVenda ?? 0);
                            const margemItem = custoUnitItem > 0 ? ((vendaUnitItem - custoUnitItem) / custoUnitItem) * 100 : null;
                            const stepQtd = tipoVendaItem === 'fracionado' ? 0.001 : 1;
                            return (
                              <tr key={it.chave}>
                                <td>
                                  {it.nomeProduto}
                                  {it.isNovo && <span className="badge badge-blue" style={{ fontSize: 10, marginLeft: 6 }}>Novo produto — {it.categoriaNome}</span>}
                                </td>
                                <td>{tamanhoItem || '—'}</td>
                                <td>{corItem || '—'}</td>
                                <td>{tipoVendaItem === 'fracionado' ? unidadeMedidaItem : 'un.'}</td>
                                <td>
                                  <input type="number" min={0} step={stepQtd} value={it.quantidade}
                                    onChange={e => {
                                      const bruto = parseFloat(e.target.value) || 0;
                                      alterarItemManual(i, 'quantidade', tipoVendaItem === 'fracionado' ? bruto : Math.round(bruto));
                                    }}
                                    style={{ width: 80 }} />
                                </td>
                                <td>
                                  <input type="number" min={0} step="0.01" value={it.precoCusto ?? ''}
                                    placeholder="mantém atual"
                                    onChange={e => alterarItemManual(i, 'precoCusto', parseFloat(e.target.value) || 0)}
                                    style={{ width: 110 }} />
                                </td>
                                <td>{fmt(vendaUnitItem)}</td>
                                <td style={{ color: margemItem !== null && margemItem < 0 ? 'var(--red)' : undefined }}>
                                  {margemItem !== null ? `${margemItem.toFixed(1)}%` : '—'}
                                </td>
                                <td>
                                  <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removerItemManual(i)}>
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24 }}>
                  {!manualFormValido && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Preencha fornecedor, número da nota e adicione ao menos um item.
                    </span>
                  )}
                  <button className="btn-primary" disabled={!manualFormValido || enviandoManual} onClick={lancarManual}>
                    <Check size={14} style={{ verticalAlign: -2 }} /> {enviandoManual ? 'Lançando...' : 'Lançar nota fiscal'}
                  </button>
                </div>
              </>
            )}

            {modo === 'xml' && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-2)' }}>
                  Envie o arquivo XML da NF-e emitida pelo seu fornecedor:
                </div>
                <input type="file" accept=".xml,text/xml,application/xml"
                  onChange={e => setArquivo(e.target.files?.[0] ?? null)}
                  style={{ marginBottom: 12 }} />
                <div>
                  <button className="btn-primary" disabled={!arquivo || carregando} onClick={enviarArquivo}>
                    <Upload size={14} style={{ verticalAlign: -2 }} /> {carregando ? 'Analisando...' : 'Analisar nota'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="nf-layout-historico">
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Histórico de NF</div>
              {historico.length === 0 ? (
                <div className="empty" style={{ padding: '16px 0' }}>
                  <ClipboardList size={24} />
                  <p>Nenhuma nota lançada ainda.</p>
                </div>
              ) : (
                <>
                  <div className="nf-historico-scroll">
                    {historico.slice((histPagina - 1) * histPorPagina, histPagina * histPorPagina).map(h => (
                      <div key={h.id} className="nf-historico-item" style={{ opacity: h.desfeita ? 0.5 : 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          NF {h.numeroNf} — {h.nomeFornecedor}
                          {h.origem === 'manual' && <span className="badge badge-blue" style={{ fontSize: 10, marginLeft: 8 }}>Manual</span>}
                          {h.desfeita && <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>Desfeita</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {h.qtdItens} item(ns) · {new Date(h.importadoEm).toLocaleString('pt-BR')}
                          {h.dataEmissao && ` · emitida em ${new Date(h.dataEmissao).toLocaleDateString('pt-BR')}`}
                          {h.valorTotal ? ` · ${fmt(h.valorTotal)}` : ''}
                        </div>
                        {(h.valorCustoTotal != null || h.valorVendaTotal != null || h.quantidadeTotal != null) && (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {h.valorCustoTotal != null && <span>Custo: <strong style={{ color: 'var(--text-2)' }}>{fmt(h.valorCustoTotal)}</strong></span>}
                            {h.valorVendaTotal != null && <span>Venda: <strong style={{ color: 'var(--text-2)' }}>{fmt(h.valorVendaTotal)}</strong></span>}
                            {h.quantidadeTotal != null && <span>{h.quantidadeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un. lançadas</span>}
                          </div>
                        )}
                        {!h.desfeita && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                            {h.origem === 'manual' && (
                              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirEdicao(h)}>
                                <Pencil size={12} style={{ verticalAlign: -1 }} /> Editar
                              </button>
                            )}
                            <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setConfirmDesfazer(h)}>
                              Desfazer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Paginacao
                      paginaAtual={histPagina}
                      totalItens={historico.length}
                      porPagina={histPorPagina}
                      onMudarPagina={setHistPagina}
                      onMudarPorPagina={setHistPorPagina}
                      opcoesPorPagina={[5, 10, 20]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal seleção variação — lançamento manual */}
      {modalVariacaoManual && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalVariacaoManual(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Escolha a variação</h2>
              <button className="btn-ghost" onClick={() => setModalVariacaoManual(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                <strong>{modalVariacaoManual.nome}</strong> — Escolha a variação:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(produtos.find(p => p.id === modalVariacaoManual.produtoId)?.variacoes ?? [])
                  .filter(v => v.ativo)
                  .map(v => {
                    const label = [v.tamanho, v.cor].filter(Boolean).join(' / ');
                    return (
                      <button key={v.id} className="btn-secondary"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}
                        onClick={() => {
                          adicionarItemManual(modalVariacaoManual.produtoId, modalVariacaoManual.nome, v.id, label);
                          setModalVariacaoManual(null);
                        }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <span className="badge badge-accent">estoque: {v.estoque}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDesfazer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDesfazer(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Desfazer importação</h2>
              <button className="btn-ghost" onClick={() => setConfirmDesfazer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Desfazer a NF <strong style={{ color: 'var(--text-1)' }}>{confirmDesfazer.numeroNf}</strong> de {confirmDesfazer.nomeFornecedor}?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                Isso vai remover o estoque adicionado e excluir produtos/variações criados exclusivamente por essa importação (produtos já vendidos não são removidos, só têm o estoque ajustado). Depois disso você pode reimportar a mesma nota.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDesfazer(null)}>Cancelar</button>
              <button className="btn-danger" disabled={desfazendo} onClick={desfazer}>
                {desfazendo ? 'Desfazendo...' : 'Desfazer importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar NF manual já lançada */}
      {editando && (
        <div className="modal-overlay" onClick={e => {
          if (e.target === e.currentTarget && !salvandoEdicao) { setEditando(null); setEditForm(null); }
        }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar NF {editando.numeroNf}</h2>
              <button className="btn-ghost" onClick={() => { setEditando(null); setEditForm(null); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {carregandoEdicao || !editForm ? (
                <p style={{ color: 'var(--text-3)' }}>Carregando...</p>
              ) : (
                <>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Fornecedor *</label>
                      <select value={editForm.fornecedorId} onChange={e => setEditForm(f => f && { ...f, fornecedorId: e.target.value })}>
                        <option value="">Selecione</option>
                        {fornecedores.filter(f => f.ativo).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Número da nota *</label>
                      <input value={editForm.numeroNf} onChange={e => setEditForm(f => f && { ...f, numeroNf: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Data de emissão <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                      <input type="date" value={editForm.dataEmissao} onChange={e => setEditForm(f => f && { ...f, dataEmissao: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor total da nota <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                      <InputMoeda value={editForm.valorTotal} onChange={v => setEditForm(f => f && { ...f, valorTotal: v })} placeholder="0,00" />
                    </div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Itens</div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    Para adicionar ou remover itens, desfaça esta nota e lance novamente.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th></tr>
                      </thead>
                      <tbody>
                        {editForm.itens.map((it, i) => {
                          const tipoVendaItem = produtos.find(p => p.id === it.produtoId)?.tipoVenda ?? 'unidade';
                          const stepQtd = tipoVendaItem === 'fracionado' ? 0.001 : 1;
                          return (
                          <tr key={`${it.produtoId}-${it.variacaoId ?? ''}`}>
                            <td>
                              {it.nomeProduto}
                              {it.variacaoLabel && <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 6 }}>{it.variacaoLabel}</span>}
                            </td>
                            <td>
                              <input type="number" min={0} step={stepQtd} value={it.quantidade}
                                onChange={e => {
                                  const bruto = parseFloat(e.target.value) || 0;
                                  alterarItemEdicao(i, 'quantidade', tipoVendaItem === 'fracionado' ? bruto : Math.round(bruto));
                                }}
                                style={{ width: 80 }} />
                            </td>
                            <td>
                              <input type="number" min={0} step="0.01" value={it.precoCusto ?? ''}
                                onChange={e => alterarItemEdicao(i, 'precoCusto', parseFloat(e.target.value) || 0)}
                                style={{ width: 110 }} />
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setEditando(null); setEditForm(null); }}>Cancelar</button>
              <button className="btn-primary" disabled={!editForm || salvandoEdicao} onClick={salvarEdicao}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileText size={16} /> <strong>NF {preview.numeroNf}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Fornecedor: <strong style={{ color: 'var(--text-2)' }}>{preview.nomeFornecedor}</strong>
              {' · '}CNPJ: {preview.cnpjFornecedor}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {preview.itens.map((it, i) => {
              const dec = decisoes[i] ?? { acao: 'novo', produtoId: null, precoVenda: it.valorUnitario };
              const status = STATUS_LABEL[it.statusMatch];
              const Icon = status.icone;
              return (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={14} style={{ color: status.cor }} />
                    <span style={{ fontSize: 11, color: status.cor, fontWeight: 500 }}>{status.txt}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.nomeBase}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {it.cor && `Cor: ${it.cor}`}{it.cor && it.tamanho && ' · '}{it.tamanho && `Tamanho: ${it.tamanho}`}
                    {(it.cor || it.tamanho) && ' · '}
                    Cód. fornecedor: {it.codigoFornecedor}
                    {it.gtin && ` · GTIN: ${it.gtin}`}
                    {' · '}Qtd: {it.quantidade}
                    {' · '}Custo unit.: {fmt(it.valorUnitario)}
                    {' · '}Total: {fmt(it.valorTotal)}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={dec.acao === 'existente' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 12 }}
                      disabled={!it.produtoSugeridoId}
                      onClick={() => alterarDecisao(i, { acao: 'existente', produtoId: it.produtoSugeridoId, precoVenda: null })}
                    >
                      Usar existente {it.produtoSugeridoNome ? `(${it.produtoSugeridoNome})` : ''}
                    </button>
                    <button
                      className={dec.acao === 'novo' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 12 }}
                      onClick={() => alterarDecisao(i, { acao: 'novo', produtoId: null, precoVenda: it.valorUnitario })}
                    >
                      Criar novo produto
                    </button>
                  </div>

                  {dec.acao === 'existente' && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      {it.variacaoJaExiste
                        ? <>Variação {it.cor ?? ''} {it.tamanho ?? ''} já existe — estoque atual: {it.estoqueVariacaoAtual} → após entrada: <strong>{(it.estoqueVariacaoAtual ?? 0) + it.quantidade}</strong></>
                        : (it.cor || it.tamanho)
                          ? <>Vai criar uma nova variação {it.cor ?? ''} {it.tamanho ?? ''} neste produto, com estoque inicial {it.quantidade}</>
                          : <>Entrada de {it.quantidade} unidade(s) no estoque</>
                      }
                    </div>
                  )}

                  {dec.acao === 'novo' && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Preço de custo:</span>
                        <input
                          type="number" step="0.01" min={0}
                          value={dec.precoCusto ?? ''}
                          onChange={e => alterarDecisao(i, { precoCusto: parseFloat(e.target.value) || 0 })}
                          style={{ width: 120, fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Preço de venda:</span>
                        <input
                          type="number" step="0.01" min={0}
                          value={dec.precoVenda ?? ''}
                          onChange={e => alterarDecisao(i, { precoVenda: parseFloat(e.target.value) || 0 })}
                          style={{ width: 120, fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Categoria:</span>
                        <input
                          value={dec.categoriaNome}
                          onChange={e => alterarDecisao(i, { categoriaNome: e.target.value })}
                          style={{ width: 140, fontSize: 13 }}
                        />
                        {!it.categoriaJaExiste && (
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>nova categoria</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setPreview(null); setArquivo(null); }}>
              <X size={14} style={{ verticalAlign: -2 }} /> Cancelar
            </button>
            <button className="btn-primary" disabled={confirmando} onClick={confirmar}>
              <Check size={14} style={{ verticalAlign: -2 }} /> {confirmando ? 'Salvando...' : 'Confirmar entrada de estoque'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}