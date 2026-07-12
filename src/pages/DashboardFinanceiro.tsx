import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Dashboard.css';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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
          <div className="stat-label"><Wallet size={12} style={{ verticalAlign: -1 }} /> Saldo total</div>
          <div className="stat-value" style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotal)}</div>
          <div className="stat-sub">{contas.filter(c => c.ativa).length} conta(s) ativa(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingUp size={12} style={{ verticalAlign: -1 }} /> A receber (mês)</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: 20 }}>
            {fmt((resumo?.receber.totalPendente ?? 0) + (resumo?.receber.totalVencido ?? 0))}
          </div>
          <div className="stat-sub">{(resumo?.receber.qtdPendente ?? 0) + (resumo?.receber.qtdVencido ?? 0)} pendente(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingDown size={12} style={{ verticalAlign: -1 }} /> A pagar (mês)</div>
          <div className="stat-value" style={{ color: 'var(--yellow, #d97706)', fontSize: 20 }}>
            {fmt((resumo?.pagar.totalPendente ?? 0) + (resumo?.pagar.totalVencido ?? 0))}
          </div>
          <div className="stat-sub">{(resumo?.pagar.qtdPendente ?? 0) + (resumo?.pagar.qtdVencido ?? 0)} pendente(s)</div>
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