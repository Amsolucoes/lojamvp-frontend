import { Wallet, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Dashboard.css';

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

  useEffect(() => {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, []);

  useEffect(() => {
    const agora = new Date();
    api.get<any>(`/api/financeiro/resumo-mensal?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`)
      .then(setResumo).catch(() => {});
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