import { useState } from 'react';
import { HelpCircle, Play } from 'lucide-react';

interface Video {
  titulo: string;
  youtubeId: string; // só o ID do vídeo, ex: em youtube.com/watch?v=ABC123, o ID é "ABC123"
}

// Pra adicionar um vídeo novo: cole o ID do YouTube (link "Não listado") na categoria certa.
const VIDEOS: Record<string, Video[]> = {
  'Produtos': [
    // { titulo: 'Como criar um produto', youtubeId: 'COLE_O_ID_AQUI' },
    // { titulo: 'Como editar um produto', youtubeId: 'COLE_O_ID_AQUI' },
    // { titulo: 'Como excluir um produto', youtubeId: 'COLE_O_ID_AQUI' },
  ],
  'Caixa': [],
  'Estoque': [],
  'Clientes': [],
  'Financeiro': [],
  'Agenda': [],
  'Turmas': [],
  'Corretora': [],
  'Planos': [],
};

const CATEGORIAS = Object.keys(VIDEOS);

export function CentralAjuda() {
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [aberto, setAberto] = useState<number | null>(null);

  const videos = VIDEOS[categoria] ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Ajuda</h1>
          <p className="page-subtitle">Vídeos rápidos mostrando como usar cada parte do sistema</p>
        </div>
      </div>

      <div className="cat-tabs" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIAS.map(cat => (
          <button key={cat} className={`cat-tab${categoria === cat ? ' active' : ''}`}
            onClick={() => { setCategoria(cat); setAberto(null); }}>
            {cat}
          </button>
        ))}
      </div>

      {videos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <HelpCircle size={36} />
            <p>Ainda não temos vídeos de "{categoria}". Em breve!</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {videos.map((v, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setAberto(aberto === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '16px 18px', background: 'transparent', border: 'none',
                  textAlign: 'left', cursor: 'pointer', color: 'var(--text-1)',
                }}>
                <Play size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{v.titulo}</span>
              </button>
              {aberto === i && (
                <div style={{ padding: '0 18px 18px' }}>
                  <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 8, overflow: 'hidden' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${v.youtubeId}`}
                      title={v.titulo}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}