import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import './AgendamentoPublico.css';

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  duracaoMin: number;
}

interface DadosLoja {
  nome: string;
  logoUrl: string | null;
  corPrimaria: string;
  confirmacao: string; // automatico | aprovacao
  servicos: Servico[];
  pausado?: boolean;
  pausaAte?: string | null;
  pausaMensagem?: string | null;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Gera os próximos 30 dias para o cliente escolher
function proximosDias(qtd: number): Date[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    return d;
  });
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function AgendamentoPublico() {
  const { slug } = useParams<{ slug: string }>();

  const [loja, setLoja] = useState<DadosLoja | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  const [passo, setPasso] = useState(1);
  const [servicoSel, setServicoSel] = useState<Servico | null>(null);
  const [diaSel, setDiaSel] = useState<Date | null>(null);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [horaSel, setHoraSel] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<{ mensagem: string; status: string } | null>(null);

  const [clienteReconhecido, setClienteReconhecido] = useState<string | null>(null);
  const [verificandoTel, setVerificandoTel] = useState(false);

  // Carrega dados da loja
  useEffect(() => {
    if (!slug) return;
    api.get<DadosLoja>(`/api/publico/${slug}`)
      .then(setLoja)
      .catch(() => setNaoEncontrada(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  // Aplica a cor da loja como variável CSS
  useEffect(() => {
    if (loja?.corPrimaria) {
      document.documentElement.style.setProperty('--loja-cor', loja.corPrimaria);
    }
  }, [loja]);

  // Busca horários quando escolhe dia
  useEffect(() => {
    if (!slug || !servicoSel || !diaSel) return;
    setCarregandoHorarios(true);
    setHoraSel(null);
    api.get<{ horarios: string[] }>(`/api/publico/${slug}/horarios?data=${ymd(diaSel)}&servicoId=${servicoSel.id}`)
      .then(res => setHorarios(res.horarios))
      .catch(() => setHorarios([]))
      .finally(() => setCarregandoHorarios(false));
  }, [slug, servicoSel, diaSel]);

  async function confirmar() {
    if (!slug || !servicoSel || !diaSel || !horaSel) return;
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha seu nome e telefone.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const dataHora = `${ymd(diaSel)}T${horaSel}:00`;
      const res = await api.post<{ mensagem: string; status: string }>(
        `/api/publico/${slug}/agendar`,
        {
          servicoId: servicoSel.id,
          nomeCliente: nome.trim(),
          telefone: telefone.trim(),
          dataHora,
        }
      );
      setResultado(res);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function verificarTelefone(tel: string) {
    const digitos = tel.replace(/\D/g, '');
    if (digitos.length < 8) {
      setClienteReconhecido(null);
      return;
    }
    setVerificandoTel(true);
    try {
      const res = await api.get<{ existe: boolean; primeiroNome?: string }>(
        `/api/publico/${slug}/cliente?telefone=${digitos}`
      );
      if (res.existe && res.primeiroNome) {
        setClienteReconhecido(res.primeiroNome);
        if (!nome.trim()) setNome(res.primeiroNome);
      } else {
        setClienteReconhecido(null);
      }
    } catch {
      setClienteReconhecido(null);
    } finally {
      setVerificandoTel(false);
    }
  }

  function formatarTelefone(valor: string): string {
    const d = valor.replace(/\D/g, '').slice(0, 11); // só dígitos, máximo 11
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  if (carregando) {
    return (
      <div className="ag-bg">
        <div className="ag-loading"><div className="ag-spinner" /></div>
      </div>
    );
  }

  if (naoEncontrada || !loja) {
    return (
      <div className="ag-bg">
        <div className="ag-card ag-centro">
          <div className="ag-emoji">🗓️</div>
          <h1 className="ag-titulo">Página não encontrada</h1>
          <p className="ag-sub">Este link de agendamento não existe ou está indisponível.</p>
        </div>
      </div>
    );
  }

  // Tela de sucesso
  if (resultado) {
    const pendente = resultado.status === 'pendente';
    return (
      <div className="ag-bg">
        <div className="ag-card ag-centro">
          <div className="ag-check">{pendente ? '⏳' : '✓'}</div>
          <h1 className="ag-titulo">{pendente ? 'Solicitação enviada!' : 'Agendamento confirmado!'}</h1>
          <p className="ag-sub">{resultado.mensagem}</p>
          <div className="ag-resumo">
            <div className="ag-resumo-linha"><span>Serviço</span><strong>{servicoSel?.nome}</strong></div>
            <div className="ag-resumo-linha"><span>Data</span><strong>{diaSel && `${diaSel.getDate()} de ${MESES[diaSel.getMonth()]}`}</strong></div>
            <div className="ag-resumo-linha"><span>Horário</span><strong>{horaSel}</strong></div>
          </div>
          <p className="ag-rodape-nota">{loja.nome}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-bg">
      <div className="ag-container">
        {/* Cabeçalho da loja */}
        <div className="ag-header">
          {loja.logoUrl
            ? <img src={loja.logoUrl} alt={loja.nome} className="ag-logo" />
            : <div className="ag-logo-placeholder">{loja.nome.charAt(0)}</div>}
          <div>
            <h1 className="ag-loja-nome">{loja.nome}</h1>
            <p className="ag-loja-sub">Agende seu horário</p>
          </div>
        </div>

        {/* Indicador de passos */}
        <div className="ag-passos">
          {[1, 2, 3].map(n => (
            <div key={n} className={`ag-passo-dot${passo >= n ? ' ativo' : ''}`} />
          ))}
        </div>

        {/* Aviso de pausa temporária */}
        {loja.pausado && (
          <div className="ag-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⏸️</div>
            <h2 className="ag-secao-titulo" style={{ marginBottom: 8 }}>Agendamentos pausados</h2>
            <p className="ag-sub" style={{ margin: '0 auto 12px' }}>{loja.pausaMensagem}</p>
            {loja.pausaAte && (
              <p style={{ fontSize: 13, color: 'var(--loja-cor, #999)', fontWeight: 600 }}>
                Voltamos em {new Date(loja.pausaAte).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* PASSO 1 — Escolher serviço */}
        {!loja.pausado && passo === 1 && (
          <div className="ag-card">
            <h2 className="ag-secao-titulo">Escolha o serviço</h2>
            <div className="ag-servicos">
              {loja.servicos.length === 0 && (
                <p className="ag-vazio">Nenhum serviço disponível no momento.</p>
              )}
              {loja.servicos.map(s => (
                <button key={s.id} className="ag-servico"
                  onClick={() => { setServicoSel(s); setPasso(2); }}>
                  <div className="ag-servico-info">
                    <span className="ag-servico-nome">{s.nome}</span>
                    <span className="ag-servico-dur">{s.duracaoMin} min</span>
                  </div>
                  <span className="ag-servico-preco">{fmt(s.preco)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASSO 2 — Escolher dia e horário */}
        {passo === 2 && servicoSel && (
          <div className="ag-card">
            <button className="ag-voltar" onClick={() => { setPasso(1); setDiaSel(null); }}>← Voltar</button>
            <h2 className="ag-secao-titulo">Escolha o dia</h2>
            <div className="ag-dias">
              {proximosDias(30).map(d => {
                const sel = diaSel && ymd(d) === ymd(diaSel);
                return (
                  <button key={ymd(d)} className={`ag-dia${sel ? ' ativo' : ''}`}
                    onClick={() => setDiaSel(d)}>
                    <span className="ag-dia-semana">{DIAS_SEMANA[d.getDay()]}</span>
                    <span className="ag-dia-num">{d.getDate()}</span>
                    <span className="ag-dia-mes">{MESES[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>

            {diaSel && (
              <>
                <h2 className="ag-secao-titulo" style={{ marginTop: 24 }}>Horários livres</h2>
                {carregandoHorarios ? (
                  <div className="ag-loading-inline"><div className="ag-spinner" /></div>
                ) : horarios.length === 0 ? (
                  <p className="ag-vazio">Nenhum horário livre neste dia. Tente outro.</p>
                ) : (
                  <div className="ag-horarios">
                    {horarios.map(h => (
                      <button key={h} className={`ag-hora${horaSel === h ? ' ativo' : ''}`}
                        onClick={() => setHoraSel(h)}>
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {horaSel && (
              <button className="ag-btn-principal" onClick={() => setPasso(3)}>
                Continuar
              </button>
            )}
          </div>
        )}

       {/* PASSO 3 — Dados do cliente */}
        {passo === 3 && servicoSel && diaSel && horaSel && (
          <div className="ag-card">
            <button className="ag-voltar" onClick={() => setPasso(2)}>← Voltar</button>
            <h2 className="ag-secao-titulo">Seus dados</h2>

            <div className="ag-resumo ag-resumo-topo">
              <div className="ag-resumo-linha"><span>Serviço</span><strong>{servicoSel.nome}</strong></div>
              <div className="ag-resumo-linha"><span>Data</span><strong>{diaSel.getDate()} de {MESES[diaSel.getMonth()]}</strong></div>
              <div className="ag-resumo-linha"><span>Horário</span><strong>{horaSel}</strong></div>
              <div className="ag-resumo-linha"><span>Valor</span><strong>{fmt(servicoSel.preco)}</strong></div>
            </div>

            <div className="ag-campo">
              <label>Telefone / WhatsApp</label>
              <input value={telefone}
                onChange={e => { setTelefone(formatarTelefone(e.target.value)); setErro(''); }}
                onBlur={e => verificarTelefone(e.target.value)}
                placeholder="(00) 00000-0000" inputMode="tel" maxLength={16} />
              {verificandoTel && <p className="ag-dica">Verificando...</p>}
            </div>

            {clienteReconhecido && (
              <div className="ag-reconhecido">
                👋 Bem-vindo de volta, <strong>{clienteReconhecido}</strong>!
              </div>
            )}

            <div className="ag-campo">
              <label>{clienteReconhecido ? 'Confirme seu nome' : 'Nome completo'}</label>
              <input value={nome} onChange={e => { setNome(e.target.value); setErro(''); }}
                placeholder="Seu nome" />
            </div>

            {erro && <p className="ag-erro">{erro}</p>}

            <button className="ag-btn-principal" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        <p className="ag-powered">Agendamento online por AL Dev Software</p>
      </div>
    </div>
  );
}