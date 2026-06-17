import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Produto } from '../../types';
import { api } from '../../services/api';
import './Produtos.css';

interface Variacao {
  id?: string;
  tamanho?: string;
  cor?: string;
  outroCampo?: string;
  estoque: number;
  estoqueMinimo: number;
  ativo?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type FormData = Omit<Produto, 'id' | 'criadoEm'>;
const EMPTY: FormData = {
  nome: '', categoria: '', precoCusto: 0, precoVenda: 0,
  estoque: 0, estoqueMinimo: 3, codigoBarras: '', descricao: '', ativo: true,
};

export function Produtos() {
  const { produtos, deleteProduto, recarregar } = useApp();
  const [busca, setBusca]         = useState('');
  const [catFiltro, setCat]       = useState<string>('todas');
  const [statusFiltro, setStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [modal, setModal]         = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormData>(EMPTY);
  const [confirmDel, setDel]      = useState<string | null>(null);
  const [cats, setCats]           = useState<{id: string; nome: string}[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [camposExtras, setCamposExtras] = useState<any[]>([]);
  const [temVariacoes, setTemVariacoes] = useState(false);

  useEffect(() => {
    api.get<any[]>('/api/perfis/loja/categorias').then(res => {
      if (res.length > 0) {
        setCats(res);
        setForm(f => ({ ...f, categoria: f.categoria || res[0].nome }));
      } else {
        setCats([
          { id: '1', nome: 'Semi Joias' },
          { id: '2', nome: 'Maquiagem' },
          { id: '3', nome: 'Acessórios' },
          { id: '4', nome: 'Outro' },
        ]);
      }
    });

    api.get<any[]>('/api/perfis/loja/campos-extras').then(res => {
      setCamposExtras(res);
      const temTamanhoOuCor = res.some(c => c.chave === 'tamanho' || c.chave === 'cor');
      setTemVariacoes(temTamanhoOuCor);
    }).catch(() => {});
  }, []);

  const lista = produtos.filter(p => {
    const ok     = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
                   (p.codigoBarras?.includes(busca) ?? false);
    const catOk  = catFiltro === 'todas' || p.categoria === catFiltro;
    const statOk = statusFiltro === 'todos' || (statusFiltro === 'ativo' ? p.ativo : !p.ativo);
    return ok && catOk && statOk;
  });

  function abrirNovo() {
    setForm({ ...EMPTY, categoria:cats[0]?.nome ?? ''});
    setVariacoes([]);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(p: Produto) {
    setForm({ ...p });
    setEditId(p.id);
    setModal('editar');
    api.get<any[]>(`/api/produtos/${p.id}/variacoes`).then(res => {
      setVariacoes(res.map((v: any) => ({
        id: v.id, tamanho: v.tamanho, cor: v.cor,
        outroCampo: v.outroCampo, estoque: v.estoque,
        estoqueMinimo: v.estoqueMinimo, ativo: v.ativo,
      })));
    }).catch(() => setVariacoes([]));
  }

  async function salvar() {
    if (!form.nome.trim()) return;
    try {
      let produtoId: string;
      if (modal === 'novo') {
        const novo = await api.post<any>('/api/produtos', form);
        produtoId = novo.id;
      } else if (editId) {
        await api.put(`/api/produtos/${editId}`, form);
        produtoId = editId;
      } else return;

      for (const v of variacoes) {
        if (v.id) await api.put(`/api/produtos/${produtoId}/variacoes/${v.id}`, v);
        else      await api.post(`/api/produtos/${produtoId}/variacoes`, v);
      }

      await recarregar();
      setModal(null);
    } catch (e) {
      alert('Erro ao salvar: ' + (e as Error).message);
    }
  }

  function confirmarDelete(id: string) { setDel(id); }
  function executarDelete() {
    if (confirmDel) { deleteProduto(confirmDel); setDel(null); }
  }

  const lucro = (p: Produto) => {
    if (p.precoCusto === 0) return null;
    return ((p.precoVenda - p.precoCusto) / p.precoCusto * 100).toFixed(0);
  };

  // Estoque calculado por variações
  const estoqueVariacoes    = variacoes.reduce((s, v) => s + v.estoque, 0);
  const estoqueMinVariacoes = variacoes.reduce((s, v) => s + v.estoqueMinimo, 0);
  const temVarsNoModal      = temVariacoes && variacoes.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="page-subtitle">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo produto
        </button>
      </div>

      {/* Filtros */}
      <div className="prod-filters">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nome ou código..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${catFiltro === 'todas' ? ' active' : ''}`} onClick={() => setCat('todas')}>Todas</button>
          {cats.map(c => (
            <button key={c.id} className={`cat-tab${catFiltro === c.nome ? ' active' : ''}`} onClick={() => setCat(c.nome)}>
              {c.nome}
            </button>
          ))}
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${statusFiltro === 'todos'   ? ' active' : ''}`} onClick={() => setStatus('todos')}>Todos</button>
          <button className={`cat-tab${statusFiltro === 'ativo'   ? ' active' : ''}`} onClick={() => setStatus('ativo')}>Ativos</button>
          <button className={`cat-tab${statusFiltro === 'inativo' ? ' active' : ''}`} onClick={() => setStatus('inativo')}>Inativos</button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>
            <Package size={32} /><p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <>
            {/* Tabela — desktop */}
            <div className="table-wrap prod-table-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th><th>Categoria</th><th>Custo</th>
                    <th>Venda</th><th>Margem</th><th>Estoque</th>
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="prod-nome">{p.nome}</div>
                        {p.codigoBarras && <div className="prod-cod">{p.codigoBarras}</div>}
                      </td>
                      <td><span className="badge badge-accent">{cats.find(c => c.nome === p.categoria)?.nome ?? p.categoria}</span></td>
                      <td style={{ color: 'var(--text-2)' }}>{fmt(p.precoCusto)}</td>
                      <td style={{ fontWeight: 500 }}>{fmt(p.precoVenda)}</td>
                      <td>{lucro(p) && <span className="badge badge-green">+{lucro(p)}%</span>}</td>
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
                          <span className={p.estoque <= p.estoqueMinimo ? 'estoque-baixo' : 'estoque-ok'}>
                            {p.estoque} un.
                          </span>
                        )}
                      </td>
                      <td><span className={`badge ${p.ativo ? 'badge-green' : 'badge-red'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-ghost" onClick={() => abrirEditar(p)} title="Editar"><Edit2 size={14} /></button>
                          <button className="btn-ghost" onClick={() => confirmarDelete(p.id)} title="Excluir" style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile */}
            <div className="prod-cards-mobile">
              {lista.map(p => (
                <div key={p.id} className="prod-card-mobile">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="prod-nome">{p.nome}</div>
                      {p.codigoBarras && <div className="prod-cod">{p.codigoBarras}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" onClick={() => abrirEditar(p)}><Edit2 size={14} /></button>
                      <button className="btn-ghost" onClick={() => confirmarDelete(p.id)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <span className="badge badge-accent">{cats.find(c => c.nome === p.categoria)?.nome ?? p.categoria}</span>
                    <span className={`badge ${p.ativo ? 'badge-green' : 'badge-red'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
                    {lucro(p) && <span className="badge badge-green">+{lucro(p)}%</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)' }}>Custo: <strong style={{ color: 'var(--text-2)' }}>{fmt(p.precoCusto)}</strong></span>
                    <span style={{ color: 'var(--text-3)' }}>Venda: <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmt(p.precoVenda)}</strong></span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {(p as any).variacoes?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(p as any).variacoes.map((v: any) => (
                          <span key={v.id} style={{ fontSize: 11, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: v.estoque <= v.estoqueMinimo ? 'var(--red)' : 'var(--green)' }}>
                            {[v.tamanho, v.cor].filter(Boolean).join('/')} — {v.estoque}un
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={p.estoque <= p.estoqueMinimo ? 'estoque-baixo' : 'estoque-ok'} style={{ fontSize: 12 }}>
                        Estoque: {p.estoque} un.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal novo/editar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal === 'novo' ? 'Novo produto' : 'Editar produto'}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Camiseta Básica" />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {cats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Código de barras</label>
                  <input value={form.codigoBarras} onChange={e => setForm(f => ({ ...f, codigoBarras: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Preço de custo (R$)</label>
                  <input type="number" min={0}
                    value={form.precoCusto === 0 ? '' : form.precoCusto}
                    onChange={e => setForm(f => ({ ...f, precoCusto: e.target.value === '' ? 0 : +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preço de venda (R$)</label>
                  <input type="number" min={0}
                    value={form.precoVenda === 0 ? '' : form.precoVenda}
                    onChange={e => setForm(f => ({ ...f, precoVenda: e.target.value === '' ? 0 : +e.target.value }))} />
                </div>

                {/* Estoque — desabilitado se tem variações */}
                <div className="form-group">
                  <label className="form-label">Estoque atual</label>
                  <input type="number" min={0}
                    value={temVarsNoModal ? estoqueVariacoes : (form.estoque === 0 ? '' : form.estoque)}
                    disabled={temVarsNoModal}
                    onChange={e => setForm(f => ({ ...f, estoque: e.target.value === '' ? 0 : +e.target.value }))}
                    style={temVarsNoModal ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
                  {temVarsNoModal && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Calculado pela grade</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Estoque mínimo (alerta)</label>
                  <input type="number" min={0}
                    value={temVarsNoModal ? estoqueMinVariacoes : (form.estoqueMinimo === 0 ? '' : form.estoqueMinimo)}
                    disabled={temVarsNoModal}
                    onChange={e => setForm(f => ({ ...f, estoqueMinimo: e.target.value === '' ? 0 : +e.target.value }))}
                    style={temVarsNoModal ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
                  {temVarsNoModal && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Calculado pela grade</p>}
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Descrição</label>
                  <textarea rows={2} value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Detalhes do produto (opcional)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select value={form.ativo ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'true' }))}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>

                {/* Variações */}
                {temVariacoes && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <label className="form-label" style={{ margin: 0 }}>Variações (Tamanho / Cor)</label>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setVariacoes(prev => [...prev, { tamanho: '', cor: '', estoque: 0, estoqueMinimo: 1 }])}>
                        + Adicionar
                      </button>
                    </div>
                    {variacoes.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                        Nenhuma variação cadastrada. Clique em "+ Adicionar".
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 32px', gap: 6 }}>
                          {['Tamanho', 'Cor', 'Estoque', 'Mín.', ''].map(h => (
                            <div key={h} style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                          ))}
                        </div>
                        {variacoes.map((v, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 32px', gap: 6, alignItems: 'center' }}>
                            {camposExtras.find(c => c.chave === 'tamanho')?.tipo === 'lista' ? (
                              <select value={v.tamanho ?? ''} onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, tamanho: e.target.value } : x))}>
                                <option value="">—</option>
                                {camposExtras.find(c => c.chave === 'tamanho')?.opcoes?.split(',').map((op: string) => (
                                  <option key={op.trim()} value={op.trim()}>{op.trim()}</option>
                                ))}
                              </select>
                            ) : (
                              <input value={v.tamanho ?? ''} placeholder="Tamanho"
                                onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, tamanho: e.target.value } : x))} />
                            )}
                            <input value={v.cor ?? ''} placeholder="Cor"
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, cor: e.target.value } : x))} />
                            <input type="number" min={0} value={v.estoque === 0 ? '' : v.estoque}
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, estoque: e.target.value === '' ? 0 : +e.target.value } : x))} />
                            <input type="number" min={0} value={v.estoqueMinimo === 0 ? '' : v.estoqueMinimo}
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, estoqueMinimo: +e.target.value } : x))} />
                            <button className="btn-ghost" style={{ color: 'var(--red)', padding: '4px' }}
                              onClick={() => setVariacoes(prev => prev.filter((_, j) => j !== i))}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {form.precoCusto > 0 && form.precoVenda > 0 && (
                  <div className="margem-preview">
                    Margem: <strong style={{ color: 'var(--green)' }}>
                      {((form.precoVenda - form.precoCusto) / form.precoCusto * 100).toFixed(1)}%
                    </strong>
                    &nbsp;· Lucro: <strong style={{ color: 'var(--green)' }}>
                      {fmt(form.precoVenda - form.precoCusto)}
                    </strong>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>
                {modal === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir produto</h2>
              <button className="btn-ghost" onClick={() => setDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>
                  {produtos.find(p => p.id === confirmDel)?.nome}
                </strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={executarDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}