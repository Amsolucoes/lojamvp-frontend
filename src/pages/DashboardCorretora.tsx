import { useState, useEffect } from 'react';
import { FileText, Users, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PERIODOS = [
  { dias: 1, label: '24 horas' },
  { dias: 7, label: '7 dias' },
  { dias: 15, label: '15 dias' },
  { dias: 30, label: '1 mês' },
];

export function DashboardCorretora() {
  const [periodo, setPeriodo] = useState(15);
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    api.get<any>(`/api/corretora/dashboard?dias=${periodo}`).then(setDados).catch(() => {});
  }, [periodo]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Corretora</h1>
          <p className="page-subtitle">Funil e propostas</p>
        </div>
      </div>

      <div className="cx-tipo-toggle" style={{ marginBottom: 20 }}>
        {PERIODOS.map(p => (
          <button key={p.dias} className={periodo === p.dias ? 'active' : ''} onClick={() => setPeriodo(p.dias)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dash-card-header">
          <div className="dash-card-title"><FileText size={15} /> Propostas em andamento</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-label"><FileText size={12} style={{ verticalAlign: -1 }} /> Propostas</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{dados?.emAndamento.propostas ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><Users size={12} style={{ verticalAlign: -1 }} /> Total de vidas</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{dados?.emAndamento.vidas ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><DollarSign size={12} style={{ verticalAlign: -1 }} /> Valor total</div>
            <div className="stat-value" style={{ fontSize: 22, color: 'var(--accent)' }}>{fmt(dados?.emAndamento.valorTotal ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="dash-card-header">
          <div className="dash-card-title" style={{ color: 'var(--green)' }}><FileText size={15} /> Propostas implantadas</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-label"><FileText size={12} style={{ verticalAlign: -1 }} /> Propostas</div>
            <div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{dados?.implantadas.propostas ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><Users size={12} style={{ verticalAlign: -1 }} /> Total de vidas</div>
            <div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{dados?.implantadas.vidas ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><DollarSign size={12} style={{ verticalAlign: -1 }} /> Valor total</div>
            <div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{fmt(dados?.implantadas.valorTotal ?? 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}