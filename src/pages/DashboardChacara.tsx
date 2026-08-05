import { useState, useEffect } from 'react';
import { Calendar, DollarSign, Clock, TrendingUp, BedDouble } from 'lucide-react';
import { api } from '../services/api';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Reserva = { id: number; clienteNome: string; dataInicio: string; dataFim: string; pessoas: number; valor: number; valorPago: number; saldoPendente: number };
type Pendente = { id: number; clienteNome: string; dataInicio: string; dataFim: string; valor: number; expiraEm: string };
type MesResumo = {
  ano: number; mes: number; qtdReservas: number;
  diasOcupados: number; diasNoMes: number;
  percentualOcupado: number; percentualLivre: number;
  receita: number; pago: number; pendente: number;
  qtdNegociacao: number; diasOcupadosNegociacao: number;
  percentualNegociacao: number; valorNegociacao: number;
};

type DadosDashboard = {
  totalReservas: number;
  totalPago: number;
  totalPendente: number;
  totalNegociacao: number;
  totalPendenteNegociacao: number;
  meses: MesResumo[];
  proximasReservas: Reserva[];
  pendentes: Pendente[];
  reservasEmNegociacao: Reserva[];
};

export function DashboardChacara() {
  const [dados, setDados] = useState<DadosDashboard | null>(null);

  useEffect(() => {
    api.get<DadosDashboard>('/api/chacara/dashboard?mesesAFrente=6').then(setDados).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chácara</h1>
          <p className="page-subtitle">Visão geral de aluguéis, pagamentos e ocupação</p>
        </div>
      </div>

      {/* Totais gerais */}
      <div className="dash-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label"><Calendar size={12} style={{ verticalAlign: -1 }} /> Total de aluguéis</div>
          <div className="stat-value">{(dados?.totalReservas ?? 0) + (dados?.totalNegociacao ?? 0)}</div>
          <div className="stat-sub">
            {dados?.totalReservas ?? 0} confirmado(s)
            {(dados?.totalNegociacao ?? 0) > 0 && <> · <span style={{ color: 'var(--accent)' }}>{dados?.totalNegociacao} em negociação</span></>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><DollarSign size={12} style={{ verticalAlign: -1 }} /> Total pago</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(dados?.totalPago ?? 0)}</div>
          <div className="stat-sub">já recebido</div>
        </div>
        <div className="stat-card" style={dados && dados.totalPendente > 0 ? { borderColor: 'rgba(251,191,36,0.3)' } : {}}>
          <div className="stat-label"><Clock size={12} style={{ verticalAlign: -1 }} /> Total pendente</div>
          <div className="stat-value" style={{ color: dados && dados.totalPendente > 0 ? 'var(--yellow)' : undefined }}>
            {fmt(dados?.totalPendente ?? 0)}
          </div>
          <div className="stat-sub">saldo a receber (confirmados)</div>
          {(dados?.totalPendenteNegociacao ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent)' }}>Em negociação</span>
              <strong style={{ color: 'var(--accent)' }}>{fmt(dados?.totalPendenteNegociacao ?? 0)}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="dash-chacara-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quebra mês a mês */}
          <div className="card">
            <div className="dash-card-header">
              <div className="dash-card-title"><TrendingUp size={15} /> Ocupação por mês</div>
            </div>
            {!dados || dados.meses.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}><p>Sem dados de meses.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dados.meses.map(m => {
                  const pctPago = m.diasNoMes > 0 ? (m.pago > 0 ? (m.diasOcupados / m.diasNoMes) * (m.pago / (m.pago + m.pendente || 1)) * 100 : 0) : 0;
                  const pctPendente = m.diasNoMes > 0 ? (m.percentualOcupado - pctPago) : 0;
                  return (
                    <div key={`${m.ano}-${m.mes}`} style={{
                      display: 'grid', gridTemplateColumns: '104px 1fr auto', alignItems: 'center', gap: 12,
                      padding: '8px 4px', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{MESES[m.mes - 1].slice(0, 3)} {m.ano}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          <BedDouble size={10} style={{ verticalAlign: -1, marginRight: 2 }} />
                          {m.diasOcupados}/{m.diasNoMes}d
                        </div>
                      </div>

                      <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                        {pctPago > 0 && <div style={{ height: '100%', width: `${pctPago}%`, background: 'var(--green)' }} title={`Pago: ${fmt(m.pago)}`} />}
                        {pctPendente > 0 && <div style={{ height: '100%', width: `${pctPendente}%`, background: 'var(--yellow, #d97706)' }} title={`Pendente: ${fmt(m.pendente)}`} />}
                        {m.percentualNegociacao > 0 && <div style={{ height: '100%', width: `${m.percentualNegociacao}%`, background: 'var(--accent)' }} title={`Em negociação: ${fmt(m.valorNegociacao)}`} />}
                      </div>

                      <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.5, minWidth: 92 }}>
                        <div style={{ color: 'var(--green)' }}>{fmt(m.pago)}</div>
                        {m.pendente > 0 && <div style={{ color: 'var(--yellow)' }}>{fmt(m.pendente)}</div>}
                        {m.valorNegociacao > 0 && <div style={{ color: 'var(--accent)' }}>{fmt(m.valorNegociacao)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Próximas reservas confirmadas */}
          <div className="card">
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
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(r.valor)}</div>
                      {r.saldoPendente > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--yellow)' }}>Falta {fmt(r.saldoPendente)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dados && dados.reservasEmNegociacao.length > 0 && (
            <div className="card">
              <div className="dash-card-header">
                <div className="dash-card-title" style={{ color: 'var(--accent)' }}><Calendar size={15} /> Reservas em Negociação</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dados.reservasEmNegociacao.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r.clienteNome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · {r.pessoas} pessoa(s)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(r.valor)}</div>
                      {r.saldoPendente > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--yellow)' }}>Falta {fmt(r.saldoPendente)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}