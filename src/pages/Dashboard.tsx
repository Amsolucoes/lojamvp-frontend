import { ShoppingCart, Package, TrendingUp, AlertTriangle, Clock, Store, Wallet, Filter, Users2, Home, ArrowUpRight, ArrowDownRight, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Venda, ItemVenda } from '../types';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DashboardFinanceiro } from './DashboardFinanceiro';
import { FinanceiroMobile } from './financeiro/FinanceiroMobile';
import { useIsMobile } from '../hooks/useIsMobile';
import { DashboardCorretora } from './DashboardCorretora';
import { DashboardTurmas } from './DashboardTurmas';
import { DashboardChacara } from './DashboardChacara';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const LABEL_PAG: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito',
};
const COR_PAG: Record<string, string> = {
  dinheiro: 'var(--green)', pix: 'var(--blue)', credito: 'var(--accent)', debito: 'var(--yellow)',
};

// Lê formasPagamento seja string JSON ou array já parseado
function parseFormas(fp: any): any[] {
  if (!fp) return [];
  if (Array.isArray(fp)) return fp;
  try { return JSON.parse(fp); } catch { return []; }
}

export function Dashboard() {
  const { temProdutos, temServicos, temTurmas, temFinanceiro, temCorretora, temChacaraReservas } = useApp();
  const isMobile = useIsMobile();

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
    if (unica === 'financeiro') return isMobile ? <FinanceiroMobile /> : <DashboardFinanceiro />;
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

interface MovimentoCaixa {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  origemNome: string | null;
  observacao: string | null;
}

function DashboardLoja() {
  const { produtos, clientes, vendas, temServicos } = useApp();
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);

  useEffect(() => {
    api.get<MovimentoCaixa[]>('/api/movimentos-caixa').then(setMovimentos).catch(() => {});
  }, []);

  const agora = new Date();
  const hoje = agora.toDateString();
  const ontemDate = new Date(agora); ontemDate.setDate(agora.getDate() - 1);
  const ontem = ontemDate.toDateString();

  const vendasHoje = vendas.filter(v => new Date(v.criadaEm).toDateString() === hoje);
  const totalHoje = vendasHoje.reduce((s, v) => s + v.totalFinal, 0);
  const vendasOntem = vendas.filter(v => new Date(v.criadaEm).toDateString() === ontem);
  const totalOntem = vendasOntem.reduce((s, v) => s + v.totalFinal, 0);
  const temComparacaoOntem = vendasOntem.length > 0;
  const variacaoVsOntem = temComparacaoOntem ? ((totalHoje - totalOntem) / totalOntem) * 100 : 0;
  const ticketMedioHoje = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0;

  const movimentosHoje = movimentos.filter(m => new Date(m.data).toDateString() === hoje);
  const entradasManuaisHoje = movimentosHoje.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
  const sangriasHoje = movimentosHoje.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);
  const ajusteCaixaHoje = entradasManuaisHoje - sangriasHoje;
  const alertasEstoque = produtos.filter(p => p.ativo && p.estoque <= p.estoqueMinimo);
  const produtosAtivos = produtos.filter(p => p.ativo).length;

  // Janela dos últimos 7 dias (hoje incluso) — usada no gráfico, em "clientes
  // novos" e nos "mais vendidos da semana", todos com o mesmo recorte.
  const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - 6); inicioSemana.setHours(0, 0, 0, 0);
  const clientesNovosSemana = clientes.filter(c => new Date(c.criadoEm) >= inicioSemana).length;

  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(agora); dia.setDate(agora.getDate() - (6 - i));
    const diaStr = dia.toDateString();
    const valor = vendas.filter(v => new Date(v.criadaEm).toDateString() === diaStr).reduce((s, v) => s + v.totalFinal, 0);
    return { label: dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), valor, isHoje: diaStr === hoje };
  });
  const maxSemana = Math.max(...ultimos7Dias.map(d => d.valor), 1);

  const totalPorForma: Record<string, number> = {};
  vendasHoje.forEach(v => {
    const formas = parseFormas(v.formasPagamento);
    if (formas.length > 0) {
      formas.forEach((f: any) => { totalPorForma[f.forma] = (totalPorForma[f.forma] ?? 0) + f.valor; });
    } else {
      totalPorForma[v.formaPagamento] = (totalPorForma[v.formaPagamento] ?? 0) + v.totalFinal;
    }
  });
  const formasPagamentoHoje = Object.entries(totalPorForma)
    .map(([forma, valor]) => ({ forma, valor }))
    .sort((a, b) => b.valor - a.valor);

  const itensSemana = vendas
    .filter(v => new Date(v.criadaEm) >= inicioSemana)
    .flatMap((v: Venda) => v.itens);
  const topSemana = [...produtos]
    .map(p => ({ produto: p, qtd: itensSemana.filter((i: ItemVenda) => i.produtoId === p.id).reduce((s: number, i: ItemVenda) => s + i.quantidade, 0) }))
    .filter(x => x.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd)
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
          <div className="stat-sub">
            {vendasHoje.length} transação(ões)
            {temComparacaoOntem && (
              <span style={{ marginLeft: 8, color: variacaoVsOntem >= 0 ? 'var(--green)' : 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {variacaoVsOntem >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(variacaoVsOntem).toFixed(0)}% vs ontem
              </span>
            )}
          </div>
          {ajusteCaixaHoje !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>Total do dia</span>
              <strong>{fmt(totalHoje + ajusteCaixaHoje)}</strong>
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Ticket médio</div>
          <div className="stat-value">{fmt(ticketMedioHoje)}</div>
          <div className="stat-sub">por venda hoje</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Produtos ativos</div>
          <div className="stat-value">{produtosAtivos}</div>
          <div className="stat-sub">no catálogo</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clientes cadastrados</div>
          <div className="stat-value">{clientes.length}</div>
          <div className="stat-sub">
            total
            {clientesNovosSemana > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· +{clientesNovosSemana} esta semana</span>}
          </div>
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
        {(entradasManuaisHoje > 0 || sangriasHoje > 0) && (
          <div className="stat-card" style={ajusteCaixaHoje < 0 ? { borderColor: 'rgba(248,113,113,0.3)' } : {}}>
            <div className="stat-label">↕️ Ajustes de caixa hoje</div>
            <div className="stat-value" style={{ fontSize: 20, color: ajusteCaixaHoje >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {ajusteCaixaHoje >= 0 ? '+' : ''}{fmt(ajusteCaixaHoje)}
            </div>
            <div className="stat-sub">
              {entradasManuaisHoje > 0 && `+${fmt(entradasManuaisHoje)} entrada`}
              {entradasManuaisHoje > 0 && sangriasHoje > 0 && ' · '}
              {sangriasHoje > 0 && `-${fmt(sangriasHoje)} sangria`}
            </div>
          </div>
        )}
      </div>

      <div className="card dash-week-card">
        <div className="dash-card-header">
          <div className="dash-card-title"><TrendingUp size={15} /> Vendas — últimos 7 dias</div>
        </div>
        <div className="dash-week-chart">
          {ultimos7Dias.map((d, i) => (
            <div key={i} className={`dash-week-col${d.isHoje ? ' hoje' : ''}`}>
              <div className="dash-week-bar-wrap">
                {d.valor > 0 && <span className="dash-week-tip">{fmt(d.valor)}</span>}
                <div className="dash-week-bar" style={{ height: `${Math.max(d.valor > 0 ? 4 : 2, (d.valor / maxSemana) * 100)}%` }} />
              </div>
              <span className="dash-week-label">{d.label}</span>
            </div>
          ))}
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

        {/* Alertas de estoque */}
        {alertasEstoque.length > 0 && (
          <div className="card dash-alerts">
            <div className="dash-card-header">
              <div className="dash-card-title" style={{ color: 'var(--yellow)' }}>
                <AlertTriangle size={15} /> Estoque baixo
              </div>
            </div>
            <div className="dash-alerts-scroll">
              {alertasEstoque.map(p => (
                <div key={p.id} className="alert-row">
                  <span>{p.nome}</span>
                  <span className="badge badge-yellow">{p.estoque} un.</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dash-grid-secundario">
        <div className="card">
          <div className="dash-card-header">
            <div className="dash-card-title"><CreditCard size={15} /> Formas de pagamento hoje</div>
          </div>
          {formasPagamentoHoje.length === 0 || totalHoje <= 0 ? (
            <div className="empty" style={{ padding: '20px 0' }}><p>Nenhuma venda hoje ainda.</p></div>
          ) : (
            <>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                {formasPagamentoHoje.map(f => (
                  <div key={f.forma} style={{ width: `${(f.valor / totalHoje) * 100}%`, background: COR_PAG[f.forma] ?? 'var(--text-3)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {formasPagamentoHoje.map(f => (
                  <div key={f.forma} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COR_PAG[f.forma] ?? 'var(--text-3)' }} />
                      {LABEL_PAG[f.forma] ?? f.forma}
                    </span>
                    <span style={{ color: 'var(--text-3)' }}>{((f.valor / totalHoje) * 100).toFixed(0)}% · {fmt(f.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="dash-card-header">
            <div className="dash-card-title"><TrendingUp size={15} /> Mais vendidos esta semana</div>
          </div>
          {topSemana.length === 0 ? (
            <div className="empty" style={{ padding: '20px 0' }}><p>Sem vendas nos últimos 7 dias.</p></div>
          ) : topSemana.map((x, i: number) => (
            <div key={x.produto.id} className="top-row">
              <span className="top-rank">#{i + 1}</span>
              <span className="top-nome">{x.produto.nome}</span>
              <span className="top-qtd">{x.qtd} un.</span>
            </div>
          ))}
        </div>
      </div>
      <div className="dash-fab-spacer" />
    </div>
  );
}
