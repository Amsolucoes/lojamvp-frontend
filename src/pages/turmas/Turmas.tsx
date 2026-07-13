import { useState, useEffect } from 'react';
import { Plus, X, Users, Calendar, ChevronLeft, ChevronRight, Trash2, Check, UserX, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Turmas.css';

interface Turma {
  id: string;
  nome: string;
  diaSemana: number;
  horario: string;
  duracaoMin: number;
  capacidade: number;
  ativa: boolean;
  qtdAlunos: number;
}

interface AlunoMatricula {
  id: string; // matriculaId
  clienteId: string;
  nome: string;
  telefone: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface AlunoSessao {
  id: string; // inscricaoId
  clienteId: string;
  nome: string;
  tipo: string; // fixo | remarcacao
  status: string; // confirmado | falta_avisada | compareceu | faltou
  remarcadoParaSessaoId: string | null;
  profissionalId: string | null;
  profissionalNome: string | null;
}

interface Sessao {
  id: string;
  turmaId: string;
  nomeTurma: string;
  dataHora: string;
  status: string;
  capacidade: number;
  vagasOcupadas: number;
  alunos: AlunoSessao[];
}

interface SessaoComVaga {
  id: string;
  nomeTurma: string;
  dataHora: string;
  vagas: number;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmtDataUTC(iso: string) {
  if (!iso) return '';
  const [datePart] = iso.split('T');
  const [ano, mes, dia] = datePart.split('-');
  return `${dia}/${mes}`;
}

function fmtHora(iso: string) {
  if (!iso) return '';
  const [, timePart] = iso.split('T');
  return timePart ? timePart.slice(0, 5) : '';
}

function inicioSemana(offset: number) {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - ((diaSemana + 6) % 7) + offset * 7);
  segunda.setHours(0, 0, 0, 0);
  return segunda;
}

export function Turmas() {
  const { sucesso, erro } = useToast();
  const [aba, setAba] = useState<'turmas' | 'agenda'>('turmas');

  // ── Turmas ──────────────────────────────────────────────────────
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [modalTurma, setModalTurma] = useState<'novo' | 'editar' | null>(null);
  const [editandoTurma, setEditandoTurma] = useState<Turma | null>(null);
  const [formTurma, setFormTurma] = useState({ nome: '', diaSemana: '1', horario: '08:00', duracaoMin: '60', capacidade: '8' });
  const [salvandoTurma, setSalvandoTurma] = useState(false);
  const [confirmExcluirTurma, setConfirmExcluirTurma] = useState<Turma | null>(null);

  // ── Profissionais ───────────────────────────────────────────────
  const [profissionais, setProfissionais] = useState<{ id: string; nome: string }[]>([]);
  const [modalProfissionais, setModalProfissionais] = useState(false);
  const [novoProfissional, setNovoProfissional] = useState('');

  // ── Matrícula ───────────────────────────────────────────────────
  const [modalMatricula, setModalMatricula] = useState<Turma | null>(null);
  const [alunosMatriculados, setAlunosMatriculados] = useState<AlunoMatricula[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [showBuscaCliente, setShowBuscaCliente] = useState(false);

  // ── Agenda ──────────────────────────────────────────────────────
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);

  // ── Falta / Remarcação ──────────────────────────────────────────
  const [modalFalta, setModalFalta] = useState<{ inscricao: AlunoSessao; sessao: Sessao } | null>(null);
  const [sessoesComVaga, setSessoesComVaga] = useState<SessaoComVaga[]>([]);
  const [sessaoDestinoId, setSessaoDestinoId] = useState('');

  function carregarTurmas() {
    api.get<Turma[]>('/api/turmas').then(setTurmas).catch(() => {});
  }

  function carregarSessoes() {
    const de = inicioSemana(semanaOffset);
    const ate = new Date(de);
    ate.setDate(de.getDate() + 6);
    const deStr = de.toISOString().slice(0, 10);
    const ateStr = ate.toISOString().slice(0, 10);
    api.get<Sessao[]>(`/api/turmas/sessoes?de=${deStr}&ate=${ateStr}`).then(setSessoes).catch(() => {});
  }

  useEffect(() => {
    carregarTurmas();
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    carregarProfissionais();
  }, []);

  function carregarProfissionais() {
    api.get<{ id: string; nome: string }[]>('/api/turmas/profissionais').then(setProfissionais).catch(() => {});
  }

  async function adicionarProfissional() {
    if (!novoProfissional.trim()) return;
    try {
      await api.post('/api/turmas/profissionais', { nome: novoProfissional.trim() });
      setNovoProfissional('');
      carregarProfissionais();
      sucesso('Profissional adicionado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function removerProfissional(id: string) {
    try {
      await api.patch(`/api/turmas/profissionais/${id}/ativo`, {});
      carregarProfissionais();
    } catch (e) {
      erro((e as Error).message);
    }
  }
  useEffect(() => { if (aba === 'agenda') carregarSessoes(); }, [aba, semanaOffset]);

  // ── CRUD Turma ──────────────────────────────────────────────────
  function abrirNovaTurma() {
    setEditandoTurma(null);
    setFormTurma({ nome: '', diaSemana: '1', horario: '08:00', duracaoMin: '60', capacidade: '8' });
    setModalTurma('novo');
  }
  function abrirEditarTurma(t: Turma) {
    setEditandoTurma(t);
    setFormTurma({ nome: t.nome, diaSemana: String(t.diaSemana), horario: t.horario, duracaoMin: String(t.duracaoMin), capacidade: String(t.capacidade) });
    setModalTurma('editar');
  }
  async function salvarTurma() {
    if (!formTurma.nome.trim()) { erro('Preencha o nome da turma.'); return; }
    setSalvandoTurma(true);
    try {
      const payload = {
        nome: formTurma.nome.trim(),
        diaSemana: parseInt(formTurma.diaSemana),
        horario: formTurma.horario,
        duracaoMin: parseInt(formTurma.duracaoMin) || 60,
        capacidade: parseInt(formTurma.capacidade) || 8,
      };
      if (editandoTurma) await api.put(`/api/turmas/${editandoTurma.id}`, payload);
      else await api.post('/api/turmas', payload);
      setModalTurma(null);
      carregarTurmas();
      sucesso('Turma salva!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoTurma(false);
    }
  }
  async function alternarAtivaTurma(t: Turma) {
    try {
      await api.patch(`/api/turmas/${t.id}/ativo`, {});
      carregarTurmas();
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function excluirTurma() {
    if (!confirmExcluirTurma) return;
    try {
      await api.delete(`/api/turmas/${confirmExcluirTurma.id}`);
      setConfirmExcluirTurma(null);
      carregarTurmas();
      sucesso('Turma excluída.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // ── Matrícula ───────────────────────────────────────────────────
  function abrirMatricula(t: Turma) {
    setModalMatricula(t);
    setBuscaCliente('');
    api.get<AlunoMatricula[]>(`/api/turmas/${t.id}/alunos`).then(setAlunosMatriculados).catch(() => {});
  }
  async function matricular(clienteId: string) {
    if (!modalMatricula) return;
    try {
      await api.post(`/api/turmas/${modalMatricula.id}/matricular`, { clienteId });
      abrirMatricula(modalMatricula);
      carregarTurmas();
      setBuscaCliente('');
      setShowBuscaCliente(false);
      sucesso('Aluno matriculado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function desmatricular(matriculaId: string) {
    if (!modalMatricula) return;
    try {
      await api.delete(`/api/turmas/matricula/${matriculaId}`);
      abrirMatricula(modalMatricula);
      carregarTurmas();
      sucesso('Aluno desmatriculado.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) &&
    !alunosMatriculados.some(a => a.clienteId === c.id)
  );

  // ── Falta / Remarcação ──────────────────────────────────────────
  async function abrirFalta(inscricao: AlunoSessao, sessao: Sessao) {
    setModalFalta({ inscricao, sessao });
    setSessaoDestinoId('');
    const de = new Date().toISOString().slice(0, 10);
    const ateD = new Date();
    ateD.setDate(ateD.getDate() + 14);
    const ate = ateD.toISOString().slice(0, 10);
    try {
      const vagas = await api.get<SessaoComVaga[]>(`/api/turmas/sessoes-com-vaga?de=${de}&ate=${ate}`);
      setSessoesComVaga(vagas.filter(s => s.id !== sessao.id));
    } catch {
      setSessoesComVaga([]);
    }
  }

  async function confirmarFalta(comRemarcacao: boolean) {
    if (!modalFalta) return;
    try {
      await api.post(`/api/turmas/inscricoes/${modalFalta.inscricao.id}/falta`, {
        sessaoDestinoId: comRemarcacao ? sessaoDestinoId : null,
      });
      setModalFalta(null);
      carregarSessoes();
      sucesso(comRemarcacao ? 'Aluno remarcado!' : 'Falta registrada.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function marcarPresenca(inscricaoId: string, compareceu: boolean) {
    try {
      await api.post(`/api/turmas/inscricoes/${inscricaoId}/presenca`, { compareceu });
      carregarSessoes();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function definirProfissional(inscricaoId: string, profissionalId: string | null) {
    try {
      await api.patch(`/api/turmas/inscricoes/${inscricaoId}/profissional`, { profissionalId });
      carregarSessoes();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // Agrupa sessões por dia da semana
  const sessoesPorDia: Record<string, Sessao[]> = {};
  sessoes.forEach(s => {
    const dia = s.dataHora.slice(0, 10);
    if (!sessoesPorDia[dia]) sessoesPorDia[dia] = [];
    sessoesPorDia[dia].push(s);
  });
  const diasOrdenados = Object.keys(sessoesPorDia).sort();

  const inicioLabel = inicioSemana(semanaOffset);
  const fimLabel = new Date(inicioLabel);
  fimLabel.setDate(inicioLabel.getDate() + 6);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Turmas</h1>
          <p className="page-subtitle">Aulas em grupo, matrícula e agenda semanal</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setModalProfissionais(true)}><Users size={14} /> Profissionais</button>
          {aba === 'turmas' && (
            <button className="btn-primary" onClick={abrirNovaTurma}><Plus size={15} /> Nova turma</button>
          )}
        </div>
      </div>

      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'turmas' ? ' ativo' : ''}`} onClick={() => setAba('turmas')}>
          <Users size={15} /> Turmas
        </button>
        <button className={`planos-tab${aba === 'agenda' ? ' ativo' : ''}`} onClick={() => setAba('agenda')}>
          <Calendar size={15} /> Agenda
        </button>
      </div>

      {/* ── ABA TURMAS ── */}
      {aba === 'turmas' && (
        turmas.length === 0 ? (
          <div className="card">
            <div className="empty">
              <Users size={36} />
              <p>Nenhuma turma cadastrada ainda.</p>
              <button className="btn-primary" onClick={abrirNovaTurma} style={{ marginTop: 12 }}>Criar primeira turma</button>
            </div>
          </div>
        ) : (
          <div className="turmas-grid">
            {turmas.map(t => (
              <div key={t.id} className={`card turma-card${!t.ativa ? ' inativa' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{t.nome}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                      {DIAS_SEMANA[t.diaSemana]} · {t.horario} · {t.duracaoMin}min
                    </div>
                  </div>
                  {!t.ativa && <span className="badge badge-accent" style={{ fontSize: 10 }}>Inativa</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(100, (t.qtdAlunos / t.capacidade) * 100)}%`,
                      background: t.qtdAlunos >= t.capacidade ? 'var(--red)' : 'var(--accent)',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{t.qtdAlunos}/{t.capacidade}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="btn-secondary" style={{ fontSize: 12, flex: 1 }} onClick={() => abrirMatricula(t)}>
                    <Users size={13} /> Alunos
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => abrirEditarTurma(t)}>Editar</button>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => alternarAtivaTurma(t)}>{t.ativa ? 'Desativar' : 'Ativar'}</button>
                  <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setConfirmExcluirTurma(t)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── ABA AGENDA ── */}
      {aba === 'agenda' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <button className="btn-secondary" onClick={() => setSemanaOffset(o => o - 1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {inicioLabel.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — {fimLabel.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {semanaOffset === 0 && <span style={{ color: 'var(--accent)', marginLeft: 8, fontSize: 12 }}>(esta semana)</span>}
            </span>
            <button className="btn-secondary" onClick={() => setSemanaOffset(o => o + 1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
          </div>

          {diasOrdenados.length === 0 ? (
            <div className="card"><div className="empty"><Calendar size={36} /><p>Nenhuma sessão nesta semana.</p></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {diasOrdenados.map(dia => {
                const data = new Date(dia + 'T12:00:00');
                return (
                  <div key={dia}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase' }}>
                      {DIAS_ABREV[data.getDay()]}, {fmtDataUTC(dia + 'T00:00:00')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {sessoesPorDia[dia].map(s => (
                        <div key={s.id} className="card" style={{ padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.nomeTurma}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtHora(s.dataHora)} · {s.vagasOcupadas}/{s.capacidade} vagas</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                            {s.alunos.map(a => (
                              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' }}>
                                  {a.tipo === 'remarcacao' && (
                                    <span title="Remarcação" style={{ display: 'inline-flex' }}>
                                      <RefreshCw size={11} style={{ color: 'var(--accent)' }} />
                                    </span>
                                  )}
                                  {a.nome}
                                  {a.status === 'falta_avisada' && <span className="badge badge-yellow" style={{ fontSize: 9 }}>Falta avisada</span>}
                                  {a.status === 'compareceu' && <span className="badge badge-green" style={{ fontSize: 9 }}>Compareceu</span>}
                                  {a.status === 'faltou' && <span className="badge badge-red" style={{ fontSize: 9 }}>Faltou</span>}
                                  {profissionais.length > 0 && (
                                    <select
                                      value={a.profissionalId ?? ''}
                                      onChange={e => definirProfissional(a.id, e.target.value || null)}
                                      style={{ fontSize: 11, padding: '2px 6px', width: 'auto', minWidth: 110, marginLeft: 4 }}
                                    >
                                      <option value="">Sem profissional</option>
                                      {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {a.status === 'confirmado' && (
                                    <>
                                      <button className="btn-ghost" title="Compareceu" style={{ padding: 4, color: 'var(--green)' }} onClick={() => marcarPresenca(a.id, true)}><Check size={14} /></button>
                                      <button className="btn-ghost" title="Faltou" style={{ padding: 4, color: 'var(--red)' }} onClick={() => marcarPresenca(a.id, false)}><UserX size={14} /></button>
                                      <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => abrirFalta(a, s)}>Avisou falta</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            {s.alunos.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 0' }}>Nenhum aluno inscrito.</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal novo/editar turma */}
      {modalTurma && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalTurma(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modalTurma === 'novo' ? 'Nova turma' : 'Editar turma'}</h2>
              <button className="btn-ghost" onClick={() => setModalTurma(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome da turma *</label>
                  <input value={formTurma.nome} onChange={e => setFormTurma(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Pilates Solo — Manhã" autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Dia da semana</label>
                    <select value={formTurma.diaSemana} onChange={e => setFormTurma(f => ({ ...f, diaSemana: e.target.value }))}>
                      {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horário</label>
                    <input type="time" value={formTurma.horario} onChange={e => setFormTurma(f => ({ ...f, horario: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Duração (min)</label>
                    <input type="number" min={15} step={5} value={formTurma.duracaoMin} onChange={e => setFormTurma(f => ({ ...f, duracaoMin: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacidade (vagas)</label>
                    <input type="number" min={1} value={formTurma.capacidade} onChange={e => setFormTurma(f => ({ ...f, capacidade: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalTurma(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarTurma} disabled={salvandoTurma}>
                {salvandoTurma ? 'Salvando...' : (modalTurma === 'novo' ? 'Criar turma' : 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal matrícula */}
      {modalMatricula && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMatricula(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Alunos — {modalMatricula.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalMatricula(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <input placeholder="Buscar cliente para matricular..." value={buscaCliente}
                  onChange={e => { setBuscaCliente(e.target.value); setShowBuscaCliente(true); }}
                  onFocus={() => setShowBuscaCliente(true)}
                  onBlur={() => setTimeout(() => setShowBuscaCliente(false), 150)} />
                {showBuscaCliente && buscaCliente && (
                  <div className="cx-dropdown">
                    {clientesFiltrados.length === 0 ? (
                      <div className="cx-dropdown-empty">Nenhum cliente encontrado</div>
                    ) : clientesFiltrados.slice(0, 6).map(c => (
                      <button key={c.id} className="cx-dropdown-item" onMouseDown={() => matricular(c.id)}>
                        <div className="cx-drop-nome">{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alunosMatriculados.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>Nenhum aluno matriculado ainda.</p>
                ) : alunosMatriculados.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{a.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.telefone}</div>
                    </div>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => desmatricular(a.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalMatricula(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal falta / remarcação */}
      {modalFalta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalFalta(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Falta — {modalFalta.inscricao.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalFalta(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                {modalFalta.sessao.nomeTurma} · {fmtDataUTC(modalFalta.sessao.dataHora)} às {fmtHora(modalFalta.sessao.dataHora)}
              </p>

              <div className="form-group">
                <label className="form-label">Remarcar para outra sessão? <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                <select value={sessaoDestinoId} onChange={e => setSessaoDestinoId(e.target.value)}>
                  <option value="">Não remarcar — só registrar falta</option>
                  {sessoesComVaga.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nomeTurma} — {fmtDataUTC(s.dataHora)} {fmtHora(s.dataHora)} ({s.vagas} vaga{s.vagas > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalFalta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => confirmarFalta(!!sessaoDestinoId)}>
                {sessaoDestinoId ? 'Remarcar' : 'Registrar falta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal profissionais */}
      {modalProfissionais && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalProfissionais(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Profissionais</h2>
              <button className="btn-ghost" onClick={() => setModalProfissionais(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {profissionais.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhum profissional cadastrado.</p>
                ) : profissionais.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>{p.nome}</span>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removerProfissional(p.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Novo profissional</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={novoProfissional} onChange={e => setNovoProfissional(e.target.value)}
                    placeholder="Nome do profissional" onKeyDown={e => e.key === 'Enter' && adicionarProfissional()} />
                  <button className="btn-primary" onClick={adicionarProfissional}>Adicionar</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalProfissionais(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão de turma */}
      {confirmExcluirTurma && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirTurma(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir turma</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirTurma(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmExcluirTurma.nome}</strong>? Se tiver alunos matriculados, não será possível excluir — desative em vez disso.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirTurma(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirTurma}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}