import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Users, Edit2, Percent } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface Servico {
  id: string;
  nome: string;
}

interface ComissaoServico {
  id: string;
  servicoId: string;
  comissaoPercentual: number;
}

interface Profissional {
  id: string;
  nome: string;
  ativo: boolean;
  comissaoPadraoPercentual: number | null;
  comissoesPorServico: ComissaoServico[];
}

export function Funcionarios() {
  const { sucesso, erro } = useToast();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', comissaoPadraoPercentual: '', ativo: true });
  const [saving, setSaving] = useState(false);

  const [modalComissoes, setModalComissoes] = useState<Profissional | null>(null);
  const [novaComissaoServicoId, setNovaComissaoServicoId] = useState('');
  const [novaComissaoValor, setNovaComissaoValor] = useState('');

  const [confirmDel, setConfirmDel] = useState<Profissional | null>(null);

  function carregar() {
    setLoading(true);
    api.get<Profissional[]>('/api/funcionarios').then(setProfissionais).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    carregar();
    api.get<Servico[]>('/api/servicos').then(setServicos).catch(() => {});
  }, []);

  function abrirNovo() {
    setEditandoId(null);
    setForm({ nome: '', comissaoPadraoPercentual: '', ativo: true });
    setModal('novo');
  }

  function abrirEditar(p: Profissional) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      comissaoPadraoPercentual: p.comissaoPadraoPercentual != null ? String(p.comissaoPadraoPercentual) : '',
      ativo: p.ativo,
    });
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim()) { erro('Preencha o nome.'); return; }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        comissaoPadraoPercentual: form.comissaoPadraoPercentual ? parseFloat(form.comissaoPadraoPercentual) : null,
        ativo: form.ativo,
      };
      if (modal === 'novo') await api.post('/api/funcionarios', payload);
      else await api.put(`/api/funcionarios/${editandoId}`, payload);
      await carregar();
      setModal(null);
      sucesso('Funcionário salvo!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function alternarAtivo(p: Profissional) {
    try {
      await api.patch(`/api/funcionarios/${p.id}/ativo`, {});
      carregar();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      const res = await api.delete<any>(`/api/funcionarios/${confirmDel.id}`);
      setConfirmDel(null);
      carregar();
      sucesso(res?.mensagem ?? 'Removido.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function abrirComissoes(p: Profissional) {
    setModalComissoes(p);
    setNovaComissaoServicoId('');
    setNovaComissaoValor('');
  }

  async function adicionarComissaoServico() {
    if (!modalComissoes || !novaComissaoServicoId || !novaComissaoValor) {
      erro('Escolha o serviço e informe o percentual.');
      return;
    }
    try {
      await api.post(`/api/funcionarios/${modalComissoes.id}/comissoes-servico`, {
        servicoId: novaComissaoServicoId,
        comissaoPercentual: parseFloat(novaComissaoValor),
      });
      const atualizados = await api.get<Profissional[]>('/api/funcionarios');
      setProfissionais(atualizados);
      const atualizado = atualizados.find(p => p.id === modalComissoes.id);
      if (atualizado) setModalComissoes(atualizado);
      setNovaComissaoServicoId('');
      setNovaComissaoValor('');
      sucesso('Comissão do serviço definida!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function removerComissaoServico(comissaoId: string) {
    if (!modalComissoes) return;
    try {
      await api.delete(`/api/funcionarios/comissoes-servico/${comissaoId}`);
      const atualizados = await api.get<Profissional[]>('/api/funcionarios');
      setProfissionais(atualizados);
      const atualizado = atualizados.find(p => p.id === modalComissoes.id);
      if (atualizado) setModalComissoes(atualizado);
      sucesso('Exceção removida.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function nomeServico(servicoId: string) {
    return servicos.find(s => s.id === servicoId)?.nome ?? '—';
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="page-subtitle">Cadastro de profissionais e comissões</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo funcionário
        </button>
      </div>

      {loading ? (
        <div className="card"><div className="empty"><div className="spinner" /></div></div>
      ) : profissionais.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Users size={36} />
            <p>Nenhum funcionário cadastrado ainda.</p>
            <button className="btn-primary" onClick={abrirNovo} style={{ marginTop: 12 }}>Cadastrar primeiro funcionário</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profissionais.map(p => (
            <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.nome}
                    {!p.ativo && <span className="badge badge-accent" style={{ fontSize: 10 }}>Inativo</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                    Comissão padrão: {p.comissaoPadraoPercentual != null ? `${p.comissaoPadraoPercentual}%` : 'não definida'}
                  </div>
                  {p.comissoesPorServico.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {p.comissoesPorServico.map(c => (
                        <span key={c.id} className="badge badge-accent" style={{ fontSize: 11 }}>
                          {nomeServico(c.servicoId)}: {c.comissaoPercentual}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => abrirComissoes(p)}>
                    <Percent size={13} /> Comissões
                  </button>
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(p)}><Edit2 size={14} /></button>
                  <button className="btn-ghost" title={p.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternarAtivo(p)}>
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => setConfirmDel(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'novo' ? 'Novo funcionário' : 'Editar funcionário'}</h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: João Silva" autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Comissão padrão (%) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="number" min={0} max={100} step={0.1} value={form.comissaoPadraoPercentual}
                    onChange={e => setForm(f => ({ ...f, comissaoPadraoPercentual: e.target.value }))} placeholder="Ex: 40" />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Aplicada a todos os serviços, exceto onde houver uma comissão específica cadastrada.
                  </p>
                </div>
                {modal === 'editar' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.ativo} style={{ width: 16, height: 16, margin: 0 }}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    <span>Funcionário ativo</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : modal === 'novo' ? 'Criar funcionário' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal comissões por serviço */}
      {modalComissoes && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalComissoes(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Comissões — {modalComissoes.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalComissoes(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Comissão padrão: <strong>{modalComissoes.comissaoPadraoPercentual != null ? `${modalComissoes.comissaoPadraoPercentual}%` : 'não definida'}</strong>.
                Cadastre abaixo exceções por serviço específico.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {modalComissoes.comissoesPorServico.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma exceção cadastrada — usa sempre a comissão padrão.</p>
                ) : modalComissoes.comissoesPorServico.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>{nomeServico(c.servicoId)} — <strong>{c.comissaoPercentual}%</strong></span>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removerComissaoServico(c.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Nova exceção</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={novaComissaoServicoId} onChange={e => setNovaComissaoServicoId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Selecione o serviço...</option>
                    {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <input type="number" min={0} max={100} step={0.1} value={novaComissaoValor}
                    onChange={e => setNovaComissaoValor(e.target.value)} placeholder="%" style={{ width: 90 }} />
                  <button className="btn-primary" onClick={adicionarComissaoServico}>Adicionar</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalComissoes(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir funcionário</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nome}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                Se ele já tiver atendimentos ou comissões vinculadas, será apenas desativado em vez de excluído.
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