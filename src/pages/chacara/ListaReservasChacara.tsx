import { useState, useEffect } from 'react';
import { Calendar, Check, Mail, FileCheck, Pencil, Trash2, X, Plus, DollarSign, Send, ChevronLeft, ChevronRight, AlertTriangle, Star } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatarTelefone, formatarCpf, formatarCep, buscarEnderecoPorCep } from '../../utils/mascaras';

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
  expiraEm: string | null;
  contratoEnviadoEm: string | null;
  criadoEm: string;
  valorPrejuizo: number | null;
  observacaoPrejuizo: string | null;
  notaCliente: number | null;
  comentarioCliente: string | null;
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  pendente_pagamento: { label: 'Pendente', cor: 'var(--yellow)' },
  confirmada: { label: 'Confirmada', cor: 'var(--green)' },
  confirmada_parcial: { label: 'Parcial (sinal pago)', cor: 'var(--yellow)' },
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
  const [ajustarValorManual, setAjustarValorManual] = useState(false);
  const [valorManual, setValorManual] = useState(0);
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

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 5;

  const [slugLoja, setSlugLoja] = useState('');

  const [modalPerdidas, setModalPerdidas] = useState(false);
  const [perdidas, setPerdidas] = useState<Reserva[]>([]);
  const [totalPerdidas, setTotalPerdidas] = useState(0);
  const [carregandoPerdidas, setCarregandoPerdidas] = useState(false);
  const [paginaPerdidas, setPaginaPerdidas] = useState(1);
  const [periodoPerdidasTipo, setPeriodoPerdidasTipo] = useState<'mes' | 'todos'>('todos');
  const [mesPerdidas, setMesPerdidas] = useState(hoje.getMonth());
  const [anoPerdidas, setAnoPerdidas] = useState(hoje.getFullYear());
  const [marcandoExpirada, setMarcandoExpirada] = useState<number | null>(null);
  const PERDIDAS_POR_PAGINA = 10;

  useEffect(() => {
    carregar();
    api.get<any>('/api/loja/situacao').then(res => setSlugLoja(res?.slug ?? '')).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener('pullToRefresh', carregar);
    return () => window.removeEventListener('pullToRefresh', carregar);
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtro, periodoTipo, mesRef, anoRef]);

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
  const [mantendoNegociacao, setMantendoNegociacao] = useState<number | null>(null);

  function carregarPerdidas() {
    setCarregandoPerdidas(true);
    const params = new URLSearchParams({ pagina: String(paginaPerdidas), porPagina: String(PERDIDAS_POR_PAGINA) });
    if (periodoPerdidasTipo === 'mes') {
      params.set('mes', String(mesPerdidas + 1));
      params.set('ano', String(anoPerdidas));
    }
    api.get<{ itens: Reserva[]; total: number }>(`/api/chacara/reservas/perdidas?${params.toString()}`)
      .then(res => { setPerdidas(res.itens); setTotalPerdidas(res.total); })
      .catch(() => toastErro('Erro ao carregar reservas perdidas.'))
      .finally(() => setCarregandoPerdidas(false));
  }

  function abrirPerdidas() {
    setPaginaPerdidas(1);
    setModalPerdidas(true);
  }

  useEffect(() => {
    if (modalPerdidas) carregarPerdidas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPerdidas, paginaPerdidas, periodoPerdidasTipo, mesPerdidas, anoPerdidas]);

  function navMesPerdidas(delta: number) {
    let nm = mesPerdidas + delta, na = anoPerdidas;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMesPerdidas(nm); setAnoPerdidas(na);
    setPaginaPerdidas(1);
  }

  const [reativando, setReativando] = useState<number | null>(null);

  async function reativarReserva(r: Reserva) {
    setReativando(r.id);
    try {
      await api.patch(`/api/chacara/reservas/${r.id}/reativar`, {});
      sucesso('Reserva reativada — 15 minutos pra pagar de novo.');
      carregar();
      if (modalPerdidas) carregarPerdidas();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setReativando(null);
    }
  }

  async function marcarComoExpirada(r: Reserva) {
    setMarcandoExpirada(r.id);
    try {
      await api.patch(`/api/chacara/reservas/${r.id}/marcar-expirada`, {});
      sucesso('Reserva marcada como expirada.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setMarcandoExpirada(null);
    }
  }

  async function desfazerNegociacao(r: Reserva) {
    setMantendoNegociacao(r.id);
    try {
      await api.patch(`/api/chacara/reservas/${r.id}/desfazer-negociacao`, {});
      sucesso('Negociação desfeita — a reserva volta a expirar em 15 minutos.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setMantendoNegociacao(null);
    }
  }

  const [modalPrejuizo, setModalPrejuizo] = useState<Reserva | null>(null);
  const [formPrejuizo, setFormPrejuizo] = useState({ valor: '', observacao: '' });
  const [salvandoPrejuizo, setSalvandoPrejuizo] = useState(false);

  const [modalAvaliarCliente, setModalAvaliarCliente] = useState<Reserva | null>(null);
  const [formAvaliarCliente, setFormAvaliarCliente] = useState({ nota: 0, comentario: '' });
  const [salvandoAvaliacaoCliente, setSalvandoAvaliacaoCliente] = useState(false);

  function abrirAvaliarCliente(r: Reserva) {
    setFormAvaliarCliente({ nota: r.notaCliente ?? 0, comentario: r.comentarioCliente ?? '' });
    setModalAvaliarCliente(r);
  }

  async function salvarAvaliacaoCliente() {
    if (!modalAvaliarCliente) return;
    setSalvandoAvaliacaoCliente(true);
    try {
      await api.patch(`/api/chacara/reservas/${modalAvaliarCliente.id}/avaliar-cliente`, {
        nota: formAvaliarCliente.nota || null,
        comentario: formAvaliarCliente.comentario.trim() || null,
      });
      sucesso('Avaliação salva.');
      setModalAvaliarCliente(null);
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoAvaliacaoCliente(false);
    }
  }

  function abrirPrejuizo(r: Reserva) {
    setFormPrejuizo({
      valor: r.valorPrejuizo ? String(r.valorPrejuizo) : '',
      observacao: r.observacaoPrejuizo ?? '',
    });
    setModalPrejuizo(r);
  }

  async function salvarPrejuizo() {
    if (!modalPrejuizo) return;
    setSalvandoPrejuizo(true);
    try {
      await api.patch(`/api/chacara/reservas/${modalPrejuizo.id}/prejuizo`, {
        valor: formPrejuizo.valor ? parseFloat(formPrejuizo.valor) : null,
        observacao: formPrejuizo.observacao.trim() || null,
      });
      sucesso('Registro salvo.');
      setModalPrejuizo(null);
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoPrejuizo(false);
    }
  }

  async function manterEmNegociacao(r: Reserva) {
    setMantendoNegociacao(r.id);
    try {
      await api.patch(`/api/chacara/reservas/${r.id}/manter-negociacao`, {});
      sucesso('Reserva mantida em negociação — não expira mais sozinha.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setMantendoNegociacao(null);
    }
  }

  async function enviarContrato(r: Reserva) {
    if (!r.clienteEmail) {
      toastErro('Reserva sem e-mail cadastrado. Edite a reserva para adicionar um e-mail antes de enviar o contrato.');
      return;
    }
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
    setBuscandoCepEdicao(true);
    const endereco = await buscarEnderecoPorCep(valor);
    if (endereco) setFormEditar(f => ({ ...f, clienteEndereco: endereco }));
    setBuscandoCepEdicao(false);
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
    setAjustarValorManual(false);
    setValorManual(r.valor);
    setErroEdicao('');
    setModalEditar(r);
  }

  async function salvarEdicao() {
    if (!modalEditar) return;
    setErroEdicao('');
    setSalvandoEdicao(true);
    try {
      const res = await api.put<{ aviso?: string | null }>(`/api/chacara/reservas/${modalEditar.id}`, {
        ...formEditar,
        valorManual: ajustarValorManual ? valorManual : null,
      });
      if (res?.aviso) {
        toastErro(res.aviso);
      } else {
        sucesso('Reserva atualizada.');
      }
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

  const listaCompleta = reservas.filter(r => {
    if (filtro !== 'todas' && r.status !== filtro) return false;
    if (periodoTipo === 'mes') {
      const chaveRef = `${anoRef}-${String(mesRef + 1).padStart(2, '0')}`;
      const bateInicio = r.dataInicio.slice(0, 7) === chaveRef;
      const bateFim = r.dataFim.slice(0, 7) === chaveRef;
      if (!bateInicio && !bateFim) return false;
    }
    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(listaCompleta.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const lista = listaCompleta.slice((paginaSegura - 1) * ITENS_POR_PAGINA, paginaSegura * ITENS_POR_PAGINA);

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Acompanhe e confirme as reservas da chácara</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={abrirPerdidas}>
            <X size={15} style={{ verticalAlign: -2 }} /> Reservas Perdidas
          </button>
          <button className="btn-primary" onClick={abrirNova}>
            <Plus size={15} style={{ verticalAlign: -2 }} /> Nova reserva manual
          </button>
        </div>
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
            const expirada = r.status === 'expirada';
            return (
              <div key={r.id} className="card" style={{ padding: 16, opacity: expirada ? 0.6 : 1, borderColor: expirada ? 'var(--border)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.clienteNome}
                      {r.valorPrejuizo != null && r.valorPrejuizo > 0 && (
                        <span title={`Prejuízo: ${fmt(r.valorPrejuizo)}${r.observacaoPrejuizo ? ' — ' + r.observacaoPrejuizo : ''}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--red)', background: 'rgba(248,113,113,0.12)', padding: '2px 8px', borderRadius: 10 }}>
                          <AlertTriangle size={11} /> {fmt(r.valorPrejuizo)}
                        </span>
                      )}
                      {r.notaCliente != null && (
                        <span title={r.comentarioCliente ?? ''}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 10 }}>
                          <Star size={11} fill="currentColor" /> {r.notaCliente}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{r.clienteEmail} · {r.clienteTelefone}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
                      <Calendar size={13} /> {fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · {r.pessoas} pessoa(s)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(r.valor)}</div>
                    {(r.status === 'confirmada' || r.status === 'confirmada_parcial') && r.valorPago < r.valor && (
                      <div style={{ fontSize: 11, color: 'var(--yellow)' }}>
                        Pago: {fmt(r.valorPago)} · Falta: {fmt(r.valor - r.valorPago)}
                      </div>
                    )}
                    {(r.status === 'confirmada' || r.status === 'confirmada_parcial') && r.valorPago >= r.valor && (
                      <div style={{ fontSize: 11, color: 'var(--green)' }}>Pago integralmente</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusInfo.cor }}>{statusInfo.label}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.contratoEnviadoEm ? (
                        <><FileCheck size={13} color="var(--green)" /> Contrato enviado em {fmtData(r.contratoEnviadoEm)}</>
                      ) : (
                        <><Mail size={13} /> Contrato ainda não enviado</>
                      )}
                    </span>
                    <button className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                      onClick={() => enviarContrato(r)} disabled={enviandoContrato === r.id}>
                      <Send size={12} /> {enviandoContrato === r.id ? 'Enviando...' : (r.contratoEnviadoEm ? 'Reenviar' : 'Enviar')} contrato
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" title="Editar" onClick={() => abrirEdicao(r)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" title={r.valorPrejuizo ? 'Editar prejuízo' : 'Registrar prejuízo'}
                      style={{ color: r.valorPrejuizo ? 'var(--red)' : undefined }}
                      onClick={() => abrirPrejuizo(r)}>
                      <AlertTriangle size={14} />
                    </button>
                    <button className="btn-ghost" title={r.notaCliente ? 'Editar avaliação do cliente' : 'Avaliar cliente'}
                      style={{ color: r.notaCliente ? 'var(--accent)' : undefined }}
                      onClick={() => abrirAvaliarCliente(r)}>
                      <Star size={14} />
                    </button>
                    {r.status === 'confirmada' && (
                      <button className="btn-ghost" title="Copiar link de avaliação da chácara"
                        onClick={() => {
                          if (!slugLoja) {
                            toastErro('Configure o link (slug) da chácara em Configurações antes de usar isso.');
                            return;
                          }
                          navigator.clipboard.writeText(`https://app.aldevsoftware.com.br/chacara-site/${slugLoja}/avaliar/${r.id}`);
                          sucesso('Link de avaliação copiado!');
                        }}>
                        <Send size={14} />
                      </button>
                    )}
                    <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setModalExcluir(r)}>
                      <Trash2 size={14} />
                    </button>
                    {r.status === 'expirada' && (
                      <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => reativarReserva(r)} disabled={reativando === r.id}>
                        <Calendar size={13} /> {reativando === r.id ? 'Reativando...' : 'Reativar'}
                      </button>
                    )}
                    {r.status === 'pendente_pagamento' && (
                      r.expiraEm ? (
                        <>
                          <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => manterEmNegociacao(r)} disabled={mantendoNegociacao === r.id}>
                            <Calendar size={13} /> {mantendoNegociacao === r.id ? 'Salvando...' : 'Manter em negociação'}
                          </button>
                          <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--text-3)' }}
                            onClick={() => marcarComoExpirada(r)} disabled={marcandoExpirada === r.id}
                            title="Marcar como expirada agora, sem esperar o prazo">
                            {marcandoExpirada === r.id ? 'Salvando...' : 'Marcar expirada'}
                          </button>
                        </>
                      ) : (
                        <button className="btn-ghost" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}
                          onClick={() => desfazerNegociacao(r)} disabled={mantendoNegociacao === r.id}
                          title="Clique para voltar a expirar automaticamente">
                          🤝 {mantendoNegociacao === r.id ? 'Salvando...' : 'Em negociação'}
                        </button>
                      )
                    )}
                    {r.status === 'pendente_pagamento' && (
                      <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => abrirConfirmacao(r)} disabled={confirmando === r.id}>
                        <Check size={13} /> {confirmando === r.id ? 'Confirmando...' : 'Confirmar pagamento'}
                      </button>
                    )}
                    {(r.status === 'confirmada' || r.status === 'confirmada_parcial') && r.valorPago < r.valor && (
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

      {listaCompleta.length > ITENS_POR_PAGINA && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" disabled={paginaSegura <= 1} onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaSegura} / {totalPaginas}</span>
          <button className="btn-secondary" disabled={paginaSegura >= totalPaginas} onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
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

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={ajustarValorManual}
                    style={{ width: 16, height: 16, margin: 0 }}
                    onChange={e => setAjustarValorManual(e.target.checked)} />
                  Ajustar valor manualmente (ex: desconto)
                </label>

                {ajustarValorManual && (
                  <div className="form-group">
                    <label className="form-label">Valor final (R$)</label>
                    <input type="number" min={0} step={0.01} value={valorManual}
                      onChange={e => setValorManual(Number(e.target.value))}
                      onFocus={e => e.target.select()} />
                  </div>
                )}
              </div>
              {erroEdicao && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erroEdicao}</p>}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
                {ajustarValorManual
                  ? 'O valor acima será usado exatamente como digitado, sem recalcular pela regra de preço.'
                  : 'O valor será recalculado automaticamente com base nas novas datas e quantidade de pessoas.'}
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

      {/* Modal registrar prejuízo */}
      {modalPrejuizo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPrejuizo(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>⚠️ Registrar prejuízo</h2>
              <button className="btn-ghost" onClick={() => setModalPrejuizo(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                Reserva de <strong>{modalPrejuizo.clienteNome}</strong> — registro interno, não gera cobrança automática.
              </p>
              <div className="form-group">
                <label className="form-label">Valor do prejuízo (R$)</label>
                <input type="number" min={0} step={0.01} value={formPrejuizo.valor}
                  onChange={e => setFormPrejuizo(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">O que aconteceu</label>
                <textarea rows={3} value={formPrejuizo.observacao}
                  onChange={e => setFormPrejuizo(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Ex: sumiu a roupa de cama e a colcha" />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                Deixe o valor em branco e salve pra remover o aviso desta reserva.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPrejuizo(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarPrejuizo} disabled={salvandoPrejuizo}>
                {salvandoPrejuizo ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal avaliar cliente */}
      {modalAvaliarCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAvaliarCliente(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>⭐ Avaliar cliente</h2>
              <button className="btn-ghost" onClick={() => setModalAvaliarCliente(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                Como foi a experiência com <strong>{modalAvaliarCliente.clienteNome}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setFormAvaliarCliente(f => ({ ...f, nota: n }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Star size={28} fill={n <= formAvaliarCliente.nota ? 'var(--accent)' : 'none'}
                      color={n <= formAvaliarCliente.nota ? 'var(--accent)' : 'var(--border)'} />
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Comentário (opcional)</label>
                <textarea rows={3} value={formAvaliarCliente.comentario}
                  onChange={e => setFormAvaliarCliente(f => ({ ...f, comentario: e.target.value }))}
                  placeholder="Ex: cliente pontual, deixou tudo limpo" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAvaliarCliente(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarAvaliacaoCliente} disabled={salvandoAvaliacaoCliente}>
                {salvandoAvaliacaoCliente ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reservas perdidas */}
      {modalPerdidas && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPerdidas(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Reservas Perdidas ({totalPerdidas})</h2>
              <button className="btn-ghost" onClick={() => setModalPerdidas(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="cx-tipo-toggle">
                  <button className={periodoPerdidasTipo === 'todos' ? 'active' : ''} onClick={() => { setPeriodoPerdidasTipo('todos'); setPaginaPerdidas(1); }}>Todas</button>
                  <button className={periodoPerdidasTipo === 'mes' ? 'active' : ''} onClick={() => { setPeriodoPerdidasTipo('mes'); setPaginaPerdidas(1); }}>Por mês</button>
                </div>
                {periodoPerdidasTipo === 'mes' && (
                  <>
                    <button className="btn-secondary" onClick={() => navMesPerdidas(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                    <span style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{MESES[mesPerdidas]} {anoPerdidas}</span>
                    <button className="btn-secondary" onClick={() => navMesPerdidas(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
                  </>
                )}
              </div>

              {carregandoPerdidas ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
              ) : perdidas.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhuma reserva perdida encontrada.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {perdidas.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.clienteNome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · criada em {fmtData(r.criadoEm)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 13 }}>{fmt(r.valor)}</strong>
                        <button className="btn-ghost" style={{ fontSize: 11 }}
                          onClick={() => reativarReserva(r)} disabled={reativando === r.id}>
                          {reativando === r.id ? 'Reativando...' : 'Reativar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalPerdidas > PERDIDAS_POR_PAGINA && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
                  <button className="btn-secondary" disabled={paginaPerdidas <= 1} onClick={() => setPaginaPerdidas(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaPerdidas} / {Math.max(1, Math.ceil(totalPerdidas / PERDIDAS_POR_PAGINA))}</span>
                  <button className="btn-secondary" disabled={paginaPerdidas >= Math.ceil(totalPerdidas / PERDIDAS_POR_PAGINA)} onClick={() => setPaginaPerdidas(p => p + 1)} style={{ padding: '4px 10px' }}>Próxima</button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPerdidas(false)}>Fechar</button>
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