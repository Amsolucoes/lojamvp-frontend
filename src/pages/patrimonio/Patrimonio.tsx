import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Edit2, Package, FileDown, ClipboardCheck, ClipboardList } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

// ── Tipos ─────────────────────────────────────────────────────────
interface ItemPatrimonio {
  id: string;
  nome: string;
  categoria: string | null;
  quantidadeEsperada: number;
  valorUnitario: number;
  observacao: string | null;
  ativo: boolean;
  valorTotal: number;
}

interface ContagemResumo {
  id: string;
  dataContagem: string;
  responsavel: string | null;
  observacao: string | null;
  qtdItens: number;
  qtdDivergentes: number;
}

interface ItemContagemDetalhe {
  id: string;
  itemPatrimonioId: string;
  nomeItem: string;
  categoria: string | null;
  quantidadeEsperadaNoMomento: number;
  quantidadeContada: number;
  diferenca: number;
  valorUnitario: number;
  observacao: string | null;
}

interface ContagemDetalhe {
  id: string;
  dataContagem: string;
  responsavel: string | null;
  observacao: string | null;
  itens: ItemContagemDetalhe[];
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Baixa um PDF do backend como blob, usando o mesmo token salvo no localStorage
async function baixarPdf(path: string, nomeArquivo: string) {
  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
  let token: string | null = null;
  try {
    const sessao = localStorage.getItem('loja:sessao');
    token = sessao ? JSON.parse(sessao).token : null;
  } catch { /* ignora */ }

  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Não foi possível gerar o PDF.');

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const ITEM_FORM_VAZIO = { nome: '', categoria: '', quantidadeEsperada: '0', valorUnitario: '0', observacao: '', ativo: true };

export function Patrimonio() {
  const { sucesso, erro } = useToast();
  const [aba, setAba] = useState<'itens' | 'contagens'>('itens');

  // ── Itens ────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemPatrimonio[]>([]);
  const [modalItem, setModalItem] = useState<'novo' | 'editar' | null>(null);
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [formItem, setFormItem] = useState(ITEM_FORM_VAZIO);
  const [confirmExcluirItem, setConfirmExcluirItem] = useState<ItemPatrimonio | null>(null);
  const [salvandoItem, setSalvandoItem] = useState(false);

  // ── Contagens ────────────────────────────────────────────────
  const [contagens, setContagens] = useState<ContagemResumo[]>([]);
  const [modalNovaContagem, setModalNovaContagem] = useState(false);
  const [responsavelContagem, setResponsavelContagem] = useState('');
  const [observacaoContagem, setObservacaoContagem] = useState('');
  const [contagemForm, setContagemForm] = useState<Record<string, { quantidadeContada: string; observacao: string }>>({});
  const [salvandoContagem, setSalvandoContagem] = useState(false);
  const [detalheContagem, setDetalheContagem] = useState<ContagemDetalhe | null>(null);
  const [confirmExcluirContagem, setConfirmExcluirContagem] = useState<ContagemResumo | null>(null);

  useEffect(() => {
    if (aba === 'itens') carregarItens();
    else carregarContagens();
  }, [aba]);

  function carregarItens() {
    api.get<ItemPatrimonio[]>('/api/ordemservico/patrimonio/itens?incluirInativos=true').then(setItens).catch(() => {});
  }

  function carregarContagens() {
    api.get<ContagemResumo[]>('/api/ordemservico/patrimonio/contagens').then(setContagens).catch(() => {});
  }

  // ── CRUD Itens ───────────────────────────────────────────────
  function abrirNovoItem() {
    setEditandoItemId(null);
    setFormItem(ITEM_FORM_VAZIO);
    setModalItem('novo');
  }

  function abrirEditarItem(item: ItemPatrimonio) {
    setEditandoItemId(item.id);
    setFormItem({
      nome: item.nome,
      categoria: item.categoria ?? '',
      quantidadeEsperada: String(item.quantidadeEsperada),
      valorUnitario: String(item.valorUnitario),
      observacao: item.observacao ?? '',
      ativo: item.ativo,
    });
    setModalItem('editar');
  }

  async function salvarItem() {
    if (!formItem.nome.trim()) { erro('Preencha o nome do item.'); return; }
    setSalvandoItem(true);
    try {
      const payload = {
        nome: formItem.nome.trim(),
        categoria: formItem.categoria.trim() || null,
        quantidadeEsperada: parseInt(formItem.quantidadeEsperada) || 0,
        valorUnitario: parseFloat(formItem.valorUnitario) || 0,
        observacao: formItem.observacao.trim() || null,
        ativo: formItem.ativo,
      };
      if (modalItem === 'novo') await api.post('/api/ordemservico/patrimonio/itens', payload);
      else await api.put(`/api/ordemservico/patrimonio/itens/${editandoItemId}`, payload);
      sucesso('Item salvo.');
      setModalItem(null);
      carregarItens();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoItem(false);
    }
  }

  async function excluirItem() {
    if (!confirmExcluirItem) return;
    try {
      const res = await api.delete<{ mensagem: string }>(`/api/ordemservico/patrimonio/itens/${confirmExcluirItem.id}`);
      sucesso(res?.mensagem ?? 'Item removido.');
      setConfirmExcluirItem(null);
      carregarItens();
    } catch (e) {
      erro((e as Error).message);
      setConfirmExcluirItem(null);
    }
  }

  const categorias = [...new Set(itens.map(i => i.categoria).filter((c): c is string => !!c))];
  const valorTotalPatrimonio = itens.filter(i => i.ativo).reduce((s, i) => s + i.valorTotal, 0);

  // ── Nova contagem ────────────────────────────────────────────
  function abrirNovaContagem() {
    const itensAtivos = itens.filter(i => i.ativo);
    if (itensAtivos.length === 0) {
      erro('Cadastre ao menos um item ativo antes de fazer uma contagem.');
      return;
    }
    const inicial: Record<string, { quantidadeContada: string; observacao: string }> = {};
    itensAtivos.forEach(i => {
      inicial[i.id] = { quantidadeContada: String(i.quantidadeEsperada), observacao: '' };
    });
    setContagemForm(inicial);
    setResponsavelContagem('');
    setObservacaoContagem('');
    setModalNovaContagem(true);
  }

  function atualizarContagemItem(itemId: string, patch: Partial<{ quantidadeContada: string; observacao: string }>) {
    setContagemForm(f => ({ ...f, [itemId]: { ...f[itemId], ...patch } }));
  }

  async function salvarContagem() {
    setSalvandoContagem(true);
    try {
      await api.post('/api/ordemservico/patrimonio/contagens', {
        responsavel: responsavelContagem.trim() || null,
        observacao: observacaoContagem.trim() || null,
        itens: Object.entries(contagemForm).map(([itemPatrimonioId, v]) => ({
          itemPatrimonioId,
          quantidadeContada: parseInt(v.quantidadeContada) || 0,
          observacao: v.observacao.trim() || null,
        })),
      });
      sucesso('Contagem registrada.');
      setModalNovaContagem(false);
      carregarContagens();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvandoContagem(false);
    }
  }

  async function abrirDetalheContagem(c: ContagemResumo) {
    try {
      const d = await api.get<ContagemDetalhe>(`/api/ordemservico/patrimonio/contagens/${c.id}`);
      setDetalheContagem(d);
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirContagem() {
    if (!confirmExcluirContagem) return;
    try {
      await api.delete(`/api/ordemservico/patrimonio/contagens/${confirmExcluirContagem.id}`);
      sucesso('Contagem excluída.');
      setConfirmExcluirContagem(null);
      carregarContagens();
    } catch (e) {
      erro((e as Error).message);
      setConfirmExcluirContagem(null);
    }
  }

  async function baixarRelatorioAtual() {
    try {
      await baixarPdf('/api/ordemservico/patrimonio/relatorio-pdf', `patrimonio-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function baixarContagemPdf(c: ContagemResumo) {
    try {
      await baixarPdf(`/api/ordemservico/patrimonio/contagens/${c.id}/pdf`, `contagem-patrimonio-${c.dataContagem.slice(0, 10)}.pdf`);
    } catch (e) {
      erro((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patrimônio</h1>
          <p className="page-subtitle">Ferramentas e equipamentos — cadastro e conferência periódica</p>
        </div>
        {aba === 'itens' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={baixarRelatorioAtual}><FileDown size={14} /> Baixar PDF</button>
            <button className="btn-primary" onClick={abrirNovoItem}><Plus size={15} /> Novo item</button>
          </div>
        ) : (
          <button className="btn-primary" onClick={abrirNovaContagem}><ClipboardCheck size={15} /> Nova contagem</button>
        )}
      </div>

      <div className="planos-tabs">
        <button className={`planos-tab${aba === 'itens' ? ' ativo' : ''}`} onClick={() => setAba('itens')}>
          <Package size={15} /> Itens
        </button>
        <button className={`planos-tab${aba === 'contagens' ? ' ativo' : ''}`} onClick={() => setAba('contagens')}>
          <ClipboardList size={15} /> Contagens
        </button>
      </div>

      {/* ── ABA ITENS ── */}
      {aba === 'itens' && (
        <>
          {itens.length > 0 && (
            <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14 }}>
                Valor total do patrimônio (itens ativos): <strong style={{ color: 'var(--accent)' }}>{fmt(valorTotalPatrimonio)}</strong>
              </span>
            </div>
          )}

          {itens.length === 0 ? (
            <div className="card"><div className="empty"><Package size={32} /><p>Nenhum item cadastrado ainda.</p></div></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Item</th><th>Categoria</th><th>Qtd esperada</th><th>Valor unit.</th><th>Total</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {itens.map(i => (
                      <tr key={i.id} style={{ opacity: i.ativo ? 1 : 0.5 }}>
                        <td>{i.nome}</td>
                        <td>{i.categoria ?? '—'}</td>
                        <td>{i.quantidadeEsperada}</td>
                        <td>{fmt(i.valorUnitario)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(i.valorTotal)}</td>
                        <td><span className={`badge ${i.ativo ? 'badge-green' : 'badge-red'}`}>{i.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td>
                          <div className="row-actions">
                            <button className="btn-ghost" onClick={() => abrirEditarItem(i)}><Edit2 size={14} /></button>
                            <button className="btn-ghost" onClick={() => setConfirmExcluirItem(i)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ABA CONTAGENS ── */}
      {aba === 'contagens' && (
        contagens.length === 0 ? (
          <div className="card"><div className="empty"><ClipboardList size={32} /><p>Nenhuma contagem registrada ainda.</p></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contagens.map(c => (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmtDataHora(c.dataContagem)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {c.responsavel ? `Responsável: ${c.responsavel} · ` : ''}{c.qtdItens} item(ns) contado(s)
                      {c.qtdDivergentes > 0 && <span style={{ color: 'var(--red)' }}> · {c.qtdDivergentes} divergência(s)</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => abrirDetalheContagem(c)}>Ver detalhes</button>
                    <button className="btn-ghost" title="Baixar PDF" onClick={() => baixarContagemPdf(c)}><FileDown size={14} /></button>
                    <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setConfirmExcluirContagem(c)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── MODAL NOVO/EDITAR ITEM ── */}
      {modalItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalItem(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modalItem === 'novo' ? 'Novo item' : 'Editar item'}</h2>
              <button className="btn-ghost" onClick={() => setModalItem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={formItem.nome} autoFocus
                    onChange={e => setFormItem(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Chave de fenda" />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <input value={formItem.categoria} list="cat-patrimonio"
                    onChange={e => setFormItem(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ex: Ferramentas manuais" />
                  <datalist id="cat-patrimonio">
                    {categorias.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Quantidade esperada</label>
                    <input type="number" min={0} value={formItem.quantidadeEsperada}
                      onChange={e => setFormItem(f => ({ ...f, quantidadeEsperada: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Valor unitário (R$)</label>
                    <input type="number" min={0} step={0.01} value={formItem.valorUnitario}
                      onChange={e => setFormItem(f => ({ ...f, valorUnitario: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input value={formItem.observacao} onChange={e => setFormItem(f => ({ ...f, observacao: e.target.value }))} />
                </div>
                {modalItem === 'editar' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formItem.ativo} style={{ width: 16, height: 16, margin: 0 }}
                      onChange={e => setFormItem(f => ({ ...f, ativo: e.target.checked }))} />
                    <span>Item ativo</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalItem(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarItem} disabled={salvandoItem}>
                {salvandoItem ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOVA CONTAGEM ── */}
      {modalNovaContagem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovaContagem(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Nova contagem</h2>
              <button className="btn-ghost" onClick={() => setModalNovaContagem(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Responsável</label>
                  <input value={responsavelContagem} onChange={e => setResponsavelContagem(e.target.value)} placeholder="Quem está contando" />
                </div>
                <div className="form-group">
                  <label className="form-label">Observação geral</label>
                  <input value={observacaoContagem} onChange={e => setObservacaoContagem(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itens.filter(i => i.ativo).map(i => {
                  const v = contagemForm[i.id] ?? { quantidadeContada: String(i.quantidadeEsperada), observacao: '' };
                  const diferenca = (parseInt(v.quantidadeContada) || 0) - i.quantidadeEsperada;
                  return (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{i.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Esperado: {i.quantidadeEsperada}</div>
                      </div>
                      <input type="number" min={0} value={v.quantidadeContada}
                        onChange={e => atualizarContagemItem(i.id, { quantidadeContada: e.target.value })}
                        style={{ width: 70 }} />
                      {diferenca !== 0 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', whiteSpace: 'nowrap' }}>
                          {diferenca > 0 ? `+${diferenca}` : diferenca}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNovaContagem(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarContagem} disabled={salvandoContagem}>
                {salvandoContagem ? 'Salvando...' : 'Registrar contagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALHE CONTAGEM ── */}
      {detalheContagem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalheContagem(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Contagem — {fmtDataHora(detalheContagem.dataContagem)}</h2>
              <button className="btn-ghost" onClick={() => setDetalheContagem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {detalheContagem.responsavel && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>Responsável: {detalheContagem.responsavel}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detalheContagem.itens.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6, fontSize: 13 }}>
                    <span>{i.nomeItem}</span>
                    <span style={{ color: 'var(--text-3)' }}>
                      {i.quantidadeEsperadaNoMomento} → {i.quantidadeContada}
                      {i.diferenca !== 0 && (
                        <strong style={{ color: 'var(--red)', marginLeft: 6 }}>
                          ({i.diferenca > 0 ? `+${i.diferenca}` : i.diferenca})
                        </strong>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetalheContagem(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão item ── */}
      {confirmExcluirItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirItem(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir item</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirItem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>Excluir <strong>{confirmExcluirItem.nome}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirItem(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirItem}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão contagem ── */}
      {confirmExcluirContagem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluirContagem(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir contagem</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluirContagem(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir a contagem de <strong>{fmtDataHora(confirmExcluirContagem.dataContagem)}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluirContagem(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirContagem}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}