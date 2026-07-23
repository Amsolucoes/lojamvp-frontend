import { useState, useEffect } from 'react';
import { Calendar, Check, Mail, FileCheck, Pencil, Trash2, X, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type Reserva = {
  id: number;
  dataInicio: string;
  dataFim: string;
  pessoas: number;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  valor: number;
  status: string;
  contratoEnviadoEm: string | null;
  criadoEm: string;
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  pendente_pagamento: { label: 'Pendente', cor: 'var(--yellow)' },
  confirmada: { label: 'Confirmada', cor: 'var(--green)' },
  cancelada: { label: 'Cancelada', cor: 'var(--red)' },
  expirada: { label: 'Expirada', cor: 'var(--text-3)' },
};

export function ListaReservasChacara() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendente_pagamento' | 'confirmada'>('todas');
  const { sucesso, erro: toastErro } = useToast();

  const [modalEditar, setModalEditar] = useState<Reserva | null>(null);
  const [formEditar, setFormEditar] = useState({ dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '' });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');

  const [modalExcluir, setModalExcluir] = useState<Reserva | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [modalNova, setModalNova] = useState(false);
  const [formNova, setFormNova] = useState({ dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '', valor: 0 });
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [erroNova, setErroNova] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setCarregando(true);
    api.get<Reserva[]>('/api/chacara/reservas')
      .then(setReservas)
      .catch(() => toastErro('Erro ao carregar reservas.'))
      .finally(() => setCarregando(false));
  }

  async function confirmar(id: number) {
    setConfirmando(id);
    try {
      await api.patch(`/api/chacara/reservas/${id}/confirmar`, {});
      sucesso('Reserva confirmada! E-mail e contrato enviados.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setConfirmando(null);
    }
  }

  function abrirEdicao(r: Reserva) {
    setFormEditar({
      dataInicio: r.dataInicio.slice(0, 10),
      dataFim: r.dataFim.slice(0, 10),
      pessoas: r.pessoas,
      clienteNome: r.clienteNome,
      clienteEmail: r.clienteEmail,
      clienteTelefone: r.clienteTelefone,
    });
    setErroEdicao('');
    setModalEditar(r);
  }

  async function salvarEdicao() {
    if (!modalEditar) return;
    setErroEdicao('');
    setSalvandoEdicao(true);
    try {
      await api.put(`/api/chacara/reservas/${modalEditar.id}`, formEditar);
      sucesso('Reserva atualizada.');
      setModalEditar(null);
      carregar();
    } catch (e) {
      setErroEdicao((e as Error).message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function confirmarExclusao() {
    if (!modalExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/api/chacara/reservas/${modalExcluir.id}`);
      sucesso('Reserva excluída.');
      setModalExcluir(null);
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
      setModalExcluir(null);
    } finally {
      setExcluindo(false);
    }
  }

  function abrirNova() {
    setFormNova({ dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '', valor: 0 });
    setErroNova('');
    setModalNova(true);
  }

  async function salvarNova() {
    if (!formNova.dataInicio || !formNova.dataFim || !formNova.clienteNome.trim()) {
      setErroNova('Preencha datas e nome do cliente.');
      return;
    }
    setSalvandoNova(true);
    setErroNova('');
    try {
      await api.post('/api/chacara/reservas', formNova);
      sucesso('Reserva criada como confirmada.');
      setModalNova(false);
      carregar();
    } catch (e) {
      setErroNova((e as Error).message);
    } finally {
      setSalvandoNova(false);
    }
  }

  const lista = reservas.filter(r => filtro === 'todas' || r.status === filtro);

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Acompanhe e confirme as reservas da chácara</p>
        </div>
        <button className="btn-primary" onClick={abrirNova}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Nova reserva manual
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['todas', 'pendente_pagamento', 'confirmada'] as const).map(f => (
          <button key={f} className={filtro === f ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : STATUS_LABEL[f].label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '30px 0' }}><p>Nenhuma reserva encontrada.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(r => {
            const statusInfo = STATUS_LABEL[r.status] ?? { label: r.status, cor: 'var(--text-3)' };
            return (
              <div key={r.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{r.clienteEmail} · {r.clienteTelefone}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
                      <Calendar size={13} /> {fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · {r.pessoas} pessoa(s)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(r.valor)}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusInfo.cor }}>{statusInfo.label}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.contratoEnviadoEm ? (
                      <><FileCheck size={13} color="var(--green)" /> Contrato enviado em {fmtData(r.contratoEnviadoEm)}</>
                    ) : (
                      <><Mail size={13} /> Contrato ainda não enviado</>
                    )}
                  </div>

                  {r.status === 'pendente_pagamento' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" title="Editar" onClick={() => abrirEdicao(r)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setModalExcluir(r)}>
                        <Trash2 size={14} />
                      </button>
                      <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => confirmar(r.id)} disabled={confirmando === r.id}>
                        <Check size={13} /> {confirmando === r.id ? 'Confirmando...' : 'Confirmar pagamento manual'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal editar reserva */}
      {modalEditar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalEditar(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Editar reserva</h2>
              <button className="btn-ghost" onClick={() => setModalEditar(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data início</label>
                    <input type="date" value={formEditar.dataInicio}
                      onChange={e => setFormEditar(f => ({ ...f, dataInicio: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data fim</label>
                    <input type="date" value={formEditar.dataFim} min={formEditar.dataInicio}
                      onChange={e => setFormEditar(f => ({ ...f, dataFim: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Pessoas</label>
                  <input type="number" min={1} value={formEditar.pessoas}
                    onChange={e => setFormEditar(f => ({ ...f, pessoas: Number(e.target.value) }))} style={{ width: 100 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do cliente</label>
                  <input value={formEditar.clienteNome}
                    onChange={e => setFormEditar(f => ({ ...f, clienteNome: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input type="email" value={formEditar.clienteEmail}
                    onChange={e => setFormEditar(f => ({ ...f, clienteEmail: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input value={formEditar.clienteTelefone}
                    onChange={e => setFormEditar(f => ({ ...f, clienteTelefone: e.target.value }))} />
                </div>
              </div>
              {erroEdicao && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erroEdicao}</p>}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
                O valor será recalculado automaticamente com base nas novas datas e quantidade de pessoas.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalEditar(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEdicao} disabled={salvandoEdicao}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova reserva manual */}
      {modalNova && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNova(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Nova reserva manual</h2>
              <button className="btn-ghost" onClick={() => setModalNova(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                Use para datas já fechadas com o cliente por fora. A reserva entra direto como <strong>confirmada</strong>, sem enviar e-mail ou contrato automaticamente.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data início</label>
                    <input type="date" value={formNova.dataInicio}
                      onChange={e => setFormNova(f => ({ ...f, dataInicio: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data fim</label>
                    <input type="date" value={formNova.dataFim} min={formNova.dataInicio}
                      onChange={e => setFormNova(f => ({ ...f, dataFim: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Pessoas</label>
                  <input type="number" min={1} value={formNova.pessoas}
                    onChange={e => setFormNova(f => ({ ...f, pessoas: Number(e.target.value) }))} style={{ width: 100 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do cliente</label>
                  <input value={formNova.clienteNome}
                    onChange={e => setFormNova(f => ({ ...f, clienteNome: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail (opcional)</label>
                  <input type="email" value={formNova.clienteEmail}
                    onChange={e => setFormNova(f => ({ ...f, clienteEmail: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone (opcional)</label>
                  <input value={formNova.clienteTelefone}
                    onChange={e => setFormNova(f => ({ ...f, clienteTelefone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor combinado (R$)</label>
                  <input type="number" min={0} step={0.01} value={formNova.valor}
                    onChange={e => setFormNova(f => ({ ...f, valor: Number(e.target.value) }))} />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Valor livre — não é calculado automaticamente, use o valor combinado com o cliente (com desconto ou não).
                  </p>
                </div>
              </div>
              {erroNova && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erroNova}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNova(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarNova} disabled={salvandoNova}>
                {salvandoNova ? 'Salvando...' : 'Criar reserva confirmada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir reserva */}
      {modalExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalExcluir(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir reserva</h2>
              <button className="btn-ghost" onClick={() => setModalExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir a reserva de <strong style={{ color: 'var(--text-1)' }}>{modalExcluir.clienteNome}</strong>?
                Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir mesmo assim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}