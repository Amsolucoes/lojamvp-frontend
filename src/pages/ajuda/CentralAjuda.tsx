import { useState, useEffect } from 'react';
import { HelpCircle, Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface Video {
  id: string;
  titulo: string;
  categoria: string;
  youtubeId: string;
  ordem: number;
}

export function CentralAjuda() {
  const { temProdutos, temServicos, temFinanceiro, temTurmas, temCorretora, temNf } = useApp();
  const [todosVideos, setTodosVideos] = useState<Video[]>([]);

  useEffect(() => {
    api.get<Video[]>('/api/videos-ajuda').then(setTodosVideos).catch(() => {});
  }, []);

  const categoriasComVideo = new Set(todosVideos.map(v => v.categoria));

  // Só mostra categorias que fazem sentido pro que a loja realmente usa E que já têm vídeo cadastrado
  const categoriasDisponiveis = [
    ...(temProdutos ? ['Produtos', 'Caixa', 'Estoque'] : []),
    ...(temProdutos || temServicos || temTurmas || temCorretora ? ['Clientes'] : []),
    ...(temServicos ? ['Agenda'] : []),
    ...(temServicos || temTurmas ? ['Planos'] : []),
    ...(temFinanceiro ? ['Financeiro'] : []),
    ...(temTurmas ? ['Turmas'] : []),
    ...(temCorretora ? ['Corretora'] : []),
    ...(temNf ? ['Importação de NF'] : []),
  ].filter(cat => categoriasComVideo.has(cat));

  const [categoria, setCategoria] = useState('');
  const [aberto, setAberto] = useState<number | null>(null);

  useEffect(() => {
    if (!categoria && categoriasDisponiveis.length > 0) setCategoria(categoriasDisponiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosVideos]);

  const videos = todosVideos.filter(v => v.categoria === categoria).sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Ajuda</h1>
          <p className="page-subtitle">Vídeos rápidos mostrando como usar cada parte do sistema</p>
        </div>
      </div>

      <div className="cat-tabs" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        {categoriasDisponiveis.map(cat => (
          <button key={cat} className={`cat-tab${categoria === cat ? ' active' : ''}`}
            onClick={() => { setCategoria(cat); setAberto(null); }}>
            {cat}
          </button>
        ))}
      </div>

      {categoriasDisponiveis.length === 0 ? (
        <div className="card">
          <div className="empty">
            <HelpCircle size={36} />
            <p>Nenhum vídeo disponível ainda.</p>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <HelpCircle size={36} />
            <p>Ainda não temos vídeos de "{categoria}". Em breve!</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {videos.map((v, i) => (
            <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
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