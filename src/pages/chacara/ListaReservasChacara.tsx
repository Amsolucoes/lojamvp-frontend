import { useState, useEffect } from 'react';
import { Calendar, Check, Mail, FileCheck, Pencil, Trash2, X, Plus, DollarSign, Send, ChevronLeft, ChevronRight } from 'lucide-react';
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
  clienteDocumento: string | null;
  clienteCep: string | null;
  clienteEndereco: string | null;
  valor: number;
  valorPago: number;
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

function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatarCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

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
  const hoje = new Date();
  const [periodoTipo, setPeriodoTipo] = useState<'mes' | 'todos'>('mes');
  const [mesRef, setMesRef] = useState(hoje.getMonth());
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());

  function navMes(delta: number) {
    let nm = mesRef + delta, na = anoRef;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesRef(nm); setAnoRef(na);
  }
  const { sucesso, erro: toastErro } = useToast();

  const [modalEditar, setModalEditar] = useState<Reserva | null>(null);
  const [formEditar, setFormEditar] = useState({
    dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '',
    clienteDocumento: '', clienteCep: '', clienteEndereco: '',
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');

  const [modalExcluir, setModalExcluir] = useState<Reserva | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [modalNova, setModalNova] = useState(false);
  const [formNova, setFormNova] = useState({ dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '', valor: 0, valorPago: 0 });
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [erroNova, setErroNova] = useState('');

  const [modalPagamento, setModalPagamento] = useState<Reserva | null>(null);
  const [valorPagamento, setValorPagamento] = useState(0);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [erroPagamento, setErroPagamento] = useState('');

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

  const [modalConfirmar, setModalConfirmar] = useState<Reserva | null>(null);
  const [valorEntrada, setValorEntrada] = useState(0);

  function abrirConfirmacao(r: Reserva) {
    setValorEntrada(r.valor); // sugestão inicial: valor cheio, dono ajusta se for só entrada
    setModalConfirmar(r);
  }

  async function confirmar() {
    if (!modalConfirmar) return;
    setConfirmando(modalConfirmar.id);
    try {
      await api.patch(`/api/chacara/reservas/${modalConfirmar.id}/confirmar`, { valorPago: valorEntrada });
      sucesso('Reserva confirmada! E-mail e contrato enviados.');
      setModalConfirmar(null);
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setConfirmando(null);
    }
  }

  const [enviandoContrato, setEnviandoContrato] = useState<number | null>(null);

  async function enviarContrato(r: Reserva) {
    setEnviandoContrato(r.id);
    try {
      await api.post(`/api/chacara/reservas/${r.id}/enviar-contrato`, {});
      sucesso('Contrato enviado por e-mail.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setEnviandoContrato(null);
    }
  }

  async function registrarPagamento() {
    if (!modalPagamento) return;
    setErroPagamento('');
    if (valorPagamento <= 0) {
      setErroPagamento('Informe um valor maior que zero.');
      return;
    }
    setSalvandoPagamento(true);
    try {
      await api.patch(`/api/chacara/reservas/${modalPagamento.id}/registrar-pagamento`, { valor: valorPagamento });
      sucesso('Pagamento registrado.');
      setModalPagamento(null);
      carregar();
    } catch (e) {
      setErroPagamento((e as Error).message);
    } finally {
      setSalvandoPagamento(false);
    }
  }

  const [buscandoCepEdicao, setBuscandoCepEdicao] = useState(false);

  async function buscarEnderecoPorCepEdicao(valor: string) {
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length !== 8) return;

    setBuscandoCepEdicao(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await res.json();
      if (!dados.erro) {
        const partes = [dados.logradouro, dados.bairro, dados.localidade && dados.uf ? `${dados.localidade} - ${dados.uf}` : '']
          .filter(Boolean);
        setFormEditar(f => ({ ...f, clienteEndereco: partes.join(', ') }));
      }
    } catch {
      // silencioso — se falhar, preenche manualmente
    } finally {
      setBuscandoCepEdicao(false);
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
      clienteDocumento: r.clienteDocumento ?? '',
      clienteCep: r.clienteCep ?? '',
      clienteEndereco: r.clienteEndereco ?? '',
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
    setFormNova({ dataInicio: '', dataFim: '', pessoas: 1, clienteNome: '', clienteEmail: '', clienteTelefone: '', valor: 0, valorPago: 0 });
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

  const lista = reservas.filter(r => {
    if (filtro !== 'todas' && r.status !== filtro) return false;
    if (periodoTipo === 'mes') {
      const chaveRef = `${anoRef}-${String(mesRef + 1).padStart(2, '0')}`;
      const bateInicio = r.dataInicio.slice(0, 7) === chaveRef;
      const bateFim = r.dataFim.slice(0, 7) === chaveRef;
      if (!bateInicio && !bateFim) return false;
    }
    return true;
  });

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

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="cx-tipo-toggle">
            <button className={periodoTipo === 'mes' ? 'active' : ''} onClick={() => setPeriodoTipo('mes')}>Mês</button>
            <button className={periodoTipo === 'todos' ? 'active' : ''} onClick={() => setPeriodoTipo('todos')}>Todos</button>
          </div>
          {periodoTipo === 'mes' && (
            <>
              <button className="btn-secondary" onClick={() => navMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{MESES[mesRef]} {anoRef}</span>
              <button className="btn-secondary" onClick={() => navMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['todas', 'pendente_pagamento', 'confirmada'] as const).map(f => (
            <button key={f} className={filtro === f ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : STATUS_LABEL[f].label}
            </button>
          ))}
        </div>
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
                    {r.status === 'confirmada' && r.valorPago < r.valor && (
                      <div style={{ fontSize: 11, color: 'var(--yellow)' }}>
                        Pago: {fmt(r.valorPago)} · Falta: {fmt(r.valor - r.valorPago)}
                      </div>
                    )}
                    {r.status === 'confirmada' && r.valorPago >= r.valor && (
                      <div style={{ fontSize: 11, color: 'var(--green)' }}>Pago integralmente</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusInfo.cor }}>{statusInfo.label}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.contratoEnviadoEm ? (
                        <><FileCheck size={13} color="var(--green)" /> Contrato enviado em {fmtData(r.contratoEnviadoEm)}</>
                      ) : (
                        <><Mail size={13} /> Contrato ainda não enviado</>
                      )}
                    </span>
                    <button className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                      onClick={() => enviarContrato(r)} disabled={enviandoContrato === r.id || !r.clienteEmail}
                      title={!r.clienteEmail ? 'Reserva sem e-mail cadastrado' : ''}>
                      <Send size={12} /> {enviandoContrato === r.id ? 'Enviando...' : (r.contratoEnviadoEm ? 'Reenviar' : 'Enviar')} contrato
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" title="Editar" onClick={() => abrirEdicao(r)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setModalExcluir(r)}>
                      <Trash2 size={14} />
                    </button>
                    {r.status === 'pendente_pagamento' && (
                      <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => abrirConfirmacao(r)} disabled={confirmando === r.id}>
                        <Check size={13} /> {confirmando === r.id ? 'Confirmando...' : 'Confirmar pagamento'}
                      </button>
                    )}
                    {r.status === 'confirmada' && r.valorPago < r.valor && (
                      <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => { setValorPagamento(r.valor - r.valorPago); setModalPagamento(r); }}>
                        <DollarSign size={13} /> Registrar saldo
                      </button>
                    )}
                  </div>
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
                    onChange={e => setFormEditar(f => ({ ...f, clienteTelefone: formatarTelefone(e.target.value) }))}
                    inputMode="tel" maxLength={16} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">CPF</label>
                    <input value={formEditar.clienteDocumento}
                      onChange={e => setFormEditar(f => ({ ...f, clienteDocumento: formatarCpf(e.target.value) }))}
                      inputMode="numeric" maxLength={14} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">CEP</label>
                    <input value={formEditar.clienteCep}
                      onChange={e => setFormEditar(f => ({ ...f, clienteCep: formatarCep(e.target.value) }))}
                      onBlur={e => buscarEnderecoPorCepEdicao(e.target.value)}
                      inputMode="numeric" maxLength={9} />
                    {buscandoCepEdicao && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Buscando...</p>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço completo</label>
                  <input value={formEditar.clienteEndereco}
                    onChange={e => setFormEditar(f => ({ ...f, clienteEndereco: e.target.value }))}
                    maxLength={150} />
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
                    onChange={e => setFormNova(f => ({ ...f, clienteTelefone: formatarTelefone(e.target.value) }))}
                    inputMode="tel" maxLength={16} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor combinado (R$)</label>
                  <input type="number" min={0} step={0.01} value={formNova.valor}
                    onChange={e => setFormNova(f => ({ ...f, valor: Number(e.target.value) }))} />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Valor livre — não é calculado automaticamente, use o valor combinado com o cliente (com desconto ou não).
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor já pago (R$)</label>
                  <input type="number" min={0} step={0.01} value={formNova.valorPago}
                    onChange={e => setFormNova(f => ({ ...f, valorPago: Number(e.target.value) }))} />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Deixe igual ao valor combinado se já recebeu tudo, ou menor se só recebeu a entrada.
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

      {/* Modal confirmar com entrada */}
      {modalConfirmar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalConfirmar(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Confirmar reserva</h2>
              <button className="btn-ghost" onClick={() => setModalConfirmar(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                Valor total da reserva: <strong>{fmt(modalConfirmar.valor)}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Valor recebido agora (entrada ou total)</label>
                <input type="number" min={0} step={0.01} value={valorEntrada}
                  onChange={e => setValorEntrada(Number(e.target.value))} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                Se for só a entrada, o saldo fica registrado como pendente e você pode registrar o pagamento do restante depois.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalConfirmar(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmar} disabled={confirmando === modalConfirmar.id}>
                {confirmando === modalConfirmar.id ? 'Confirmando...' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar saldo */}
      {modalPagamento && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPagamento(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Registrar pagamento</h2>
              <button className="btn-ghost" onClick={() => setModalPagamento(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                Já pago: <strong>{fmt(modalPagamento.valorPago)}</strong> de {fmt(modalPagamento.valor)} — falta {fmt(modalPagamento.valor - modalPagamento.valorPago)}
              </p>
              <div className="form-group">
                <label className="form-label">Valor recebido agora (R$)</label>
                <input type="number" min={0} step={0.01} value={valorPagamento}
                  onChange={e => setValorPagamento(Number(e.target.value))} />
              </div>
              {erroPagamento && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroPagamento}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPagamento(null)}>Cancelar</button>
              <button className="btn-primary" onClick={registrarPagamento} disabled={salvandoPagamento}>
                {salvandoPagamento ? 'Salvando...' : 'Registrar pagamento'}
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
              {modalExcluir.status === 'confirmada' && (
                <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>
                  ⚠️ Esta reserva já está confirmada. Se o cliente já pagou de verdade, excluir aqui não desfaz o pagamento — apenas libera as datas no sistema.
                </p>
              )}
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