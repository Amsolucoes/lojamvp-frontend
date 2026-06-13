import { useState } from 'react';
import { BarChart2, TrendingUp, Package, ShoppingCart, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './Relatorios.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Periodo = '7d' | '30d' | '90d' | 'tudo';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d',   label: 'Últimos 7 dias'  },
  { value: '30d',  label: 'Últimos 30 dias' },
  { value: '90d',  label: 'Últimos 90 dias' },
  { value: 'tudo', label: 'Todo o período'  },
];

function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Extrai variação do nome do produto — Ex: "Camiseta Hering (M / Azul)" → "M / Azul"
function extrairVariacao(nomeProduto: string): { nome: string; variacao?: string } {
  const match = nomeProduto.match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { nome: match[1].trim(), variacao: match[2].trim() };
  return { nome: nomeProduto };
}

const labelPag: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito',
};

export function Relatorios() {
  const { vendas, produtos } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>('30d');

  const vendasFiltradas = vendas.filter(v => {
    if (periodo === 'tudo') return true;
    const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
    return new Date(v.criadaEm) >= diasAtras(dias);
  });

  const totalVendido   = vendasFiltradas.reduce((s, v) => s + v.totalFinal, 0);
  const totalDesconto  = vendasFiltradas.reduce((s, v) => s + v.desconto, 0);
  const ticketMedio    = vendasFiltradas.length > 0 ? totalVendido / vendasFiltradas.length : 0;
  const totalItensVend = vendasFiltradas.flatMap(v => v.itens).reduce((s, i) => s + i.quantidade, 0);

  // Produtos mais vendidos — agrupado por nomeProduto (inclui variação)
  const rankItens = vendasFiltradas
    .flatMap(v => v.itens)
    .reduce((acc, item) => {
      const key = item.nomeProduto;
      if (!acc[key]) acc[key] = { nomeProduto: item.nomeProduto, qtd: 0, receita: 0 };
      acc[key].qtd     += item.quantidade;
      acc[key].receita += item.subtotal;
      return acc;
    }, {} as Record<string, { nomeProduto: string; qtd: number; receita: number }>);

  const rankProdutos = Object.values(rankItens)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  const maxQtd = rankProdutos[0]?.qtd || 1;

  // Vendas por forma de pagamento
  const porPagamento = ['dinheiro', 'pix', 'credito', 'debito'].map(fp => {
    const vs = vendasFiltradas.filter(v => v.formaPagamento === fp);
    return { forma: fp, qtd: vs.length, total: vs.reduce((s, v) => s + v.totalFinal, 0) };
  }).filter(x => x.qtd > 0).sort((a, b) => b.total - a.total);

  const maxPag = porPagamento[0]?.total || 1;

  // Vendas por categoria — dinâmico
  const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  const porCategoria = categorias.map(cat => {
    const prods = produtos.filter(p => p.categoria === cat);
    const itens = vendasFiltradas.flatMap(v => v.itens).filter(i =>
      prods.some(p => p.id === i.produtoId)
    );
    const qtd     = itens.reduce((s, i) => s + i.quantidade, 0);
    const receita = itens.reduce((s, i) => s + i.subtotal, 0);
    return { categoria: cat, qtd, receita };
  }).filter(x => x.qtd > 0).sort((a, b) => b.receita - a.receita);

  const maxCat = porCategoria[0]?.receita || 1;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise de vendas e desempenho</p>
        </div>
        <div className="rel-periodo-tabs">
          {PERIODOS.map(p => (
            <button key={p.value} className={`cat-tab${periodo === p.value ? ' active' : ''}`}
              onClick={() => setPeriodo(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="rel-stats">
        <div className="stat-card">
          <div className="stat-label"><ShoppingCart size={12} style={{ verticalAlign: -1 }} /> Total vendido</div>
          <div className="stat-value">{fmt(totalVendido)}</div>
          <div className="stat-sub">{vendasFiltradas.length} venda(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingUp size={12} style={{ verticalAlign: -1 }} /> Ticket médio</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{fmt(ticketMedio)}</div>
          <div className="stat-sub">por venda</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Package size={12} style={{ verticalAlign: -1 }} /> Itens vendidos</div>
          <div className="stat-value">{totalItensVend}</div>
          <div className="stat-sub">unidades no período</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Calendar size={12} style={{ verticalAlign: -1 }} /> Descontos</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>{fmt(totalDesconto)}</div>
          <div className="stat-sub">concedidos no período</div>
        </div>
      </div>

      {vendasFiltradas.length === 0 ? (
        <div className="card">
          <div className="empty" style={{ padding: '60px 0' }}>
            <BarChart2 size={36} />
            <p>Nenhuma venda no período selecionado.</p>
            <p style={{ fontSize: 12 }}>Registre vendas no módulo Caixa para ver os relatórios.</p>
          </div>
        </div>
      ) : (
        <div className="rel-grid">

          {/* Produtos mais vendidos */}
          <div className="card rel-card">
            <div className="rel-card-title"><TrendingUp size={15} /> Produtos mais vendidos</div>
            {rankProdutos.length === 0 ? (
              <div className="empty" style={{ padding: '30px 0' }}><p>Sem dados no período.</p></div>
            ) : rankProdutos.map((item, i) => {
              const { nome, variacao } = extrairVariacao(item.nomeProduto);
              return (
                <div key={item.nomeProduto} className="rel-bar-row">
                  <div className="rel-rank">#{i + 1}</div>
                  <div className="rel-bar-info">
                    <div className="rel-bar-label">
                      <span className="rel-nome">
                        {nome}
                        {variacao && (
                          <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 6 }}>
                            {variacao}
                          </span>
                        )}
                      </span>
                      <span className="rel-valor">{item.qtd} un. · {fmt(item.receita)}</span>
                    </div>
                    <div className="rel-bar-wrap">
                      <div className="rel-bar rel-bar-accent"
                        style={{ width: `${(item.qtd / maxQtd) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coluna direita */}
          <div className="rel-col-right">

            {/* Por categoria — dinâmico */}
            <div className="card rel-card">
              <div className="rel-card-title"><Package size={15} /> Vendas por categoria</div>
              {porCategoria.length === 0 ? (
                <div className="empty" style={{ padding: '20px 0' }}><p>Sem dados.</p></div>
              ) : porCategoria.map(c => (
                <div key={c.categoria} className="rel-bar-row" style={{ marginBottom: 14 }}>
                  <div className="rel-bar-info">
                    <div className="rel-bar-label">
                      <span className="rel-nome">{c.categoria}</span>
                      <span className="rel-valor">{fmt(c.receita)}</span>
                    </div>
                    <div className="rel-bar-wrap">
                      <div className="rel-bar rel-bar-blue"
                        style={{ width: `${(c.receita / maxCat) * 100}%` }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {c.qtd} unidades vendidas
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Por forma de pagamento */}
            <div className="card rel-card">
              <div className="rel-card-title"><ShoppingCart size={15} /> Formas de pagamento</div>
              {porPagamento.map(p => (
                <div key={p.forma} className="rel-pag-row">
                  <div className="rel-pag-label">
                    <span>{labelPag[p.forma] ?? p.forma}</span>
                    <span className="badge badge-accent" style={{ fontSize: 11 }}>{p.qtd}x</span>
                  </div>
                  <div className="rel-bar-wrap" style={{ margin: '5px 0' }}>
                    <div className="rel-bar rel-bar-green"
                      style={{ width: `${(p.total / maxPag) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{fmt(p.total)}</div>
                </div>
              ))}
            </div>

            {/* Últimas vendas */}
            <div className="card rel-card">
              <div className="rel-card-title"><Calendar size={15} /> Últimas vendas</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Data</th><th>Itens</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {[...vendasFiltradas]
                      .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                      .slice(0, 6)
                      .map(v => (
                        <tr key={v.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {new Date(v.criadaEm).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                            {v.itens.map(i => {
                              const { nome, variacao } = extrairVariacao(i.nomeProduto);
                              return (
                                <div key={i.produtoId + (variacao ?? '')}>
                                  {nome} {variacao && <span style={{ color: 'var(--accent)' }}>({variacao})</span>} ×{i.quantidade}
                                </div>
                              );
                            })}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--green)', fontSize: 13 }}>
                            {fmt(v.totalFinal)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}