import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet, Menu, X, LogOut, HelpCircle, Settings } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { setMobileShellOverride } from '../utils/mobileShellOverride';
import { BankBadge } from '../utils/bancos';
import './FinanceiroMobile.css';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface Conta { id: string; nome: string; saldoAtual: number; ativa: boolean; banco?: string | null; limite: number; }
interface ResumoTipo { totalPago: number; qtdPago: number; totalPendente: number; qtdPendente: number; totalVencido: number; qtdVencido: number; }
interface Alerta { id: string; descricao: string; tipo: string; valor: number; vencimento: string; origem: string; }

const ABAS = [
  { key: 'visao', label: 'Visão geral', Icon: LayoutDashboard },
  { key: 'pagar', label: 'A Pagar', Icon: ArrowDownCircle },
  { key: 'receber', label: 'A Receber', Icon: ArrowUpCircle },
  { key: 'cartoes', label: 'Cartões', Icon: CreditCard },
  { key: 'contas', label: 'Contas', Icon: Wallet },
] as const;

export function FinanceiroMobile() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    setMobileShellOverride(true);
    return () => setMobileShellOverride(false);
  }, []);

  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<{ pagar: ResumoTipo; receber: ResumoTipo } | null>(null);
  const [resumoAnual, setResumoAnual] = useState<{ mes: number; pagar: number; receber: number; saldo: number }[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [mostrarMesAMes, setMostrarMesAMes] = useState(false);
  const anoRef = new Date().getFullYear();

  useEffect(() => {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
    api.get<any>(`/api/financeiro/resumo-mensal?ano=${anoRef}&mes=${new Date().getMonth() + 1}`).then(setResumo).catch(() => {});
    api.get<any[]>(`/api/financeiro/resumo-anual?ano=${anoRef}`).then(setResumoAnual).catch(() => {});
    api.get<Alerta[]>('/api/financeiro/alertas-vencimento?dias=7').then(setAlertas).catch(() => {});
  }, []);

  const saldoTotal = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);
  const pagarAberto = (resumo?.pagar.totalPendente ?? 0) + (resumo?.pagar.totalVencido ?? 0);
  const receberAberto = (resumo?.receber.totalPendente ?? 0) + (resumo?.receber.totalVencido ?? 0);
  const totalVencidoQtd = (resumo?.pagar.qtdVencido ?? 0) + (resumo?.receber.qtdVencido ?? 0);
  const totalVencidoValor = (resumo?.pagar.totalVencido ?? 0) + (resumo?.receber.totalVencido ?? 0);

  const anoPago = resumoAnual.reduce((s, m) => s + m.pagar, 0);
  const anoRecebido = resumoAnual.reduce((s, m) => s + m.receber, 0);
  const anoSaldo = anoRecebido - anoPago;

  const proximos = alertas.slice(0, 4);

  function irPara(tela: typeof ABAS[number]['key']) {
    if (tela === 'visao') return;
    if (tela === 'pagar' || tela === 'receber') { navigate(`/financeiro?aba=${tela}`); return; }
    navigate('/financeiro'); // Cartões/Contas: fase 4/5 — por ora usa os botoes do topo daquela tela
  }

  return (
    <div className="fm-shell">
      <div className="fm-topbar">
        <div>
          <h1 className="fm-titulo">Financeiro</h1>
          <p className="fm-subtitulo">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="btn-ghost" onClick={() => setMenuAberto(true)}><Menu size={22} /></button>
      </div>

      <div className="fm-content">
        <div className="card fm-card">
          <div className="fm-card-kicker">Saldo por conta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {contas.filter(c => c.ativa).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BankBadge bancoId={c.banco} tamanho={16} /> {c.nome}
                </span>
                <strong style={{ color: c.saldoAtual >= 0 ? 'var(--text-1)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>Total</span>
              <strong style={{ color: saldoTotal >= 0 ? 'var(--text-1)' : 'var(--red)' }}>{fmt(saldoTotal)}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
          <div className="card fm-card">
            <div className="fm-card-kicker">A pagar</div>
            <div className="fm-valor-destaque">{fmt(pagarAberto)}</div>
            <div className="fm-card-meta">{resumo?.pagar.qtdPendente ?? 0} lançamento(s)</div>
          </div>
          <div className="card fm-card">
            <div className="fm-card-kicker">A receber</div>
            <div className="fm-valor-destaque">{fmt(receberAberto)}</div>
            <div className="fm-card-meta">{resumo?.receber.qtdPendente ?? 0} lançamento(s)</div>
          </div>
        </div>

        {totalVencidoQtd > 0 && (
          <div className="card fm-card" style={{ borderColor: 'rgba(248,113,113,0.4)', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>Vencidos</span>
              <span className="badge badge-red">{fmt(totalVencidoValor)}</span>
            </div>
          </div>
        )}

        <div className="card fm-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="fm-card-kicker">Resumo do ano · {anoRef}</div>
            <button className="fm-link-btn" onClick={() => setMostrarMesAMes(v => !v)}>
              {mostrarMesAMes ? 'Ocultar mês a mês' : 'Ver mês a mês'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <div className="fm-label-fraco">Pago no ano</div>
              <div className="fm-valor-medio">{fmt(anoPago)}</div>
            </div>
            <div>
              <div className="fm-label-fraco">Recebido no ano</div>
              <div className="fm-valor-medio">{fmt(anoRecebido)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>Saldo do ano</span>
            <strong style={{ color: anoSaldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(anoSaldo)}</strong>
          </div>
          {mostrarMesAMes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {resumoAnual.map(m => {
                const saldo = m.receber - m.pagar;
                return (
                  <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-2)', textTransform: 'capitalize', width: 40 }}>{MESES_ABREV[m.mes - 1]}</span>
                    <span style={{ color: 'var(--green)' }}>{fmt(m.receber)}</span>
                    <span style={{ color: 'var(--text-3)' }}>−</span>
                    <span style={{ color: 'var(--red)' }}>{fmt(m.pagar)}</span>
                    <strong style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)', minWidth: 74, textAlign: 'right' }}>
                      {saldo >= 0 ? '+' : ''}{fmt(saldo)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <h3 className="fm-secao-titulo">Próximos vencimentos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {proximos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nada vencendo nos próximos dias.</p>
          ) : proximos.map(p => (
            <div key={p.id} className="card fm-card-linha">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(p.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
              </div>
              <div style={{ fontSize: 14, color: p.tipo === 'pagar' ? 'var(--red)' : 'var(--green)', whiteSpace: 'nowrap' }}>
                {fmt(p.valor)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="bottom-nav">
        {ABAS.map(({ key, label, Icon }) => (
          <button key={key} className={`bottom-nav-item${key === 'visao' ? ' active' : ''}`} onClick={() => irPara(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {menuAberto && (
        <div className="modal-overlay" onClick={() => setMenuAberto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}>Menu</span>
              <button className="btn-ghost" onClick={() => setMenuAberto(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="sidebar-link" onClick={() => { setMenuAberto(false); navigate('/ajuda'); }}>
                <HelpCircle size={16} /> <span>Central de Ajuda</span>
              </button>
              <button className="sidebar-link" onClick={() => { setMenuAberto(false); navigate('/configuracoes'); }}>
                <Settings size={16} /> <span>Configurações</span>
              </button>
              <button className="sidebar-link" onClick={logout} style={{ marginTop: 8, color: 'var(--red)' }}>
                <LogOut size={16} /> <span>Sair ({usuario?.nome})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}