import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { InputMoeda } from '../../components/InputMoeda';
import { Cliente } from '../../types';

// Carteira do cliente ("fiado"): compra agora no caixa e paga depois, normalmente no fim do mês.
// Aqui o dono vê o saldo, define o limite, recebe o pagamento e cobra pelo WhatsApp.

interface MovimentoCarteira {
  id: string;
  tipo: 'compra' | 'pagamento';
  valor: number;
  data: string;
  vendaId?: string | null;
  formaPagamento?: string | null;
  observacao?: string | null;
  saldoApos: number;
}
interface CompraEmAberto { vendaId: string; data: string; valor: number; emAberto: number }
interface CarteiraDados {
  saldo: number;
  limite: number | null;
  disponivel: number | null;
  emAberto: CompraEmAberto[];
  movimentos: MovimentoCarteira[];
}

const FORMAS_RECEBIMENTO = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'debito', label: 'Cartão de débito' },
];
const NOME_FORMA: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' };

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const hojeStr = () => new Date().toISOString().slice(0, 10);

// Texto da cobrança que o dono manda pelo WhatsApp (ele revisa antes de enviar)
export function mensagemCobrancaCarteira(nomeCliente: string, nomeLoja: string, dados: Pick<CarteiraDados, 'saldo' | 'emAberto'>): string {
  const primeiro = nomeCliente.trim().split(' ')[0];
  const linhas = dados.emAberto.slice(0, 15).map(c => `• ${fmtData(c.data)} — ${fmt(c.emAberto)}`).join('\n');
  const mais = dados.emAberto.length > 15 ? `\n… e mais ${dados.emAberto.length - 15} compra(s)` : '';
  return `Olá, ${primeiro}! Tudo bem? Aqui é da ${nomeLoja || 'loja'}. 😊\n\n` +
    `Passando para lembrar do seu saldo em aberto na carteira: *${fmt(dados.saldo)}*.\n\n` +
    (linhas ? `Compras em aberto:\n${linhas}${mais}\n\n` : '') +
    `Qualquer dúvida é só chamar. Quando puder acertar, me avise! 🙏`;
}

export function linkWhatsApp(telefone: string, mensagem: string): string {
  const d = telefone.replace(/\D/g, '');
  const completo = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${completo}?text=${encodeURIComponent(mensagem)}`;
}

export function CarteiraCliente({ cliente, nomeLoja, onMudou }: { cliente: Cliente; nomeLoja: string; onMudou: () => void }) {
  const { usuario } = useAuth();
  const { temFinanceiro } = useApp();
  const { sucesso, erro } = useToast();
  const ehAdmin = usuario?.role === 'admin';

  const [dados, setDados] = useState<CarteiraDados | null>(null);
  const [limiteTxt, setLimiteTxt] = useState<number>(0);
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [modalReceber, setModalReceber] = useState(false);
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState('pix');
  const [data, setData] = useState(hojeStr());
  const [obs, setObs] = useState('');
  // Com o módulo Financeiro, o dinheiro recebido pode entrar numa conta bancária (igual ao reforço de caixa)
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contaId, setContaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api.get<CarteiraDados>(`/api/clientes/${cliente.id}/carteira`).then(setDados).catch(() => setDados(null));
  }, [cliente.id]);

  useEffect(() => { setDados(null); carregar(); }, [carregar]);
  useEffect(() => {
    if (!temFinanceiro) return;
    api.get<{ id: string; nome: string }[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, [temFinanceiro]);

  if (!dados) return null;

  const devendo = dados.saldo > 0;
  const semMovimento = dados.movimentos.length === 0 && dados.limite == null;

  function abrirReceber() {
    setValor(dados!.saldo);
    setForma('pix');
    setData(hojeStr());
    setObs('');
    setContaId('');
    setModalReceber(true);
  }

  async function receber() {
    if (valor <= 0) { erro('Informe um valor maior que zero.'); return; }
    if (salvando) return;
    setSalvando(true);
    try {
      const r = await api.post<{ saldo: number; quitado: boolean }>(`/api/clientes/${cliente.id}/carteira/pagamentos`, {
        valor, formaPagamento: forma, data, observacao: obs.trim() || null, contaBancariaId: contaId || null,
      });
      sucesso(r.quitado ? 'Carteira quitada! O valor entrou no caixa.' : `Recebido! Ainda falta ${fmt(r.saldo)}.`);
      setModalReceber(false);
      carregar();
      onMudou();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function desfazer(m: MovimentoCarteira) {
    if (!window.confirm(`Desfazer o recebimento de ${fmt(m.valor)}? A dívida volta e a entrada sai do caixa.`)) return;
    try {
      await api.delete(`/api/clientes/${cliente.id}/carteira/pagamentos/${m.id}`);
      sucesso('Recebimento desfeito.');
      carregar();
      onMudou();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function salvarLimite() {
    try {
      await api.put(`/api/clientes/${cliente.id}/carteira/limite`, { limite: limiteTxt > 0 ? limiteTxt : null });
      sucesso(limiteTxt > 0 ? 'Limite atualizado!' : 'Limite removido (sem limite).');
      setEditandoLimite(false);
      carregar();
      onMudou();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
        👛 Carteira (pagar depois)
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Saldo devedor</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: devendo ? 'var(--red)' : 'var(--green)' }}>{fmt(dados.saldo)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {dados.limite != null ? `Limite ${fmt(dados.limite)} · disponível ${fmt(dados.disponivel ?? 0)}` : 'Sem limite'}
              {ehAdmin && !editandoLimite && (
                <button className="btn-ghost" style={{ fontSize: 12, marginLeft: 6, padding: '0 4px' }}
                  onClick={() => { setLimiteTxt(dados.limite ?? 0); setEditandoLimite(true); }}>alterar</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {devendo && (
              <a className="btn-secondary" style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer"
                href={linkWhatsApp(cliente.telefone, mensagemCobrancaCarteira(cliente.nome, nomeLoja, dados))}>
                💬 Cobrar no WhatsApp
              </a>
            )}
            {devendo && <button className="btn-primary" onClick={abrirReceber}>Receber pagamento</button>}
          </div>
        </div>

        {editandoLimite && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Limite da carteira (vazio = sem limite)</label>
              <InputMoeda value={limiteTxt} onChange={setLimiteTxt} placeholder="Sem limite" />
            </div>
            <button className="btn-primary" onClick={salvarLimite}>Salvar</button>
            <button className="btn-secondary" onClick={() => setEditandoLimite(false)}>Cancelar</button>
          </div>
        )}

        {devendo && dados.emAberto.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Compras em aberto</div>
            {dados.emAberto.map(c => (
              <div key={c.vendaId} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{fmtData(c.data)}{c.emAberto < c.valor ? ` (de ${fmt(c.valor)})` : ''}</span>
                <span style={{ fontWeight: 600 }}>{fmt(c.emAberto)}</span>
              </div>
            ))}
          </div>
        )}

        {semMovimento && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            Nenhuma compra na carteira ainda. No caixa, escolha este cliente e a forma de pagamento “Carteira”.
          </div>
        )}
      </div>

      {dados.movimentos.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Lançamento</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Saldo</th><th /></tr></thead>
            <tbody>
              {dados.movimentos.slice(0, 20).map(m => (
                <tr key={m.id}>
                  <td>{fmtData(m.data)}</td>
                  <td>
                    {m.tipo === 'compra' ? 'Compra na carteira' : `Pagamento (${NOME_FORMA[m.formaPagamento ?? ''] ?? m.formaPagamento})`}
                    {m.observacao && <div className="cli-sub-tab">{m.observacao}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: m.tipo === 'compra' ? 'var(--red)' : 'var(--green)' }}>
                    {m.tipo === 'compra' ? '+' : '−'} {fmt(m.valor)}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(m.saldoApos)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {m.tipo === 'pagamento' && ehAdmin && (
                      <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => desfazer(m)} title="Desfazer este recebimento">desfazer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalReceber && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalReceber(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Receber pagamento</h2>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                {cliente.nome} deve <strong>{fmt(dados.saldo)}</strong>. Pode receber o valor todo ou só uma parte.
              </p>
              <div className="form-group">
                <label className="form-label">Valor recebido</label>
                <InputMoeda value={valor} onChange={setValor} placeholder="0,00" autoFocus />
                {valor > dados.saldo + 0.001 && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Maior que o saldo devedor.</div>
                )}
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Forma de pagamento</label>
                <select value={forma} onChange={e => setForma(e.target.value)}>
                  {FORMAS_RECEBIMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Data do recebimento</label>
                <input type="date" value={data} max={hojeStr()} onChange={e => setData(e.target.value)} />
              </div>
              {temFinanceiro && contas.length > 0 && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Conta bancária (opcional)</label>
                  <select value={contaId} onChange={e => setContaId(e.target.value)}>
                    <option value="">Não vincular a uma conta</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Observação (opcional)</label>
                <input value={obs} maxLength={120} onChange={e => setObs(e.target.value)} placeholder="Ex.: acerto de novembro" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                O valor entra no caixa na data do recebimento.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalReceber(false)}>Cancelar</button>
              <button className="btn-primary" disabled={salvando || valor <= 0 || valor > dados.saldo + 0.001} onClick={receber}>
                {salvando ? 'Salvando...' : 'Confirmar recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
