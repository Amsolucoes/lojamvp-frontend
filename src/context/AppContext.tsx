import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import { Produto, Cliente, Venda, MovimentoEstoque } from '../types';

interface AppCtx {
  // Estado
  produtos:   Produto[];
  clientes:   Cliente[];
  vendas:     Venda[];
  movimentos: MovimentoEstoque[];
  loading:    boolean;
  erro:       string | null;

  // Produtos
  addProduto:    (p: Omit<Produto, 'id' | 'criadoEm'>) => Promise<void>;
  updateProduto: (id: string, p: Partial<Produto>)       => Promise<void>;
  deleteProduto: (id: string)                            => Promise<void>;

  // Clientes
  addCliente:    (c: Omit<Cliente, 'id' | 'criadoEm'>) => Promise<void>;
  updateCliente: (id: string, c: Partial<Cliente>)       => Promise<void>;
  deleteCliente: (id: string)                            => Promise<void>;

  // Vendas
  registrarVenda: (v: Omit<Venda, 'id' | 'criadaEm'>) => Promise<void>;

  // Estoque
  ajustarEstoque: (
    produtoId: string,
    quantidade: number,
    tipo: 'entrada' | 'ajuste',
    obs?: string
  ) => Promise<void>;

  // Refetch
  recarregar: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

// ── Mappers API → tipos locais ────────────────────────────────────
// A API retorna camelCase igual ao frontend, só precisamos garantir
// que os campos de data sejam strings ISO.

function mapProduto(p: any): Produto {
  return {
    id:            p.id,
    nome:          p.nome,
    descricao:     p.descricao,
    categoria:     p.categoria,
    precoCusto:    p.precoCusto,
    precoVenda:    p.precoVenda,
    estoque:       p.estoque,
    estoqueMinimo: p.estoqueMinimo,
    codigoBarras:  p.codigoBarras,
    ativo:         p.ativo,
    criadoEm:      p.criadoEm,
  };
}

function mapCliente(c: any): Cliente {
  return {
    id:          c.id,
    nome:        c.nome,
    telefone:    c.telefone,
    cpf:         c.cpf,
    email:       c.email,
    endereco:    c.endereco,
    observacoes: c.observacoes,
    criadoEm:    c.criadoEm,
  };
}

function mapVenda(v: any): Venda {
  return {
    id:             v.id,
    clienteId:      v.clienteId,
    nomeCliente:    v.nomeCliente,
    total:          v.total,
    desconto:       v.desconto,
    totalFinal:     v.totalFinal,
    formaPagamento: v.formaPagamento,
    troco:          v.troco,
    criadaEm:       v.criadaEm,
    itens:          (v.itens ?? []).map((i: any) => ({
      produtoId:      i.produtoId,
      nomeProduto:    i.nomeProduto,
      quantidade:     i.quantidade,
      precoUnitario:  i.precoUnitario,
      subtotal:       i.subtotal,
    })),
  };
}

function mapMovimento(m: any): MovimentoEstoque {
  return {
    id:          m.id,
    produtoId:   m.produtoId,
    nomeProduto: m.nomeProduto,
    tipo:        m.tipo,
    quantidade:  m.quantidade,
    observacao:  m.observacao,
    criadoEm:    m.criadoEm,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [produtos,   setProdutos]   = useState<Produto[]>([]);
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [vendas,     setVendas]     = useState<Venda[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  async function recarregar() {
    setLoading(true);
    setErro(null);
    try {
      const [prods, clis, vends, movs] = await Promise.all([
        api.get<any[]>('/api/produtos'),
        api.get<any[]>('/api/clientes'),
        api.get<any[]>('/api/vendas'),
        api.get<any[]>('/api/estoque/movimentos'),
      ]);
      setProdutos(prods.map(mapProduto));
      setClientes(clis.map(mapCliente));
      setVendas(vends.map(mapVenda));
      setMovimentos(movs.map(mapMovimento));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recarregar(); }, []);

  // ── Produtos ────────────────────────────────────────────────────
  async function addProduto(p: Omit<Produto, 'id' | 'criadoEm'>) {
    const novo = await api.post<any>('/api/produtos', p);
    setProdutos(prev => [...prev, mapProduto(novo)]);
  }

  async function updateProduto(id: string, p: Partial<Produto>) {
    const atual = produtos.find(x => x.id === id)!;
    const atualizado = await api.put<any>(`/api/produtos/${id}`, { ...atual, ...p });
    setProdutos(prev => prev.map(x => x.id === id ? mapProduto(atualizado) : x));
  }

  async function deleteProduto(id: string) {
    await api.delete(`/api/produtos/${id}`);
    setProdutos(prev => prev.filter(x => x.id !== id));
  }

  // ── Clientes ────────────────────────────────────────────────────
  async function addCliente(c: Omit<Cliente, 'id' | 'criadoEm'>) {
    const novo = await api.post<any>('/api/clientes', c);
    setClientes(prev => [...prev, mapCliente(novo)]);
  }

  async function updateCliente(id: string, c: Partial<Cliente>) {
    const atual = clientes.find(x => x.id === id)!;
    const atualizado = await api.put<any>(`/api/clientes/${id}`, { ...atual, ...c });
    setClientes(prev => prev.map(x => x.id === id ? mapCliente(atualizado) : x));
  }

  async function deleteCliente(id: string) {
    await api.delete(`/api/clientes/${id}`);
    setClientes(prev => prev.filter(x => x.id !== id));
  }

  // ── Vendas ──────────────────────────────────────────────────────
  async function registrarVenda(v: Omit<Venda, 'id' | 'criadaEm'>) {
    const payload = {
      itens:          v.itens.map(i => ({
        produtoId:     i.produtoId,
        quantidade:    i.quantidade,
        precoUnitario: i.precoUnitario,
      })),
      clienteId:      v.clienteId ?? null,
      desconto:       v.desconto,
      formaPagamento: v.formaPagamento,
      troco:          v.troco ?? null,
    };

    const nova = await api.post<any>('/api/vendas', payload);
    setVendas(prev => [mapVenda(nova), ...prev]);

    // Atualiza estoque local sem precisar refetch
    nova.itens.forEach((item: any) => {
      setProdutos(prev => prev.map(p =>
        p.id === item.produtoId
          ? { ...p, estoque: Math.max(0, p.estoque - item.quantidade) }
          : p
      ));
    });

    // Adiciona movimentos da venda
    const novosMovs = nova.itens.map((item: any) => mapMovimento({
      id:          crypto.randomUUID(),
      produtoId:   item.produtoId,
      nomeProduto: item.nomeProduto,
      tipo:        'saida',
      quantidade:  item.quantidade,
      observacao:  `Venda #${nova.id.slice(-8)}`,
      criadoEm:    nova.criadaEm,
    }));
    setMovimentos(prev => [...novosMovs, ...prev]);
  }

  // ── Estoque ─────────────────────────────────────────────────────
  async function ajustarEstoque(
    produtoId: string,
    quantidade: number,
    tipo: 'entrada' | 'ajuste',
    obs?: string
  ) {
    const res = await api.post<any>('/api/estoque/ajuste', {
      produtoId,
      quantidade,
      tipo,
      observacao: obs ?? null,
    });

    setProdutos(prev => prev.map(p =>
      p.id === produtoId ? { ...p, estoque: res.estoqueAgora } : p
    ));

    setMovimentos(prev => [{
      id:          crypto.randomUUID(),
      produtoId,
      nomeProduto: produtos.find(p => p.id === produtoId)?.nome ?? '',
      tipo,
      quantidade,
      observacao:  obs,
      criadoEm:    new Date().toISOString(),
    }, ...prev]);
  }

  return (
    <Ctx.Provider value={{
      produtos, clientes, vendas, movimentos, loading, erro,
      addProduto, updateProduto, deleteProduto,
      addCliente, updateCliente, deleteCliente,
      registrarVenda, ajustarEstoque,
      recarregar,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
