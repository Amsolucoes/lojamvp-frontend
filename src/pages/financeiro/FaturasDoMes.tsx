// Faturas de cartão de um mês: o que já foi pago, pagamento parcial/adiantado e parcelamento.
// Usada nas telas de Cartões e Contas a Pagar do mobile.

export interface FaturaMes {
  cartaoId: string;
  cartaoNome: string;
  ano: number;
  mes: number;
  vencimento: string;
  total: number;
  totalAntecipado: number;
  restante: number;
  status: string; // pendente | parcial | pago | financiada
  valorPago: number;
  pagoEm: string | null;
  parcelas: { id: string; numeroParcela: number | null; totalParcelas: number | null; valor: number; vencimento: string; status: string; pagoEm: string | null }[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Só faturas que já tiveram algum pagamento (pago, parcial, parcelada ou com adiantamento)
export function faturasComPagamento(faturas: FaturaMes[]): FaturaMes[] {
  return faturas.filter(f => f.status !== 'pendente' || f.totalAntecipado > 0);
}

const linha = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12.5, marginTop: 4 } as const;

interface Props {
  faturas: FaturaMes[];
  titulo: string;
  // true: mostra também as faturas ainda em aberto (tela de Cartões); false: só as que já tiveram pagamento
  mostrarTodas?: boolean;
  // texto quando não há nada a mostrar (se omitido, a seção some)
  vazio?: string;
  erro?: boolean;
}

export function FaturasDoMes({ faturas, titulo, mostrarTodas = false, vazio, erro = false }: Props) {
  const lista = mostrarTodas ? faturas : faturasComPagamento(faturas);

  if (erro) {
    return <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16, textAlign: 'center' }}>Não foi possível carregar as faturas do mês agora.</p>;
  }
  if (lista.length === 0) {
    if (!vazio) return null;
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{titulo}</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '14px 0' }}>{vazio}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map(f => {
          const financiada = f.status === 'financiada';
          const parcial = f.status === 'parcial';
          const paga = f.status === 'pago';
          const soAdiantamento = f.status === 'pendente' && f.totalAntecipado > 0;
          const emAberto = f.status === 'pendente' && f.totalAntecipado === 0;
          const restanteParcial = Math.max(0, f.total - f.valorPago);
          const nParcelas = f.parcelas.length;

          return (
            <div key={f.cartaoId} className={`card fm-card${emAberto ? '' : ' fin-row-pago'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', minWidth: 0 }}>💳 Fatura {f.cartaoNome}</span>
                <span className={`badge badge-${paga ? 'green' : financiada ? 'accent' : emAberto ? 'red' : 'yellow'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {paga ? 'Paga' : financiada ? 'Parcelada' : parcial ? 'Pago parcial' : emAberto ? 'Em aberto' : 'Adiantado'}
                </span>
              </div>

              <div style={linha}>
                <span style={{ color: 'var(--text-3)' }}>Total · vence {dia(f.vencimento)}</span>
                <strong style={{ color: 'var(--text-1)' }}>{fmt(f.total)}</strong>
              </div>

              {paga && (
                <div style={linha}>
                  <span style={{ color: 'var(--green)' }}>Pago{f.pagoEm ? ` em ${dia(f.pagoEm)}` : ''}</span>
                  <strong style={{ color: 'var(--green)' }}>{fmt(f.valorPago)}</strong>
                </div>
              )}

              {parcial && (
                <>
                  <div style={linha}>
                    <span style={{ color: 'var(--green)' }}>Pago{f.pagoEm ? ` em ${dia(f.pagoEm)}` : ''}</span>
                    <strong style={{ color: 'var(--green)' }}>{fmt(f.valorPago)}</strong>
                  </div>
                  <div style={linha}>
                    <span style={{ color: 'var(--yellow, #d97706)' }}>Restante (vai para a próxima fatura)</span>
                    <strong style={{ color: 'var(--yellow, #d97706)' }}>{fmt(restanteParcial)}</strong>
                  </div>
                </>
              )}

              {financiada && (
                <div style={linha}>
                  <span style={{ color: 'var(--green)' }}>Entrada paga{f.pagoEm ? ` em ${dia(f.pagoEm)}` : ''}</span>
                  <strong style={{ color: 'var(--green)' }}>{fmt(f.valorPago)}</strong>
                </div>
              )}

              {f.totalAntecipado > 0 && (
                <div style={linha}>
                  <span style={{ color: 'var(--text-3)' }}>Adiantado</span>
                  <strong style={{ color: 'var(--text-2)' }}>{fmt(f.totalAntecipado)}</strong>
                </div>
              )}

              {(soAdiantamento || emAberto) && (
                <div style={linha}>
                  <span style={{ color: 'var(--text-3)' }}>Falta pagar</span>
                  <strong style={{ color: 'var(--text-1)' }}>{fmt(f.restante)}</strong>
                </div>
              )}

              {financiada && nParcelas > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer' }}>
                    Parcelado em {f.parcelas[0].totalParcelas ?? nParcelas}× — ver parcelas
                  </summary>
                  <div style={{ marginTop: 6 }}>
                    {f.parcelas.map(p => (
                      <div key={p.id} style={{ ...linha, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-2)' }}>
                          {p.numeroParcela}/{p.totalParcelas} · vence {dia(p.vencimento)}
                        </span>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {fmt(p.valor)}{' '}
                          <span style={{ color: p.status === 'pago' ? 'var(--green)' : 'var(--text-3)', fontSize: 11 }}>
                            {p.status === 'pago' ? `· Paga${p.pagoEm ? ` ${dia(p.pagoEm)}` : ''}` : '· Pendente'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
