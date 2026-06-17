import { useState } from 'react';
import { Search, Plus, Minus, AlertTriangle, ArrowUp, ArrowDown, RefreshCw, X, Boxes } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Produto } from '../../types';
import './Estoque.css';
import { api } from '@/services/api';

type AbaEstoque = 'visao-geral' | 'movimentos';

interface ModalAjuste {
  produto: Produto;
  tipo: 'entrada' | 'ajuste';
  variacaoId?: string;
  variacaoLabel?: string;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Estoque() {
  const { produtos, movimentos, ajustarEstoque, recarregar } = useApp();
  const [aba, setAba]             = useState<AbaEstoque>('visao-geral');
  const [busca, setBusca]         = useState('');
  const [filtro, setFiltro]       = useState<'todos' | 'baixo' | 'zerado'>('todos');
  const [modal, setModal]         = useState<ModalAjuste | null>(null);
  const [qtdAjuste, setQtdAjuste] = useState('');
  const [obsAjuste, setObsAjuste] = useState('');
  const [modalVariacaoEntrada, setModalVariacaoEntrada] = useState<{ produto: Produto } | null>(null);

  const prodsFiltrados = produtos.filter(p => {
    const buscaOk = p.nome.toLowerCase().includes(busca.toLowerCase());
    if (filtro === 'baixo')   return buscaOk && p.estoque > 0 && p.estoque <= p.estoqueMinimo;
    if (filtro === 'zerado')  return buscaOk && p.estoque === 0;
    return buscaOk;
  });

  const alertas = produtos.filter(p => {
    if (!p.ativo) return false;
    const vars = (p as any).variacoes?.filter((v: any) => v.ativo);
    if (vars?.length > 0) return vars.some((v: any) => v.estoque > 0 && v.estoque <= v.estoqueMinimo);
    return p.estoque > 0 && p.estoque <= p.estoqueMinimo;
  }).length;

  const zerados = produtos.filter(p => {
    if (!p.ativo) return false;
    const vars = (p as any).variacoes?.filter((v: any) => v.ativo);
    if (vars?.length > 0) return vars.some((v: any) => v.estoque === 0);
    return p.estoque === 0;
  }).length;
  
  const totalItens = produtos.filter(p => p.ativo).reduce((s, p) => s + p.estoque, 0);
  const valorEstoque = produtos.filter(p => p.ativo).reduce((s, p) => s + p.estoque * p.precoCusto, 0);

  function abrirEntrada(p: Produto) {
    const vars = (p as any).variacoes?.filter((v: any) => v.ativo);
    if (vars?.length > 0) {
      setModalVariacaoEntrada({ produto: p });
    } else {
      setModal({ produto: p, tipo: 'entrada' });
      setQtdAjuste('');
      setObsAjuste('');
    }
  }

  function abrirAjuste(p: Produto) {
    setModal({ produto: p, tipo: 'ajuste' });
    setQtdAjuste(String(p.estoque));
    setObsAjuste('');
  }

  function confirmarAjuste() {
    if (!modal || !qtdAjuste) return;
    const qtd = parseInt(qtdAjuste);
    if (isNaN(qtd) || qtd < 0) return;

    if (modal.variacaoId) {
      // Entrada por variação — chama API diretamente
      api.post('/api/estoque/ajuste-variacao', {
        produtoId: modal.produto.id,
        variacaoId: modal.variacaoId,
        quantidade: qtd,
        tipo: modal.tipo,
        observacao: obsAjuste || null,
      }).then(() => recarregar());
    } else {
      ajustarEstoque(modal.produto.id, qtd, modal.tipo, obsAjuste || undefined);
    }
    setModal(null);
  }

  function statusEstoque(p: Produto) {
    const vars = (p as any).variacoes?.filter((v: any) => v.ativo);
    if (vars?.length > 0) {
      const temZerado = vars.some((v: any) => v.estoque === 0);
      const temBaixo  = vars.some((v: any) => v.estoque > 0 && v.estoque <= v.estoqueMinimo);
      if (temZerado) return 'zerado';
      if (temBaixo)  return 'baixo';
      return 'ok';
    }
    if (p.estoque === 0)              return 'zerado';
    if (p.estoque <= p.estoqueMinimo) return 'baixo';
    return 'ok';
  }

  const movOrdenados = [...movimentos].reverse();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">Controle de entradas, saídas e ajustes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="est-stats">
        <div className="stat-card">
          <div className="stat-label">Total de itens</div>
          <div className="stat-value">{totalItens}</div>
          <div className="stat-sub">unidades em estoque</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valor em estoque</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{fmt(valorEstoque)}</div>
          <div className="stat-sub">pelo preço de custo</div>
        </div>
        <div className="stat-card" style={alertas > 0 ? { borderColor: 'rgba(251,191,36,0.3)' } : {}}>
          <div className="stat-label">Estoque baixo</div>
          <div className="stat-value" style={{ color: alertas > 0 ? 'var(--yellow)' : undefined }}>
            {alertas}
          </div>
          <div className="stat-sub">produto(s) abaixo do mínimo</div>
        </div>
        <div className="stat-card" style={zerados > 0 ? { borderColor: 'rgba(248,113,113,0.3)' } : {}}>
          <div className="stat-label">Sem estoque</div>
          <div className="stat-value" style={{ color: zerados > 0 ? 'var(--red)' : undefined }}>
            {zerados}
          </div>
          <div className="stat-sub">produto(s) zerado(s)</div>
        </div>
      </div>

      {/* Abas */}
      <div className="est-abas">
        <button className={`est-aba${aba === 'visao-geral' ? ' active' : ''}`} onClick={() => setAba('visao-geral')}>
          <Boxes size={14} /> Visão geral
        </button>
        <button className={`est-aba${aba === 'movimentos' ? ' active' : ''}`} onClick={() => setAba('movimentos')}>
          <RefreshCw size={14} /> Histórico de movimentos
          <span className="est-aba-count">{movimentos.length}</span>
        </button>
      </div>

      {/* Visão geral */}
      {aba === 'visao-geral' && (
        <>
          <div className="est-filters">
            <div className="search-wrap" style={{ maxWidth: 300 }}>
              <Search size={14} className="search-icon" />
              <input className="search-input" placeholder="Buscar produto..."
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className="cat-tabs">
              <button className={`cat-tab${filtro === 'todos' ? ' active' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
              <button className={`cat-tab${filtro === 'baixo' ? ' active' : ''}`} onClick={() => setFiltro('baixo')}>
                Estoque baixo {alertas > 0 && <span className="est-badge-warn">{alertas}</span>}
              </button>
              <button className={`cat-tab${filtro === 'zerado' ? ' active' : ''}`} onClick={() => setFiltro('zerado')}>
                Zerados {zerados > 0 && <span className="est-badge-red">{zerados}</span>}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {prodsFiltrados.length === 0 ? (
              <div className="empty" style={{ padding: '40px 0' }}><Boxes size={28} /><p>Nenhum produto encontrado.</p></div>
            ) : (
              <>
                {/* Tabela — desktop */}
                <div className="table-wrap est-table-desktop">
                  <table>
                    <thead>
                      <tr><th>Produto</th><th>Categoria</th><th>Estoque atual</th><th>Mínimo</th><th>Valor (custo)</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {prodsFiltrados.map(p => {
                        const status = statusEstoque(p);
                        return (
                          <tr key={p.id}>
                            <td><div style={{ fontWeight: 500 }}>{p.nome}</div></td>
                            <td><span className="badge badge-accent" style={{ fontSize: 11 }}>{p.categoria}</span></td>
                            <td>
                              {(p as any).variacoes?.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {(p as any).variacoes.map((v: any) => (
                                    <span key={v.id} style={{ fontSize: 11, color: v.estoque <= v.estoqueMinimo ? 'var(--red)' : 'var(--green)' }}>
                                      {[v.tamanho, v.cor].filter(Boolean).join('/')} — {v.estoque} un.
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="est-qtd-cell">
                                  <div className="est-bar-wrap">
                                    <div className={`est-bar est-bar-${status}`}
                                      style={{ width: `${Math.min(100, (p.estoque / Math.max(p.estoqueMinimo * 3, 1)) * 100)}%` }} />
                                  </div>
                                  <span className={`est-qtd est-qtd-${status}`}>{p.estoque} un.</span>
                                </div>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{p.estoqueMinimo} un.</td>
                            <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{fmt(p.estoque * p.precoCusto)}</td>
                            <td>
                              {status === 'zerado' && <span className="badge badge-red">Zerado</span>}
                              {status === 'baixo'  && <span className="badge badge-yellow"><AlertTriangle size={10} /> Baixo</span>}
                              {status === 'ok'     && <span className="badge badge-green">OK</span>}
                            </td>
                            <td>
                              <div className="est-acoes">
                                <button className="btn-secondary est-btn-acao" onClick={() => abrirEntrada(p)}><ArrowDown size={13} style={{ color: 'var(--green)' }} /> Entrada</button>
                                <button className="btn-ghost est-btn-acao" onClick={() => abrirAjuste(p)}><RefreshCw size={12} /> Ajustar</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cards — mobile */}
                <div className="est-cards-mobile">
                  {prodsFiltrados.map(p => {
                    const status = statusEstoque(p);
                    return (
                      <div key={p.id} className="est-card-mobile">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{p.nome}</div>
                            <span className="badge badge-accent" style={{ fontSize: 10, marginTop: 4 }}>{p.categoria}</span>
                          </div>
                          <div>
                            {status === 'zerado' && <span className="badge badge-red">Zerado</span>}
                            {status === 'baixo'  && <span className="badge badge-yellow"><AlertTriangle size={10} /> Baixo</span>}
                            {status === 'ok'     && <span className="badge badge-green">OK</span>}
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          {(p as any).variacoes?.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(p as any).variacoes.map((v: any) => (
                                <span key={v.id} style={{ fontSize: 11, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: v.estoque <= v.estoqueMinimo ? 'var(--red)' : 'var(--green)' }}>
                                  {[v.tamanho, v.cor].filter(Boolean).join('/')} — {v.estoque}un
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="est-qtd-cell">
                              <div className="est-bar-wrap">
                                <div className={`est-bar est-bar-${status}`}
                                  style={{ width: `${Math.min(100, (p.estoque / Math.max(p.estoqueMinimo * 3, 1)) * 100)}%` }} />
                              </div>
                              <span className={`est-qtd est-qtd-${status}`}>{p.estoque} un.</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button className="btn-secondary est-btn-acao" style={{ flex: 1 }} onClick={() => abrirEntrada(p)}>
                            <ArrowDown size={13} style={{ color: 'var(--green)' }} /> Entrada
                          </button>
                          <button className="btn-ghost est-btn-acao" style={{ flex: 1 }} onClick={() => abrirAjuste(p)}>
                            <RefreshCw size={12} /> Ajustar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Histórico */}
      {aba === 'movimentos' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {movOrdenados.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}><RefreshCw size={28} /><p>Nenhum movimento registrado ainda.</p></div>
          ) : (
            <>
              {/* Tabela — desktop */}
              <div className="table-wrap est-table-desktop">
                <table>
                  <thead>
                    <tr><th>Data / Hora</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Observação</th></tr>
                  </thead>
                  <tbody>
                    {movOrdenados.map(m => (
                      <tr key={m.id}>
                        <td style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(m.criadoEm).toLocaleDateString('pt-BR')}{' '}
                          {new Date(m.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ fontWeight: 500 }}>{m.nomeProduto}</td>
                        <td>
                          {m.tipo === 'entrada' && <span className="badge badge-green"><ArrowDown size={10} /> Entrada</span>}
                          {m.tipo === 'saida'   && <span className="badge badge-red"><ArrowUp size={10} /> Saída</span>}
                          {m.tipo === 'ajuste'  && <span className="badge badge-blue"><RefreshCw size={10} /> Ajuste</span>}
                        </td>
                        <td><span className={`est-mov-qtd ${m.tipo === 'saida' ? 'saida' : 'entrada'}`}>{m.tipo === 'saida' ? '−' : '+'}{m.quantidade}</span></td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{m.observacao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="est-cards-mobile">
                {movOrdenados.map(m => (
                  <div key={m.id} className="est-card-mobile">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{m.nomeProduto}</div>
                      <span className={`est-mov-qtd ${m.tipo === 'saida' ? 'saida' : 'entrada'}`}>
                        {m.tipo === 'saida' ? '−' : '+'}{m.quantidade}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <div>
                        {m.tipo === 'entrada' && <span className="badge badge-green"><ArrowDown size={10} /> Entrada</span>}
                        {m.tipo === 'saida'   && <span className="badge badge-red"><ArrowUp size={10} /> Saída</span>}
                        {m.tipo === 'ajuste'  && <span className="badge badge-blue"><RefreshCw size={10} /> Ajuste</span>}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {new Date(m.criadoEm).toLocaleDateString('pt-BR')}{' '}
                        {new Date(m.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {m.observacao && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{m.observacao}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal seleção variação para entrada */}
      {modalVariacaoEntrada && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalVariacaoEntrada(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                <ArrowDown size={16} style={{ color: 'var(--green)', verticalAlign: -2 }} /> Registrar entrada
              </h2>
              <button className="btn-ghost" onClick={() => setModalVariacaoEntrada(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                <strong>{modalVariacaoEntrada.produto.nome}</strong> — Escolha a variação:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(modalVariacaoEntrada.produto as any).variacoes
                  ?.filter((v: any) => v.ativo)
                  .map((v: any) => {
                    const label = [v.tamanho, v.cor].filter(Boolean).join(' / ');
                    return (
                      <button key={v.id} className="btn-secondary"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}
                        onClick={() => {
                          setModal({
                            produto: modalVariacaoEntrada.produto,
                            tipo: 'entrada',
                            variacaoId: v.id,
                            variacaoLabel: label,
                          });
                          setQtdAjuste('');
                          setObsAjuste('');
                          setModalVariacaoEntrada(null);
                        }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <span className={`badge ${v.estoque <= v.estoqueMinimo ? 'badge-yellow' : 'badge-green'}`}>
                          {v.estoque} un.
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal entrada / ajuste */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal.tipo === 'entrada' ? (
                  <><ArrowDown size={16} style={{ color: 'var(--green)', verticalAlign: -2 }} /> Registrar entrada</>
                ) : (
                  <><RefreshCw size={16} style={{ color: 'var(--blue)', verticalAlign: -2 }} /> Ajustar estoque</>
                )}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* Info produto */}
              <div className="est-modal-prod">
                <div className="est-modal-prod-nome">{modal.produto.nome}</div>
                <div className="est-modal-prod-info">
                  <span>Estoque atual: <strong>{modal.produto.estoque} un.</strong></span>
                  <span>Mínimo: <strong>{modal.produto.estoqueMinimo} un.</strong></span>
                </div>
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 14, marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label">
                    {modal.tipo === 'entrada' ? 'Quantidade a adicionar' : 'Novo estoque total'}
                  </label>
                  <div className="est-qtd-input-wrap">
                    <button className="cx-qtd-btn" onClick={() => setQtdAjuste(q => String(Math.max(0, parseInt(q || '0') - 1)))}>
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={qtdAjuste}
                      onChange={e => setQtdAjuste(e.target.value)}
                      style={{ textAlign: 'center', fontWeight: 600, fontSize: 18 }}
                    />
                    <button className="cx-qtd-btn" onClick={() => setQtdAjuste(q => String(parseInt(q || '0') + 1))}>
                      <Plus size={13} />
                    </button>
                  </div>
                  {modal.tipo === 'entrada' && qtdAjuste && parseInt(qtdAjuste) > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
                      Novo total: {modal.produto.estoque + parseInt(qtdAjuste)} un.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    value={obsAjuste}
                    onChange={e => setObsAjuste(e.target.value)}
                    placeholder={modal.tipo === 'entrada' ? 'Ex: Compra de fornecedor' : 'Ex: Contagem física'}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={confirmarAjuste}
                disabled={!qtdAjuste || parseInt(qtdAjuste) < 0}
              >
                {modal.tipo === 'entrada' ? 'Registrar entrada' : 'Salvar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
