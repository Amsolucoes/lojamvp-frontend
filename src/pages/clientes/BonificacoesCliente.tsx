import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Bonificacao, Cliente } from '../../types';

// Bonificações do cliente: brindes que a loja deu (pulseira numa compra, por exemplo). Cada brinde fica registrado aqui
// e dá baixa no estoque. O administrador pode dar um brinde avulso e desfazer um brinde avulso lançado por engano;
// o brinde dado dentro de uma venda (botão 🎁 no caixa) aparece aqui também e só se desfaz excluindo a venda.

interface VariacaoDisponivel { id: string; tamanho?: string; cor?: string; outroCampo?: string; estoque: number; ativo: boolean }

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const rotuloVariacao = (v: VariacaoDisponivel) => [v.tamanho, v.cor, v.outroCampo].filter(Boolean).join(' / ') || 'Variação';

export function BonificacoesCliente({ cliente, onMudou }: { cliente: Cliente; onMudou: () => void }) {
  const { usuario } = useAuth();
  const { produtos } = useApp();
  const { sucesso, erro } = useToast();
  const ehAdmin = usuario?.role === 'admin';

  const [lista, setLista] = useState<Bonificacao[] | null>(null);
  const [modal, setModal] = useState(false);
  const [produtoId, setProdutoId] = useState('');
  const [variacoes, setVariacoes] = useState<VariacaoDisponivel[]>([]);
  const [variacaoId, setVariacaoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api.get<Bonificacao[]>(`/api/bonificacoes?clienteId=${cliente.id}&incluirEstornadas=true`).then(setLista).catch(() => setLista([]));
  }, [cliente.id]);

  useEffect(() => { setLista(null); carregar(); }, [carregar]);

  const produto = produtos.find(p => p.id === produtoId);
  const fracionado = produto?.tipoVenda === 'fracionado';
  const variacao = variacoes.find(v => v.id === variacaoId);
  const temGrade = variacoes.length > 0;
  const estoqueDisponivel = temGrade ? (variacao?.estoque ?? 0) : (produto?.estoque ?? 0);
  const qtd = Number(quantidade.replace(',', '.'));
  const quantidadeValida = qtd > 0 && qtd <= estoqueDisponivel && (fracionado && !temGrade ? true : Number.isInteger(qtd));
  const podeConfirmar = !!produto && (!temGrade || !!variacao) && quantidadeValida && !salvando;

  function abrir() {
    setProdutoId(''); setVariacoes([]); setVariacaoId(''); setQuantidade('1'); setObs('');
    setModal(true);
  }

  // Ao escolher o produto, vê se ele tem variações (tamanho/cor) com estoque: nesse caso o brinde é de uma delas
  async function escolherProduto(id: string) {
    setProdutoId(id); setVariacaoId(''); setVariacoes([]); setQuantidade('1');
    if (!id) return;
    try {
      const vars = await api.get<VariacaoDisponivel[]>(`/api/produtos/${id}/variacoes`);
      setVariacoes(vars.filter(v => v.ativo !== false && v.estoque > 0));
    } catch { setVariacoes([]); }
  }

  async function confirmar() {
    if (!podeConfirmar) return;
    setSalvando(true);
    try {
      await api.post('/api/bonificacoes', {
        clienteId: cliente.id, produtoId, variacaoId: variacaoId || null, quantidade: qtd, observacao: obs.trim() || null,
      });
      sucesso('Brinde registrado! O estoque foi atualizado.');
      setModal(false);
      carregar();
      onMudou();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function estornar(b: Bonificacao) {
    if (!window.confirm(`Desfazer o brinde "${b.nomeProduto}" (${b.quantidade})? O produto volta para o estoque.`)) return;
    try {
      await api.post(`/api/bonificacoes/${b.id}/estornar`, {});
      sucesso('Brinde estornado. O estoque voltou.');
      carregar();
      onMudou();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  if (lista === null) return null;
  if (lista.length === 0 && !ehAdmin) return null;

  const ativas = lista.filter(b => !b.estornadaEm);
  const totalCusto = ativas.reduce((s, b) => s + b.custoTotal, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🎁 Brindes (bonificações)
        </div>
        {ehAdmin && <button className="btn-secondary" style={{ fontSize: 12 }} onClick={abrir}>Dar brinde</button>}
      </div>

      {lista.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Nenhum brinde ainda. Use “Dar brinde” ou, no caixa, o botão 🎁 do item (a venda precisa ter este cliente).
        </div>
      ) : (
        <>
          {ehAdmin && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              {ativas.length} brinde(s) · custo para a loja: <strong style={{ color: 'var(--text-1)' }}>{fmt(totalCusto)}</strong>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Produto</th><th style={{ textAlign: 'right' }}>Qtd</th>{ehAdmin && <th style={{ textAlign: 'right' }}>Custo</th>}<th /></tr></thead>
              <tbody>
                {lista.map(b => (
                  <tr key={b.id} style={b.estornadaEm ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtData(b.criadoEm)}</td>
                    <td>
                      {b.nomeProduto}
                      {b.vendaId && <span className="badge badge-blue" style={{ fontSize: 10, marginLeft: 6 }}>na venda</span>}
                      {b.estornadaEm && <span className="badge badge-red" style={{ fontSize: 10, marginLeft: 6, textDecoration: 'none' }}>estornado</span>}
                      {b.observacao && <div className="cli-sub-tab">{b.observacao}</div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{b.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                    {ehAdmin && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(b.custoTotal)}</td>}
                    <td style={{ textAlign: 'right' }}>
                      {ehAdmin && !b.vendaId && !b.estornadaEm && (
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => estornar(b)} title="Desfazer este brinde (o estoque volta)">estornar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Dar brinde a {cliente.nome}</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Produto</label>
                <select value={produtoId} onChange={e => escolherProduto(e.target.value)} autoFocus>
                  <option value="">Escolha o produto…</option>
                  {produtos.filter(p => p.ativo).map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              {temGrade && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Variação</label>
                  <select value={variacaoId} onChange={e => { setVariacaoId(e.target.value); setQuantidade('1'); }}>
                    <option value="">Escolha…</option>
                    {variacoes.map(v => <option key={v.id} value={v.id}>{rotuloVariacao(v)} (estoque {v.estoque})</option>)}
                  </select>
                </div>
              )}
              {produto && (!temGrade || variacao) && (
                <>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Quantidade (estoque: {estoqueDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })})</label>
                    <input type="number" min={fracionado && !temGrade ? 0.001 : 1} step={fracionado && !temGrade ? 0.001 : 1}
                      value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                    {qtd > estoqueDisponivel && (
                      <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Maior que o estoque disponível.</div>
                    )}
                  </div>
                </>
              )}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Observação (opcional)</label>
                <input value={obs} maxLength={200} onChange={e => setObs(e.target.value)} placeholder="Ex.: aniversário, compra acima de R$ 200" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                O brinde fica registrado no cadastro do cliente e o produto sai do estoque com a observação “Bonificação”.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" disabled={!podeConfirmar} onClick={confirmar}>{salvando ? 'Salvando...' : 'Dar brinde'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
