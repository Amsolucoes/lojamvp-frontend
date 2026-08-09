import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet, Menu, X, LogOut, HelpCircle, Settings, Plus, Check } from 'lucide-react';
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
interface LinhaPagar {
  id: string; descricao: string; observacao?: string | null;
  categoriaNome: string | null; contaBancariaId: string | null;
  modo: string; valor: number; vencimento: string; status: string;
  numeroParcela: number | null; totalParcelas: number | null;
  origem: string; cartaoId: string | null; cartaoNome: string | null;
}
interface Categoria { id: string; nome: string; tipo: string; icone: string | null; }

function ehVencido(l: { status: string; vencimento: string }) {
  if (!l.vencimento) return false;
  return l.status === 'pendente' && new Date(l.vencimento) < new Date(new Date().toDateString());
}
function agruparPorData<T extends { vencimento: string }>(lista: T[]) {
  const grupos: Record<string, T[]> = {};
  lista.forEach(l => {
    const chave = l.vencimento ? l.vencimento.slice(0, 10) : 'sem-data';
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(l);
  });
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

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
  const [tela, setTela] = useState<'visao' | 'pagar'>('visao');
  const [linhasPagar, setLinhasPagar] = useState<LinhaPagar[]>([]);
  const [categoriasPagar, setCategoriasPagar] = useState<Categoria[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'vencido' | 'pago'>('todos');
  const [catFiltro, setCatFiltro] = useState('todas');

  useEffect(() => {
    setMobileShellOverride(true);
    return () => setMobileShellOverride(false);
  }, []);

  useEffect(() => {
    if (tela !== 'pagar') return;
    const agora = new Date();
    api.get<LinhaPagar[]>(`/api/financeiro/pagar-unificado?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}&modo=agrupado`)
      .then(setLinhasPagar).catch(() => {});
    api.get<Categoria[]>('/api/financeiro/categorias').then(cats => setCategoriasPagar(cats.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos'))).catch(() => {});
  }, [tela]);

  async function marcarPagamentoLocal(l: LinhaPagar, pago: boolean) {
    const ehCartao = l.origem === 'cartao_fatura' || l.origem === 'cartao_item' || l.origem === 'cartao_fatura_financiada';
    try {
      if (ehCartao && l.cartaoId) {
        const agora = new Date();
        await api.post(`/api/financeiro/cartoes/${l.cartaoId}/fatura/pagamento?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`, { modo: pago ? 'total' : 'desfazer' });
      } else {
        await api.post(`/api/financeiro/lancamentos/${l.id}/pagamento`, { pago });
      }
      const agora = new Date();
      api.get<LinhaPagar[]>(`/api/financeiro/pagar-unificado?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}&modo=agrupado`).then(setLinhasPagar).catch(() => {});
    } catch {}
  }

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

  function irPara(destino: typeof ABAS[number]['key']) {
    if (destino === 'visao' || destino === 'pagar') { setTela(destino); return; }
    if (destino === 'receber') { navigate('/financeiro?aba=receber'); return; }
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
      {tela === 'visao' && (
      <>
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
      </>
      )}

      {tela === 'pagar' && (
        <>
          <div className="fm-pills">
            {(['todos', 'pendente', 'vencido', 'pago'] as const).map(f => (
              <button key={f} className={`fm-pill${filtroStatus === f ? ' active' : ''}`} onClick={() => setFiltroStatus(f)}>
                {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendente' : f === 'vencido' ? 'Vencido' : 'Pago'}
              </button>
            ))}
          </div>
          {categoriasPagar.length > 0 && (
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="todas">Todas categorias</option>
              {categoriasPagar.map(c => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          )}

          {(() => {
            const filtrada = linhasPagar.filter(l => {
              const catOk = catFiltro === 'todas' || l.categoriaNome === catFiltro;
              const statusReal = ehVencido(l) ? 'vencido' : l.status;
              const statusOk = filtroStatus === 'todos' || statusReal === filtroStatus;
              return catOk && statusOk;
            });
            if (filtrada.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nada encontrado com esse filtro.</p>;
            return agruparPorData(filtrada).map(([dia, itens]) => (
              <div key={dia} style={{ marginBottom: 12 }}>
                <div className="fm-dia-header">
                  <span>{dia !== 'sem-data' ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Sem data'}</span>
                  <strong>{fmt(itens.reduce((s, i) => s + i.valor, 0))}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map(l => {
                    const status = ehVencido(l) ? 'vencido' : l.status;
                    return (
                      <div key={l.id} className="card fm-card-linha" onClick={() => marcarPagamentoLocal(l, l.status !== 'pago')} style={{ cursor: 'pointer' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{l.descricao}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                            {l.categoriaNome && <span className="fm-tag-neutra">{l.categoriaNome}</span>}
                            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{new Date(l.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{fmt(l.valor)}</div>
                          <span className={`badge badge-${status === 'pago' ? 'green' : status === 'vencido' ? 'red' : 'yellow'}`} style={{ fontSize: 10 }}>
                            {status === 'pago' ? 'Pago' : status === 'vencido' ? 'Vencido' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </>
      )}
      </div>

      <nav className="bottom-nav">
        {ABAS.slice(0, 2).map(({ key, label, Icon }) => (
          <button key={key} className={`bottom-nav-item${key === tela ? ' active' : ''}`} onClick={() => irPara(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        {tela === 'pagar' && (
          <button className="bottom-nav-fab" style={{ background: 'var(--red-bg)', borderColor: 'var(--red)', color: 'var(--red)' }}
            onClick={() => navigate('/financeiro?aba=pagar&novo=pagar')}>
            <Plus size={18} />
          </button>
        )}
        {ABAS.slice(2).map(({ key, label, Icon }) => (
          <button key={key} className={`bottom-nav-item${key === tela ? ' active' : ''}`} onClick={() => irPara(key)}>
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