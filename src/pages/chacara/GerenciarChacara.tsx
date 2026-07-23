import { useState, useEffect, useRef } from 'react';
import { Upload, X, GripVertical } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CLOUDINARY_CLOUD = 'dnwnwshvq';
const CLOUDINARY_PRESET = 'chacara-fotos';
const LIMITE_FOTOS = 30;

type Foto = { id: number; url: string; ordem: number };
type Info = { descricao: string; endereco: string; comodidades: string; comodidadesExtras: string | null; mapaEmbedUrl: string | null };

const COMODIDADES_OPCOES: { chave: string; label: string }[] = [
  { chave: 'piscina', label: 'Piscina' },
  { chave: 'churrasqueira', label: 'Churrasqueira' },
  { chave: 'wifi', label: 'Wi-Fi' },
  { chave: 'estacionamento', label: 'Estacionamento' },
  { chave: 'area_coberta', label: 'Área coberta' },
  { chave: 'playground', label: 'Playground infantil' },
  { chave: 'campo_futebol', label: 'Campo de futebol' },
  { chave: 'salao_festas', label: 'Salão de festas' },
  { chave: 'gerador', label: 'Gerador de energia' },
  { chave: 'ar_condicionado', label: 'Ar-condicionado' },
];

export function GerenciarChacara() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [info, setInfo] = useState<Info>({ descricao: '', endereco: '', comodidades: '', comodidadesExtras: '', mapaEmbedUrl: '' });
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<Foto[]>('/api/chacara/fotos'),
      api.get<Info>('/api/chacara/info'),
    ]).then(([f, i]) => { setFotos(f); setInfo(i); })
      .catch(() => toastErro('Erro ao carregar dados da chácara.'))
      .finally(() => setCarregando(false));
  }, []);

  async function uploadFoto(file: File) {
    if (fotos.length >= LIMITE_FOTOS) {
      toastErro(`Limite de ${LIMITE_FOTOS} fotos atingido.`);
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', CLOUDINARY_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Erro no upload');

      const foto = await api.post<Foto>('/api/chacara/fotos', { url: json.secure_url });
      setFotos(f => [...f, foto]);
    } catch (e) {
      toastErro('Erro ao subir foto: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removerFoto(id: number) {
    try {
      await api.delete(`/api/chacara/fotos/${id}`);
      setFotos(f => f.filter(x => x.id !== id));
    } catch (e) {
      toastErro((e as Error).message);
    }
  }

  function definirComoCapa(index: number) {
    const novaLista = [...fotos];
    const [escolhida] = novaLista.splice(index, 1);
    novaLista.unshift(escolhida);
    setFotos(novaLista);
    api.put('/api/chacara/fotos/ordem', { ids: novaLista.map(f => f.id) }).catch(() => {
      toastErro('Erro ao definir capa.');
    });
  }

  function moverFoto(index: number, direcao: -1 | 1) {
    const novaLista = [...fotos];
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= novaLista.length) return;
    [novaLista[index], novaLista[alvo]] = [novaLista[alvo], novaLista[index]];
    setFotos(novaLista);
    api.put('/api/chacara/fotos/ordem', { ids: novaLista.map(f => f.id) }).catch(() => {
      toastErro('Erro ao salvar nova ordem.');
    });
  }

  function toggleComodidade(chave: string) {
    const lista = info.comodidades.split(',').filter(Boolean);
    const nova = lista.includes(chave) ? lista.filter(c => c !== chave) : [...lista, chave];
    setInfo(i => ({ ...i, comodidades: nova.join(',') }));
  }

  async function salvarInfo() {
    setSalvandoInfo(true);
    try {
      const atualizado = await api.put<Info>('/api/chacara/info', info);
      setInfo(atualizado);
      sucesso('Informações da chácara salvas.');
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoInfo(false);
    }
  }

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  const comodidadesAtivas = info.comodidades.split(',').filter(Boolean);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fotos e Descrição</h1>
          <p className="page-subtitle">Gerencie as fotos, endereço e comodidades da chácara</p>
        </div>
      </div>

      {/* Galeria de fotos */}
      <div className="card" style={{ maxWidth: 640 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Fotos ({fotos.length}/{LIMITE_FOTOS})</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          A primeira foto é a capa. Use as setas para reordenar.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
          {fotos.map((foto, i) => (
            <div key={foto.id} style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={foto.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removerFoto(foto.id)} style={{
                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none',
                borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <X size={12} color="#fff" />
              </button>
              <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4 }}>
                <button onClick={() => moverFoto(i, -1)} disabled={i === 0} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>◀</button>
                <button onClick={() => moverFoto(i, 1)} disabled={i === fotos.length - 1} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>▶</button>
                {i !== 0 && (
                  <button onClick={() => definirComoCapa(i)} title="Definir como capa" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>★</button>
                )}
              </div>
              {i === 0 && (
                <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Capa</span>
              )}
            </div>
          ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); if (fileRef.current) fileRef.current.value = ''; }} />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading || fotos.length >= LIMITE_FOTOS}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {uploading ? <>Enviando...</> : <><Upload size={14} /> Adicionar foto</>}
        </button>
      </div>

      {/* Descrição e endereço */}
      <div className="card" style={{ maxWidth: 640, marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea rows={4} value={info.descricao}
              onChange={e => setInfo(i => ({ ...i, descricao: e.target.value }))}
              placeholder="Conte sobre a chácara: estrutura, capacidade, diferenciais..." />
          </div>

          <div className="form-group">
            <label className="form-label">Endereço completo</label>
            <input value={info.endereco}
              onChange={e => setInfo(i => ({ ...i, endereco: e.target.value }))}
              placeholder="Rua, número, bairro, cidade - UF" />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Texto simples (não cole link aqui). Usado só como referência visual no site.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Link do mapa (opcional)</label>
            <input value={info.mapaEmbedUrl ?? ''}
              onChange={e => setInfo(i => ({ ...i, mapaEmbedUrl: e.target.value }))}
              placeholder="https://www.google.com/maps/embed?..." />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              No Google Maps: encontre o local → Compartilhar → aba "Incorporar um mapa" → copie só o link dentro de <code>src="..."</code> do código gerado. Se deixar em branco, o mapa é gerado automaticamente a partir do endereço acima.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Comodidades</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {COMODIDADES_OPCOES.map(op => {
                const ativa = comodidadesAtivas.includes(op.chave);
                return (
                  <button key={op.chave} type="button" onClick={() => toggleComodidade(op.chave)}
                    className={ativa ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: 12, padding: '6px 12px' }}>
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Outras comodidades (opcional)</label>
            <textarea rows={3} value={info.comodidadesExtras ?? ''}
              onChange={e => setInfo(i => ({ ...i, comodidadesExtras: e.target.value }))}
              placeholder={'Uma por linha, ex:\nLago para pesca\nQuadra de vôlei'} />
          </div>

          <button className="btn-primary" onClick={salvarInfo} disabled={salvandoInfo} style={{ alignSelf: 'flex-start' }}>
            {salvandoInfo ? 'Salvando...' : 'Salvar informações'}
          </button>
        </div>
      </div>
    </div>
  );
}