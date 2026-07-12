import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight, CreditCard, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Dashboard.css';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Alerta {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  vencimento: string;
  origem: string;
}

interface CartaoResumo {
  id: string;
  nome: string;
  limite: number;
  usado: number;
  disponivel: number;
  vencimentoAtual: string;
  status: string;
}

function diasAte(dataStr: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const data = new Date(dataStr); data.setHours(0,0,0,0);
  return Math.round((data.getTime() - hoje.getTime()) / 86400000);
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Conta {
  id: string;
  nome: string;
  saldoAtual: number;
  ativa: boolean;
}

interface ResumoTipo {
  totalPago: number;
  qtdPago: number;
  totalPendente: number;
  qtdPendente: number;
  totalVencido: number;
  qtdVencido: number;
}

export function DashboardFinanceiro() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<{ pagar: ResumoTipo; receber: ResumoTipo } | null>(null);
  const [anoRef, setAnoRef] = useState(new Date().getFullYear());
  const [resumoAnual, setResumoAnual] = useState<{ mes: number; pagar: number; receber: number; saldo: number }[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cartoesResumo, setCartoesResumo] = useState<CartaoResumo[]>([]);

  useEffect(() => {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, []);

  useEffect(() => {
    const agora = new Date();
    api.get<any>(`/api/financeiro/resumo-mensal?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`)
      .then(setResumo).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<any[]>(`/api/financeiro/resumo-anual?ano=${anoRef}`).then(setResumoAnual).catch(() => {});
  }, [anoRef]);

  useEffect(() => {
    api.get<Alerta[]>('/api/financeiro/alertas-vencimento?dias=7').then(setAlertas).catch(() => {});
    api.get<CartaoResumo[]>('/api/financeiro/cartoes-resumo').then(setCartoesResumo).catch(() => {});
  }, []);

  const saldoTotal = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);
  const mesAtualLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{mesAtualLabel}</p>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-label"><Wallet size={12} style={{ verticalAlign: -1 }} /> Saldo por conta</div>
          {contas.filter(c => c.ativa).length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {contas.filter(c => c.ativa).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 2 }}>
                  <span style={{ color: 'var(--text-2)' }}>{c.nome}</span>
                  <strong style={{ color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>Total</span>
                <strong style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotal)}</strong>
              </div>
            </div>
          ) : (
            <div className="stat-value" style={{ fontSize: 20 }}>{fmt(0)}</div>
          )}
        </div>
        {(resumo as any)?.previsao && (
          <div className="stat-card" style={{ borderColor: (resumo as any).previsao.saldoPrevisto >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)' }}>
            <div className="stat-label">Previsão do mês</div>
            <div className="stat-value" style={{ color: (resumo as any).previsao.saldoPrevisto >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {(resumo as any).previsao.saldoPrevisto >= 0 ? '+' : ''}{fmt((resumo as any).previsao.saldoPrevisto)}
            </div>
            <div className="stat-sub">se tudo for pago/recebido</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label"><TrendingUp size={12} style={{ verticalAlign: -1 }} /> A receber (mês)</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: 20 }}>
            {fmt((resumo?.receber.totalPendente ?? 0) + (resumo?.receber.totalVencido ?? 0))}
          </div>
          <div className="stat-sub">{(resumo?.receber.qtdPendente ?? 0) + (resumo?.receber.qtdVencido ?? 0)} pendente(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingDown size={12} style={{ verticalAlign: -1 }} /> A pagar (mês)</div>
          {(resumo as any)?.detalhePagar ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-2)' }}>Contas</span>
                <strong style={{ color: 'var(--yellow, #d97706)' }}>{fmt((resumo as any).detalhePagar.lancamentos)}</strong>
              </div>
              {(resumo as any).detalhePagar.cartoes.map((c: any) => (
                <div key={c.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 2 }}>
                  <span style={{ color: 'var(--text-2)' }}>💳 {c.nome}</span>
                  <strong style={{ color: 'var(--yellow, #d97706)' }}>{fmt(c.valor)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>Total</span>
                <strong>{fmt((resumo?.pagar.totalPendente ?? 0) + (resumo?.pagar.totalVencido ?? 0))}</strong>
              </div>
            </div>
          ) : (
            <>
              <div className="stat-value" style={{ color: 'var(--yellow, #d97706)', fontSize: 20 }}>
                {fmt((resumo?.pagar.totalPendente ?? 0) + (resumo?.pagar.totalVencido ?? 0))}
              </div>
              <div className="stat-sub">{(resumo?.pagar.qtdPendente ?? 0) + (resumo?.pagar.qtdVencido ?? 0)} pendente(s)</div>
            </>
          )}
        </div>
        {((resumo?.pagar.qtdVencido ?? 0) + (resumo?.receber.qtdVencido ?? 0)) > 0 && (
          <div className="stat-card" style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
            <div className="stat-label"><AlertTriangle size={12} style={{ verticalAlign: -1 }} /> Vencido</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>
              {(resumo?.pagar.qtdVencido ?? 0) + (resumo?.receber.qtdVencido ?? 0)}
            </div>
            <div className="stat-sub">conta(s) atrasada(s)</div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dash-card-header" style={{ justifyContent: 'space-between' }}>
          <div className="dash-card-title"><TrendingUp size={15} /> Resumo do ano</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setAnoRef(a => a - 1)} style={{ padding: '4px 8px' }}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 600 }}>{anoRef}</span>
            <button className="btn-secondary" onClick={() => setAnoRef(a => a + 1)} style={{ padding: '4px 8px' }}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Gráfico de barras — receita x despesa por mês */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '16px 8px 8px', overflowX: 'auto' }}>
          {(() => {
            const max = Math.max(...resumoAnual.map(m => Math.max(m.pagar, m.receber)), 1);
            return resumoAnual.map(m => (
              <div key={m.mes} style={{ flex: '1 0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                  <div title={`Receitas: ${fmt(m.receber)}`} style={{ width: 10, borderRadius: '3px 3px 0 0', background: 'var(--green)', height: `${(m.receber / max) * 100}%`, minHeight: m.receber > 0 ? 3 : 0 }} />
                  <div title={`Despesas: ${fmt(m.pagar)}`} style={{ width: 10, borderRadius: '3px 3px 0 0', background: 'var(--red)', height: `${(m.pagar / max) * 100}%`, minHeight: m.pagar > 0 ? 3 : 0 }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{MESES_ABREV[m.mes - 1]}</span>
              </div>
            ));
          })()}
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--green)', marginRight: 4 }} />Receitas</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--red)', marginRight: 4 }} />Despesas</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr>
            </thead>
            <tbody>
              {resumoAnual.map(m => (
                <tr key={m.mes}>
                  <td>{MESES_ABREV[m.mes - 1]}</td>
                  <td style={{ color: 'var(--green)' }}>{fmt(m.receber)}</td>
                  <td style={{ color: 'var(--red)' }}>{fmt(m.pagar)}</td>
                  <td style={{ fontWeight: 600, color: m.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {m.saldo >= 0 ? '+' : ''}{fmt(m.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(251,191,36,0.3)' }}>
          <div className="dash-card-header">
            <div className="dash-card-title" style={{ color: 'var(--yellow, #d97706)' }}><Clock size={15} /> Vencendo em breve</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertas.map(a => {
              const d = diasAte(a.vencimento);
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.descricao}</div>
                    <div style={{ fontSize: 11, color: d <= 1 ? 'var(--red)' : 'var(--text-3)' }}>
                      {d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, color: a.tipo === 'pagar' ? 'var(--red)' : 'var(--green)' }}>{fmt(a.valor)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cartoesResumo.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="dash-card-header">
            <div className="dash-card-title"><CreditCard size={15} /> Cartões de crédito</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {cartoesResumo.map(c => {
              const pct = c.limite > 0 ? Math.min(100, (c.usado / c.limite) * 100) : 0;
              return (
                <div key={c.id} className="stat-card">
                  <div className="stat-label">{c.nome}</div>
                  <div className="stat-value" style={{ fontSize: 16 }}>{fmt(c.usado)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>/ {fmt(c.limite)}</span></div>
                  <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow, #d97706)' : 'var(--green)', borderRadius: 3 }} />
                  </div>
                  <div className="stat-sub" style={{ marginTop: 6 }}>
                    Fatura atual vence {new Date(c.vencimentoAtual).toLocaleDateString('pt-BR')}
                    {c.status === 'pago' && <span style={{ color: 'var(--green)' }}> · Paga</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="dash-card-header">
          <div className="dash-card-title"><Wallet size={15} /> Contas bancárias</div>
        </div>
        {contas.length === 0 ? (
          <div className="empty" style={{ padding: '30px 0' }}>
            <p>Nenhuma conta cadastrada ainda.</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Acesse Financeiro para criar sua primeira conta.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {contas.map(c => (
              <div key={c.id} className="stat-card" style={{ opacity: c.ativa ? 1 : 0.5 }}>
                <div className="stat-label">{c.nome}</div>
                <div className="stat-value" style={{ fontSize: 18, color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmt(c.saldoAtual)}
                </div>
                {!c.ativa && <div className="stat-sub">Inativa</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}