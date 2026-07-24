import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { formatarTelefone, formatarCpf, formatarCep, emailValido, buscarEnderecoPorCep } from '../../utils/mascaras';

type DadosChacara = {
  nome: string; logoUrl: string | null; corPrimaria: string;
  descricao: string; endereco: string; mapaEmbedUrl: string | null;
  fotos: string[];
  comodidades: { chave: string; label: string }[];
  comodidadesExtras: string[];
  precificacao: { limitePessoasPacotePequeno: number; minimoPessoas: number };
};

type Detalhamento = { valorEstadia: number; valorTaxaLimpeza: number; valorTotal: number; detalhamento: string[] };

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function ymd(d: string) { return d; }

const CHAC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=Work+Sans:wght@400;500;600&family=Caveat:wght@600&display=swap');

.chac-root {
  --chac-paper: #F1E9D8;
  --chac-panel: #FFFFFF;
  --chac-ink: #2B2A1F;
  --chac-ink-soft: #6b6650;
  --chac-green: #2E4A34;
  --chac-green-deep: #1B2A20;
  --chac-terra: #A6472E;
  --chac-gold: #C99A3C;
  --chac-line: #D8CBA8;
  font-family: 'Work Sans', sans-serif;
  background: var(--chac-paper);
  color: var(--chac-ink);
  min-height: 100vh;
  line-height: 1.6;
}
.chac-root * { box-sizing: border-box; }

.chac-hero {
  position: relative;
  min-height: 62vh;
  background-size: cover;
  background-position: center;
  background-color: var(--chac-green-deep);
  display: flex;
  align-items: flex-end;
}
.chac-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(27,42,32,0.15) 0%, rgba(20,26,18,0.55) 65%, rgba(15,19,13,0.88) 100%);
}
.chac-hero-content {
  position: relative;
  z-index: 1;
  padding: 32px 24px 36px;
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
  color: #fdfbf5;
}
.chac-hero-logo {
  width: 52px; height: 52px; object-fit: contain;
  border-radius: 10px; background: rgba(255,255,255,0.92);
  padding: 6px; margin-bottom: 14px;
}
.chac-eyebrow {
  font-family: 'Caveat', cursive;
  font-size: 22px;
  color: var(--chac-gold);
  margin: 0 0 2px;
  transform: rotate(-1deg);
  display: inline-block;
}
.chac-hero-title {
  font-family: 'Zilla Slab', serif;
  font-weight: 700;
  font-size: clamp(30px, 6vw, 48px);
  line-height: 1.05;
  margin: 0 0 10px;
  text-shadow: 0 2px 14px rgba(0,0,0,0.35);
}
.chac-hero-sub {
  font-size: 14px;
  color: #e9e2cf;
  margin: 0;
  opacity: 0.9;
}

.chac-container { max-width: 780px; margin: 0 auto; padding: 0 20px; }

.chac-thumbs {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 16px 0 4px;
  margin-bottom: 4px;
}
.chac-thumb {
  width: 64px; height: 64px; object-fit: cover; border-radius: 8px;
  cursor: pointer; flex-shrink: 0; border: 2px solid transparent; opacity: 0.7;
  transition: opacity 0.15s, border-color 0.15s, transform 0.15s;
}
.chac-thumb:hover { opacity: 1; transform: translateY(-2px); }
.chac-thumb.active { border-color: var(--chac-terra); opacity: 1; }

.chac-section { padding: 30px 0; border-top: 1px dashed var(--chac-line); }
.chac-section:first-of-type { border-top: none; }

.chac-lede {
  font-size: 16px; color: var(--chac-ink); max-width: 62ch; margin: 0;
}

.chac-heading {
  font-family: 'Zilla Slab', serif;
  font-weight: 700;
  font-size: 22px;
  color: var(--chac-green);
  margin: 0 0 16px;
}

.chac-tags { display: flex; flex-wrap: wrap; gap: 12px 14px; }
.chac-tag {
  display: inline-block;
  font-family: 'Zilla Slab', serif;
  font-weight: 500;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--chac-green);
  background: var(--chac-panel);
  border: 1.5px solid var(--chac-green);
  border-radius: 4px;
  padding: 7px 13px;
  box-shadow: 2px 3px 0 var(--chac-line);
  transition: transform 0.15s;
}
.chac-tag:hover { transform: translateY(-2px) rotate(0deg) !important; }

.chac-address { font-size: 14px; color: var(--chac-ink-soft); margin: 0 0 12px; }
.chac-map { border-radius: 10px; overflow: hidden; border: 1px solid var(--chac-line); }
.chac-map iframe { display: block; }

.chac-booking-card {
  background: var(--chac-panel);
  border: 1px solid var(--chac-line);
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(43,42,31,0.08);
}

.chac-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.chac-cal-nav {
  background: var(--chac-paper); border: 1px solid var(--chac-line); border-radius: 8px;
  width: 32px; height: 32px; cursor: pointer; font-size: 15px; color: var(--chac-green);
}
.chac-cal-nav:hover { background: var(--chac-line); }
.chac-cal-month { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 15px; text-transform: capitalize; }
.chac-cal-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; font-size: 11px; color: var(--chac-ink-soft); text-align: center; margin-bottom: 4px; }
.chac-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.chac-cal-day {
  aspect-ratio: 1; border-radius: 6px; font-size: 12px; border: 1px solid var(--chac-line);
  background: var(--chac-panel); color: var(--chac-ink); cursor: pointer;
}
.chac-cal-day:disabled { cursor: not-allowed; color: #bcb6a0; }
.chac-cal-day.occupied { background: #f1d9d2; color: var(--chac-terra); text-decoration: line-through; border-color: #e0bfb4; }
.chac-cal-day.selected { background: var(--chac-accent, var(--chac-green)); color: #fff; border-color: transparent; }
.chac-cal-day.in-range { background: color-mix(in srgb, var(--chac-accent, var(--chac-green)) 20%, white); }
.chac-cal-legend { display: flex; gap: 14px; margin-top: 8px; font-size: 11px; color: var(--chac-ink-soft); }
.chac-legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

.chac-input {
  width: 100%; box-sizing: border-box; font-size: 16px; padding: 10px 12px;
  background: #fff; color: var(--chac-ink); border: 1px solid var(--chac-line);
  border-radius: 8px; font-family: 'Work Sans', sans-serif;
}
.chac-input:focus-visible { outline: 2px solid var(--chac-accent, var(--chac-green)); outline-offset: 1px; }
.chac-field-label { font-size: 12px; color: var(--chac-ink-soft); display: block; margin-bottom: 4px; }

.chac-summary { background: var(--chac-paper); border-radius: 10px; padding: 14px; margin: 14px 0; }
.chac-summary-line { font-size: 12px; color: var(--chac-ink-soft); }
.chac-summary-total { font-size: 16px; font-weight: 700; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--chac-line); color: var(--chac-green); }

.chac-btn {
  font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 15px;
  color: #fff; background: var(--chac-accent, var(--chac-terra));
  border: none; border-radius: 8px; padding: 12px 22px; cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
}
.chac-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.chac-btn:disabled { background: #cfc9b6; cursor: not-allowed; }
.chac-btn-ghost {
  background: none; border: none; color: var(--chac-ink-soft); font-size: 13px; cursor: pointer; padding: 0;
}

.chac-error { color: var(--chac-terra); font-size: 13px; margin: 8px 0 0; }

.chac-success { text-align: center; padding: 16px 4px; }
.chac-success-icon { font-size: 34px; margin-bottom: 8px; }
.chac-success-title { font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 19px; color: var(--chac-green); margin: 0 0 6px; }

.chac-footer { text-align: center; font-size: 12px; color: var(--chac-ink-soft); padding: 28px 20px 40px; }
.chac-footer a { color: inherit; }

.chac-state-screen {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 10px; background: var(--chac-paper); color: var(--chac-ink);
  font-family: 'Work Sans', sans-serif; text-align: center; padding: 24px;
}

@media (prefers-reduced-motion: reduce) {
  .chac-root * { transition: none !important; animation: none !important; }
}
`;

export function SiteChacara() {
  const { slug } = useParams<{ slug: string }>();

  const [dados, setDados] = useState<DadosChacara | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [autoplayPausado, setAutoplayPausado] = useState(false);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pessoas, setPessoas] = useState(1);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [valor, setValor] = useState<Detalhamento | null>(null);
  const [verificando, setVerificando] = useState(false);

  const [mesCalendario, setMesCalendario] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [datasOcupadas, setDatasOcupadas] = useState<{ dataInicio: string; dataFim: string }[]>([]);

  const [etapa, setEtapa] = useState<'datas' | 'dados' | 'sucesso'>('datas');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [enderecoCliente, setEnderecoCliente] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [reservaCriada, setReservaCriada] = useState<{ id: number; valor: number } | null>(null);

  useEffect(() => {
    if (!slug) return;
    api.get<DadosChacara>(`/api/publico/${slug}/chacara/dados`)
      .then(setDados)
      .catch(() => setNaoEncontrada(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    api.get<{ dataInicio: string; dataFim: string }[]>(`/api/publico/${slug}/chacara/datas-ocupadas?meses=6`)
      .then(setDatasOcupadas)
      .catch(() => setDatasOcupadas([]));
  }, [slug]);

  useEffect(() => {
    if (!dados || dados.fotos.length <= 1 || autoplayPausado) return;
    const intervalo = setInterval(() => {
      setFotoAtiva(f => (f + 1) % dados.fotos.length);
    }, 5000);
    return () => clearInterval(intervalo);
  }, [dados, autoplayPausado]);

  useEffect(() => {
    if (!slug || !dataInicio || !dataFim || pessoas <= 0) { setDisponivel(null); setValor(null); return; }
    if (pessoas < dados!.precificacao.minimoPessoas) { setDisponivel(null); setValor(null); return; }
    if (dataFim < dataInicio) return;
    if ((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000 > 29) { setDisponivel(null); setValor(null); return; }

    setVerificando(true);
    Promise.all([
      api.get<{ disponivel: boolean }>(`/api/publico/${slug}/chacara/disponibilidade?dataInicio=${dataInicio}&dataFim=${dataFim}`),
      api.get<Detalhamento>(`/api/publico/${slug}/chacara/valor?dataInicio=${dataInicio}&dataFim=${dataFim}&pessoas=${pessoas}`),
    ]).then(([disp, val]) => {
      setDisponivel(disp.disponivel);
      setValor(val);
    }).catch(() => { setDisponivel(null); setValor(null); })
      .finally(() => setVerificando(false));
  }, [slug, dataInicio, dataFim, pessoas]);

  async function handleBuscarCep(valor: string) {
    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(valor);
    if (endereco) setEnderecoCliente(endereco);
    setBuscandoCep(false);
  }

  async function confirmarReserva() {
    if (!slug || !dataInicio || !dataFim) return;
    if (!nome.trim() || !email.trim() || !telefone.trim()) {
      setErro('Preencha nome, e-mail e telefone.');
      return;
    }
    if (!emailValido(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const res = await api.post<{ id: number; valor: number }>(`/api/publico/${slug}/chacara/reservar`, {
        dataInicio, dataFim, pessoas,
        clienteNome: nome.trim(), clienteEmail: email.trim(), clienteTelefone: telefone.trim(),
        clienteDocumento: cpf.trim() || null, clienteCep: cep.trim() || null, clienteEndereco: enderecoCliente.trim() || null,
      });
      setReservaCriada(res);
      setEtapa('sucesso');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const hojeStr = ymd(new Date().toISOString().slice(0, 10));

  const diaOcupado = (diaStr: string) =>
    datasOcupadas.some(o => diaStr >= o.dataInicio.slice(0, 10) && diaStr <= o.dataFim.slice(0, 10));

  function selecionarDiaCalendario(diaStr: string) {
    if (diaOcupado(diaStr) || diaStr < hojeStr) return;
    if (!dataInicio || (dataInicio && dataFim)) {
      setDataInicio(diaStr);
      setDataFim('');
    } else if (diaStr < dataInicio) {
      setDataInicio(diaStr);
      setDataFim('');
    } else {
      setDataFim(diaStr);
    }
  }

  function navMesCalendario(delta: number) {
    setMesCalendario(m => {
      const novo = new Date(m);
      novo.setMonth(novo.getMonth() + delta);
      return novo;
    });
  }

  function gerarDiasDoMes(mes: Date) {
    const ano = mes.getFullYear();
    const mesIndex = mes.getMonth();
    const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay();
    const totalDias = new Date(ano, mesIndex + 1, 0).getDate();
    const dias: (string | null)[] = Array(primeiroDiaSemana).fill(null);
    for (let d = 1; d <= totalDias; d++) {
      dias.push(`${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dias;
  }

  if (carregando) {
    return <div className="chac-state-screen">Carregando...</div>;
  }
  if (naoEncontrada || !dados) {
    return <div className="chac-state-screen"><strong>Página não encontrada.</strong></div>;
  }

  const cor = dados.corPrimaria || '#A6472E';
  const mapaUrl = dados.mapaEmbedUrl || `https://www.google.com/maps?q=${encodeURIComponent(dados.endereco)}&output=embed`;

  return (
    <div className="chac-root" style={{ ['--chac-accent' as any]: cor }}>
      <style>{CHAC_CSS}</style>

      <header className="chac-hero" style={dados.fotos.length > 0 ? { backgroundImage: `url(${dados.fotos[fotoAtiva]})` } : undefined}>
        <div className="chac-hero-overlay" />
        <div className="chac-hero-content">
          {dados.logoUrl && <img src={dados.logoUrl} alt={dados.nome} className="chac-hero-logo" />}
          <span className="chac-eyebrow">um cantinho pra chamar de seu</span>
          <h1 className="chac-hero-title">{dados.nome}</h1>
          {dados.endereco && <p className="chac-hero-sub">📍 {dados.endereco}</p>}
        </div>
      </header>

      <div className="chac-container">
        {dados.fotos.length > 1 && (
          <div className="chac-thumbs">
            {dados.fotos.map((f, i) => (
              <img key={i} src={f} alt="" className={`chac-thumb${i === fotoAtiva ? ' active' : ''}`}
                onClick={() => { setFotoAtiva(i); setAutoplayPausado(true); }} />
            ))}
          </div>
        )}

        {dados.descricao && (
          <section className="chac-section">
            <p className="chac-lede">{dados.descricao}</p>
          </section>
        )}

        {(dados.comodidades.length > 0 || dados.comodidadesExtras.length > 0) && (
          <section className="chac-section">
            <h2 className="chac-heading">O que você encontra por aqui</h2>
            <div className="chac-tags">
              {dados.comodidades.map((c, i) => (
                <span key={c.chave} className="chac-tag" style={{ transform: `rotate(${i % 2 === 0 ? -1.2 : 1.2}deg)` }}>
                  {c.label}
                </span>
              ))}
              {dados.comodidadesExtras.map((c, i) => (
                <span key={i} className="chac-tag" style={{ transform: `rotate(${i % 2 === 0 ? 1.2 : -1.2}deg)` }}>
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {dados.endereco && (
          <section className="chac-section">
            <h2 className="chac-heading">Como chegar</h2>
            <p className="chac-address">{dados.endereco}</p>
            <div className="chac-map">
              <iframe title="Mapa" src={mapaUrl} width="100%" height="240" style={{ border: 0 }} loading="lazy" />
            </div>
          </section>
        )}

        <section className="chac-section" id="reservar">
          <h2 className="chac-heading">Reserve sua estadia</h2>

          <div className="chac-booking-card">
            {etapa === 'datas' && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <div className="chac-cal-head">
                    <button type="button" className="chac-cal-nav" onClick={() => navMesCalendario(-1)}>‹</button>
                    <span className="chac-cal-month">
                      {mesCalendario.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button type="button" className="chac-cal-nav" onClick={() => navMesCalendario(1)}>›</button>
                  </div>

                  <div className="chac-cal-dow">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
                  </div>

                  <div className="chac-cal-grid">
                    {gerarDiasDoMes(mesCalendario).map((dia, i) => {
                      if (!dia) return <div key={`vazio-${i}`} />;
                      const ocupado = diaOcupado(dia);
                      const passado = dia < hojeStr;
                      const noIntervalo = !!(dataInicio && dataFim && dia >= dataInicio && dia <= dataFim);
                      const extremo = dia === dataInicio || dia === dataFim;
                      const classes = ['chac-cal-day'];
                      if (ocupado) classes.push('occupied');
                      else if (extremo) classes.push('selected');
                      else if (noIntervalo) classes.push('in-range');
                      return (
                        <button key={dia} type="button" disabled={ocupado || passado}
                          className={classes.join(' ')}
                          onClick={() => selecionarDiaCalendario(dia)}
                          title={ocupado ? 'Já reservado' : ''}>
                          {Number(dia.slice(8, 10))}
                        </button>
                      );
                    })}
                  </div>

                  <div className="chac-cal-legend">
                    <span><span className="chac-legend-dot" style={{ background: '#f1d9d2' }} />Ocupado</span>
                    <span><span className="chac-legend-dot" style={{ background: cor }} />Selecionado</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                    <label className="chac-field-label">Data início</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="chac-input" />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                    <label className="chac-field-label">Data fim</label>
                    <input type="date" value={dataFim} min={dataInicio}
                      max={dataInicio ? new Date(new Date(dataInicio).getTime() + 29 * 86400000).toISOString().slice(0, 10) : undefined}
                      onChange={e => setDataFim(e.target.value)} className="chac-input" />
                  </div>
                  <div style={{ flex: '0 1 90px', minWidth: 80 }}>
                    <label className="chac-field-label">Pessoas</label>
                    <input type="number" min={dados.precificacao.minimoPessoas} value={pessoas}
                      onChange={e => setPessoas(Number(e.target.value))} className="chac-input" />
                  </div>
                </div>

                {pessoas > 0 && pessoas < dados.precificacao.minimoPessoas && (
                  <p className="chac-error">O mínimo é de {dados.precificacao.minimoPessoas} pessoas.</p>
                )}
                {dataInicio && dataFim && (new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000 > 29 && (
                  <p className="chac-error">O período máximo por reserva é de 30 dias.</p>
                )}
                {verificando && <p style={{ fontSize: 13, color: 'var(--chac-ink-soft)' }}>Verificando disponibilidade...</p>}
                {!verificando && disponivel === false && (
                  <p className="chac-error">Datas indisponíveis. Escolha outro período.</p>
                )}

                {!verificando && disponivel === true && valor && (
                  <div className="chac-summary">
                    {valor.detalhamento.map((linha, i) => (
                      <div key={i} className="chac-summary-line">{linha}</div>
                    ))}
                    <div className="chac-summary-total">Total: {fmt(valor.valorTotal)}</div>
                  </div>
                )}

                <button className="chac-btn" disabled={!disponivel || !valor} onClick={() => setEtapa('dados')}>
                  Continuar
                </button>
              </>
            )}

            {etapa === 'dados' && valor && (
              <>
                <button className="chac-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setEtapa('datas')}>← Voltar</button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  <input placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} className="chac-input" />
                  <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} className="chac-input" />
                  <input placeholder="Telefone / WhatsApp" value={telefone}
                    onChange={e => setTelefone(formatarTelefone(e.target.value))}
                    inputMode="tel" maxLength={16} className="chac-input" />
                  <input placeholder="CPF" value={cpf}
                    onChange={e => setCpf(formatarCpf(e.target.value))}
                    inputMode="numeric" maxLength={14} className="chac-input" />
                  <input placeholder="CEP" value={cep}
                    onChange={e => setCep(formatarCep(e.target.value))}
                    onBlur={e => handleBuscarCep(e.target.value)}
                    inputMode="numeric" maxLength={9} className="chac-input" />
                  {buscandoCep && <p style={{ fontSize: 12, color: 'var(--chac-ink-soft)', margin: 0 }}>Buscando endereço...</p>}
                  <input placeholder="Endereço completo (rua, número, bairro)" value={enderecoCliente}
                    onChange={e => setEnderecoCliente(e.target.value)}
                    maxLength={150} className="chac-input" />
                </div>
                <p style={{ fontSize: 11, color: 'var(--chac-ink-soft)', marginTop: -8, marginBottom: 12 }}>
                  CPF, CEP e endereço são usados para gerar seu contrato de locação.
                </p>

                {erro && <p className="chac-error">{erro}</p>}

                <button className="chac-btn" onClick={confirmarReserva} disabled={enviando}>
                  {enviando ? 'Enviando...' : `Confirmar reserva — ${fmt(valor.valorTotal)}`}
                </button>
              </>
            )}

            {etapa === 'sucesso' && reservaCriada && (
              <div className="chac-success">
                <div className="chac-success-icon">⏳</div>
                <h3 className="chac-success-title">Reserva criada!</h3>
                <p style={{ fontSize: 13, color: 'var(--chac-ink-soft)' }}>
                  Sua reserva no valor de <strong>{fmt(reservaCriada.valor)}</strong> foi criada.
                  Em breve o pagamento estará disponível aqui para confirmar sua data.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <p className="chac-footer">Reservas online por AL Dev Software</p>
    </div>
  );
}