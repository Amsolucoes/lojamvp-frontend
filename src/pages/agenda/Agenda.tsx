import { useState, useEffect } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Clock, Check, Ban, Trash2, Calendar as CalIcon } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import './Agenda.css';

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  duracaoMin: number;
  ativo: boolean;
}

interface Agendamento {
  id: string;
  servicoId: string;
  nomeServico: string;
  clienteId?: string;
  nomeCliente?: string;
  preco: number;
  dataHora: string;
  duracaoMin: number;
  status: string;
  observacao?: string;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function hojeStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Gera faixas de 30 min entre início e fim (ex: "08:00", "08:30"...)
function gerarFaixas(horaInicio: number, horaFim: number): string[] {
  const faixas: string[] = [];
  for (let h = horaInicio; h < horaFim; h++) {
    faixas.push(`${String(h).padStart(2, '0')}:00`);
    faixas.push(`${String(h).padStart(2, '0')}:30`);
  }
  return faixas;
}

// Converte uma data ISO (UTC) para "HH:MM" no horário local
function horaLocal(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STATUS_INFO: Record<string, { label: string; cor: string; bg: string }> = {
  agendado:  { label: 'Agendado',  cor: 'var(--blue, #6366f1)', bg: 'rgba(99,102,241,0.1)' },
  concluido: { label: 'Concluído', cor: 'var(--green)',         bg: 'var(--green-bg)' },
  cancelado: { label: 'Cancelado', cor: 'var(--red)',           bg: 'rgba(248,113,113,0.1)' },
};

export function Agenda() {
  const { clientes } = useApp();
  const { sucesso, erro } = useToast();

  const [dia, setDia] = useState<Date>(hojeStr());
  const [horaInicio, setHoraInicio] = useState(8);
  const [horaFim, setHoraFim] = useState(18);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    servicoId: '', clienteId: '', nomeCliente: '', preco: 0,
    hora: '08:00', duracaoMin: 30, observacao: '',
  });
  const [buscaCli, setBuscaCli] = useState('');
  const [showCli, setShowCli] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Agendamento | null>(null);

  const faixas = gerarFaixas(horaInicio, horaFim);

  useEffect(() => {
    api.get<Servico[]>('/api/servicos').then(s => setServicos(s.filter(x => x.ativo))).catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [dia]);

  function carregar() {
    const ano = dia.getFullYear();
    const mes = String(dia.getMonth() + 1).padStart(2, '0');
    const d = String(dia.getDate()).padStart(2, '0');
    api.get<Agendamento[]>(`/api/agendamentos?data=${ano}-${mes}-${d}`)
      .then(setAgendamentos).catch(() => {});
  }

  function navDia(delta: number) {
    const novo = new Date(dia);
    novo.setDate(novo.getDate() + delta);
    setDia(novo);
  }

  const ehHoje = dia.toDateString() === new Date().toDateString();

  function abrirNovo(hora?: string) {
    setEditId(null);
    setForm({
      servicoId: servicos[0]?.id ?? '',
      clienteId: '', nomeCliente: '',
      preco: servicos[0]?.preco ?? 0,
      hora: hora ?? `${String(horaInicio).padStart(2, '0')}:00`,
      duracaoMin: servicos[0]?.duracaoMin ?? 30,
      observacao: '',
    });
    setBuscaCli('');
    setModal(true);
  }

  function abrirEditar(a: Agendamento) {
    setEditId(a.id);
    setForm({
      servicoId: a.servicoId,
      clienteId: a.clienteId ?? '',
      nomeCliente: a.nomeCliente ?? '',
      preco: a.preco,
      hora: horaLocal(a.dataHora),
      duracaoMin: a.duracaoMin,
      observacao: a.observacao ?? '',
    });
    setBuscaCli(a.clienteId ? '' : (a.nomeCliente ?? ''));
    setModal(true);
  }

  async function salvar() {
    if (!form.servicoId) { erro('Escolha um serviço.'); return; }
    setSaving(true);
    try {
      // Monta a data/hora no horário local e converte para ISO
      const [h, m] = form.hora.split(':').map(Number);
      const dataHora = new Date(dia);
      dataHora.setHours(h, m, 0, 0);

      const payload = {
        servicoId: form.servicoId,
        clienteId: form.clienteId || null,
        nomeCliente: form.clienteId ? null : (form.nomeCliente || null),
        preco: form.preco,
        dataHora: dataHora.toISOString(),
        duracaoMin: form.duracaoMin,
        observacao: form.observacao || null,
      };

      if (editId) {
        await api.put(`/api/agendamentos/${editId}`, payload);
      } else {
        await api.post('/api/agendamentos', payload);
      }
      carregar();
      sucesso(editId ? 'Agendamento atualizado.' : 'Agendamento criado.');
      setModal(false);
    } catch (e) {
      erro('Erro ao salvar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function mudarStatus(a: Agendamento, status: string) {
    try {
      await api.patch(`/api/agendamentos/${a.id}/status`, { status });
      carregar();
      sucesso(status === 'concluido' ? 'Marcado como concluído.' : status === 'cancelado' ? 'Agendamento cancelado.' : 'Reaberto.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      await api.delete(`/api/agendamentos/${confirmDel.id}`);
      carregar();
      sucesso('Agendamento excluído.');
      setConfirmDel(null);
    } catch (e) {
      erro((e as Error).message);
      setConfirmDel(null);
    }
  }

  const cliFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCli.toLowerCase()) || c.telefone.includes(buscaCli)
  );

  // Agendamentos por faixa de horário
  function agsNaFaixa(faixa: string) {
    return agendamentos.filter(a => horaLocal(a.dataHora) === faixa);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">{agendamentos.length} agendamento(s) no dia</p>
        </div>
        <button className="btn-primary" onClick={() => abrirNovo()}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo agendamento
        </button>
      </div>

      {/* Navegação de dia + faixa */}
      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-secondary" onClick={() => navDia(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
          <button className="btn-secondary" onClick={() => setDia(hojeStr())} style={{ padding: '6px 14px' }}>Hoje</button>
          <button className="btn-secondary" onClick={() => navDia(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
          <span style={{ fontWeight: 600, fontSize: 15, marginLeft: 8, textTransform: 'capitalize' }}>
            {dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {ehHoje && <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>Hoje</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Clock size={14} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: 'var(--text-3)' }}>Faixa:</span>
          <select value={horaInicio} onChange={e => setHoraInicio(+e.target.value)} style={{ width: 'auto', padding: '4px 8px' }}>
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
          </select>
          <span style={{ color: 'var(--text-3)' }}>até</span>
          <select value={horaFim} onChange={e => setHoraFim(+e.target.value)} style={{ width: 'auto', padding: '4px 8px' }}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map(i => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
          </select>
        </div>
      </div>

      {/* Grade de horários */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {servicos.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>
            <CalIcon size={32} /><p>Cadastre serviços antes de agendar.</p>
          </div>
        ) : (
          <div className="agenda-grade">
            {faixas.map(faixa => {
              const ags = agsNaFaixa(faixa);
              return (
                <div key={faixa} className="agenda-linha">
                  <div className="agenda-hora">{faixa}</div>
                  <div className="agenda-slot">
                    {ags.length === 0 ? (
                      <button className="agenda-vazio" onClick={() => abrirNovo(faixa)}>
                        <Plus size={13} /> Agendar
                      </button>
                    ) : (
                      ags.map(a => {
                        const info = STATUS_INFO[a.status] ?? STATUS_INFO.agendado;
                        return (
                          <div key={a.id} className="agenda-card" style={{ borderLeft: `3px solid ${info.cor}`, background: info.bg, opacity: a.status === 'cancelado' ? 0.6 : 1 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {a.nomeServico}
                                <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>{fmt(a.preco)}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                {a.nomeCliente || 'Sem cliente'} · {a.duracaoMin}min
                                {a.status !== 'agendado' && <span style={{ marginLeft: 6, color: info.cor, fontWeight: 500 }}>· {info.label}</span>}
                              </div>
                              {a.observacao && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{a.observacao}</div>}
                            </div>
                            <div className="agenda-acoes">
                              {a.status !== 'concluido' && (
                                <button className="btn-ghost" title="Concluir" style={{ color: 'var(--green)', padding: 4 }} onClick={() => mudarStatus(a, 'concluido')}><Check size={14} /></button>
                              )}
                              {a.status !== 'cancelado' && (
                                <button className="btn-ghost" title="Cancelar" style={{ color: 'var(--red)', padding: 4 }} onClick={() => mudarStatus(a, 'cancelado')}><Ban size={14} /></button>
                              )}
                              <button className="btn-ghost" title="Editar" style={{ padding: 4 }} onClick={() => abrirEditar(a)}><Plus size={14} style={{ transform: 'rotate(45deg)', display: 'none' }} /><span style={{ fontSize: 11 }}>✎</span></button>
                              <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)', padding: 4 }} onClick={() => setConfirmDel(a)}><Trash2 size={13} /></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal novo/editar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editId ? 'Editar agendamento' : 'Novo agendamento'}</h2>
              <button className="btn-ghost" onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Serviço */}
                <div className="form-group">
                  <label className="form-label">Serviço *</label>
                  <select value={form.servicoId} onChange={e => {
                      const s = servicos.find(x => x.id === e.target.value);
                      setForm(f => ({ ...f, servicoId: e.target.value, preco: s?.preco ?? f.preco, duracaoMin: s?.duracaoMin ?? f.duracaoMin }));
                    }}>
                    {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} — {fmt(s.preco)}</option>)}
                  </select>
                </div>

                {/* Cliente (cadastrado ou avulso) */}
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  {form.clienteId ? (
                    <div className="cx-cliente-sel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: '8px 12px' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{clientes.find(c => c.id === form.clienteId)?.nome}</span>
                      <button className="btn-ghost" onClick={() => setForm(f => ({ ...f, clienteId: '' }))}><X size={13} /></button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input placeholder="Buscar cliente ou digite um nome avulso"
                        value={buscaCli}
                        onChange={e => { setBuscaCli(e.target.value); setForm(f => ({ ...f, nomeCliente: e.target.value })); setShowCli(true); }}
                        onFocus={() => setShowCli(true)}
                        onBlur={() => setTimeout(() => setShowCli(false), 150)} />
                      {showCli && buscaCli && cliFiltrados.length > 0 && (
                        <div className="cx-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                          {cliFiltrados.slice(0, 5).map(c => (
                            <button key={c.id} className="cx-dropdown-item" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', borderBottom: '1px solid var(--border)' }}
                              onMouseDown={() => { setForm(f => ({ ...f, clienteId: c.id, nomeCliente: '' })); setBuscaCli(''); setShowCli(false); }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Deixe um nome digitado para cliente avulso, ou escolha um cadastrado.</p>
                </div>

                {/* Hora + duração + preço */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Hora</label>
                    <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duração (min)</label>
                    <input type="number" min={5} step={5} value={form.duracaoMin} onChange={e => setForm(f => ({ ...f, duracaoMin: +e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço (R$)</label>
                    <input type="number" min={0} step={0.01} value={form.preco === 0 ? '' : form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value === '' ? 0 : +e.target.value }))} />
                  </div>
                </div>

                {/* Observação */}
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: cachorro tem medo de secador" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : editId ? 'Salvar' : 'Agendar'}
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
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir agendamento</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir o agendamento de <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nomeServico}</strong>
                {confirmDel.nomeCliente && <> para <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nomeCliente}</strong></>}?
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