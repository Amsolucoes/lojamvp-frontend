import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../../services/api';
import { BankBadge } from '../../utils/bancos';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface ItemCategoria { nome: string; icone: string; valor: number; }
interface Balanco {
  receitas: ItemCategoria[];
  despesas: ItemCategoria[];
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}
interface Conta {
  id: string; nome: string; saldoAtual: number; banco?: string | null; ativa: boolean;
}

// Paleta consistente por categoria (rotação simples)
const CORES = ['#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#06b6d4'];
function corPara(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return CORES[Math.abs(hash) % CORES.length];
}

export function BalancoMensal() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(hoje.getMonth());
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());
  const [aba, setAba] = useState<'categoria' | 'conta'>('categoria');
  const [balanco, setBalanco] = useState<Balanco | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api.get<Balanco>(`/api/financeiro/balanco-por-categoria?ano=${anoRef}&mes=${mesRef + 1}`)
      .then(setBalanco).catch(() => setBalanco(null)).finally(() => setCarregando(false));
  }, [anoRef, mesRef]);

  useEffect(() => {
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, []);

  function navMes(delta: number) {
    let nm = mesRef + delta, na = anoRef;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesRef(nm); setAnoRef(na);
  }

  const saldoTotalContas = contas.filter(c => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button className="btn-ghost" onClick={() => navigate('/financeiro')} style={{ padding: 8 }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>Balanço mensal</h1>
      </div>

      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
        <button className="btn-secondary" onClick={() => navMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: 16, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>
          {MESES[mesRef]} {anoRef}
        </span>
        <button className="btn-secondary" onClick={() => navMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
      </div>

      {/* Toggle categoria / conta */}
      <div className="cx-tipo-toggle" style={{ marginBottom: 20, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        <button className={aba === 'categoria' ? 'active' : ''} onClick={() => setAba('categoria')}>Balanço por categoria</button>
        <button className={aba === 'conta' ? 'active' : ''} onClick={() => setAba('conta')}>Saldo por conta</button>
      </div>

      {aba === 'categoria' ? (
        carregando ? (
          <div className="empty"><div className="spinner" /></div>
        ) : !balanco ? (
          <div className="empty"><p>Não foi possível carregar o balanço.</p></div>
        ) : (
          <>
            {/* Resumo */}
            <div className="card" style={{ textAlign: 'center', marginBottom: 20, padding: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Balanço</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: balanco.saldo >= 0 ? 'var(--green)' : 'var(--red)', margin: '6px 0 16px' }}>
                {balanco.saldo >= 0 ? '+' : '-'}{fmt(Math.abs(balanco.saldo))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <TrendingUp size={13} /> Receitas
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green)' }}>{fmt(balanco.totalReceitas)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <TrendingDown size={13} /> Despesas
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--red)' }}>{fmt(balanco.totalDespesas)}</div>
                </div>
              </div>
            </div>

            {/* Categorias lado a lado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }} className="balanco-cat-grid">
              <div>
                {balanco.receitas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem receitas no mês.</p>}
                {balanco.receitas.map(r => (
                  <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: corPara(r.nome) + '33',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    }}>{r.icone}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{fmt(r.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                {balanco.despesas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem despesas no mês.</p>}
                {balanco.despesas.map(d => (
                  <div key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: corPara(d.nome) + '33',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    }}>{d.icone}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nome}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>{fmt(d.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      ) : (
        <div className="card">
          {contas.filter(c => c.ativa).length === 0 ? (
            <div className="empty"><p>Nenhuma conta ativa cadastrada.</p></div>
          ) : (
            <>
              {contas.filter(c => c.ativa).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BankBadge bancoId={c.banco} />
                    <span style={{ fontSize: 14 }}>{c.nome}</span>
                  </div>
                  <strong style={{ color: c.saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(c.saldoAtual)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Total</span>
                <strong style={{ color: saldoTotalContas >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoTotalContas)}</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}