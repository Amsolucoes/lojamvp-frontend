import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Produto, Categoria } from '../../types';
import './Produtos.css';

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'semi-joias',  label: 'Semi Joias'  },
  { value: 'maquiagem',   label: 'Maquiagem'   },
  { value: 'acessorios',  label: 'Acessórios'  },
  { value: 'outro',       label: 'Outro'        },
];

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type FormData = Omit<Produto, 'id' | 'criadoEm'>;
const EMPTY: FormData = {
  nome: '', categoria: 'semi-joias', precoCusto: 0, precoVenda: 0,
  estoque: 0, estoqueMinimo: 3, codigoBarras: '', descricao: '', ativo: true,
};

export function Produtos() {
  const { produtos, addProduto, updateProduto, deleteProduto } = useApp();
  const [busca, setBusca]     = useState('');
  const [catFiltro, setCat]   = useState<string>('todas');
  const [modal, setModal]     = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [confirmDel, setDel]  = useState<string | null>(null);

  const lista = produtos.filter(p => {
    const ok = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
               (p.codigoBarras?.includes(busca) ?? false);
    const catOk = catFiltro === 'todas' || p.categoria === catFiltro;
    return ok && catOk;
  });

  function abrirNovo() {
    setForm(EMPTY);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(p: Produto) {
    setForm({ ...p });
    setEditId(p.id);
    setModal('editar');
  }

  function salvar() {
    if (!form.nome.trim()) return;
    if (modal === 'novo') {
      addProduto(form);
    } else if (editId) {
      updateProduto(editId, form);
    }
    setModal(null);
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
          {CATEGORIAS.map(c => (
            <button key={c.value} className={`cat-tab${catFiltro === c.value ? ' active' : ''}`} onClick={() => setCat(c.value)}>{c.label}</button>
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
                      {CATEGORIAS.find(c => c.value === p.categoria)?.label}
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
                    <span className={p.estoque <= p.estoqueMinimo ? 'estoque-baixo' : 'estoque-ok'}>
                      {p.estoque} un.
                    </span>
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
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}>
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
