import { useState, useEffect, useRef } from 'react';
import { Tag, Search, Printer, Settings, Upload, Eye } from 'lucide-react';
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
  corTexto: string;
  fonteFamilia: string;
  escalaFonte: number;
}

const TAMANHOS_PADRAO = [
  { label: '30 x 20mm — pequena (bijuteria, acessórios)', largura: 30, altura: 20 },
  { label: '33 x 22mm — pequena', largura: 33, altura: 22 },
  { label: '40 x 25mm — padrão pequeno', largura: 40, altura: 25 },
  { label: '40 x 30mm — mais usada (roupas, preço)', largura: 40, altura: 30 },
  { label: '50 x 30mm — roupas (mais larga)', largura: 50, altura: 30 },
  { label: '50 x 40mm — média', largura: 50, altura: 40 },
  { label: '60 x 40mm — maior, mais espaço pro código de barras', largura: 60, altura: 40 },
  { label: '100 x 50mm — grande (caixas, volumes)', largura: 100, altura: 50 },
];

const FONTES_DISPONIVEIS = [
  { valor: 'Arial, sans-serif', label: 'Arial' },
  { valor: "'Courier New', monospace", label: 'Courier New' },
  { valor: 'Georgia, serif', label: 'Georgia' },
  { valor: 'Verdana, sans-serif', label: 'Verdana' },
  { valor: "'Times New Roman', serif", label: 'Times New Roman' },
  { valor: 'Tahoma, sans-serif', label: 'Tahoma' },
];

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
  const [selecionados, setSelecionados] = useState<Record<string, number>>({}); // chave -> quantidade
  const [modoImpressao, setModoImpressao] = useState<'a4' | 'termica'>('a4');
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 15;

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

  interface ItemEtiqueta {
    chave: string;
    nomeExibicao: string;
    precoVenda: number;
    codigoBarras: string | null;
    estoque: number;
  }

  // Cada produto vira 1 item — a não ser que tenha variações com código de barras próprio,
  // aí cada variação vira uma linha selecionável separada (ex: Bermuda Tricô P/Azul, M/Preto...)
  const todosItens: ItemEtiqueta[] = produtos.filter(p => p.ativo).flatMap(p => {
    const variacoes = ((p as any).variacoes ?? []).filter((v: any) => v.ativo !== false);
    if (variacoes.length > 0) {
      return variacoes.map((v: any) => {
        const label = [v.tamanho, v.cor].filter(Boolean).join(' / ');
        return {
          chave: `${p.id}-${v.id}`,
          nomeExibicao: label ? `${p.nome} (${label})` : p.nome,
          precoVenda: p.precoVenda,
          codigoBarras: v.codigoBarras ?? null,
          estoque: v.estoque ?? 0,
        };
      });
    }
    return [{
      chave: p.id,
      nomeExibicao: p.nome,
      precoVenda: p.precoVenda,
      codigoBarras: p.codigoBarras ?? null,
      estoque: p.estoque ?? 0,
    }];
  });

  const itensFiltrados = todosItens.filter(item =>
    item.nomeExibicao.toLowerCase().includes(busca.toLowerCase()) ||
    (item.codigoBarras ?? '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const itensPaginados = itensFiltrados.slice((paginaSegura - 1) * ITENS_POR_PAGINA, paginaSegura * ITENS_POR_PAGINA);

  useEffect(() => { setPagina(1); }, [busca]);

  function toggleItem(chave: string) {
    setSelecionados(sel => {
      const novo = { ...sel };
      if (novo[chave]) delete novo[chave];
      else {
        const item = todosItens.find(i => i.chave === chave);
        novo[chave] = item && item.estoque > 0 ? item.estoque : 1;
      }
      return novo;
    });
  }

  function alterarQtd(chave: string, qtd: number) {
    setSelecionados(sel => ({ ...sel, [chave]: Math.max(1, qtd) }));
  }

  const listaImpressao = Object.entries(selecionados).flatMap(([chave, qtd]) => {
    const item = todosItens.find(i => i.chave === chave);
    if (!item) return [];
    return Array.from({ length: qtd }, (_, i) => ({ ...item, chaveUnica: `${chave}-${i}` }));
  });

  function imprimir() {
    if (listaImpressao.length === 0) { erro('Selecione ao menos um produto.'); return; }
    window.print();
  }

  const logoParaEtiqueta = config?.usarLogoPropria ? config.logoEtiquetaUrl : logoLoja;

  if (!config) return <div className="page"><p>Carregando...</p></div>;

  const escala = config.escalaFonte / 100;

  function conteudoEtiqueta(nomeExibicao: string, precoVenda: number, codigoBarras: string | null) {
    return (
      <>
        {config!.incluirLogo && logoParaEtiqueta && <img className="etq-logo" src={logoParaEtiqueta} alt="" />}
        {config!.incluirNomeMarca && nomeLoja && (
          <div style={{ fontSize: 8 * escala, fontWeight: 700 }}>{nomeLoja}</div>
        )}
        {config!.incluirNomeProduto && (
          <div style={{ fontSize: 7 * escala, marginTop: '1mm' }}>{nomeExibicao}</div>
        )}
        {config!.incluirPreco && (
          <div style={{ fontSize: 11 * escala, fontWeight: 700, marginTop: '1mm' }}>{fmt(precoVenda)}</div>
        )}
        {config!.incluirCodigoBarras && codigoBarras && (
          <img className="etq-barras" src={urlCodigoBarras(codigoBarras)} alt="" />
        )}
      </>
    );
  }

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
          text-align: center; overflow: hidden;
          font-family: ${config.fonteFamilia}; color: ${config.corTexto};
        }
        .etq-item img.etq-logo { max-width: 60%; max-height: 30%; object-fit: contain; margin-bottom: 1mm; }
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
                <div className="cx-tipo-toggle" style={{ maxWidth: 340, display: 'flex', gap: 8 }}>
                  <button type="button" className={!config.usarLogoPropria ? 'active' : ''}
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => setConfig(c => c ? { ...c, usarLogoPropria: false } : c)}>
                    Logo da loja
                  </button>
                  <button type="button" className={config.usarLogoPropria ? 'active' : ''}
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => setConfig(c => c ? { ...c, usarLogoPropria: true } : c)}>
                    Logo própria
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
          <div className="form-group" style={{ marginBottom: 14, maxWidth: 400 }}>
            <label className="form-label">Tamanho padrão</label>
            <select
              value={TAMANHOS_PADRAO.findIndex(t => t.largura === config.larguraMm && t.altura === config.alturaMm)}
              onChange={e => {
                const idx = +e.target.value;
                if (idx === -1) return;
                const t = TAMANHOS_PADRAO[idx];
                setConfig(c => c ? { ...c, larguraMm: t.largura, alturaMm: t.altura } : c);
              }}>
              <option value={-1}>Personalizado</option>
              {TAMANHOS_PADRAO.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          </div>
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
            Escolha um padrão acima, ou ajuste manualmente os campos de largura/altura pra um tamanho customizado.
          </p>

          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Estilo do texto</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Cor do texto</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={config.corTexto}
                  onChange={e => setConfig(c => c ? { ...c, corTexto: e.target.value } : c)}
                  style={{ width: 44, height: 36, padding: 2 }} />
                <input value={config.corTexto}
                  onChange={e => setConfig(c => c ? { ...c, corTexto: e.target.value } : c)}
                  style={{ width: 90 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Fonte</label>
              <select value={config.fonteFamilia} style={{ width: 200 }}
                onChange={e => setConfig(c => c ? { ...c, fonteFamilia: e.target.value } : c)}>
                {FONTES_DISPONIVEIS.map(f => <option key={f.valor} value={f.valor}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tamanho do texto ({config.escalaFonte}%)</label>
              <input type="range" min={50} max={300} step={10} value={config.escalaFonte}
                onChange={e => setConfig(c => c ? { ...c, escalaFonte: +e.target.value } : c)}
                style={{ width: 180 }} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} /> Pré-visualização
          </div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: `${config.larguraMm}mm`, height: `${config.alturaMm}mm`,
                border: '1px dashed #ccc', boxSizing: 'border-box', padding: '2mm',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', overflow: 'hidden', background: '#fff',
                fontFamily: config.fonteFamilia, color: config.corTexto,
              }}
            >
              {config.incluirLogo && logoParaEtiqueta && (
                <img src={logoParaEtiqueta} alt="" style={{ maxWidth: '60%', maxHeight: '30%', objectFit: 'contain', marginBottom: '1mm' }} />
              )}
              {config.incluirNomeMarca && nomeLoja && (
                <div style={{ fontSize: 8 * escala, fontWeight: 700 }}>{nomeLoja}</div>
              )}
              {config.incluirNomeProduto && (
                <div style={{ fontSize: 7 * escala, marginTop: '1mm' }}>Nome do produto</div>
              )}
              {config.incluirPreco && (
                <div style={{ fontSize: 11 * escala, fontWeight: 700, marginTop: '1mm' }}>{fmt(29.9)}</div>
              )}
              {config.incluirCodigoBarras && (
                <img src={urlCodigoBarras('7891234567895')} alt="" style={{ width: '90%', marginTop: '1mm' }} />
              )}
            </div>
          </div>

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
        {itensPaginados.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}><Tag size={28} /><p>Nenhum produto encontrado.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {itensPaginados.map(item => {
              const marcado = !!selecionados[item.chave];
              return (
                <div key={item.chave} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={marcado} style={{ width: 16, height: 16, margin: 0 }}
                    onChange={() => toggleItem(item.chave)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.nomeExibicao}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {fmt(item.precoVenda)}{item.codigoBarras ? ` · ${item.codigoBarras}` : ' · sem código de barras'}
                    </div>
                  </div>
                  {marcado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Qtd:</span>
                      <input type="number" min={1} value={selecionados[item.chave]} style={{ width: 60 }}
                        onChange={e => alterarQtd(item.chave, +e.target.value)} />
                      {item.estoque > 0 && (
                        <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}
                          title={`Estoque: ${item.estoque}`}
                          onClick={() => alterarQtd(item.chave, item.estoque)}>
                          Usar estoque ({item.estoque})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {itensFiltrados.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" disabled={paginaSegura <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaSegura} / {totalPaginas}</span>
          <button className="btn-secondary" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
        </div>
      )}

      {/* Área de impressão — escondida na tela, só aparece via CSS @media print */}
      <div className="etq-impressao">
        <div className="etq-grid">
          {listaImpressao.map(item => (
            <div key={item.chaveUnica} className="etq-item" style={{ width: `${config.larguraMm}mm`, height: `${config.alturaMm}mm` }}>
              {conteudoEtiqueta(item.nomeExibicao, item.precoVenda, item.codigoBarras)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}