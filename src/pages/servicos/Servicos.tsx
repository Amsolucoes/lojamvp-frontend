import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Scissors, X, Search, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Servicos.css';

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  duracaoMin: number;
  ativo: boolean;
  criadoEm: string;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

type FormData = Omit<Servico, 'id' | 'criadoEm'>;
const EMPTY: FormData = { nome: '', categoria: '', preco: 0, duracaoMin: 30, ativo: true };

export function Servicos() {
  const { sucesso, erro } = useToast();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<Servico | null>(null);
  const [saving, setSaving] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  useEffect(() => { carregar(); }, []);

  function carregar() {
    api.get<Servico[]>('/api/servicos').then(setServicos).catch(() => {});
  }

  const categorias = [...new Set(servicos.map(s => s.categoria).filter(Boolean))];

  const lista = servicos.filter(s => {
    const buscaOk = s.nome.toLowerCase().includes(busca.toLowerCase());
    const catOk = catFiltro === 'todas' || s.categoria === catFiltro;
    return buscaOk && catOk;
  });

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  useEffect(() => { setPagina(1); }, [busca, catFiltro, porPagina]);

  function abrirNovo() {
    setForm(EMPTY);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(s: Servico) {
    setForm({ nome: s.nome, categoria: s.categoria, preco: s.preco, duracaoMin: s.duracaoMin, ativo: s.ativo });
    setEditId(s.id);
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim()) { erro('Digite o nome do serviço.'); return; }
    setSaving(true);
    try {
      if (modal === 'novo') {
        await api.post('/api/servicos', form);
      } else if (editId) {
        await api.put(`/api/servicos/${editId}`, form);
      }
      carregar();
      sucesso(modal === 'novo' ? 'Serviço cadastrado.' : 'Serviço atualizado.');
      setModal(null);
    } catch (e) {
      erro('Erro ao salvar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      await api.delete(`/api/servicos/${confirmDel.id}`);
      carregar();
      sucesso(`"${confirmDel.nome}" excluído.`);
      setConfirmDel(null);
    } catch (e) {
      erro((e as Error).message);
      setConfirmDel(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Serviços</h1>
          <p className="page-subtitle">{servicos.length} serviço(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo serviço
        </button>
      </div>

      {/* Filtros */}
      <div className="prod-filters">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Buscar serviço..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="cat-tabs">
          <button className={`cat-tab${catFiltro === 'todas' ? ' active' : ''}`} onClick={() => setCatFiltro('todas')}>Todas</button>
          {categorias.map(c => (
            <button key={c} className={`cat-tab${catFiltro === c ? ' active' : ''}`} onClick={() => setCatFiltro(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>
            <Scissors size={32} /><p>Nenhum serviço encontrado.</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="table-wrap serv-table-desktop">
              <table>
                <thead>
                  <tr><th>Serviço</th><th>Categoria</th><th>Duração</th><th>Preço</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {listaPaginada.map(s => (
                    <tr key={s.id}>
                      <td><div style={{ fontWeight: 500 }}>{s.nome}</div></td>
                      <td><span className="badge badge-accent">{s.categoria}</span></td>
                      <td style={{ color: 'var(--text-2)' }}><Clock size={12} style={{ verticalAlign: -2 }} /> {fmtDuracao(s.duracaoMin)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(s.preco)}</td>
                      <td><span className={`badge ${s.ativo ? 'badge-green' : 'badge-red'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-ghost" onClick={() => abrirEditar(s)} title="Editar"><Edit2 size={14} /></button>
                          <button className="btn-ghost" onClick={() => setConfirmDel(s)} title="Excluir" style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="serv-cards-mobile">
              {listaPaginada.map(s => (
                <div key={s.id} className="serv-card-mobile">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{s.nome}</div>
                      <span className="badge badge-accent" style={{ fontSize: 10, marginTop: 4 }}>{s.categoria}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" onClick={() => abrirEditar(s)}><Edit2 size={14} /></button>
                      <button className="btn-ghost" onClick={() => setConfirmDel(s)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}><Clock size={12} style={{ verticalAlign: -2 }} /> {fmtDuracao(s.duracaoMin)}</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 15 }}>{fmt(s.preco)}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`badge ${s.ativo ? 'badge-green' : 'badge-red'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {lista.length > 0 && (
        <div className="prod-paginacao">
          <div className="prod-pag-info">
            Mostrando {(paginaSegura - 1) * porPagina + 1}–{Math.min(paginaSegura * porPagina, lista.length)} de {lista.length}
          </div>
          <div className="prod-pag-controles">
            <select value={porPagina} onChange={e => setPorPagina(+e.target.value)} className="prod-pag-select">
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
            <div className="prod-pag-botoes">
              <button className="btn-secondary" disabled={paginaSegura <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
              <span className="prod-pag-atual">{paginaSegura} / {totalPaginas}</span>
              <button className="btn-secondary" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Próxima</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'novo' ? 'Novo serviço' : 'Editar serviço'}</h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} autoFocus
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Banho cão pequeno" />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <input value={form.categoria} list="cat-servicos"
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ex: Banho, Tosa..." />
                  <datalist id="cat-servicos">
                    {categorias.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Preço (R$)</label>
                    <input type="number" min={0} step={0.01}
                      value={form.preco === 0 ? '' : form.preco}
                      onChange={e => setForm(f => ({ ...f, preco: e.target.value === '' ? 0 : +e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duração (min)</label>
                    <input type="number" min={5} step={5}
                      value={form.duracaoMin}
                      onChange={e => setForm(f => ({ ...f, duracaoMin: +e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select value={form.ativo ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'true' }))}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving}>
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
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir serviço</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nome}</strong>?
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