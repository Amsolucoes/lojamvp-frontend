import { useState, useEffect } from 'react';
import { Calendar, DollarSign, BedDouble, Clock } from 'lucide-react';
import { api } from '../services/api';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 15, label: '15 dias' },
  { dias: 30, label: '1 mês' },
  { dias: 90, label: '3 meses' },
];

type Reserva = { id: number; clienteNome: string; dataInicio: string; dataFim: string; pessoas: number; valor: number };
type Pendente = Reserva & { expiraEm: string };

type DadosDashboard = {
  proximasReservas: Reserva[];
  receitaPeriodo: number;
  reservasNoPeriodo: number;
  diasReservados: number;
  diasPeriodo: number;
  pendentes: Pendente[];
};

export function DashboardChacara() {
  const [periodo, setPeriodo] = useState(15);
  const [dados, setDados] = useState<DadosDashboard | null>(null);

  useEffect(() => {
    api.get<DadosDashboard>(`/api/chacara/dashboard?dias=${periodo}`).then(setDados).catch(() => {});
  }, [periodo]);

  const ocupacaoPct = dados ? Math.min(100, Math.round((dados.diasReservados / dados.diasPeriodo) * 100)) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chácara</h1>
          <p className="page-subtitle">Reservas e ocupação</p>
        </div>
      </div>

      <div className="cx-tipo-toggle" style={{ marginBottom: 20 }}>
        {PERIODOS.map(p => (
          <button key={p.dias} className={periodo === p.dias ? 'active' : ''} onClick={() => setPeriodo(p.dias)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="dash-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label"><DollarSign size={12} style={{ verticalAlign: -1 }} /> Receita do período</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(dados?.receitaPeriodo ?? 0)}</div>
          <div className="stat-sub">{dados?.reservasNoPeriodo ?? 0} reserva(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><BedDouble size={12} style={{ verticalAlign: -1 }} /> Ocupação</div>
          <div className="stat-value">{ocupacaoPct}%</div>
          <div className="stat-sub">{dados?.diasReservados ?? 0} de {dados?.diasPeriodo ?? periodo} dias</div>
        </div>
        <div className="stat-card" style={dados && dados.pendentes.length > 0 ? { borderColor: 'rgba(251,191,36,0.3)' } : {}}>
          <div className="stat-label"><Clock size={12} style={{ verticalAlign: -1 }} /> Pendentes de pagamento</div>
          <div className="stat-value" style={dados && dados.pendentes.length > 0 ? { color: 'var(--yellow)' } : {}}>
            {dados?.pendentes.length ?? 0}
          </div>
          <div className="stat-sub">aguardando confirmação</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dash-card-header">
          <div className="dash-card-title"><Calendar size={15} /> Próximas reservas confirmadas</div>
        </div>
        {!dados || dados.proximasReservas.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}><p>Nenhuma reserva confirmada por enquanto.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.proximasReservas.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{r.clienteNome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · {r.pessoas} pessoa(s)</div>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(r.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {dados && dados.pendentes.length > 0 && (
        <div className="card">
          <div className="dash-card-header">
            <div className="dash-card-title" style={{ color: 'var(--yellow)' }}><Clock size={15} /> Aguardando pagamento</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.pendentes.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{p.clienteNome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtData(p.dataInicio)} — {fmtData(p.dataFim)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{fmt(p.valor)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>expira {new Date(p.expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}