import { useState } from 'react';
import { Plus, X, Trash2, Truck, Edit2, Phone, Mail, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Fornecedor } from '../../types';
import { useToast } from '../../context/ToastContext';
import { formatarTelefone } from '../../utils/mascaras';
import { Paginacao } from '@/components/Paginacao';

function formatarCnpjCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ: 00.000.000/0000-00
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

type FormData = Omit<Fornecedor, 'id' | 'criadoEm' | 'qtdProdutos'>;
const EMPTY: FormData = { nome: '', cnpjCpf: '', telefone: '', email: '', endereco: '', observacoes: '', ativo: true };

export function Fornecedores() {
  const { fornecedores, addFornecedor, updateFornecedor, deleteFornecedor } = useApp();
  const { sucesso, erro } = useToast();

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Fornecedor | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(15);

  const lista = fornecedores.filter(f => {
    const passaBusca = !busca ||
      f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (f.cnpjCpf?.includes(busca) ?? false) ||
      (f.telefone?.includes(busca) ?? false);
    const passaStatus = statusFiltro === 'todos' ? true : statusFiltro === 'ativo' ? f.ativo : !f.ativo;
    return passaBusca && passaStatus;
  });
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  function abrirNovo() {
    setForm(EMPTY);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(f: Fornecedor) {
    setForm({
      nome: f.nome, cnpjCpf: f.cnpjCpf ?? '', telefone: f.telefone ?? '',
      email: f.email ?? '', endereco: f.endereco ?? '', observacoes: f.observacoes ?? '',
      ativo: f.ativo,
    });
    setEditId(f.id);
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim()) { erro('Preencha o nome.'); return; }
    setSaving(true);
    try {
      if (modal === 'novo') await addFornecedor(form);
      else if (editId) await updateFornecedor(editId, form);
      setModal(null);
      sucesso(modal === 'novo' ? 'Fornecedor cadastrado!' : 'Fornecedor atualizado!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      await deleteFornecedor(confirmDel.id);
      setConfirmDel(null);
      sucesso('Fornecedor removido.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <p className="page-subtitle">{fornecedores.length} fornecedor(es) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo fornecedor
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar por nome, CNPJ/CPF ou telefone..." value={busca}
          onChange={e => { setBusca(e.target.value); setPagina(1); }} style={{ flex: 1, minWidth: 200 }} />
        <select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value as any); setPagina(1); }} style={{ width: 'auto', minWidth: 130 }}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Só ativos</option>
          <option value="inativo">Só inativos</option>
        </select>
        {(busca || statusFiltro !== 'todos') && (
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setBusca(''); setStatusFiltro('todos'); }}>
            Limpar filtros
          </button>
        )}
      </div>

      {fornecedores.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Truck size={36} />
            <p>Nenhum fornecedor cadastrado ainda.</p>
            <button className="btn-primary" onClick={abrirNovo} style={{ marginTop: 12 }}>Cadastrar primeiro fornecedor</button>
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Truck size={36} />
            <p>Nenhum fornecedor encontrado com esse filtro.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listaPaginada.map(f => (
            <div key={f.id} className="card" style={{ opacity: f.ativo ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.nome}
                    {!f.ativo && <span className="badge badge-accent" style={{ fontSize: 10 }}>Inativo</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6, fontSize: 13, color: 'var(--text-3)' }}>
                    {f.telefone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{f.telefone}</span>}
                    {f.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{f.email}</span>}
                    {f.endereco && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{f.endereco}</span>}
                    {f.cnpjCpf && <span>CNPJ/CPF: {f.cnpjCpf}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    {f.qtdProdutos} produto(s) deste fornecedor
                  </div>
                  {f.observacoes && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{f.observacoes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(f)}><Edit2 size={14} /></button>
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => setConfirmDel(f)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lista.length > 0 && (
        <Paginacao
          paginaAtual={paginaSegura}
          totalItens={lista.length}
          porPagina={porPagina}
          onMudarPagina={setPagina}
          onMudarPorPagina={setPorPagina}
          opcoesPorPagina={[15, 30, 60]}
        />
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal === 'novo' ? 'Novo fornecedor' : 'Editar fornecedor'}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Distribuidora ABC" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.telefone ?? ''} onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ/CPF <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.cnpjCpf ?? ''} onChange={e => setForm(f => ({ ...f, cnpjCpf: formatarCnpjCpf(e.target.value) }))} placeholder="00.000.000/0000-00" />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@fornecedor.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.endereco ?? ''} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observações</label>
                  <textarea rows={2} value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Prazo de entrega, condições de pagamento..." />
                </div>
                {modal === 'editar' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', gridColumn: '1/-1' }}>
                    <input type="checkbox" checked={form.ativo} style={{ width: 16, height: 16, margin: 0 }}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    <span>Fornecedor ativo</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
                {saving ? 'Salvando...' : modal === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir fornecedor</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nome}</strong>?
                {confirmDel.qtdProdutos > 0 && ' Como há produtos vinculados, ele será apenas desativado em vez de excluído.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
