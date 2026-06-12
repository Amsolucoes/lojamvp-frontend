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
  const { produtos, clientes, registrarVenda, vendas } = useApp();

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

  function finalizarVenda() {
    if (carrinho.length === 0) return;
    const venda = {
      itens: carrinho.map(({ estoqueDisp: _, variacaoLabel: __, ...rest }) => ({
        ...rest,
        variacaoId: rest.variacaoId ?? null,
      })),
      clienteId: clienteId || undefined,
      nomeCliente: clienteSel?.nome,
      total: subtotal,
      desconto: descontoVal,
      totalFinal: total,
      formaPagamento: formaPag,
      troco: formaPag === 'dinheiro' ? troco : undefined,
    };
    registrarVenda(venda);
    setUltimaVenda(total.toString());
    setSucesso(true);
    limpar();
  }

  function limpar() {
    setCarrinho([]);
    setDesconto(0);
    setTipoDesc('reais');
    setFormaPag('pix');
    setValorPago('');
    setClienteId('');
    setBuscaCli('');
    setBuscaProd('');
  }

  // Vendas do dia
  const hoje = new Date().toDateString();
  const vendasHoje = vendas.filter(v => new Date(v.criadaEm).toDateString() === hoje);
  const totalDia   = vendasHoje.reduce((s, v) => s + v.totalFinal, 0);

  const podeFinalizar = carrinho.length > 0 &&
    (formaPag !== 'dinheiro' || (!!valorPago && parseFloat(valorPago.replace(',', '.')) >= total));

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
          {carrinho.length > 0 && (
            <button className="btn-ghost" onClick={limpar} style={{ color: 'var(--red)' }}>
              <Trash2 size={14} style={{ verticalAlign: -2 }} /> Limpar
            </button>
          )}
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Preço unit.</th>
                    <th>Qtd</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {carrinho.map(item => (
                    <tr key={item.produtoId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.nomeProduto}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          estoque: {item.estoqueDisp} un.
                        </div>
                      </td>
                      <td>
                        <input
                          className="cx-preco-input"
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.precoUnitario}
                          onChange={e => editarPreco(item.produtoId, +e.target.value)}
                        />
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
          <div className="cx-section-title">Forma de pagamento</div>
          <div className="cx-formas">
            {FORMAS.map(f => (
              <button
                key={f.value}
                className={`cx-forma-btn${formaPag === f.value ? ' active' : ''}`}
                onClick={() => setFormaPag(f.value)}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          {formaPag === 'dinheiro' && (
            <div style={{ marginTop: 12 }}>
              <label className="form-label">Valor recebido</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
                placeholder={fmt(total)}
                style={{ marginTop: 5 }}
              />
              {valorPago && parseFloat(valorPago.replace(',', '.')) >= total && (
                <div className="cx-troco">
                  Troco: <strong>{fmt(troco)}</strong>
                </div>
              )}
              {valorPago && parseFloat(valorPago.replace(',', '.')) < total && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                  Valor insuficiente — faltam {fmt(total - parseFloat(valorPago.replace(',', '.')))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão finalizar */}
        <button
          className={`cx-finalizar${podeFinalizar ? '' : ' disabled'}`}
          onClick={podeFinalizar ? finalizarVenda : undefined}
          disabled={!podeFinalizar}
        >
          <Check size={18} />
          Finalizar venda · {fmt(total)}
        </button>
      </div>

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

      {/* Modal sucesso */}
      {sucesso && (
        <div className="modal-overlay">
          <div className="modal cx-sucesso-modal">
            <div className="cx-sucesso-icon">✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Venda registrada!</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 4 }}>
              Total: <strong style={{ color: 'var(--green)' }}>{fmt(parseFloat(ultimaVenda ?? '0'))}</strong>
            </p>
            {formaPag === 'dinheiro' && troco > 0 && (
              <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                Troco: <strong>{fmt(troco)}</strong>
              </p>
            )}
            <button className="btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={() => setSucesso(false)}>
              Nova venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
