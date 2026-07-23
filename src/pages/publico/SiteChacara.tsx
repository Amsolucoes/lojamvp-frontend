import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';

type DadosChacara = {
  nome: string; logoUrl: string | null; corPrimaria: string;
  descricao: string; endereco: string;
  fotos: string[];
  comodidades: { chave: string; label: string }[];
  comodidadesExtras: string[];
  precificacao: { limitePessoasPacotePequeno: number; minimoPessoas: number };
};

type Detalhamento = { valorEstadia: number; valorTaxaLimpeza: number; valorTotal: number; detalhamento: string[] };

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function ymd(d: string) { return d; } // datas já vêm como yyyy-mm-dd do <input type="date">

function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

export function SiteChacara() {
  const { slug } = useParams<{ slug: string }>();

  const [dados, setDados] = useState<DadosChacara | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [fotoAtiva, setFotoAtiva] = useState(0);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pessoas, setPessoas] = useState(1);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [valor, setValor] = useState<Detalhamento | null>(null);
  const [verificando, setVerificando] = useState(false);

  const [etapa, setEtapa] = useState<'datas' | 'dados' | 'sucesso'>('datas');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
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
    if (!slug || !dataInicio || !dataFim || pessoas <= 0) { setDisponivel(null); setValor(null); return; }
    if (pessoas < dados!.precificacao.minimoPessoas) { setDisponivel(null); setValor(null); return; }
    if (dataFim < dataInicio) return;

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
      });
      setReservaCriada(res);
      setEtapa('sucesso');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;
  if (naoEncontrada || !dados) return <div style={{ padding: 40, textAlign: 'center' }}>Página não encontrada.</div>;

  const cor = dados.corPrimaria || '#2f7d4f';
  const mapaUrl = `https://www.google.com/maps?q=${encodeURIComponent(dados.endereco)}&output=embed`;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px', fontFamily: 'inherit', background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {dados.logoUrl && <img src={dados.logoUrl} alt={dados.nome} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain' }} />}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#222' }}>{dados.nome}</h1>
      </div>

      {/* Galeria */}
      {dados.fotos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <img src={dados.fotos[fotoAtiva]} alt="" style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 12 }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
            {dados.fotos.map((f, i) => (
              <img key={i} src={f} alt="" onClick={() => setFotoAtiva(i)}
                style={{
                  width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                  border: i === fotoAtiva ? `2px solid ${cor}` : '2px solid transparent',
                }} />
            ))}
          </div>
        </div>
      )}

      {/* Descrição */}
      {dados.descricao && <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333', marginBottom: 20 }}>{dados.descricao}</p>}

      {/* Comodidades */}
      {(dados.comodidades.length > 0 || dados.comodidadesExtras.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#222' }}>O que a chácara oferece</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dados.comodidades.map(c => (
              <span key={c.chave} style={{ fontSize: 13, background: '#f0f0f0', color: '#333', padding: '6px 12px', borderRadius: 20 }}>{c.label}</span>
            ))}
            {dados.comodidadesExtras.map((c, i) => (
              <span key={i} style={{ fontSize: 13, background: '#f0f0f0', color: '#333', padding: '6px 12px', borderRadius: 20 }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Localização */}
      {dados.endereco && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#222' }}>Localização</h2>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{dados.endereco}</p>
          <iframe title="Mapa" src={mapaUrl} width="100%" height="240" style={{ border: 0, borderRadius: 12 }} loading="lazy" />
        </div>
      )}

      {/* Reserva */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: '#222' }}>Reservar</h2>

        {etapa === 'datas' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Data início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Data fim</label>
                <input type="date" value={dataFim} min={dataInicio} onChange={e => setDataFim(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Pessoas</label>
                <input type="number" min={dados.precificacao.minimoPessoas} value={pessoas} onChange={e => setPessoas(Number(e.target.value))} style={{ width: 70 }} />
              </div>
            </div>

            {pessoas > 0 && pessoas < dados.precificacao.minimoPessoas && (
              <p style={{ fontSize: 13, color: '#c0392b' }}>O mínimo é de {dados.precificacao.minimoPessoas} pessoas.</p>
            )}

            {verificando && <p style={{ fontSize: 13, color: '#888' }}>Verificando disponibilidade...</p>}

            {!verificando && disponivel === false && (
              <p style={{ fontSize: 13, color: '#c0392b' }}>Datas indisponíveis. Escolha outro período.</p>
            )}

            {!verificando && disponivel === true && valor && (
              <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                {valor.detalhamento.map((linha, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#555' }}>{linha}</div>
                ))}
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
                  Total: {fmt(valor.valorTotal)}
                </div>
              </div>
            )}

            <button
              disabled={!disponivel || !valor}
              onClick={() => setEtapa('dados')}
              style={{
                background: disponivel ? cor : '#ccc', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: disponivel ? 'pointer' : 'not-allowed',
              }}>
              Continuar
            </button>
          </>
        )}

        {etapa === 'dados' && valor && (
          <>
            <button onClick={() => setEtapa('datas')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#888', marginBottom: 12, cursor: 'pointer' }}>← Voltar</button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <input placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
              <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input placeholder="Telefone / WhatsApp" value={telefone}
                onChange={e => setTelefone(formatarTelefone(e.target.value))}
                inputMode="tel" maxLength={16} />
            </div>

            {erro && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 10 }}>{erro}</p>}

            <button onClick={confirmarReserva} disabled={enviando}
              style={{ background: cor, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
              {enviando ? 'Enviando...' : `Confirmar reserva — ${fmt(valor.valorTotal)}`}
            </button>
          </>
        )}

        {etapa === 'sucesso' && reservaCriada && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Reserva criada!</h3>
            <p style={{ fontSize: 13, color: '#555' }}>
              Sua reserva no valor de <strong>{fmt(reservaCriada.valor)}</strong> foi criada.
              Em breve o pagamento estará disponível aqui para confirmar sua data.
            </p>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 20 }}>
        Reservas online por AL Dev Software
      </p>
    </div>
  );
}