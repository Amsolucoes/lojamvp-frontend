import { ArrowDown, ArrowUp, Search } from 'lucide-react';

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

// Conteúdo de uma fatura (título + etiqueta + valores + parcelas). Reutilizado dentro do card do cartão.
export function DetalheFatura({ f, rotulo }: { f: FaturaMes; rotulo?: string }) {
  const financiada = f.status === 'financiada';
  const parcial = f.status === 'parcial';
  const paga = f.status === 'pago';
  const soAdiantamento = f.status === 'pendente' && f.totalAntecipado > 0;
  const emAberto = f.status === 'pendente' && f.totalAntecipado === 0;
  const restanteParcial = Math.max(0, f.total - f.valorPago);
  const nParcelas = f.parcelas.length;

  return (
    <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', minWidth: 0 }}>{rotulo ?? `💳 Fatura ${f.cartaoNome}`}</span>
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
    </>
  );
}

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
        {lista.map(f => (
          <div key={f.cartaoId} className={`card fm-card${f.status === 'pendente' && f.totalAntecipado === 0 ? '' : ' fin-row-pago'}`}>
            <DetalheFatura f={f} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Integração com a lista de Contas a pagar ──────────────────────────────

// Fatura do cartão com algum pagamento (pago, parcial, parcelada ou adiantado), se houver
export function faturaComPagamento(faturas: FaturaMes[], cartaoId: string | null | undefined): FaturaMes | undefined {
  if (!cartaoId) return undefined;
  return faturasComPagamento(faturas).find(f => f.cartaoId === cartaoId);
}

// Faturas com pagamento que NÃO têm linha na lista (ex.: já 100% pagas) — entram no dia do vencimento
export function faturasSemLinha(faturas: FaturaMes[], linhas: { cartaoId?: string | null; origem?: string }[]): FaturaMes[] {
  const comLinha = new Set(linhas.filter(l => l.origem && l.origem.startsWith('cartao') && l.cartaoId).map(l => l.cartaoId as string));
  return faturasComPagamento(faturas).filter(f => !comLinha.has(f.cartaoId));
}

// Une os grupos por dia da lista com as faturas órfãs, mantendo a ordem por data
export function agruparComFaturas<T>(grupos: [string, T[]][], orfas: FaturaMes[]): { dia: string; itens: T[]; faturas: FaturaMes[] }[] {
  const mapa = new Map<string, { dia: string; itens: T[]; faturas: FaturaMes[] }>();
  grupos.forEach(([dia, itens]) => mapa.set(dia, { dia, itens, faturas: [] }));
  orfas.forEach(f => {
    const dia = f.vencimento ? f.vencimento.slice(0, 10) : 'sem-data';
    if (!mapa.has(dia)) mapa.set(dia, { dia, itens: [], faturas: [] });
    mapa.get(dia)!.faturas.push(f);
  });
  return [...mapa.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

// Detalhe do pagamento dentro do próprio card da fatura na lista
export function FaturaAninhada({ f }: { f: FaturaMes | undefined }) {
  if (!f) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
      <DetalheFatura f={f} rotulo="Pagamento da fatura" />
    </div>
  );
}


// ── Busca e ordenação da lista de cartões ─────────────────────────────────

export type OrdemCartoes = 'asc' | 'desc';

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Fatura com baixa (paga, parcial ou parcelada) — usada para destacar o card em verde
export function faturaFoiPaga(faturas: FaturaMes[], cartaoId: string): boolean {
  const f = faturas.find(x => x.cartaoId === cartaoId);
  return !!f && (f.status === 'pago' || f.status === 'financiada' || f.status === 'parcial');
}

// Vencimento da fatura do mês; sem fatura, usa o dia de vencimento do cartão no mês atual
function vencimentoDoCartao(c: { id: string; diaVencimento: number }, faturas: FaturaMes[]): number {
  const f = faturas.find(x => x.cartaoId === c.id);
  if (f?.vencimento) return new Date(f.vencimento).getTime();
  const agora = new Date();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  return new Date(agora.getFullYear(), agora.getMonth(), Math.min(c.diaVencimento, diasNoMes), 12).getTime();
}

export function filtrarOrdenarCartoes<T extends { id: string; nome: string; diaVencimento: number }>(
  cartoes: T[], faturas: FaturaMes[], busca: string, ordem: OrdemCartoes,
): T[] {
  const termo = normalizar(busca);
  const lista = cartoes.filter(c => !termo || normalizar(c.nome).includes(termo));
  return lista.sort((a, b) => {
    const d = vencimentoDoCartao(a, faturas) - vencimentoDoCartao(b, faturas);
    const r = d !== 0 ? d : a.nome.localeCompare(b.nome);
    return ordem === 'asc' ? r : -r;
  });
}

// Pesquisa por nome do cartão + botão de ordenação por vencimento (crescente/decrescente)
export function BarraCartoes({ busca, setBusca, ordem, setOrdem }: {
  busca: string; setBusca: (v: string) => void; ordem: OrdemCartoes; setOrdem: (o: OrdemCartoes) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input type="text" placeholder="Buscar cartão pelo nome..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ width: '100%', paddingLeft: 30 }} />
      </div>
      <button className="btn-secondary" onClick={() => setOrdem(ordem === 'asc' ? 'desc' : 'asc')}
        title={ordem === 'asc' ? 'Vencimento: do mais próximo ao mais distante' : 'Vencimento: do mais distante ao mais próximo'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '0 14px', whiteSpace: 'nowrap' }}>
        {ordem === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />} Vencimento
      </button>
    </div>
  );
}
