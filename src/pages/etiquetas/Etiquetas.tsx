import { useState, useEffect, useRef } from 'react';
import { Tag, Search, Printer, Settings, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CLOUDINARY_CLOUD = 'dnwnwshvq';
const CLOUDINARY_PRESET = 'loja-logos';

interface ConfigEtiqueta {
  incluirLogo: boolean;
  usarLogoPropria: boolean;
  logoEtiquetaUrl: string | null;
  incluirNomeMarca: boolean;
  incluirNomeProduto: boolean;
  incluirPreco: boolean;
  incluirCodigoBarras: boolean;
  larguraMm: number;
  alturaMm: number;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function urlCodigoBarras(codigo: string) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(codigo)}&code=Code128&dpi=150`;
}

export function Etiquetas() {
  const { produtos } = useApp();
  const { sucesso, erro } = useToast();

  const [config, setConfig] = useState<ConfigEtiqueta | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Record<string, number>>({}); // produtoId -> quantidade
  const [modoImpressao, setModoImpressao] = useState<'a4' | 'termica'>('a4');

  const [nomeLoja, setNomeLoja] = useState('');
  const [logoLoja, setLogoLoja] = useState('');

  useEffect(() => {
    api.get<ConfigEtiqueta>('/api/etiquetas/configuracao').then(setConfig).catch(() => {});
    api.get<any>('/api/cliente/config').then(res => {
      setNomeLoja(res?.nome ?? '');
      setLogoLoja(res?.logoUrl ?? '');
    }).catch(() => {});
  }, []);

  async function salvarConfig() {
    if (!config) return;
    setSalvandoConfig(true);
    try {
      const atualizado = await api.put<ConfigEtiqueta>('/api/etiquetas/configuracao', config);
      setConfig(atualizado);
      sucesso('Configuração salva!');
      setMostrarConfig(false);
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function uploadLogoPropria(file: File) {
    setUploadingLogo(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', CLOUDINARY_PRESET);
      data.append('folder', 'logos-etiqueta');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Erro no upload');
      setConfig(c => c ? { ...c, logoEtiquetaUrl: json.secure_url } : c);
    } catch (e) {
      erro('Erro ao fazer upload: ' + (e as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  const produtosFiltrados = produtos.filter(p =>
    p.ativo && p.nome.toLowerCase().includes(busca.toLowerCase())
  );

  function toggleProduto(id: string) {
    setSelecionados(sel => {
      const novo = { ...sel };
      if (novo[id]) delete novo[id];
      else novo[id] = 1;
      return novo;
    });
  }

  function alterarQtd(id: string, qtd: number) {
    setSelecionados(sel => ({ ...sel, [id]: Math.max(1, qtd) }));
  }

  const listaImpressao = Object.entries(selecionados).flatMap(([id, qtd]) => {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return [];
    return Array.from({ length: qtd }, (_, i) => ({ ...produto, chaveUnica: `${id}-${i}` }));
  });

  function imprimir() {
    if (listaImpressao.length === 0) { erro('Selecione ao menos um produto.'); return; }
    window.print();
  }

  const logoParaEtiqueta = config?.usarLogoPropria ? config.logoEtiquetaUrl : logoLoja;

  if (!config) return <div className="page"><p>Carregando...</p></div>;

  const cssImpressao = modoImpressao === 'termica'
    ? `
      @page { size: ${config.larguraMm}mm ${config.alturaMm}mm; margin: 0; }
      .etq-grid { display: block; }
      .etq-item { width: ${config.larguraMm}mm; height: ${config.alturaMm}mm; page-break-after: always; }
    `
    : `
      @page { size: A4; margin: 10mm; }
      .etq-grid { display: flex; flex-wrap: wrap; gap: 2mm; }
      .etq-item { width: ${config.larguraMm}mm; height: ${config.alturaMm}mm; page-break-inside: avoid; }
    `;

  return (
    <div className="page">
      <style>{`
        .etq-impressao { display: none; }
        @media print {
          body * { visibility: hidden; }
          .etq-impressao, .etq-impressao * { visibility: visible; }
          .etq-impressao { display: block; position: absolute; top: 0; left: 0; }
          ${cssImpressao}
        }
        .etq-item {
          border: 1px dashed #ccc; box-sizing: border-box; padding: 2mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; overflow: hidden; font-family: Arial, sans-serif; color: #000;
        }
        .etq-item img.etq-logo { max-width: 60%; max-height: 30%; object-fit: contain; margin-bottom: 1mm; }
        .etq-item .etq-marca { font-size: 8px; font-weight: 700; }
        .etq-item .etq-produto { font-size: 7px; margin-top: 1mm; }
        .etq-item .etq-preco { font-size: 11px; font-weight: 700; margin-top: 1mm; }
        .etq-item img.etq-barras { width: 90%; margin-top: 1mm; }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Etiquetas</h1>
          <p className="page-subtitle">Configure e imprima etiquetas de preço dos produtos</p>
        </div>
        <button className="btn-secondary" onClick={() => setMostrarConfig(v => !v)}>
          <Settings size={15} style={{ verticalAlign: -2 }} /> Configurar etiqueta
        </button>
      </div>

      {mostrarConfig && (
        <div className="card" style={{ marginBottom: 16, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>O que aparece na etiqueta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.incluirLogo} style={{ width: 16, height: 16, margin: 0 }}
                onChange={e => setConfig(c => c ? { ...c, incluirLogo: e.target.checked } : c)} />
              Incluir logo
            </label>
            {config.incluirLogo && (
              <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="cx-tipo-toggle" style={{ maxWidth: 300 }}>
                  <button type="button" className={!config.usarLogoPropria ? 'active' : ''}
                    onClick={() => setConfig(c => c ? { ...c, usarLogoPropria: false } : c)}>
                    Logo da loja
                  </button>
                  <button type="button" className={config.usarLogoPropria ? 'active' : ''}
                    onClick={() => setConfig(c => c ? { ...c, usarLogoPropria: true } : c)}>
                    Logo própria da etiqueta
                  </button>
                </div>
                {config.usarLogoPropria && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {config.logoEtiquetaUrl && (
                      <img src={config.logoEtiquetaUrl} alt="Logo" style={{ width: 50, height: 50, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6 }} />
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogoPropria(f); }} />
                    <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {uploadingLogo ? 'Enviando...' : <><Upload size={14} /> {config.logoEtiquetaUrl ? 'Trocar' : 'Enviar'} logo</>}
                    </button>
                  </div>
                )}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.incluirNomeMarca} style={{ width: 16, height: 16, margin: 0 }}
                onChange={e => setConfig(c => c ? { ...c, incluirNomeMarca: e.target.checked } : c)} />
              Incluir nome da marca ({nomeLoja || 'sua loja'})
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.incluirNomeProduto} style={{ width: 16, height: 16, margin: 0 }}
                onChange={e => setConfig(c => c ? { ...c, incluirNomeProduto: e.target.checked } : c)} />
              Incluir nome do produto
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.incluirPreco} style={{ width: 16, height: 16, margin: 0 }}
                onChange={e => setConfig(c => c ? { ...c, incluirPreco: e.target.checked } : c)} />
              Incluir preço
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.incluirCodigoBarras} style={{ width: 16, height: 16, margin: 0 }}
                onChange={e => setConfig(c => c ? { ...c, incluirCodigoBarras: e.target.checked } : c)} />
              Incluir código de barras
            </label>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Tamanho da etiqueta</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Largura (mm)</label>
              <input type="number" min={10} value={config.larguraMm}
                onChange={e => setConfig(c => c ? { ...c, larguraMm: +e.target.value } : c)} style={{ width: 100 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Altura (mm)</label>
              <input type="number" min={10} value={config.alturaMm}
                onChange={e => setConfig(c => c ? { ...c, alturaMm: +e.target.value } : c)} style={{ width: 100 }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
            Padrão comum de etiqueta térmica: 40x30mm ou 50x30mm. Verifique o tamanho da sua folha adesiva ou rolo.
          </p>

          <button className="btn-primary" onClick={salvarConfig} disabled={salvandoConfig}>
            {salvandoConfig ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="search-wrap" style={{ maxWidth: 320, flex: 1 }}>
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="cx-tipo-toggle">
              <button className={modoImpressao === 'a4' ? 'active' : ''} onClick={() => setModoImpressao('a4')}>Folha A4</button>
              <button className={modoImpressao === 'termica' ? 'active' : ''} onClick={() => setModoImpressao('termica')}>Térmica</button>
            </div>
            <button className="btn-primary" onClick={imprimir} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={15} /> Imprimir ({listaImpressao.length})
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {produtosFiltrados.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}><Tag size={28} /><p>Nenhum produto encontrado.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {produtosFiltrados.map(p => {
              const marcado = !!selecionados[p.id];
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={marcado} style={{ width: 16, height: 16, margin: 0 }}
                    onChange={() => toggleProduto(p.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {fmt(p.precoVenda)}{p.codigoBarras ? ` · ${p.codigoBarras}` : ' · sem código de barras'}
                    </div>
                  </div>
                  {marcado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Qtd:</span>
                      <input type="number" min={1} value={selecionados[p.id]} style={{ width: 60 }}
                        onChange={e => alterarQtd(p.id, +e.target.value)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Área de impressão — escondida na tela, só aparece via CSS @media print */}
      <div className="etq-impressao">
        <div className="etq-grid">
          {listaImpressao.map(item => (
            <div key={item.chaveUnica} className="etq-item" style={{ width: `${config.larguraMm}mm`, height: `${config.alturaMm}mm` }}>
              {config.incluirLogo && logoParaEtiqueta && <img className="etq-logo" src={logoParaEtiqueta} alt="" />}
              {config.incluirNomeMarca && nomeLoja && <div className="etq-marca">{nomeLoja}</div>}
              {config.incluirNomeProduto && <div className="etq-produto">{item.nome}</div>}
              {config.incluirPreco && <div className="etq-preco">{fmt(item.precoVenda)}</div>}
              {config.incluirCodigoBarras && item.codigoBarras && (
                <img className="etq-barras" src={urlCodigoBarras(item.codigoBarras)} alt="" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}