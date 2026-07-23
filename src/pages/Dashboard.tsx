import { ShoppingCart, Package, TrendingUp, AlertTriangle, Clock, Store, Wallet, Filter, Users2, Home } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Produto, Venda, ItemVenda } from '../types';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DashboardFinanceiro } from './DashboardFinanceiro';
import { DashboardCorretora } from './DashboardCorretora';
import { DashboardTurmas } from './DashboardTurmas';
import { DashboardChacara } from './DashboardChacara';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Dashboard() {
  const { temProdutos, temServicos, temTurmas, temFinanceiro, temCorretora, temChacaraReservas } = useApp();

  const abasDisponiveis = [
    ...(temProdutos || temServicos ? [{ chave: 'loja' as const, label: 'Loja', Icon: Store }] : []),
    ...(temTurmas && !temProdutos && !temServicos ? [{ chave: 'turmas' as const, label: 'Turmas', Icon: Users2 }] : []),
    ...(temCorretora ? [{ chave: 'corretora' as const, label: 'Corretora', Icon: Filter }] : []),
    ...(temChacaraReservas && !temProdutos && !temServicos ? [{ chave: 'chacara' as const, label: 'Chácara', Icon: Home }] : []),
    ...(temFinanceiro ? [{ chave: 'financeiro' as const, label: 'Financeiro', Icon: Wallet }] : []),
  ];

  const [abaDash, setAbaDash] = useState(abasDisponiveis[0]?.chave ?? 'loja');

  useEffect(() => {
    if (abasDisponiveis.length > 0 && !abasDisponiveis.some(a => a.chave === abaDash)) {
      setAbaDash(abasDisponiveis[0].chave);
    }
  }, [temProdutos, temServicos, temTurmas, temCorretora, temFinanceiro, temChacaraReservas]);

  // Só existe 1 dashboard aplicável — renderiza direto, sem abas
  if (abasDisponiveis.length <= 1) {
    const unica = abasDisponiveis[0]?.chave ?? 'loja';
    if (unica === 'financeiro') return <DashboardFinanceiro />;
    if (unica === 'corretora') return <DashboardCorretora />;
    if (unica === 'turmas') return <DashboardTurmas />;
    if (unica === 'chacara') return <DashboardChacara />;
    return <DashboardLoja />;
  }

  return (
    <div className="page">
      <div className="planos-tabs" style={{ marginBottom: 20 }}>
        {abasDisponiveis.map(a => (
          <button key={a.chave} className={`planos-tab${abaDash === a.chave ? ' ativo' : ''}`} onClick={() => setAbaDash(a.chave)}>
            <a.Icon size={15} /> {a.label}
          </button>
        ))}
      </div>
      {abaDash === 'loja' && <DashboardLoja />}
      {abaDash === 'financeiro' && <DashboardFinanceiro />}
      {abaDash === 'corretora' && <DashboardCorretora />}
      {abaDash === 'turmas' && <DashboardTurmas />}
      {abaDash === 'chacara' && <DashboardChacara />}
    </div>
  );
}

function DashboardLoja() {
  const { produtos, clientes, vendas, temServicos } = useApp();

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

  const [situacao, setSituacao] = useState<any>(null);
  const [assinantes, setAssinantes] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/loja/situacao').then(setSituacao).catch(() => {});
  }, []);

  useEffect(() => {
    if (temServicos) {
      api.get<any[]>('/api/planos/assinantes').then(setAssinantes).catch(() => {});
    }
  }, [temServicos]);

  const receitaRecorrente = assinantes.reduce((s, a) => s + (a.valor ?? 0), 0);

  return (
    <div className="page">
      {situacao && (situacao.fase === 'trial' || situacao.fase === 'carencia') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderRadius: 12, marginBottom: 16,
          background: situacao.fase === 'carencia' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
          border: `1px solid ${situacao.fase === 'carencia' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
          flexWrap: 'wrap',
        }}>
          <Clock size={18} style={{ color: situacao.fase === 'carencia' ? 'var(--red)' : 'var(--blue, #6366f1)', flexShrink: 0 }} />
          <div style={{ fontSize: 14, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
            {situacao.fase === 'trial' ? (
              situacao.diasRestantes > 0 ? (
                <>Seu período de teste termina em <strong>{situacao.diasRestantes} {situacao.diasRestantes === 1 ? 'dia' : 'dias'}</strong>. Assine para continuar usando sem interrupções.</>
              ) : (
                <>Seu teste termina <strong>hoje</strong>. Faça o pagamento para continuar.</>
              )
            ) : (
              <>Sua fatura está vencida. Você tem <strong>{situacao.diasRestantes} {situacao.diasRestantes === 1 ? 'dia' : 'dias'}</strong> para pagar antes do bloqueio.</>
            )}
          </div>
            <button
            onClick={() => window.open('https://admin.aldevsoftware.com.br', '_blank')}
            style={{
              background: situacao.fase === 'carencia' ? 'var(--red)' : 'var(--blue, #6366f1)',
              color: '#fff', padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {situacao.fase === 'carencia' ? 'Pagar agora' : 'Ver assinatura'}
          </button>
        </div>
      )}
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
        {temServicos && (
          <div className="stat-card">
            <div className="stat-label">Assinantes</div>
            <div className="stat-value">{assinantes.length}</div>
            <div className="stat-sub">{fmt(receitaRecorrente)}/mês recorrente</div>
          </div>
        )}
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
            <>
              {/* Tabela — desktop */}
              <div className="table-wrap dash-table-desktop">
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
                          {v.formasPagamento ? (
                            JSON.parse(v.formasPagamento).map((f: any) => (
                              <div key={f.forma} style={{ fontSize: 11 }}>
                                <span className={`badge badge-${f.forma === 'pix' ? 'blue' : f.forma === 'dinheiro' ? 'green' : 'accent'}`}>
                                  {f.forma}
                                </span>
                                <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>{fmt(f.valor)}</span>
                              </div>
                            ))
                          ) : (
                            <span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>
                              {v.formaPagamento}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-3)' }}>
                          {new Date(v.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards — mobile */}
              <div className="dash-vendas-mobile">
                {[...vendas].reverse().slice(0, 8).map(v => (
                  <div key={v.id} className="dash-venda-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>#{v.id.slice(-6)}</span>
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(v.totalFinal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{v.nomeCliente || '—'}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>
                          {v.formaPagamento}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {new Date(v.criadaEm).toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                          {new Date(v.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
            {top5.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}><p>Sem vendas ainda.</p></div>
            ) : top5.map((p: Produto, i: number) => {
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
      <div className="dash-fab-spacer" />
    </div>
  );
}
