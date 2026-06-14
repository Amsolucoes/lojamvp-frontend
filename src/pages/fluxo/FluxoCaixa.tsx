import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './FluxoCaixa.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDia(date: Date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function FluxoCaixa() {
  const { vendas } = useApp();
  const hoje = new Date();

  const [aba, setAba]       = useState<'diario' | 'mensal'>('diario');
  const [mesRef, setMesRef] = useState(hoje.getMonth());
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());

  const diasDoMes = new Date(anoRef, mesRef + 1, 0).getDate();

  const diasFluxo = Array.from({ length: diasDoMes }, (_, i) => {
    const dia    = new Date(anoRef, mesRef, i + 1);
    const diaStr = dia.toDateString();
    const vendasDia = vendas.filter(v => new Date(v.criadaEm).toDateString() === diaStr);
    return {
      dia,
      label: `${String(i + 1).padStart(2, '0')}/${String(mesRef + 1).padStart(2, '0')}`,
      entradas:  vendasDia.reduce((s, v) => s + v.totalFinal, 0),
      descontos: vendasDia.reduce((s, v) => s + v.desconto, 0),
      qtdVendas: vendasDia.length,
      isHoje:   diaStr === hoje.toDateString(),
      isFuturo: dia > hoje,
    };
  });

  const totalEntMes   = diasFluxo.reduce((s, d) => s + d.entradas, 0);
  const totalDescMes  = diasFluxo.reduce((s, d) => s + d.descontos, 0);
  const diasComVenda  = diasFluxo.filter(d => d.qtdVendas > 0).length;
  const mediaVendaDia = diasComVenda > 0 ? totalEntMes / diasComVenda : 0;
  const maxDia        = Math.max(...diasFluxo.map(d => d.entradas), 1);

  const mesesFluxo = Array.from({ length: 12 }, (_, m) => {
    const vendasMes = vendas.filter(v => {
      const d = new Date(v.criadaEm);
      return d.getFullYear() === anoRef && d.getMonth() === m;
    });
    return {
      mes: m, label: MESES[m].slice(0, 3),
      entradas:  vendasMes.reduce((s, v) => s + v.totalFinal, 0),
      descontos: vendasMes.reduce((s, v) => s + v.desconto, 0),
      qtdVendas: vendasMes.length,
    };
  });

  const totalEntAno  = mesesFluxo.reduce((s, m) => s + m.entradas, 0);
  const totalDescAno = mesesFluxo.reduce((s, m) => s + m.descontos, 0);
  const maxMes       = Math.max(...mesesFluxo.map(m => m.entradas), 1);

  function navMes(delta: number) {
    let nm = mesRef + delta, na = anoRef;
    if (nm < 0)  { nm = 11; na--; }
    if (nm > 11) { nm = 0;  na++; }
    setMesRef(nm); setAnoRef(na);
  }

  function navAno(delta: number) { setAnoRef(a => a + delta); }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Entradas e movimentações financeiras</p>
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${aba === 'diario' ? ' active' : ''}`} onClick={() => setAba('diario')}>
            <Calendar size={13} /> Diário
          </button>
          <button className={`cat-tab${aba === 'mensal' ? ' active' : ''}`} onClick={() => setAba('mensal')}>
            <TrendingUp size={13} /> Mensal
          </button>
        </div>
      </div>

      {/* ── DIÁRIO ── */}
      {aba === 'diario' && (
        <>
          <div className="fc-nav">
            <button className="btn-secondary fc-nav-btn" onClick={() => navMes(-1)}><ChevronLeft size={16} /></button>
            <span className="fc-nav-label">{MESES[mesRef]} {anoRef}</span>
            <button className="btn-secondary fc-nav-btn" onClick={() => navMes(1)}><ChevronRight size={16} /></button>
          </div>

          <div className="fc-stats">
            <div className="stat-card">
              <div className="stat-label"><TrendingUp size={12} style={{ verticalAlign: -1 }} /> Total do mês</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(totalEntMes)}</div>
              <div className="stat-sub">{diasFluxo.filter(d => d.qtdVendas > 0).reduce((s, d) => s + d.qtdVendas, 0)} vendas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><DollarSign size={12} style={{ verticalAlign: -1 }} /> Média por dia</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(mediaVendaDia)}</div>
              <div className="stat-sub">{diasComVenda} dia(s) com vendas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><TrendingDown size={12} style={{ verticalAlign: -1 }} /> Descontos</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>{fmt(totalDescMes)}</div>
              <div className="stat-sub">no mês</div>
            </div>
          </div>

          {/* Gráfico diário melhorado */}
          <div className="card fc-chart-card">
            <div className="fc-chart-title">Vendas por dia — {MESES[mesRef]} {anoRef}</div>
            <div className="fc-chart">
              {diasFluxo.map(d => (
                <div key={d.label} className={`fc-col${d.isHoje ? ' hoje' : ''}${d.isFuturo ? ' futuro' : ''}`}>
                  <div className="fc-col-valor">
                    {d.entradas > 0 && <span className="fc-col-tip">{fmt(d.entradas)}</span>}
                    <div className="fc-bar"
                      style={{ height: `${Math.max(d.entradas > 0 ? 4 : 0, (d.entradas / maxDia) * 100)}%` }} />
                  </div>
                  <div className="fc-col-label">{d.dia.getDate()}</div>
                  {d.isHoje && <div className="fc-hoje-dot" />}
                </div>
              ))}
            </div>
          </div>

          {/* Tabela diária — desktop */}
          <div className="card fc-table-desktop" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Dia</th><th>Qtd. vendas</th><th>Descontos</th><th>Entradas</th><th>Barra</th></tr>
                </thead>
                <tbody>
                  {diasFluxo.filter(d => d.qtdVendas > 0).map(d => (
                    <tr key={d.label} style={d.isHoje ? { background: 'var(--accent-bg)' } : {}}>
                      <td>
                        <span style={{ fontWeight: d.isHoje ? 600 : 400 }}>
                          {fmtDia(d.dia)}
                          {d.isHoje && <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>Hoje</span>}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{d.qtdVendas}</td>
                      <td style={{ color: 'var(--red)', fontSize: 13 }}>{d.descontos > 0 ? `− ${fmt(d.descontos)}` : '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(d.entradas)}</td>
                      <td style={{ width: 120 }}>
                        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: 'var(--green)', width: `${(d.entradas / maxDia) * 100}%`, opacity: 0.8 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {diasFluxo.filter(d => d.qtdVendas > 0).length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0' }}>Nenhuma venda neste mês.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards mobile — dias */}
          <div className="fc-cards-mobile" style={{ marginTop: 16 }}>
            {diasFluxo.filter(d => d.qtdVendas > 0).length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>Nenhuma venda neste mês.</div>
            ) : diasFluxo.filter(d => d.qtdVendas > 0).map(d => (
              <div key={d.label} className="fc-card-mobile" style={d.isHoje ? { background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' } : {}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDia(d.dia)}</span>
                    {d.isHoje && <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>Hoje</span>}
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(d.entradas)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                  <span>{d.qtdVendas} venda(s)</span>
                  {d.descontos > 0 && <span style={{ color: 'var(--red)' }}>− {fmt(d.descontos)} desc.</span>}
                </div>
                <div style={{ marginTop: 8, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--green)', width: `${(d.entradas / maxDia) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── MENSAL ── */}
      {aba === 'mensal' && (
        <>
          <div className="fc-nav">
            <button className="btn-secondary fc-nav-btn" onClick={() => navAno(-1)}><ChevronLeft size={16} /></button>
            <span className="fc-nav-label">{anoRef}</span>
            <button className="btn-secondary fc-nav-btn" onClick={() => navAno(1)}><ChevronRight size={16} /></button>
          </div>

          <div className="fc-stats">
            <div className="stat-card">
              <div className="stat-label"><TrendingUp size={12} style={{ verticalAlign: -1 }} /> Total do ano</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(totalEntAno)}</div>
              <div className="stat-sub">{mesesFluxo.reduce((s, m) => s + m.qtdVendas, 0)} vendas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Melhor mês</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                {mesesFluxo.reduce((best, m) => m.entradas > best.entradas ? m : best, mesesFluxo[0]).label}
              </div>
              <div className="stat-sub">{fmt(Math.max(...mesesFluxo.map(m => m.entradas)))}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><TrendingDown size={12} style={{ verticalAlign: -1 }} /> Descontos no ano</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>{fmt(totalDescAno)}</div>
              <div className="stat-sub">total concedido</div>
            </div>
          </div>

          {/* Gráfico mensal melhorado */}
          <div className="card fc-chart-card">
            <div className="fc-chart-title">Vendas por mês — {anoRef}</div>
            <div className="fc-chart fc-chart-mensal">
              {mesesFluxo.map(m => {
                const isMesAtual = m.mes === hoje.getMonth() && anoRef === hoje.getFullYear();
                const isFuturo   = anoRef > hoje.getFullYear() || (anoRef === hoje.getFullYear() && m.mes > hoje.getMonth());
                return (
                  <div key={m.mes} className={`fc-col${isMesAtual ? ' hoje' : ''}${isFuturo ? ' futuro' : ''}`}>
                    <div className="fc-col-valor">
                      {m.entradas > 0 && <span className="fc-col-tip">{fmt(m.entradas)}</span>}
                      <div className="fc-bar"
                        style={{ height: `${Math.max(m.entradas > 0 ? 4 : 0, (m.entradas / maxMes) * 100)}%` }} />
                    </div>
                    <div className="fc-col-label">{m.label}</div>
                    {isMesAtual && <div className="fc-hoje-dot" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela mensal — desktop */}
          <div className="card fc-table-desktop" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Mês</th><th>Vendas</th><th>Descontos</th><th>Entradas</th><th>Barra</th></tr>
                </thead>
                <tbody>
                  {mesesFluxo.map(m => {
                    const isMesAtual = m.mes === hoje.getMonth() && anoRef === hoje.getFullYear();
                    return (
                      <tr key={m.mes} style={isMesAtual ? { background: 'var(--accent-bg)' } : {}}>
                        <td>
                          <span style={{ fontWeight: isMesAtual ? 600 : 400 }}>
                            {MESES[m.mes]}
                            {isMesAtual && <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>Atual</span>}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{m.qtdVendas}</td>
                        <td style={{ color: 'var(--red)', fontSize: 13 }}>{m.descontos > 0 ? `− ${fmt(m.descontos)}` : '—'}</td>
                        <td style={{ fontWeight: 600, color: m.entradas > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                          {m.entradas > 0 ? fmt(m.entradas) : '—'}
                        </td>
                        <td style={{ width: 120 }}>
                          <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: 'var(--green)', width: `${(m.entradas / maxMes) * 100}%`, opacity: 0.8 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards mobile — meses */}
          <div className="fc-cards-mobile" style={{ marginTop: 16 }}>
            {mesesFluxo.map(m => {
              const isMesAtual = m.mes === hoje.getMonth() && anoRef === hoje.getFullYear();
              return (
                <div key={m.mes} className="fc-card-mobile"
                  style={isMesAtual ? { background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{MESES[m.mes]}</span>
                      {isMesAtual && <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>Atual</span>}
                    </div>
                    <span style={{ fontWeight: 700, color: m.entradas > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                      {m.entradas > 0 ? fmt(m.entradas) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                    <span>{m.qtdVendas} venda(s)</span>
                    {m.descontos > 0 && <span style={{ color: 'var(--red)' }}>− {fmt(m.descontos)} desc.</span>}
                  </div>
                  {m.entradas > 0 && (
                    <div style={{ marginTop: 8, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: 'var(--green)', width: `${(m.entradas / maxMes) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}