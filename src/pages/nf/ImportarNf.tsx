import { useState, useEffect } from 'react';
import { Upload, Check, X, FileText, Package, PackagePlus } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ItemPreview {
  codigoFornecedor: string;
  gtin: string | null;
  descricao: string;
  nomeBase: string;
  cor: string | null;
  tamanho: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  statusMatch: 'gtin' | 'mapeamento' | 'nome_exato' | 'sugestao' | 'novo';
  produtoSugeridoId: string | null;
  produtoSugeridoNome: string | null;
  variacaoJaExiste: boolean;
  estoqueVariacaoAtual: number | null;
  categoriaSugerida: string;
  categoriaJaExiste: boolean;
}

interface Preview {
  cnpjFornecedor: string;
  nomeFornecedor: string;
  numeroNf: string;
  chaveAcesso: string;
  itens: ItemPreview[];
}

interface DecisaoItem {
  acao: 'existente' | 'novo';
  produtoId: string | null;
  precoCusto: number | null;
  precoVenda: number | null;
  categoriaNome: string;
}

const STATUS_LABEL: Record<ItemPreview['statusMatch'], { txt: string; cor: string; icone: any }> = {
  gtin:       { txt: 'Match por código de barras', cor: 'var(--green)', icone: Check },
  mapeamento: { txt: 'Reconhecido de nota anterior', cor: 'var(--green)', icone: Check },
  nome_exato: { txt: 'Produto já cadastrado', cor: 'var(--green)', icone: Check },
  sugestao:   { txt: 'Sugestão (revisar)', cor: 'var(--yellow, #d97706)', icone: Package },
  novo:       { txt: 'Produto novo', cor: 'var(--accent)', icone: PackagePlus },
};

interface NfHistorico {
  id: string;
  numeroNf: string;
  nomeFornecedor: string;
  qtdItens: number;
  importadoEm: string;
  desfeita: boolean;
}

export function ImportarNf() {
  const { sucesso, erro } = useToast();
  const { recarregar } = useApp();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, DecisaoItem>>({});
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [historico, setHistorico] = useState<NfHistorico[]>([]);
  const [confirmDesfazer, setConfirmDesfazer] = useState<NfHistorico | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);

  function carregarHistorico() {
    api.get<NfHistorico[]>('/api/nf-importacao/historico').then(setHistorico).catch(() => {});
  }

  async function desfazer() {
    if (!confirmDesfazer) return;
    setDesfazendo(true);
    try {
      await api.post(`/api/nf-importacao/${confirmDesfazer.id}/desfazer`, {});
      sucesso('Importação desfeita. Você já pode reimportar esta nota.');
      setConfirmDesfazer(null);
      carregarHistorico();
      recarregar();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setDesfazendo(false);
    }
  }

  async function enviarArquivo() {
    if (!arquivo) return;
    setCarregando(true);
    try {
      const form = new FormData();
      form.append('arquivo', arquivo);
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/nf-importacao/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('loja:sessao') || '{}').token ?? ''}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro ?? 'Erro ao processar XML.');

      setPreview(data);

      // Prepara decisões iniciais: se tem match, usa produto existente; se não, cria novo com preço = custo
      const decIni: Record<number, DecisaoItem> = {};
      data.itens.forEach((it: ItemPreview, i: number) => {
        decIni[i] = it.produtoSugeridoId
          ? { acao: 'existente', produtoId: it.produtoSugeridoId, precoCusto: null, precoVenda: null, categoriaNome: it.categoriaSugerida }
          : { acao: 'novo',       produtoId: null, precoCusto: it.valorUnitario, precoVenda: it.valorUnitario, categoriaNome: it.categoriaSugerida };
      });
      setDecisoes(decIni);
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!preview) return;
    setConfirmando(true);
    try {
      const itens = preview.itens.map((it, i) => {
        const dec = decisoes[i];
        return {
          codigoFornecedor: it.codigoFornecedor,
          gtin: it.gtin,
          nomeBase: it.nomeBase,
          cor: it.cor,
          tamanho: it.tamanho,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          acao: dec.acao,
          produtoId: dec.acao === 'existente' ? dec.produtoId : null,
          precoCusto: dec.acao === 'novo' ? dec.precoCusto : null,
          precoVenda: dec.acao === 'novo' ? dec.precoVenda : null,
          categoriaNome: dec.acao === 'novo' ? dec.categoriaNome : null,
        };
      });

      const res = await api.post<any>('/api/nf-importacao/confirmar', {
        cnpjFornecedor: preview.cnpjFornecedor,
        numeroNf: preview.numeroNf,
        chaveAcesso: preview.chaveAcesso,
        nomeFornecedor: preview.nomeFornecedor,
        itens,
      });
      
      sucesso(`${res.mensagem} (${res.produtosNovos} novos, ${res.produtosAtualizados} atualizados${res.categoriasCriadas > 0 ? `, ${res.categoriasCriadas} categoria(s) nova(s)` : ''})`);
      setPreview(null);
      setArquivo(null);
      setDecisoes({});
      recarregar();
      carregarHistorico();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  }

  useEffect(() => { carregarHistorico(); }, []);

  function alterarDecisao(i: number, dec: Partial<DecisaoItem>) {
    setDecisoes(d => ({ ...d, [i]: { ...d[i], ...dec } }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar NF</h1>
          <p className="page-subtitle">Dar entrada em produtos a partir do XML da nota fiscal</p>
        </div>
      </div>

      {!preview && (
        <>
          <div className="card" style={{ maxWidth: 520, marginBottom: 24 }}>
            <div style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-2)' }}>
              Envie o arquivo XML da NF-e emitida pelo seu fornecedor:
            </div>
            <input type="file" accept=".xml,text/xml,application/xml"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              style={{ marginBottom: 12 }} />
            <div>
              <button className="btn-primary" disabled={!arquivo || carregando} onClick={enviarArquivo}>
                <Upload size={14} style={{ verticalAlign: -2 }} /> {carregando ? 'Analisando...' : 'Analisar nota'}
              </button>
            </div>
          </div>

          {historico.length > 0 && (
            <div className="card" style={{ maxWidth: 720 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Notas importadas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historico.map(h => (
                  <div key={h.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
                    opacity: h.desfeita ? 0.5 : 1,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        NF {h.numeroNf} — {h.nomeFornecedor}
                        {h.desfeita && <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>Desfeita</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {h.qtdItens} item(ns) · {new Date(h.importadoEm).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    {!h.desfeita && (
                      <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setConfirmDesfazer(h)}>
                        Desfazer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {confirmDesfazer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDesfazer(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Desfazer importação</h2>
              <button className="btn-ghost" onClick={() => setConfirmDesfazer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Desfazer a NF <strong style={{ color: 'var(--text-1)' }}>{confirmDesfazer.numeroNf}</strong> de {confirmDesfazer.nomeFornecedor}?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                Isso vai remover o estoque adicionado e excluir produtos/variações criados exclusivamente por essa importação (produtos já vendidos não são removidos, só têm o estoque ajustado). Depois disso você pode reimportar a mesma nota.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDesfazer(null)}>Cancelar</button>
              <button className="btn-danger" disabled={desfazendo} onClick={desfazer}>
                {desfazendo ? 'Desfazendo...' : 'Desfazer importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileText size={16} /> <strong>NF {preview.numeroNf}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Fornecedor: <strong style={{ color: 'var(--text-2)' }}>{preview.nomeFornecedor}</strong>
              {' · '}CNPJ: {preview.cnpjFornecedor}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {preview.itens.map((it, i) => {
              const dec = decisoes[i] ?? { acao: 'novo', produtoId: null, precoVenda: it.valorUnitario };
              const status = STATUS_LABEL[it.statusMatch];
              const Icon = status.icone;
              return (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={14} style={{ color: status.cor }} />
                    <span style={{ fontSize: 11, color: status.cor, fontWeight: 500 }}>{status.txt}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.nomeBase}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {it.cor && `Cor: ${it.cor}`}{it.cor && it.tamanho && ' · '}{it.tamanho && `Tamanho: ${it.tamanho}`}
                    {(it.cor || it.tamanho) && ' · '}
                    Cód. fornecedor: {it.codigoFornecedor}
                    {it.gtin && ` · GTIN: ${it.gtin}`}
                    {' · '}Qtd: {it.quantidade}
                    {' · '}Custo unit.: {fmt(it.valorUnitario)}
                    {' · '}Total: {fmt(it.valorTotal)}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={dec.acao === 'existente' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 12 }}
                      disabled={!it.produtoSugeridoId}
                      onClick={() => alterarDecisao(i, { acao: 'existente', produtoId: it.produtoSugeridoId, precoVenda: null })}
                    >
                      Usar existente {it.produtoSugeridoNome ? `(${it.produtoSugeridoNome})` : ''}
                    </button>
                    <button
                      className={dec.acao === 'novo' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 12 }}
                      onClick={() => alterarDecisao(i, { acao: 'novo', produtoId: null, precoVenda: it.valorUnitario })}
                    >
                      Criar novo produto
                    </button>
                  </div>

                  {dec.acao === 'existente' && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      {it.variacaoJaExiste
                        ? <>Variação {it.cor ?? ''} {it.tamanho ?? ''} já existe — estoque atual: {it.estoqueVariacaoAtual} → após entrada: <strong>{(it.estoqueVariacaoAtual ?? 0) + it.quantidade}</strong></>
                        : (it.cor || it.tamanho)
                          ? <>Vai criar uma nova variação {it.cor ?? ''} {it.tamanho ?? ''} neste produto, com estoque inicial {it.quantidade}</>
                          : <>Entrada de {it.quantidade} unidade(s) no estoque</>
                      }
                    </div>
                  )}

                  {dec.acao === 'novo' && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Preço de custo:</span>
                        <input
                          type="number" step="0.01" min={0}
                          value={dec.precoCusto ?? ''}
                          onChange={e => alterarDecisao(i, { precoCusto: parseFloat(e.target.value) || 0 })}
                          style={{ width: 120, fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Preço de venda:</span>
                        <input
                          type="number" step="0.01" min={0}
                          value={dec.precoVenda ?? ''}
                          onChange={e => alterarDecisao(i, { precoVenda: parseFloat(e.target.value) || 0 })}
                          style={{ width: 120, fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Categoria:</span>
                        <input
                          value={dec.categoriaNome}
                          onChange={e => alterarDecisao(i, { categoriaNome: e.target.value })}
                          style={{ width: 140, fontSize: 13 }}
                        />
                        {!it.categoriaJaExiste && (
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>nova categoria</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setPreview(null); setArquivo(null); }}>
              <X size={14} style={{ verticalAlign: -2 }} /> Cancelar
            </button>
            <button className="btn-primary" disabled={confirmando} onClick={confirmar}>
              <Check size={14} style={{ verticalAlign: -2 }} /> {confirmando ? 'Salvando...' : 'Confirmar entrada de estoque'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}