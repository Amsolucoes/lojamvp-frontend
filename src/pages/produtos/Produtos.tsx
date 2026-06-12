import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Produto, Categoria } from '../../types';
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
  const { produtos, addProduto, updateProduto, deleteProduto, recarregar } = useApp();
  const [busca, setBusca]     = useState('');
  const [catFiltro, setCat]   = useState<string>('todas');
  const [modal, setModal]     = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [confirmDel, setDel]  = useState<string | null>(null);
  const [cats, setCats] = useState<{id: string; nome: string}[]>([]);
  const [variacoes, setVariacoes]   = useState<Variacao[]>([]);
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
    }});

    api.get<any[]>('/api/perfis/loja/campos-extras').then(res => {
      setCamposExtras(res);
      const temTamanhoOuCor = res.some(c => c.chave === 'tamanho' || c.chave === 'cor');
      setTemVariacoes(temTamanhoOuCor);
    }).catch(() => {});
  }, []);

  const lista = produtos.filter(p => {
    const ok = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
               (p.codigoBarras?.includes(busca) ?? false);
    const catOk = catFiltro === 'todas' || p.categoria === catFiltro;
    return ok && catOk;
  });

  function abrirNovo() {
    setForm(EMPTY);
    setVariacoes([]);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(p: Produto) {
    setForm({ ...p });
    setEditId(p.id);
    setModal('editar');
    // Carrega variações existentes
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
        // Recarrega produtos do contexto
        await recarregar();
      } else if (editId) {
        await api.put(`/api/produtos/${editId}`, form);
        produtoId = editId;
        await recarregar();
      } else return;

      // Salva variações
      for (const v of variacoes) {
        if (v.id) {
          await api.put(`/api/produtos/${produtoId}/variacoes/${v.id}`, v);
        } else {
          await api.post(`/api/produtos/${produtoId}/variacoes`, v);
        }
      }

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
          <input
            className="search-input"
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${catFiltro === 'todas' ? ' active' : ''}`} onClick={() => setCat('todas')}>Todas</button>
          {cats.map(c => (
            <button key={c.id} className={`cat-tab${catFiltro === c.nome ? ' active' : ''}`} onClick={() => setCat(c.nome)}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Venda</th>
                <th>Margem</th>
                <th>Estoque</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <Package size={32} />
                      <p>Nenhum produto encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : lista.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="prod-nome">{p.nome}</div>
                    {p.codigoBarras && <div className="prod-cod">{p.codigoBarras}</div>}
                  </td>
                  <td>
                    <span className="badge badge-accent">
                      {cats.find(c => c.nome === p.categoria)?.nome ?? p.categoria}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{fmt(p.precoCusto)}</td>
                  <td style={{ fontWeight: 500 }}>{fmt(p.precoVenda)}</td>
                  <td>
                    {lucro(p) && (
                      <span className="badge badge-green">+{lucro(p)}%</span>
                    )}
                  </td>
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
                  <td>
                    <span className={`badge ${p.ativo ? 'badge-green' : 'badge-red'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => abrirEditar(p)} title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => confirmarDelete(p.id)} title="Excluir"
                        style={{ color: 'var(--red)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Colar Dourado Delicado" />
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
                  <input type="number" min={0} step={0.01} value={form.precoCusto}
                    onChange={e => setForm(f => ({ ...f, precoCusto: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preço de venda (R$)</label>
                  <input type="number" min={0} step={0.01} value={form.precoVenda}
                    onChange={e => setForm(f => ({ ...f, precoVenda: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estoque atual</label>
                  <input type="number" min={0} value={form.estoque}
                    onChange={e => setForm(f => ({ ...f, estoque: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estoque mínimo (alerta)</label>
                  <input type="number" min={0} value={form.estoqueMinimo}
                    onChange={e => setForm(f => ({ ...f, estoqueMinimo: +e.target.value }))} />
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
                    <div style={{ 
                      display: 'flex', justifyContent: 'space-between', 
                      alignItems: 'center', marginBottom: 10,
                      paddingTop: 14, borderTop: '1px solid var(--border)'
                    }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Variações (Tamanho / Cor)
                      </label>
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
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 32px', gap: 6 }}>
                          {['Tamanho', 'Cor', 'Estoque', 'Mín.', ''].map(h => (
                            <div key={h} style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                          ))}
                        </div>
                        {variacoes.map((v, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 32px', gap: 6, alignItems: 'center' }}>
                            {/* Tamanho */}
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
                            {/* Cor */}
                            <input value={v.cor ?? ''} placeholder="Cor"
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, cor: e.target.value } : x))} />
                            {/* Estoque */}
                            <input type="number" min={0} value={v.estoque}
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, estoque: +e.target.value } : x))} />
                            {/* Mínimo */}
                            <input type="number" min={0} value={v.estoqueMinimo}
                              onChange={e => setVariacoes(prev => prev.map((x, j) => j === i ? { ...x, estoqueMinimo: +e.target.value } : x))} />
                            {/* Remover */}
                            <button className="btn-ghost" style={{ color: 'var(--red)', padding: '4px' }}
                              onClick={() => setVariacoes(prev => prev.filter((_, j) => j !== i))}>
                              ✕
                            </button>
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
