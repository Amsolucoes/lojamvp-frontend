import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, CreditCard, Users, Check, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import './Planos.css';

interface Plano {
  id: string;
  nome: string;
  valor: number;
  servicosIds: string | null;
  ativo: boolean;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
}

interface Assinante {
  assinaturaId: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  planoId: string;
  planoNome: string;
  valor: number;
  diaVencimento: number;
  pagoNoMes: boolean;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Planos() {
  const { clientes } = useApp();
  const [aba, setAba] = useState<'planos' | 'assinantes'>('planos');

  const [planos, setPlanos] = useState<Plano[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Modal de plano
  const [modalPlano, setModalPlano] = useState<'novo' | 'editar' | null>(null);
  const [planoEdit, setPlanoEdit] = useState<Plano | null>(null);
  const [formPlano, setFormPlano] = useState({ nome: '', valor: '', servicosIds: [] as string[] });

  // Modal de vincular assinante
  const [modalAssinante, setModalAssinante] = useState(false);
  const [formAssinante, setFormAssinante] = useState({ clienteId: '', planoId: '', diaVencimento: '10' });
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const [pls, svs, ass] = await Promise.all([
        api.get<Plano[]>('/api/planos'),
        api.get<Servico[]>('/api/servicos'),
        api.get<Assinante[]>('/api/planos/assinantes'),
      ]);
      setPlanos(pls);
      setServicos(svs);
      setAssinantes(ass);
    } catch (e) {
      showToast('Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  // ── Planos ──────────────────────────────────────────────────────
  function abrirNovoPlano() {
    setFormPlano({ nome: '', valor: '', servicosIds: [] });
    setPlanoEdit(null);
    setErroModal('');
    setModalPlano('novo');
  }

  function abrirEditarPlano(p: Plano) {
    setFormPlano({
      nome: p.nome,
      valor: String(p.valor),
      servicosIds: p.servicosIds ? p.servicosIds.split(',').filter(Boolean) : [],
    });
    setPlanoEdit(p);
    setErroModal('');
    setModalPlano('editar');
  }

  async function salvarPlano() {
    const valor = parseFloat(formPlano.valor);
    if (!formPlano.nome.trim() || !valor || valor <= 0) {
      setErroModal('Informe nome e valor válidos.');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: formPlano.nome.trim(),
        valor,
        servicosIds: formPlano.servicosIds.join(',') || null,
      };
      if (modalPlano === 'novo') {
        await api.post('/api/planos', payload);
      } else if (planoEdit) {
        await api.put(`/api/planos/${planoEdit.id}`, payload);
      }
      setModalPlano(null);
      await carregar();
      showToast(modalPlano === 'novo' ? 'Plano criado!' : 'Plano atualizado!');
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Plano) {
    try {
      await api.patch(`/api/planos/${p.id}/ativo`, {});
      await carregar();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function excluirPlano(p: Plano) {
    if (!confirm(`Excluir o plano "${p.nome}"?`)) return;
    try {
      await api.delete(`/api/planos/${p.id}`);
      await carregar();
      showToast('Plano excluído');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  function toggleServico(id: string) {
    setFormPlano(f => ({
      ...f,
      servicosIds: f.servicosIds.includes(id)
        ? f.servicosIds.filter(s => s !== id)
        : [...f.servicosIds, id],
    }));
  }

  // ── Assinantes ──────────────────────────────────────────────────
  function abrirVincular() {
    setFormAssinante({ clienteId: '', planoId: '', diaVencimento: '10' });
    setErroModal('');
    setModalAssinante(true);
  }

  async function vincular() {
    if (!formAssinante.clienteId || !formAssinante.planoId) {
      setErroModal('Escolha o cliente e o plano.');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/api/planos/assinantes', {
        clienteId: formAssinante.clienteId,
        planoId: formAssinante.planoId,
        diaVencimento: parseInt(formAssinante.diaVencimento) || 10,
      });
      setModalAssinante(false);
      await carregar();
      showToast('Cliente vinculado ao plano!');
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPagamento(a: Assinante, pago: boolean) {
    try {
      await api.post(`/api/planos/assinantes/${a.assinaturaId}/pagamento`, { pago });
      await carregar();
      showToast(pago ? 'Marcado como pago' : 'Marcado como pendente');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function cancelarAssinatura(a: Assinante) {
    if (!confirm(`Cancelar o plano de ${a.clienteNome}?`)) return;
    try {
      await api.patch(`/api/planos/assinantes/${a.assinaturaId}/cancelar`, {});
      await carregar();
      showToast('Plano cancelado');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const planosAtivos = planos.filter(p => p.ativo);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planos</h1>
          <p className="page-subtitle">Planos de assinatura e clientes vinculados</p>
        </div>
        {aba === 'planos'
          ? <button className="btn-primary" onClick={abrirNovoPlano}><Plus size={15} style={{ verticalAlign: -2 }} /> Novo plano</button>
          : <button className="btn-primary" onClick={abrirVincular}><Plus size={15} style={{ verticalAlign: -2 }} /> Vincular cliente</button>}
      </div>

      {/* Abas */}
      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'planos' ? ' ativo' : ''}`} onClick={() => setAba('planos')}>
          <CreditCard size={15} /> Planos
        </button>
        <button className={`planos-tab${aba === 'assinantes' ? ' ativo' : ''}`} onClick={() => setAba('assinantes')}>
          <Users size={15} /> Assinantes ({assinantes.length})
        </button>
      </div>

      {carregando ? (
        <div className="card"><div className="empty"><p>Carregando...</p></div></div>
      ) : aba === 'planos' ? (
        // ── ABA PLANOS ──
        planos.length === 0 ? (
          <div className="card">
            <div className="empty">
              <CreditCard size={36} />
              <p>Nenhum plano cadastrado.</p>
              <button className="btn-primary" onClick={abrirNovoPlano} style={{ marginTop: 12 }}>Criar primeiro plano</button>
            </div>
          </div>
        ) : (
          <div className="planos-grid">
            {planos.map(p => {
              const svs = p.servicosIds ? p.servicosIds.split(',').filter(Boolean) : [];
              return (
                <div key={p.id} className={`plano-card${!p.ativo ? ' inativo' : ''}`}>
                  <div className="plano-card-top">
                    <div className="plano-nome">{p.nome}</div>
                    <div className="plano-acoes">
                      <button className="btn-ghost" title="Editar" onClick={() => abrirEditarPlano(p)}><Edit2 size={13} /></button>
                      <button className="btn-ghost" title={p.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternarAtivo(p)}><Power size={13} /></button>
                      <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => excluirPlano(p)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="plano-valor">{fmt(p.valor)}<span>/mês</span></div>
                  {svs.length > 0 && (
                    <div className="plano-servicos">
                      {svs.map(sid => {
                        const s = servicos.find(x => x.id === sid);
                        return s ? <span key={sid} className="plano-servico-tag">{s.nome}</span> : null;
                      })}
                    </div>
                  )}
                  {!p.ativo && <div className="plano-inativo-badge">Inativo</div>}
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ── ABA ASSINANTES ──
        assinantes.length === 0 ? (
          <div className="card">
            <div className="empty">
              <Users size={36} />
              <p>Nenhum cliente com plano ainda.</p>
              <button className="btn-primary" onClick={abrirVincular} style={{ marginTop: 12 }}>Vincular cliente</button>
            </div>
          </div>
        ) : (
          <div className="card">
            {/* Desktop */}
            <div className="table-wrap planos-desktop">
              <table>
                <thead>
                  <tr><th>Cliente</th><th>Plano</th><th>Valor</th><th>Venc.</th><th>Este mês</th><th></th></tr>
                </thead>
                <tbody>
                  {assinantes.map(a => (
                    <tr key={a.assinaturaId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.clienteNome}</div>
                        {a.clienteTelefone && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.clienteTelefone}</div>}
                      </td>
                      <td style={{ fontSize: 13 }}>{a.planoNome}</td>
                      <td style={{ fontSize: 13 }}>{fmt(a.valor)}</td>
                      <td style={{ fontSize: 13 }}>Dia {a.diaVencimento}</td>
                      <td>
                        {a.pagoNoMes
                          ? <span className="badge badge-green">Pago</span>
                          : <span className="badge badge-accent">Pendente</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {a.pagoNoMes
                            ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => marcarPagamento(a, false)}>Desfazer</button>
                            : <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} onClick={() => marcarPagamento(a, true)}><Check size={13} /> Pagar</button>}
                          <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => cancelarAssinatura(a)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="planos-mobile">
              {assinantes.map(a => (
                <div key={a.assinaturaId} className="assinante-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.clienteNome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.planoNome} · {fmt(a.valor)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Vencimento dia {a.diaVencimento}</div>
                    </div>
                    {a.pagoNoMes
                      ? <span className="badge badge-green">Pago</span>
                      : <span className="badge badge-accent">Pendente</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {a.pagoNoMes
                      ? <button className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => marcarPagamento(a, false)}>Desfazer</button>
                      : <button className="btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => marcarPagamento(a, true)}>Marcar pago</button>}
                    <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => cancelarAssinatura(a)}>Cancelar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Modal novo/editar plano */}
      {modalPlano && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPlano(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modalPlano === 'novo' ? 'Novo plano' : 'Editar plano'}</h2>
              <button className="btn-ghost" onClick={() => setModalPlano(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Nome do plano *</label>
                <input value={formPlano.nome} onChange={e => setFormPlano(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Cabelo + Barba" autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Valor mensal (R$) *</label>
                <input type="number" min={0} step={0.01} value={formPlano.valor}
                  onChange={e => setFormPlano(f => ({ ...f, valor: e.target.value }))}
                  placeholder="159,90" />
              </div>
              {servicos.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Serviços incluídos <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <div className="plano-svc-list">
                    {servicos.map(s => (
                      <label key={s.id} className="plano-svc-check">
                        <input type="checkbox" checked={formPlano.servicosIds.includes(s.id)}
                          onChange={() => toggleServico(s.id)} />
                        <span>{s.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {erroModal && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroModal}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPlano(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarPlano} disabled={salvando}>
                {salvando ? 'Salvando...' : (modalPlano === 'novo' ? 'Criar plano' : 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular cliente */}
      {modalAssinante && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAssinante(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Vincular cliente a um plano</h2>
              <button className="btn-ghost" onClick={() => setModalAssinante(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Cliente *</label>
                <select value={formAssinante.clienteId} onChange={e => setFormAssinante(f => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Plano *</label>
                <select value={formAssinante.planoId} onChange={e => setFormAssinante(f => ({ ...f, planoId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {planosAtivos.map(p => <option key={p.id} value={p.id}>{p.nome} — {fmt(p.valor)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dia do vencimento</label>
                <input type="number" min={1} max={28} value={formAssinante.diaVencimento}
                  onChange={e => setFormAssinante(f => ({ ...f, diaVencimento: e.target.value }))} />
              </div>
              {erroModal && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroModal}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAssinante(false)}>Cancelar</button>
              <button className="btn-primary" onClick={vincular} disabled={salvando}>
                {salvando ? 'Vinculando...' : 'Vincular'}
              </button>
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