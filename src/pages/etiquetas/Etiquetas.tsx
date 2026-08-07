import { useState, useEffect, useRef } from 'react';
import { Tag, Search, Printer, Settings, Upload, Eye, Plus, Star, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CLOUDINARY_CLOUD = 'dnwnwshvq';
const CLOUDINARY_PRESET = 'loja-logos';

interface ModeloEtiqueta {
  id: string;
  nome: string;
  padrao: boolean;
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
  corFundo: string;
  fonteFamilia: string;
  escalaFonte: number;
}

const MODELO_VAZIO: Omit<ModeloEtiqueta, 'id'> = {
  nome: '', padrao: false,
  incluirLogo: true, usarLogoPropria: false, logoEtiquetaUrl: null,
  incluirNomeMarca: true, incluirNomeProduto: true, incluirPreco: true, incluirCodigoBarras: true,
  larguraMm: 40, alturaMm: 30,
  corTexto: '#000000', corFundo: '#FFFFFF', fonteFamilia: 'Arial, sans-serif', escalaFonte: 100,
};

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
  { valor: "'Arial Black', sans-serif", label: 'Arial Black (bem grossa)' },
  { valor: 'Verdana, sans-serif', label: 'Verdana' },
  { valor: 'Tahoma, sans-serif', label: 'Tahoma' },
  { valor: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { valor: "'Segoe UI', sans-serif", label: 'Segoe UI' },
  { valor: 'Calibri, sans-serif', label: 'Calibri' },
  { valor: 'Georgia, serif', label: 'Georgia' },
  { valor: "'Times New Roman', serif", label: 'Times New Roman' },
  { valor: "'Palatino Linotype', serif", label: 'Palatino' },
  { valor: 'Garamond, serif', label: 'Garamond' },
  { valor: "'Courier New', monospace", label: 'Courier New (máquina de escrever)' },
  { valor: "'Comic Sans MS', cursive", label: 'Comic Sans' },
  { valor: "'Brush Script MT', cursive", label: 'Brush Script (cursiva)' },
  { valor: 'Impact, sans-serif', label: 'Impact (bem chamativa)' },
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

  const [modelos, setModelos] = useState<ModeloEtiqueta[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(true);
  const [modeloAtivoId, setModeloAtivoId] = useState('');

  const [modalModelos, setModalModelos] = useState(false);
  const [mostrarFormModelo, setMostrarFormModelo] = useState(false);
  const [editandoModeloId, setEditandoModeloId] = useState<string | null>(null);
  const [formModelo, setFormModelo] = useState<Omit<ModeloEtiqueta, 'id'>>(MODELO_VAZIO);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<ModeloEtiqueta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Record<string, number>>({});
  const [modoImpressao, setModoImpressao] = useState<'a4' | 'termica'>('a4');
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [usarEstoqueAuto, setUsarEstoqueAuto] = useState(false);

  const [nomeLoja, setNomeLoja] = useState('');
  const [logoLoja, setLogoLoja] = useState('');

  function carregarModelos() {
    setCarregandoModelos(true);
    api.get<ModeloEtiqueta[]>('/api/etiquetas/modelos')
      .then(lista => {
        setModelos(lista);
        const padrao = lista.find(m => m.padrao) ?? lista[0];
        if (padrao) setModeloAtivoId(atual => atual || padrao.id);
      })
      .catch(() => {})
      .finally(() => setCarregandoModelos(false));
  }

  useEffect(() => {
    carregarModelos();
    api.get<any>('/api/cliente/config').then(res => {
      setNomeLoja(res?.nome ?? '');
      setLogoLoja(res?.logoUrl ?? '');
    }).catch(() => {});
  }, []);

  const modeloAtivo = modelos.find(m => m.id === modeloAtivoId) ?? null;

  // ── Gerenciar modelos (CRUD) ──────────────────────────────────
  function abrirNovoModelo() {
    setEditandoModeloId(null);
    setFormModelo(MODELO_VAZIO);
    setMostrarFormModelo(true);
  }

  function abrirEditarModelo(m: ModeloEtiqueta) {
    setEditandoModeloId(m.id);
    setFormModelo({ ...m });
    setMostrarFormModelo(true);
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
      setFormModelo(f => ({ ...f, logoEtiquetaUrl: json.secure_url }));
    } catch (e) {
      erro('Erro ao fazer upload: ' + (e as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function salvarModelo() {
    if (!formModelo.nome.trim()) { erro('Digite um nome pro modelo.'); return; }
    setSalvandoModelo(true);
    try {
      if (editandoModeloId) await api.put(`/api/etiquetas/modelos/${editandoModeloId}`, formModelo);
      else await api.post('/api/etiquetas/modelos', formModelo);
      sucesso('Modelo salvo!');
      setMostrarFormModelo(false);
      carregarModelos();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoModelo(false);
    }
  }

  async function marcarPadrao(m: ModeloEtiqueta) {
    try {
      await api.patch(`/api/etiquetas/modelos/${m.id}/padrao`, {});
      sucesso('Modelo padrão atualizado.');
      carregarModelos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirModelo() {
    if (!confirmExcluir) return;
    try {
      await api.delete(`/api/etiquetas/modelos/${confirmExcluir.id}`);
      sucesso('Modelo excluído.');
      setConfirmExcluir(null);
      if (modeloAtivoId === confirmExcluir.id) setModeloAtivoId('');
      carregarModelos();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  // ── Seleção de produtos ────────────────────────────────────────
  interface ItemEtiqueta {
    chave: string;
    nomeExibicao: string;
    precoVenda: number;
    codigoBarras: string | null;
    estoque: number;
  }

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

  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / itensPorPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const itensPaginados = itensFiltrados.slice((paginaSegura - 1) * itensPorPagina, paginaSegura * itensPorPagina);

  useEffect(() => { setPagina(1); }, [busca, itensPorPagina]);

  function toggleItem(chave: string) {
    setSelecionados(sel => {
      const novo = { ...sel };
      if (novo[chave]) delete novo[chave];
      else {
        const item = todosItens.find(i => i.chave === chave);
        novo[chave] = usarEstoqueAuto && item && item.estoque > 0 ? item.estoque : 1;
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
    if (!modeloAtivo) { erro('Escolha um modelo de etiqueta.'); return; }
    if (listaImpressao.length === 0) { erro('Selecione ao menos um produto.'); return; }
    window.print();
  }

  const logoParaEtiqueta = formModelo.usarLogoPropria ? formModelo.logoEtiquetaUrl : logoLoja;
  const logoParaImpressao = modeloAtivo?.usarLogoPropria ? modeloAtivo.logoEtiquetaUrl : logoLoja;

  function conteudoEtiqueta(m: ModeloEtiqueta | Omit<ModeloEtiqueta, 'id'>, logo: string | null, nomeExibicao: string, precoVenda: number, codigoBarras: string | null) {
    const escala = m.escalaFonte / 100;
    return (
      <>
        {m.incluirLogo && logo && <img src={logo} alt="" style={{ maxWidth: '60%', maxHeight: '30%', objectFit: 'contain', marginBottom: '1mm' }} />}
        {m.incluirNomeMarca && nomeLoja && <div style={{ fontSize: 8 * escala, fontWeight: 700 }}>{nomeLoja}</div>}
        {m.incluirNomeProduto && <div style={{ fontSize: 7 * escala, marginTop: '1mm' }}>{nomeExibicao}</div>}
        {m.incluirPreco && <div style={{ fontSize: 11 * escala, fontWeight: 700, marginTop: '1mm' }}>{fmt(precoVenda)}</div>}
        {m.incluirCodigoBarras && codigoBarras && <img className="etq-barras" src={urlCodigoBarras(codigoBarras)} alt="" style={{ width: '90%', marginTop: '1mm' }} />}
      </>
    );
  }

  if (carregandoModelos) return <div className="page"><div className="layout-spinner" /></div>;

  const cssImpressao = modeloAtivo ? (modoImpressao === 'termica'
    ? `
      @page { size: ${modeloAtivo.larguraMm}mm ${modeloAtivo.alturaMm}mm; margin: 0; }
      .etq-grid { display: block; }
      .etq-item { width: ${modeloAtivo.larguraMm}mm; height: ${modeloAtivo.alturaMm}mm; page-break-after: always; }
    `
    : `
      @page { size: A4; margin: 10mm; }
      .etq-grid { display: flex; flex-wrap: wrap; gap: 2mm; }
      .etq-item { width: ${modeloAtivo.larguraMm}mm; height: ${modeloAtivo.alturaMm}mm; page-break-inside: avoid; }
    `) : '';

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
          font-family: ${modeloAtivo?.fonteFamilia ?? 'Arial'}; color: ${modeloAtivo?.corTexto ?? '#000'};
          background: ${modeloAtivo?.corFundo ?? '#fff'};
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Etiquetas</h1>
          <p className="page-subtitle">Escolha um modelo, selecione os produtos e imprima</p>
        </div>
        <button className="btn-secondary" onClick={() => setModalModelos(true)}>
          <Settings size={15} style={{ verticalAlign: -2 }} /> Gerenciar modelos
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
            <label className="form-label">Modelo de etiqueta</label>
            <select value={modeloAtivoId} onChange={e => setModeloAtivoId(e.target.value)}>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.padrao ? ' ⭐' : ''}</option>)}
            </select>
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

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-wrap" style={{ maxWidth: 320, flex: 1 }}>
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Buscar produto ou código de barras..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={usarEstoqueAuto} style={{ width: 14, height: 14, margin: 0 }}
              onChange={e => setUsarEstoqueAuto(e.target.checked)} />
            Usar quantidade do estoque automaticamente
          </label>
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-secondary" disabled={paginaSegura <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaSegura} / {totalPaginas}</span>
            <button className="btn-secondary" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
            Por página:
            <select value={itensPorPagina} onChange={e => setItensPorPagina(+e.target.value)} style={{ width: 70 }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </label>
        </div>
      )}

      {/* Área de impressão — escondida na tela, aparece via CSS @media print */}
      {modeloAtivo && (
        <div className="etq-impressao">
          <div className="etq-grid">
            {listaImpressao.map(item => (
              <div key={item.chaveUnica} className="etq-item" style={{ width: `${modeloAtivo.larguraMm}mm`, height: `${modeloAtivo.alturaMm}mm` }}>
                {conteudoEtiqueta(modeloAtivo, logoParaImpressao, item.nomeExibicao, item.precoVenda, item.codigoBarras)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal gerenciar modelos */}
      {modalModelos && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalModelos(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Modelos de etiqueta</h2>
              <button className="btn-ghost" onClick={() => { setModalModelos(false); setMostrarFormModelo(false); }}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {!mostrarFormModelo && (
                <button className="btn-primary" style={{ width: '100%', marginBottom: 16 }} onClick={abrirNovoModelo}>
                  <Plus size={15} style={{ verticalAlign: -2 }} /> Novo modelo
                </button>
              )}

              {mostrarFormModelo && (
                <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{editandoModeloId ? 'Editar modelo' : 'Novo modelo'}</p>

                  <div className="form-group">
                    <label className="form-label">Nome do modelo</label>
                    <input value={formModelo.nome} onChange={e => setFormModelo(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Ex: Roupa, Preço simples..." autoFocus />
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>O que aparece</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formModelo.incluirLogo} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setFormModelo(f => ({ ...f, incluirLogo: e.target.checked }))} />
                      Incluir logo
                    </label>
                    {formModelo.incluirLogo && (
                      <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="cx-tipo-toggle" style={{ maxWidth: 340, display: 'flex', gap: 8 }}>
                          <button type="button" className={!formModelo.usarLogoPropria ? 'active' : ''}
                            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                            onClick={() => setFormModelo(f => ({ ...f, usarLogoPropria: false }))}>
                            Logo da loja
                          </button>
                          <button type="button" className={formModelo.usarLogoPropria ? 'active' : ''}
                            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                            onClick={() => setFormModelo(f => ({ ...f, usarLogoPropria: true }))}>
                            Logo própria
                          </button>
                        </div>
                        {formModelo.usarLogoPropria && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {formModelo.logoEtiquetaUrl && (
                              <img src={formModelo.logoEtiquetaUrl} alt="Logo" style={{ width: 50, height: 50, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6 }} />
                            )}
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogoPropria(f); }} />
                            <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {uploadingLogo ? 'Enviando...' : <><Upload size={14} /> {formModelo.logoEtiquetaUrl ? 'Trocar' : 'Enviar'} logo</>}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formModelo.incluirNomeMarca} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setFormModelo(f => ({ ...f, incluirNomeMarca: e.target.checked }))} />
                      Nome da marca ({nomeLoja || 'sua loja'})
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formModelo.incluirNomeProduto} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setFormModelo(f => ({ ...f, incluirNomeProduto: e.target.checked }))} />
                      Nome do produto
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formModelo.incluirPreco} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setFormModelo(f => ({ ...f, incluirPreco: e.target.checked }))} />
                      Preço
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formModelo.incluirCodigoBarras} style={{ width: 16, height: 16, margin: 0 }}
                        onChange={e => setFormModelo(f => ({ ...f, incluirCodigoBarras: e.target.checked }))} />
                      Código de barras
                    </label>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tamanho</div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <select
                      value={TAMANHOS_PADRAO.findIndex(t => t.largura === formModelo.larguraMm && t.altura === formModelo.alturaMm)}
                      onChange={e => {
                        const idx = +e.target.value;
                        if (idx === -1) return;
                        const t = TAMANHOS_PADRAO[idx];
                        setFormModelo(f => ({ ...f, larguraMm: t.largura, alturaMm: t.altura }));
                      }}>
                      <option value={-1}>Personalizado</option>
                      {TAMANHOS_PADRAO.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Largura (mm)</label>
                      <input type="number" min={10} value={formModelo.larguraMm}
                        onChange={e => setFormModelo(f => ({ ...f, larguraMm: +e.target.value }))} style={{ width: 90 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Altura (mm)</label>
                      <input type="number" min={10} value={formModelo.alturaMm}
                        onChange={e => setFormModelo(f => ({ ...f, alturaMm: +e.target.value }))} style={{ width: 90 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Estilo</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Cor do texto</label>
                      <input type="color" value={formModelo.corTexto}
                        onChange={e => setFormModelo(f => ({ ...f, corTexto: e.target.value }))}
                        style={{ width: 44, height: 36, padding: 2 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cor de fundo</label>
                      <input type="color" value={formModelo.corFundo}
                        onChange={e => setFormModelo(f => ({ ...f, corFundo: e.target.value }))}
                        style={{ width: 44, height: 36, padding: 2 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fonte</label>
                      <select value={formModelo.fonteFamilia} style={{ width: 180 }}
                        onChange={e => setFormModelo(f => ({ ...f, fonteFamilia: e.target.value }))}>
                        {FONTES_DISPONIVEIS.map(fnt => <option key={fnt.valor} value={fnt.valor}>{fnt.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tamanho do texto ({formModelo.escalaFonte}%)</label>
                      <input type="range" min={50} max={300} step={10} value={formModelo.escalaFonte}
                        onChange={e => setFormModelo(f => ({ ...f, escalaFonte: +e.target.value }))}
                        style={{ width: 160 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Eye size={13} /> Pré-visualização
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: `${formModelo.larguraMm}mm`, height: `${formModelo.alturaMm}mm`,
                      border: '1px dashed #ccc', boxSizing: 'border-box', padding: '2mm',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      textAlign: 'center', overflow: 'hidden',
                      fontFamily: formModelo.fonteFamilia, color: formModelo.corTexto, background: formModelo.corFundo,
                    }}>
                      {conteudoEtiqueta(formModelo, logoParaEtiqueta, 'Nome do produto', 29.9, '7891234567895')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" onClick={salvarModelo} disabled={salvandoModelo}>
                      {salvandoModelo ? 'Salvando...' : editandoModeloId ? 'Salvar alterações' : 'Criar modelo'}
                    </button>
                    <button className="btn-secondary" onClick={() => setMostrarFormModelo(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modelos.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{m.nome}</span>
                      {m.padrao && <span className="badge badge-accent" style={{ fontSize: 10 }}>Padrão</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!m.padrao && (
                        <button className="btn-ghost" title="Marcar como padrão" onClick={() => marcarPadrao(m)}>
                          <Star size={14} />
                        </button>
                      )}
                      <button className="btn-ghost" onClick={() => abrirEditarModelo(m)}>Editar</button>
                      <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluir(m)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setModalModelos(false); setMostrarFormModelo(false); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir modelo</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir o modelo <strong style={{ color: 'var(--text-1)' }}>{confirmExcluir.nome}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirModelo}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}