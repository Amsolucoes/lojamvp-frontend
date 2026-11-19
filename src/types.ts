// ── Produto ───────────────────────────────────────────────────────
export type Categoria = 'semi-joias' | 'maquiagem' | 'acessorios' | 'outro';

export interface ProdutoVariacao {
  id: string;
  tamanho?: string;
  cor?: string;
  outroCampo?: string;
  codigoBarras?: string;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  precoCusto: number;
  precoVenda: number;
  estoque: number;
  estoqueMinimo: number;
  codigoBarras?: string;
  descricao?: string;
  ativo: boolean;
  criadoEm: string;
  tipoVenda: string;
  unidadeMedida?: string;
  marcaId?: string | null;
  nomeMarca?: string | null;
  fornecedorId?: string | null;
  nomeFornecedor?: string | null;
  variacoes?: ProdutoVariacao[];
}

// ── Cliente ───────────────────────────────────────────────────────
export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  dataNascimento?: string;
  endereco?: string;
  observacoes?: string;
  criadoEm: string;
  creditoLoja?: number;
  saldoCarteira?: number;          // quanto o cliente deve na carteira (fiado)
  limiteCarteira?: number | null;  // teto da carteira; vazio = sem limite
}

// ── Fornecedor ────────────────────────────────────────────────────
export interface Fornecedor {
  id: string;
  nome: string;
  cnpjCpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  criadoEm: string;
  qtdProdutos: number;
}

// ── Venda / Caixa ─────────────────────────────────────────────────
export type FormaPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'carteira';

export interface ItemVenda {
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  bonificacao?: boolean;   // brinde dado dentro da venda (preço zero)
}

// ── Bonificação (brinde que a loja dá ao cliente) ─────────────────
export interface Bonificacao {
  id: string;
  clienteId: string | null;
  nomeCliente: string;
  produtoId: string | null;
  variacaoId: string | null;
  nomeProduto: string;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  observacao: string | null;
  vendaId: string | null;        // preenchido quando o brinde foi dado dentro de uma venda
  usuarioId: string | null;
  criadoEm: string;
  estornadaEm: string | null;
}

export interface ResumoBonificacoes {
  totalBonificacoes: number;
  totalQuantidade: number;
  totalCusto: number;
  porProduto: { produtoId: string | null; nomeProduto: string; quantidade: number; custo: number }[];
  porCliente: { clienteId: string | null; nomeCliente: string; bonificacoes: number; quantidade: number; custo: number }[];
}

export interface Venda {
  id: string;
  itens: ItemVenda[];
  clienteId?: string;
  nomeCliente?: string;
  total: number;
  desconto: number;
  totalFinal: number;
  formaPagamento: FormaPagamento;
  formasPagamento?: string;
  parcelas?: number;
  troco?: number;
  criadaEm: string;
  origemNome?: string;
  nomeFuncionario?: string;
  valorCarteira?: number | null;   // parte da venda que ficou na carteira do cliente (paga depois)
}

// ── Estoque ───────────────────────────────────────────────────────
export type TipoMovimento = 'entrada' | 'saida' | 'ajuste';

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  nomeProduto: string;
  tipo: TipoMovimento;
  quantidade: number;
  observacao?: string;
  criadoEm: string;
}
