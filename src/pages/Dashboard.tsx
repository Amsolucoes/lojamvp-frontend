import { ShoppingCart, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Produto, Venda, ItemVenda } from '../types';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Dashboard() {
  const { produtos, clientes, vendas } = useApp();

  const hoje = new Date().toDateString();
  const vendasHoje = vendas.filter(v => new Date(v.criadaEm).toDateString() === hoje);
  const totalHoje = vendasHoje.reduce((s, v) => s + v.totalFinal, 0);
  const alertasEstoque = produtos.filter(p => p.ativo && p.estoque <= p.estoqueMinimo);
  const produtosAtivos = produtos.filter(p => p.ativo).length;

  const allItens = vendas.flatMap((v: Venda) => v.itens);
  const top5 = [...produtos]
    .sort((a: Produto, b: Produto) => {
      const va = allItens.filter((i: ItemVenda) => i.produtoId === a.id).reduce((s: number, i: ItemVenda) => s + i.quantidade, 0);
      const vb = allItens.filter((i: ItemVenda) => i.produtoId === b.id).reduce((s: number, i: ItemVenda) => s + i.quantidade, 0);
      return vb - va;
    })
    .slice(0, 5);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-label">Vendas hoje</div>
          <div className="stat-value">{fmt(totalHoje)}</div>
          <div className="stat-sub">{vendasHoje.length} transação(ões)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Produtos ativos</div>
          <div className="stat-value">{produtosAtivos}</div>
          <div className="stat-sub">no catálogo</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clientes cadastrados</div>
          <div className="stat-value">{clientes.length}</div>
          <div className="stat-sub">total</div>
        </div>
        <div className="stat-card" style={alertasEstoque.length > 0 ? { borderColor: 'rgba(251,191,36,0.3)' } : {}}>
          <div className="stat-label">Alertas de estoque</div>
          <div className="stat-value" style={alertasEstoque.length > 0 ? { color: 'var(--yellow)' } : {}}>
            {alertasEstoque.length}
          </div>
          <div className="stat-sub">produto(s) com estoque baixo</div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Vendas recentes */}
        <div className="card">
          <div className="dash-card-header">
            <div className="dash-card-title"><ShoppingCart size={15} /> Vendas recentes</div>
          </div>
          {vendas.length === 0 ? (
            <div className="empty" style={{ padding: '30px 0' }}>
              <p>Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vendas].reverse().slice(0, 8).map(v => (
                    <tr key={v.id}>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>#{v.id.slice(-6)}</span></td>
                      <td>{v.nomeCliente || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt(v.totalFinal)}</td>
                      <td>
                        <span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>
                          {v.formaPagamento}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-3)' }}>
                        {new Date(v.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas + Top produtos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alertasEstoque.length > 0 && (
            <div className="card dash-alerts">
              <div className="dash-card-header">
                <div className="dash-card-title" style={{ color: 'var(--yellow)' }}>
                  <AlertTriangle size={15} /> Estoque baixo
                </div>
              </div>
              {alertasEstoque.map(p => (
                <div key={p.id} className="alert-row">
                  <span>{p.nome}</span>
                  <span className="badge badge-yellow">{p.estoque} un.</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="dash-card-header">
              <div className="dash-card-title"><TrendingUp size={15} /> Produtos mais vendidos</div>
            </div>
            {top5.map((p: Produto, i: number) => {
              const qtd = allItens.filter((it: ItemVenda) => it.produtoId === p.id).reduce((s: number, it: ItemVenda) => s + it.quantidade, 0);
              return (
                <div key={p.id} className="top-row">
                  <span className="top-rank">#{i + 1}</span>
                  <span className="top-nome">{p.nome}</span>
                  <span className="top-qtd">{qtd} un.</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
