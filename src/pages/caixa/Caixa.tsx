import { useState, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, User, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ItemVenda, FormaPagamento } from '../../types';
import { api } from '@/services/api';
import './Caixa.css';

interface VariacaoItem {
  id: string;
  tamanho?: string;
  cor?: string;
  estoque: number;
}

type CarrinhoItem = ItemVenda & { 
  estoqueDisp: number;
  variacaoId?: string;
  variacaoLabel?: string;
};

const FORMAS: { value: FormaPagamento; label: string; icon: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro',  icon: '💵' },
  { value: 'pix',      label: 'Pix',       icon: '⚡' },
  { value: 'credito',  label: 'Crédito',   icon: '💳' },
  { value: 'debito',   label: 'Débito',    icon: '🏦' },
];

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Caixa() {
  const { produtos, clientes, registrarVenda, vendas, recarregar } = useApp();

  // Carrinho
  const [carrinho, setCarrinho]       = useState<CarrinhoItem[]>([]);
  const [buscaProd, setBuscaProd]     = useState('');
  const [showProd, setShowProd]       = useState(false);
  const [desconto, setDesconto]       = useState(0);
  const [tipoDesc, setTipoDesc]       = useState<'reais' | 'pct'>('reais');
  const [formaPag, setFormaPag]       = useState<FormaPagamento>('pix');
  const [valorPago, setValorPago]     = useState('');
  const [clienteId, setClienteId]     = useState('');
  const [buscaCli, setBuscaCli]       = useState('');
  const [showCli, setShowCli]         = useState(false);
  const [sucesso, setSucesso]         = useState(false);
  const [ultimaVenda, setUltimaVenda] = useState<string | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [variacoesDisponiveis, setVariacoesDisponiveis] = useState<{prodId: string; vars: VariacaoItem[]}[]>([]);
  const [modalVariacao, setModalVariacao] = useState<{prodId: string; nomeProd: string} | null>(null);
  const [modalTroca, setModalTroca] = useState(false);
  const [trocaCliente, setTrocaCliente] = useState('');
  const [trocaBuscaCli, setTrocaBuscaCli] = useState('');
  const [trocaShowCli, setTrocaShowCli] = useState(false);
  const [devolvidos, setDevolvidos] = useState<any[]>([]);
  const [novos, setNovos] = useState<any[]>([]);
  const [trocaBuscaProd, setTrocaBuscaProd] = useState('');
  const [trocaTipo, setTrocaTipo] = useState<'devolvido' | 'novo'>('devolvido');
  const [trocaFormaPag, setTrocaFormaPag] = useState<FormaPagamento>('pix');
  const [trocaResultado, setTrocaResultado] = useState<any>(null);

  const [formas, setFormas] = useState<{forma: FormaPagamento; valor: number; parcelas?: number}[]>([
  { forma: 'dinheiro', valor: 0 }]);
  const [duasFormas, setDuasFormas] = useState(false);

  const prodsFiltrados = produtos.filter(p =>
    p.ativo && p.estoque > 0 &&
    (p.nome.toLowerCase().includes(buscaProd.toLowerCase()) ||
     (p.codigoBarras?.includes(buscaProd) ?? false))
  );

  const cliFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCli.toLowerCase()) ||
    c.telefone.includes(buscaCli)
  );

  const clienteSel = clientes.find(c => c.id === clienteId);

  // Subtotal, desconto, total
  const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const descontoVal = tipoDesc === 'pct'
    ? subtotal * (desconto / 100)
    : Math.min(desconto, subtotal);
  const total = Math.max(0, subtotal - descontoVal);
  const troco = formaPag === 'dinheiro' && valorPago
    ? Math.max(0, parseFloat(valorPago.replace(',', '.')) - total)
    : 0;

  async function addProduto(prodId: string) {
    const prod = produtos.find(p => p.id === prodId);
    if (!prod) return;

    // Busca variações
    try {
      const vars = await api.get<any[]>(`/api/produtos/${prodId}/variacoes`);
      if (vars.length > 0) {
        setVariacoesDisponiveis(prev => {
          const existe = prev.find(v => v.prodId === prodId);
          if (existe) return prev;
          return [...prev, { prodId, vars: vars.filter(v => v.ativo && v.estoque > 0) }];
        });
        setModalVariacao({ prodId, nomeProd: prod.nome });
        setBuscaProd('');
        setShowProd(false);
        return;
      }
    } catch {}

    // Sem variações — adiciona direto
    adicionarAoCarrinho(prodId, prod, null, null, null);
  }

  function adicionarAoCarrinho(
  prodId: string, prod: any,
  variacaoId: string | null,
  tamanho: string | null,
  cor: string | null
  ) {
    const estoqueDisp = variacaoId
      ? (variacoesDisponiveis.find(v => v.prodId === prodId)?.vars.find(v => v.id === variacaoId)?.estoque ?? 0)
      : prod.estoque;

    const label = [tamanho, cor].filter(Boolean).join(' / ');

    setCarrinho(prev => {
      const chave = `${prodId}-${variacaoId ?? 'sem'}`;
      const existe = prev.find(i => i.produtoId === prodId && i.variacaoId === variacaoId);
      if (existe) {
        if (existe.quantidade >= estoqueDisp) return prev;
        return prev.map(i => i.produtoId === prodId && i.variacaoId === variacaoId
          ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.precoUnitario }
          : i
        );
      }
      return [...prev, {
        produtoId: prodId,
        nomeProduto: prod.nome + (label ? ` (${label})` : ''),
        quantidade: 1,
        precoUnitario: prod.precoVenda,
        subtotal: prod.precoVenda,
        estoqueDisp,
        variacaoId: variacaoId ?? undefined,
        variacaoLabel: label || undefined,
      }];
    });
    setModalVariacao(null);
  }

  function alterarQtd(prodId: string, delta: number) {
    setCarrinho(prev => prev
      .map(i => {
        if (i.produtoId !== prodId) return i;
        const novaQtd = i.quantidade + delta;
        if (novaQtd <= 0) return null as unknown as CarrinhoItem;
        if (novaQtd > i.estoqueDisp) return i;
        return { ...i, quantidade: novaQtd, subtotal: novaQtd * i.precoUnitario };
      })
      .filter(Boolean)
    );
  }

  function removerItem(prodId: string) {
    setCarrinho(prev => prev.filter(i => i.produtoId !== prodId));
  }

  function editarPreco(prodId: string, novoPreco: number) {
    setCarrinho(prev => prev.map(i =>
      i.produtoId === prodId
        ? { ...i, precoUnitario: novoPreco, subtotal: i.quantidade * novoPreco }
        : i
    ));
  }

  async function confirmarTroca() {
    if (!trocaCliente || devolvidos.length === 0 || novos.length === 0) return;

    try {
      const totDev  = devolvidos.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
      const totNovo = novos.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
      const dif = totNovo - totDev;

      const payload = {
        clienteId: trocaCliente,
        devolvidos: devolvidos.map(i => ({
          produtoId: i.produtoId,
          nomeProduto: i.nomeProduto,
          variacaoId: i.variacaoId ?? null,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          voltaEstoque: i.voltaEstoque,
        })),
        novos: novos.map(i => ({
          produtoId: i.produtoId,
          nomeProduto: i.nomeProduto,
          variacaoId: i.variacaoId ?? null,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          voltaEstoque: false,
        })),
        formaPagamento: dif > 0 ? trocaFormaPag : null,
      };

      const res = await api.post<any>('/api/trocas', payload);
      setTrocaResultado(res);
      await recarregar();
    } catch (e) {
      alert('Erro ao processar troca: ' + (e as Error).message);
    }
  }

  function finalizarVenda() {
    if (carrinho.length === 0) return;
    const venda = {
      itens: carrinho.map(item => ({
        produtoId:     item.produtoId,
        nomeProduto:   item.nomeProduto,
        quantidade:    item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal:      item.subtotal,
        variacaoId:    item.variacaoId ?? null,
      })),
      clienteId:      clienteId || undefined,
      nomeCliente:    clienteSel?.nome,
      total:          subtotal,
      desconto:       descontoVal,
      totalFinal:     total,
      formaPagamento: duasFormas ? formas[0].forma : formas[0].forma,
      parcelas:       formas[0].parcelas ?? 1,
      formasPagamento: duasFormas ? JSON.stringify(formas.map(f => ({ forma: f.forma, valor: f.valor}))) : null,
      troco: formas[0].forma === 'dinheiro' && !duasFormas && valorPago
        ? Math.max(0, parseFloat(valorPago) - total)
        : undefined,
    } as any;
    registrarVenda(venda);
    setUltimaVenda(total.toString());
    setSucesso(true);
    limpar();
  }

  function limpar() {
    setCarrinho([]);
    setClienteId('');
    setBuscaCli('');
    setDesconto(0);
    setValorPago('');
    setFormas([{ forma: 'dinheiro', valor: 0 }]);
    setDuasFormas(false);
  }

  // Vendas do dia
  const hoje = new Date().toDateString();
  const vendasHoje = vendas.filter(v => new Date(v.criadaEm).toDateString() === hoje);
  const totalDia   = vendasHoje.reduce((s, v) => s + v.totalFinal, 0);
  const totalFormas = formas.reduce((s, f) => s + f.valor, 0);

  const podeFinalizar = carrinho.length > 0 && 
  (duasFormas ? Math.abs(totalFormas - total) < 0.01 : formas[0].forma !== undefined);

  return (
    <div className="page caixa-page">
      {/* Coluna esquerda — produtos + carrinho */}
      <div className="caixa-left">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">Caixa</h1>
            <p className="page-subtitle">
              Hoje: {fmt(totalDia)} em {vendasHoje.length} venda(s)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => setModalTroca(true)}>
              🔄 Troca
            </button>
            {carrinho.length > 0 && (
              <button className="btn-ghost" onClick={limpar} style={{ color: 'var(--red)' }}>
                <Trash2 size={14} style={{ verticalAlign: -2 }} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Busca de produto */}
        <div className="cx-busca-wrap">
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search size={14} className="search-icon" />
            <input
              ref={buscaRef}
              className="search-input"
              placeholder="Buscar produto por nome ou código de barras..."
              value={buscaProd}
              onChange={e => { setBuscaProd(e.target.value); setShowProd(true); }}
              onFocus={() => setShowProd(true)}
              onBlur={() => setTimeout(() => setShowProd(false), 150)}
            />
          </div>
          {showProd && buscaProd && (
            <div className="cx-dropdown">
              {prodsFiltrados.length === 0 ? (
                <div className="cx-dropdown-empty">Nenhum produto encontrado</div>
              ) : prodsFiltrados.slice(0, 8).map(p => (
                <button key={p.id} className="cx-dropdown-item" onMouseDown={() => addProduto(p.id)}>
                  <div className="cx-drop-nome">{p.nome}</div>
                  <div className="cx-drop-info">
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>{p.categoria}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.estoque} un.</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(p.precoVenda)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="card cx-carrinho">
          {carrinho.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <ShoppingCart size={32} />
              <p>Carrinho vazio</p>
              <p style={{ fontSize: 12 }}>Busque um produto acima para adicionar</p>
            </div>
          ) : (
            <>
              {/* Tabela — desktop */}
              <div className="table-wrap cx-table-desktop">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th><th>Preço unit.</th><th>Qtd</th><th>Subtotal</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrinho.map(item => (
                      <tr key={`${item.produtoId}-${item.variacaoId ?? ''}`}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.nomeProduto}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>estoque: {item.estoqueDisp} un.</div>
                        </td>
                        <td>
                          <input className="cx-preco-input" type="number" min={0} step={0.01}
                            value={item.precoUnitario}
                            onChange={e => editarPreco(item.produtoId, +e.target.value)} />
                        </td>
                        <td>
                          <div className="cx-qtd">
                            <button className="cx-qtd-btn" onClick={() => alterarQtd(item.produtoId, -1)}><Minus size={12} /></button>
                            <span className="cx-qtd-val">{item.quantidade}</span>
                            <button className="cx-qtd-btn" onClick={() => alterarQtd(item.produtoId, 1)}><Plus size={12} /></button>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(item.subtotal)}</td>
                        <td>
                          <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removerItem(item.produtoId)}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="cx-cards-mobile">
                {carrinho.map(item => (
                  <div key={`${item.produtoId}-${item.variacaoId ?? ''}`} className="cx-item-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{item.nomeProduto}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          estoque: {item.estoqueDisp} un.
                        </div>
                      </div>
                      <button className="btn-ghost" style={{ color: 'var(--red)', flexShrink: 0 }}
                        onClick={() => removerItem(item.produtoId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                      <input className="cx-preco-input" type="number" min={0} step={0.01}
                        value={item.precoUnitario}
                        onChange={e => editarPreco(item.produtoId, +e.target.value)}
                        style={{ maxWidth: 90 }} />
                      <div className="cx-qtd">
                        <button className="cx-qtd-btn" onClick={() => alterarQtd(item.produtoId, -1)}><Minus size={12} /></button>
                        <span className="cx-qtd-val">{item.quantidade}</span>
                        <button className="cx-qtd-btn" onClick={() => alterarQtd(item.produtoId, 1)}><Plus size={12} /></button>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 15 }}>{fmt(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Coluna direita — pagamento */}
      <div className="caixa-right">

        {/* Cliente */}
        <div className="card cx-section">
          <div className="cx-section-title"><User size={14} /> Cliente <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></div>
          {clienteSel ? (
            <div className="cx-cliente-sel">
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{clienteSel.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{clienteSel.telefone}</div>
              </div>
              <button className="btn-ghost" onClick={() => { setClienteId(''); setBuscaCli(''); }}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Buscar cliente..."
                value={buscaCli}
                onChange={e => { setBuscaCli(e.target.value); setShowCli(true); }}
                onFocus={() => setShowCli(true)}
                onBlur={() => setTimeout(() => setShowCli(false), 150)}
              />
              {showCli && buscaCli && (
                <div className="cx-dropdown">
                  {cliFiltrados.length === 0
                    ? <div className="cx-dropdown-empty">Nenhum cliente encontrado</div>
                    : cliFiltrados.slice(0, 5).map(c => (
                      <button key={c.id} className="cx-dropdown-item" onMouseDown={() => { setClienteId(c.id); setShowCli(false); setBuscaCli(''); }}>
                        <div className="cx-drop-nome">{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desconto */}
        <div className="card cx-section">
          <div className="cx-section-title">Desconto</div>
          <div className="cx-desc-row">
            <input
              type="number"
              min={0}
              value={desconto || ''}
              onChange={e => setDesconto(+e.target.value)}
              placeholder="0"
              style={{ flex: 1 }}
            />
            <div className="cx-tipo-toggle">
              <button className={tipoDesc === 'reais' ? 'active' : ''} onClick={() => setTipoDesc('reais')}>R$</button>
              <button className={tipoDesc === 'pct' ? 'active' : ''} onClick={() => setTipoDesc('pct')}>%</button>
            </div>
          </div>
          {descontoVal > 0 && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
              — {fmt(descontoVal)} de desconto
            </div>
          )}
        </div>

        {/* Totais */}
        <div className="card cx-totais">
          <div className="cx-total-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {descontoVal > 0 && (
            <div className="cx-total-row" style={{ color: 'var(--red)' }}>
              <span>Desconto</span>
              <span>− {fmt(descontoVal)}</span>
            </div>
          )}
          <div className="cx-total-row cx-total-final">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

      {/* Forma de pagamento */}
      <div className="card cx-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="cx-section-title" style={{ margin: 0 }}>Forma de pagamento</div>
          <button className="btn-ghost" style={{ fontSize: 12, color: duasFormas ? 'var(--accent)' : 'var(--text-3)' }}
            onClick={() => {
              const novoEstado = !duasFormas;
              setDuasFormas(novoEstado);
              setFormas(novoEstado ? 
                [{ forma: 'dinheiro', valor: 0 }, { forma: 'pix', valor: 0 }]
                : [{forma: 'dinheiro', valor: 0}]);
            }}>
            {duasFormas ? '✓ 2 formas' : '+ 2 formas'}
          </button>
        </div>

        {formas.map((f, idx) => (
          <div key={idx} style={{ marginBottom: idx < formas.length - 1 ? 16 : 0 }}>
            {duasFormas && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {idx === 0 ? '1ª forma' : '2ª forma'}
              </div>
            )}
            <div className="cx-formas">
              {FORMAS.map(fp => (
                <button key={fp.value}
                  className={`cx-forma-btn${f.forma === fp.value ? ' active' : ''}`}
                  onClick={() => setFormas(prev => prev.map((x, i) => i === idx ? { ...x, forma: fp.value } : x))}>
                  <span>{fp.icon}</span>
                  <span>{fp.label}</span>
                </button>
              ))}
            </div>

            {/* Cartão — parcelamento */}
            {f.forma === 'credito' && (
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Parcelamento</label>
                <select style={{ marginTop: 5 }}
                  value={f.parcelas ?? 1}
                  onChange={e => setFormas(prev => prev.map((x, i) => i === idx ? { ...x, parcelas: +e.target.value } : x))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n}x {fmt((duasFormas ? f.valor : total) / n)}{n === 1 ? ' (à vista)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dinheiro — troco */}
            {f.forma === 'dinheiro' && !duasFormas && (
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Valor recebido</label>
                <input type="number" min={0} step={0.01}
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  placeholder={fmt(total)}
                  style={{ marginTop: 5 }} />
                {valorPago && parseFloat(valorPago) >= total && (
                  <div className="cx-troco">Troco: <strong>{fmt(parseFloat(valorPago) - total)}</strong></div>
                )}
                {valorPago && parseFloat(valorPago) < total && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                    Faltam {fmt(total - parseFloat(valorPago))}
                  </div>
                )}
              </div>
            )}

            {/* Valor de cada forma quando usa 2 */}
            {duasFormas && (
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Valor nesta forma</label>
                <input type="number" min={0} step={0.01}
                  value={f.valor === 0 ? '' : f.valor}
                  onChange={e => {
                    const val = +e.target.value || 0;
                    setFormas(prev => {
                      const nova = [...prev];
                      nova[idx] = { ...nova[idx], valor: val };
                      // Auto-preenche o restante na outra forma
                      if (idx === 0) nova[1] = { ...nova[1], valor: Math.max(0, +(total - val).toFixed(2)) };
                      return nova;
                    });
                  }}
                  style={{ marginTop: 5 }}
                  placeholder={fmt(idx === 0 ? total / 2 : total / 2)} />
              </div>
            )}
          </div>
        ))}

        {duasFormas && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Total das formas:</span>
              <span style={{ fontWeight: 600, color: Math.abs(totalFormas - total) < 0.01 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(totalFormas)}
              </span>
            </div>
            {Math.abs(totalFormas - total) >= 0.01 && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                {totalFormas < total ? `Faltam ${fmt(total - totalFormas)}` : `Excesso de ${fmt(totalFormas - total)}`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão finalizar */}
      <button
        className={`cx-finalizar${podeFinalizar ? '' : ' disabled'}`}
        onClick={podeFinalizar ? finalizarVenda : undefined}
        disabled={!podeFinalizar}>
        <Check size={18} />
        Finalizar venda · {fmt(total)}
      </button>

      {/* Modal seleção de variação */}
      {modalVariacao && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalVariacao(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Escolha a variação</h2>
              <button className="btn-ghost" onClick={() => setModalVariacao(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                {modalVariacao.nomeProd}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {variacoesDisponiveis
                  .find(v => v.prodId === modalVariacao.prodId)?.vars
                  .map(v => (
                    <button
                      key={v.id}
                      className="btn-secondary"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}
                      onClick={() => {
                        const prod = produtos.find(p => p.id === modalVariacao.prodId);
                        if (prod) adicionarAoCarrinho(modalVariacao.prodId, prod, v.id, v.tamanho ?? null, v.cor ?? null);
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        {[v.tamanho, v.cor].filter(Boolean).join(' / ') || 'Padrão'}
                      </span>
                      <span className={`badge ${v.estoque > 0 ? 'badge-green' : 'badge-red'}`}>
                        {v.estoque} un.
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Troca */}
      {modalTroca && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalTroca(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>🔄 Troca de produtos</h2>
              <button className="btn-ghost" onClick={() => { setModalTroca(false); setDevolvidos([]); setNovos([]); setTrocaCliente(''); setTrocaResultado(null); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {trocaResultado ? (
                // Resultado da troca
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Troca realizada!</h3>
                  <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'left', fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-3)' }}>Total devolvido:</span>
                      <span>{fmt(trocaResultado.totalDevolvido)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-3)' }}>Total novo:</span>
                      <span>{fmt(trocaResultado.totalNovo)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                      {trocaResultado.diferenca > 0 ? (
                        <><span style={{ color: 'var(--red)' }}>Cliente paga:</span><span style={{ color: 'var(--red)' }}>{fmt(trocaResultado.diferenca)}</span></>
                      ) : trocaResultado.diferenca < 0 ? (
                        <><span style={{ color: 'var(--green)' }}>Crédito gerado:</span><span style={{ color: 'var(--green)' }}>{fmt(trocaResultado.creditoGerado)}</span></>
                      ) : (
                        <><span>Troca sem diferença</span><span>—</span></>
                      )}
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 20, width: '100%' }}
                    onClick={() => { setModalTroca(false); setDevolvidos([]); setNovos([]); setTrocaCliente(''); setTrocaResultado(null); }}>
                    Concluir
                  </button>
                </div>
              ) : (
                <>
                  {/* Cliente */}
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Cliente *</label>
                    {trocaCliente ? (
                      <div className="cx-cliente-sel">
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{clientes.find(c => c.id === trocaCliente)?.nome}</div>
                          {(clientes.find(c => c.id === trocaCliente)?.creditoLoja ?? 0) > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--green)' }}>
                              Crédito atual: {fmt(clientes.find(c => c.id === trocaCliente)?.creditoLoja ?? 0)}
                            </div>
                          )}
                        </div>
                        <button className="btn-ghost" onClick={() => setTrocaCliente('')}><X size={13} /></button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input placeholder="Buscar cliente..." value={trocaBuscaCli}
                          onChange={e => { setTrocaBuscaCli(e.target.value); setTrocaShowCli(true); }}
                          onFocus={() => setTrocaShowCli(true)}
                          onBlur={() => setTimeout(() => setTrocaShowCli(false), 150)} />
                        {trocaShowCli && trocaBuscaCli && (
                          <div className="cx-dropdown">
                            {clientes.filter(c => c.nome.toLowerCase().includes(trocaBuscaCli.toLowerCase())).slice(0, 5).map(c => (
                              <button key={c.id} className="cx-dropdown-item" onMouseDown={() => { setTrocaCliente(c.id); setTrocaShowCli(false); setTrocaBuscaCli(''); }}>
                                <div className="cx-drop-nome">{c.nome}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Toggle devolvido/novo */}
                  <div className="cx-tipo-toggle" style={{ marginBottom: 12 }}>
                    <button className={trocaTipo === 'devolvido' ? 'active' : ''} onClick={() => setTrocaTipo('devolvido')}>
                      Devolvidos ({devolvidos.length})
                    </button>
                    <button className={trocaTipo === 'novo' ? 'active' : ''} onClick={() => setTrocaTipo('novo')}>
                      Novos ({novos.length})
                    </button>
                  </div>

                  {/* Busca produto */}
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input placeholder="Buscar produto para adicionar..." value={trocaBuscaProd}
                      onChange={e => setTrocaBuscaProd(e.target.value)} />
                    {trocaBuscaProd && (
                      <div className="cx-dropdown">
                        {produtos.filter(p => p.nome.toLowerCase().includes(trocaBuscaProd.toLowerCase())).slice(0, 6).map(p => (
                          <button key={p.id} className="cx-dropdown-item" onMouseDown={() => {
                            const item = { produtoId: p.id, nomeProduto: p.nome, quantidade: 1, precoUnitario: p.precoVenda, voltaEstoque: true };
                            if (trocaTipo === 'devolvido') setDevolvidos(prev => [...prev, item]);
                            else setNovos(prev => [...prev, item]);
                            setTrocaBuscaProd('');
                          }}>
                            <div className="cx-drop-nome">{p.nome}</div>
                            <div className="cx-drop-info">
                              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(p.precoVenda)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista do tipo selecionado */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {(trocaTipo === 'devolvido' ? devolvidos : novos).map((item, i) => (
                      <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{item.nomeProduto}</span>
                          <button className="btn-ghost" style={{ color: 'var(--red)', padding: 2 }}
                            onClick={() => {
                              if (trocaTipo === 'devolvido') setDevolvidos(prev => prev.filter((_, j) => j !== i));
                              else setNovos(prev => prev.filter((_, j) => j !== i));
                            }}><X size={13} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                          <input type="number" min={1} value={item.quantidade} style={{ width: 60 }}
                            onChange={e => {
                              const q = +e.target.value || 1;
                              if (trocaTipo === 'devolvido') setDevolvidos(prev => prev.map((x, j) => j === i ? { ...x, quantidade: q } : x));
                              else setNovos(prev => prev.map((x, j) => j === i ? { ...x, quantidade: q } : x));
                            }} />
                          <input type="number" min={0} step={0.01} value={item.precoUnitario} style={{ width: 90 }}
                            onChange={e => {
                              const v = +e.target.value || 0;
                              if (trocaTipo === 'devolvido') setDevolvidos(prev => prev.map((x, j) => j === i ? { ...x, precoUnitario: v } : x));
                              else setNovos(prev => prev.map((x, j) => j === i ? { ...x, precoUnitario: v } : x));
                            }} />
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(item.quantidade * item.precoUnitario)}</span>
                          {trocaTipo === 'devolvido' && (
                            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                              <input type="checkbox" checked={item.voltaEstoque}
                                onChange={e => setDevolvidos(prev => prev.map((x, j) => j === i ? { ...x, voltaEstoque: e.target.checked } : x))} />
                              Volta ao estoque
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumo */}
                  {(devolvidos.length > 0 || novos.length > 0) && (
                    <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
                      {(() => {
                        const totDev = devolvidos.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
                        const totNovo = novos.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
                        const dif = totNovo - totDev;
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                              <span style={{ color: 'var(--text-3)' }}>Devolvido:</span><span>{fmt(totDev)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                              <span style={{ color: 'var(--text-3)' }}>Novo:</span><span>{fmt(totNovo)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                              {dif > 0 ? <><span style={{ color: 'var(--red)' }}>Cliente paga:</span><span style={{ color: 'var(--red)' }}>{fmt(dif)}</span></>
                                : dif < 0 ? <><span style={{ color: 'var(--green)' }}>Crédito gerado:</span><span style={{ color: 'var(--green)' }}>{fmt(Math.abs(dif))}</span></>
                                : <><span>Sem diferença</span><span>—</span></>}
                            </div>
                            {dif > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <label className="form-label">Forma de pagamento da diferença</label>
                                <div className="cx-formas" style={{ marginTop: 6 }}>
                                  {FORMAS.map(fp => (
                                    <button key={fp.value} className={`cx-forma-btn${trocaFormaPag === fp.value ? ' active' : ''}`}
                                      onClick={() => setTrocaFormaPag(fp.value)}>
                                      <span>{fp.icon}</span><span>{fp.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
            {!trocaResultado && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => { setModalTroca(false); setDevolvidos([]); setNovos([]); setTrocaCliente(''); }}>Cancelar</button>
                <button className="btn-primary"
                  disabled={!trocaCliente || devolvidos.length === 0 || novos.length === 0}
                  onClick={confirmarTroca}>
                  Confirmar troca
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal sucesso */}
      {sucesso && (
        <div className="modal-overlay">
          <div className="modal cx-sucesso-modal">
            <div className="cx-sucesso-icon">✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Venda registrada!</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 4 }}>
              Total: <strong style={{ color: 'var(--green)' }}>{fmt(parseFloat(ultimaVenda ?? '0'))}</strong>
            </p>
            {formas[0].forma === 'dinheiro' && valorPago && parseFloat(valorPago) > total && (
              <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                Troco: <strong>{fmt(parseFloat(valorPago) - total)}</strong>
              </p>
            )}
            <button className="btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={() => setSucesso(false)}>
              Nova venda
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
