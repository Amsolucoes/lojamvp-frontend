import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, X, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Cliente } from '../../types';
import './Clientes.css';

type FormData = Omit<Cliente, 'id' | 'criadoEm'>;
const EMPTY: FormData = { nome: '', telefone: '', cpf: '', email: '', endereco: '', observacoes: '', dataNascimento: undefined };

function fmtTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return v;
}

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function Clientes() {
  const { clientes, vendas, addCliente, updateCliente, deleteCliente } = useApp();
  const [busca, setBusca]    = useState('');
  const [modal, setModal]    = useState<'novo' | 'editar' | 'ver' | null>(null);
  const [editId, setEditId]  = useState<string | null>(null);
  const [form, setForm]      = useState<FormData>(EMPTY);
  const [confirmDel, setDel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const lista = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.cpf?.includes(busca) ?? false)
  );

  function abrirNovo() { setForm(EMPTY); setEditId(null); setModal('novo'); }

  function abrirEditar(c: Cliente) {
    setForm({ 
      nome: c.nome, telefone: c.telefone, cpf: c.cpf ?? '', 
      email: c.email ?? '', endereco: c.endereco ?? '', 
      observacoes: c.observacoes ?? '', 
      dataNascimento: c.dataNascimento ? c.dataNascimento.split('T')[0] : undefined 
    });
    setEditId(c.id);
    setModal('editar');
  }

  function abrirVer(c: Cliente) {
    setForm({ 
      nome: c.nome, telefone: c.telefone, cpf: c.cpf ?? '', 
      email: c.email ?? '', endereco: c.endereco ?? '', 
      observacoes: c.observacoes ?? '', 
      dataNascimento: c.dataNascimento ? c.dataNascimento.split('T')[0] : undefined 
    });
    setEditId(c.id);
    setModal('ver');
  }

  async function salvar() {
    if (!form.nome.trim() || !form.telefone.trim()) return;
    try {
      if (modal === 'novo') await addCliente(form);
      else if (editId) await updateCliente(editId, form);
      setModal(null);
      setToast(modal === 'novo' ? 'Cliente cadastrado!' : 'Cliente atualizado!');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast('Erro ao salvar cliente');
      setTimeout(() => setToast(null), 2500);
    }
  }

  function totalGasto(clienteId: string) {
    return vendas.filter(v => v.clienteId === clienteId).reduce((s, v) => s + v.totalFinal, 0);
  }

  function qtdCompras(clienteId: string) {
    return vendas.filter(v => v.clienteId === clienteId).length;
  }

  function ultimaCompra(clienteId: string) {
    const vs = vendas.filter(v => v.clienteId === clienteId);
    if (!vs.length) return null;
    return vs.sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())[0];
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const clienteAtivo = editId ? clientes.find(c => c.id === editId) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="cli-filters">
        <div className="search-wrap" style={{ maxWidth: 360 }}>
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de cards */}
      {lista.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Users size={36} />
            <p>Nenhum cliente encontrado.</p>
          </div>
        </div>
      ) : (
        <div className="cli-grid">
          {lista.map(c => {
            const compras = qtdCompras(c.id);
            const gasto   = totalGasto(c.id);
            const ultima  = ultimaCompra(c.id);
            return (
              <div key={c.id} className="cli-card" onClick={() => abrirVer(c)}>
                <div className="cli-card-top">
                  <div className="cli-avatar">{iniciais(c.nome)}</div>
                  <div className="cli-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost" onClick={() => abrirEditar(c)} title="Editar"><Edit2 size={13} /></button>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setDel(c.id)} title="Excluir"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="cli-nome">{c.nome}</div>
                <div className="cli-info"><Phone size={12} />{c.telefone}</div>
                {c.email && <div className="cli-info"><Mail size={12} />{c.email}</div>}
                {c.dataNascimento && (
                  <div className="cli-info">
                    🎂 {new Date(c.dataNascimento).toLocaleDateString('pt-BR')}
                  </div>
                )}
                <div className="cli-divider" />
                <div className="cli-stats">
                  <div>
                    <div className="cli-stat-val">{compras}</div>
                    <div className="cli-stat-label">compras</div>
                  </div>
                  <div>
                    <div className="cli-stat-val" style={{ color: 'var(--green)' }}>{fmt(gasto)}</div>
                    <div className="cli-stat-label">total gasto</div>
                  </div>
                </div>
                {ultima && (
                  <div className="cli-ultima">
                    Última compra: {new Date(ultima.criadaEm).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal === 'novo' ? 'Novo cliente' : 'Editar cliente'}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome completo *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria Silva" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone / WhatsApp *</label>
                  <input
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: fmtTel(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    value={form.cpf}
                    onChange={e => setForm(f => ({ ...f, cpf: fmtCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de nascimento <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="date"
                    value={form.dataNascimento ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value || undefined }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observações</label>
                  <textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Preferências, alergias, anotações..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={!form.nome.trim() || !form.telefone.trim()}>
                {modal === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver cliente */}
      {modal === 'ver' && clienteAtivo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cli-avatar cli-avatar-lg">{iniciais(clienteAtivo.nome)}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{clienteAtivo.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Cliente desde {new Date(clienteAtivo.criadoEm).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* Stats */}
              <div className="cli-modal-stats">
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-label">Compras</div>
                  <div className="stat-value">{qtdCompras(clienteAtivo.id)}</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-label">Total gasto</div>
                  <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>
                    {fmt(totalGasto(clienteAtivo.id))}
                  </div>
                </div>
              </div>

              {/* Dados */}
              <div className="cli-detail-list">
                <div className="cli-detail-row"><Phone size={14} /><span>{clienteAtivo.telefone}</span></div>
                {clienteAtivo.email    && <div className="cli-detail-row"><Mail size={14} /><span>{clienteAtivo.email}</span></div>}
                {clienteAtivo.endereco && <div className="cli-detail-row"><MapPin size={14} /><span>{clienteAtivo.endereco}</span></div>}
                {clienteAtivo.cpf      && <div className="cli-detail-row"><FileText size={14} /><span>CPF: {clienteAtivo.cpf}</span></div>}
                {clienteAtivo.dataNascimento && (
                  <div className="cli-detail-row">
                    <span style={{ fontSize: 14 }}>🎂</span>
                    <span>Nascimento: {new Date(clienteAtivo.dataNascimento).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {clienteAtivo.observacoes && (
                  <div className="cli-obs">{clienteAtivo.observacoes}</div>
                )}
              </div>

              {/* Histórico de compras */}
              {qtdCompras(clienteAtivo.id) > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Histórico de compras
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Data</th><th>Itens</th><th>Pagamento</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {vendas
                          .filter(v => v.clienteId === clienteAtivo.id)
                          .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                          .map(v => (
                            <tr key={v.id}>
                              <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                                {new Date(v.criadaEm).toLocaleDateString('pt-BR')}
                              </td>
                              <td style={{ fontSize: 12 }}>{v.itens.length} item(s)</td>
                              <td><span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>{v.formaPagamento}</span></td>
                              <td style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(v.totalFinal)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => abrirEditar(clienteAtivo)}>Editar dados</button>
              <button className="btn-primary" onClick={() => setModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir cliente</h2>
              <button className="btn-ghost" onClick={() => setDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>
                  {clientes.find(c => c.id === confirmDel)?.nome}
                </strong>? O histórico de compras será mantido.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteCliente(confirmDel); setDel(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-2)', border: '1px solid var(--accent-border)',
          color: 'var(--text-1)', padding: '12px 24px', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)', zIndex: 200, fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--green)' }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}
