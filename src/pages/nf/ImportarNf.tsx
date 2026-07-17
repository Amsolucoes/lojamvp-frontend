import { useState } from 'react';
import { Upload, Check, X, FileText, Package, PackagePlus } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ItemPreview {
  codigoFornecedor: string;
  gtin: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  statusMatch: 'gtin' | 'mapeamento' | 'sugestao' | 'novo';
  produtoSugeridoId: string | null;
  produtoSugeridoNome: string | null;
  produtoSugeridoEstoqueAtual: number | null;
}

interface Preview {
  cnpjFornecedor: string;
  nomeFornecedor: string;
  numeroNf: string;
  itens: ItemPreview[];
}

interface DecisaoItem {
  acao: 'existente' | 'novo';
  produtoId: string | null;
  precoVenda: number | null;
}

const STATUS_LABEL: Record<ItemPreview['statusMatch'], { txt: string; cor: string; icone: any }> = {
  gtin:       { txt: 'Match por código de barras', cor: 'var(--green)', icone: Check },
  mapeamento: { txt: 'Reconhecido de nota anterior', cor: 'var(--green)', icone: Check },
  sugestao:   { txt: 'Sugestão (revisar)', cor: 'var(--yellow, #d97706)', icone: Package },
  novo:       { txt: 'Produto novo', cor: 'var(--accent)', icone: PackagePlus },
};

export function ImportarNf() {
  const { sucesso, erro } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, DecisaoItem>>({});
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

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
          ? { acao: 'existente', produtoId: it.produtoSugeridoId, precoVenda: null }
          : { acao: 'novo',       produtoId: null, precoVenda: it.valorUnitario };
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
          descricao: it.descricao,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          acao: dec.acao,
          produtoId: dec.acao === 'existente' ? dec.produtoId : null,
          precoVenda: dec.acao === 'novo' ? dec.precoVenda : null,
        };
      });

      const res = await api.post<any>('/api/nf-importacao/confirmar', {
        cnpjFornecedor: preview.cnpjFornecedor,
        numeroNf: preview.numeroNf,
        itens,
      });
      sucesso(`${res.mensagem} (${res.produtosNovos} novos, ${res.produtosAtualizados} atualizados)`);
      setPreview(null);
      setArquivo(null);
      setDecisoes({});
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  }

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
        <div className="card" style={{ maxWidth: 520 }}>
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
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.descricao}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
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

                  {dec.acao === 'existente' && it.produtoSugeridoEstoqueAtual != null && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      Estoque atual: {it.produtoSugeridoEstoqueAtual} → após entrada: <strong>{Number(it.produtoSugeridoEstoqueAtual) + it.quantidade}</strong>
                    </div>
                  )}

                  {dec.acao === 'novo' && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Preço de venda:</span>
                      <input
                        type="number" step="0.01" min={0}
                        value={dec.precoVenda ?? ''}
                        onChange={e => alterarDecisao(i, { precoVenda: parseFloat(e.target.value) || 0 })}
                        style={{ width: 120, fontSize: 13 }}
                      />
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