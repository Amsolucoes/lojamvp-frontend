// ── Produto ───────────────────────────────────────────────────────
export type Categoria = 'semi-joias' | 'maquiagem' | 'acessorios' | 'outro';

export interface Produto {
  id: string;
  nome: string;
  categoria: Categoria;
  precoCusto: number;
  precoVenda: number;
  estoque: number;
  estoqueMinimo: number;
  codigoBarras?: string;
  descricao?: string;
  ativo: boolean;
  criadoEm: string;
}

// ── Cliente ───────────────────────────────────────────────────────
export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  endereco?: string;
  observacoes?: string;
  criadoEm: string;
}

// ── Venda / Caixa ─────────────────────────────────────────────────
export type FormaPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito';

export interface ItemVenda {
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
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
  troco?: number;
  criadaEm: string;
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
