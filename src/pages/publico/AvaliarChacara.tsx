import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';

type DadosAvaliacao = {
  clienteNome: string;
  dataInicio: string;
  dataFim: string;
  nomeLoja: string;
  jaAvaliado: boolean;
  notaAtual: number | null;
  comentarioAtual: string | null;
};

const AVAL_CSS = `
.aval-root {
  min-height: 100vh;
  background: #F1E9D8;
  color: #2B2A1F;
  font-family: 'Work Sans', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.aval-card {
  background: #fff;
  border: 1px solid #D8CBA8;
  border-radius: 14px;
  padding: 28px 24px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 30px rgba(43,42,31,0.08);
}
.aval-titulo {
  font-family: 'Zilla Slab', serif;
  font-weight: 700;
  font-size: 22px;
  color: #2E4A34;
  margin: 0 0 6px;
}
.aval-sub { font-size: 13px; color: #6b6650; margin: 0 0 20px; }
.aval-estrelas { display: flex; gap: 6px; justify-content: center; margin-bottom: 18px; }
.aval-estrelas button { background: none; border: none; cursor: pointer; padding: 0; font-size: 34px; line-height: 1; color: #D8CBA8; }
.aval-estrelas button.ativa { color: #C99A3C; }
.aval-textarea {
  width: 100%; box-sizing: border-box; font-size: 14px; padding: 10px 12px;
  border: 1px solid #D8CBA8; border-radius: 8px; font-family: 'Work Sans', sans-serif;
  resize: vertical; min-height: 80px; margin-bottom: 16px;
}
.aval-btn {
  font-family: 'Zilla Slab', serif; font-weight: 700; font-size: 15px;
  color: #fff; background: #A6472E; border: none; border-radius: 8px;
  padding: 12px 22px; cursor: pointer; width: 100%;
}
.aval-btn:disabled { background: #cfc9b6; cursor: not-allowed; }
.aval-erro { color: #A6472E; font-size: 13px; margin: 10px 0 0; }
`;

export function AvaliarChacara() {
  const { slug, reservaId } = useParams<{ slug: string; reservaId: string }>();
  const [dados, setDados] = useState<DadosAvaliacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState('');

  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!slug || !reservaId) return;
    api.get<DadosAvaliacao>(`/api/publico/${slug}/chacara/avaliacao/${reservaId}`)
      .then(d => {
        setDados(d);
        if (d.jaAvaliado) {
          setNota(d.notaAtual ?? 0);
          setComentario(d.comentarioAtual ?? '');
        }
      })
      .catch(e => setErroCarregar(e.message || 'Não foi possível carregar.'))
      .finally(() => setCarregando(false));
  }, [slug, reservaId]);

  async function enviar() {
    if (!slug || !reservaId) return;
    setErro('');
    if (nota < 1) { setErro('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setEnviando(true);
    try {
      await api.post(`/api/publico/${slug}/chacara/avaliacao/${reservaId}`, {
        nota,
        comentario: comentario.trim() || null,
      });
      setEnviado(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <div className="aval-root"><style>{AVAL_CSS}</style><p>Carregando...</p></div>;
  }

  if (erroCarregar || !dados) {
    return (
      <div className="aval-root">
        <style>{AVAL_CSS}</style>
        <div className="aval-card">
          <p className="aval-erro">{erroCarregar || 'Avaliação não encontrada.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aval-root">
      <style>{AVAL_CSS}</style>
      <div className="aval-card">
        {enviado ? (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <h1 className="aval-titulo">Obrigado!</h1>
            <p className="aval-sub">Sua avaliação foi enviada com sucesso.</p>
          </>
        ) : (
          <>
            <h1 className="aval-titulo">Como foi sua estadia?</h1>
            <p className="aval-sub">
              {dados.clienteNome}, conta pra gente como foi sua experiência na {dados.nomeLoja}.
            </p>
            <div className="aval-estrelas">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" className={n <= nota ? 'ativa' : ''} onClick={() => setNota(n)}>★</button>
              ))}
            </div>
            <textarea
              className="aval-textarea"
              placeholder="O que faltou ou pode melhorar? (opcional)"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
            />
            {erro && <p className="aval-erro">{erro}</p>}
            <button className="aval-btn" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando...' : dados.jaAvaliado ? 'Atualizar avaliação' : 'Enviar avaliação'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}