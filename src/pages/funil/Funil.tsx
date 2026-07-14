import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Building2 } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Funil.css';

interface Oportunidade {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  seguradoraNome: string | null;
  planoDesejado: string | null;
  valorEstimado: number | null;
  observacao: string;
  quantidadeVidas: number;
  etapa: string;
  ordem: number;
  criadoEm: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Seguradora {
  id: string;
  nome: string;
}

const ETAPAS = [
  { chave: 'lead', label: 'Lead', cor: 'var(--text-3)' },
  { chave: 'contato', label: 'Contato', cor: '#3b82f6' },
  { chave: 'proposta', label: 'Proposta Enviada', cor: '#a855f7' },
  { chave: 'negociacao', label: 'Negociação', cor: '#d97706' },
  { chave: 'ganho', label: 'Ganho', cor: 'var(--green)' },
];

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Funil() {
  const { sucesso, erro } = useToast();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);

  const [modalNova, setModalNova] = useState(false);
  const [editandoOp, setEditandoOp] = useState<Oportunidade | null>(null);
  const [modalSeguradora, setModalSeguradora] = useState(false);
  const [novaSeguradora, setNovaSeguradora] = useState('');
  const [modalGerenciarSeguradoras, setModalGerenciarSeguradoras] = useState(false);
  const [seguradorasTodas, setSeguradorasTodas] = useState<{ id: string; nome: string; ativa: boolean }[]>([]);
  const [editandoSeguradoraId, setEditandoSeguradoraId] = useState<string | null>(null);
  const [nomeEditSeguradora, setNomeEditSeguradora] = useState('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [showBuscaCliente, setShowBuscaCliente] = useState(false);
  const [formOp, setFormOp] = useState({ clienteId: '', clienteNome: '', seguradoraId: '', planoDesejado: '', valorEstimado: '', observacao: '', quantidadeVidas: '' });
  const [salvando, setSalvando] = useState(false);

  const [modalPerda, setModalPerda] = useState<Oportunidade | null>(null);
  const [motivoPerda, setMotivoPerda] = useState('');
  const [modalGanho, setModalGanho] = useState<Oportunidade | null>(null);
  const [valorGanho, setValorGanho] = useState('');
  const [contaGanho, setContaGanho] = useState('');
  const [contas, setContas] = useState<{ id: string; nome: string; ativa: boolean }[]>([]);

  const [confirmExcluir, setConfirmExcluir] = useState<Oportunidade | null>(null);
  const [avisoClienteDuplicado, setAvisoClienteDuplicado] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [etapaMobile, setEtapaMobile] = useState('lead');
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);

  function carregar() {
    api.get<Oportunidade[]>('/api/corretora/oportunidades').then(setOportunidades).catch(() => {});
  }

  useEffect(() => {
    carregar();
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    api.get<Seguradora[]>('/api/corretora/seguradoras').then(setSeguradoras).catch(() => {});
    api.get<{ id: string; nome: string; ativa: boolean }[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, []);

  function abrirNova() {
    setEditandoOp(null);
    setFormOp({ clienteId: '', clienteNome: '', seguradoraId: '', planoDesejado: '', valorEstimado: '', observacao: '', quantidadeVidas: '' });
    setBuscaCliente('');
    setAvisoClienteDuplicado(null);
    setModalNova(true);
  }

  function abrirEditar(op: Oportunidade) {
    setEditandoOp(op);
    setFormOp({
      clienteId: op.clienteId,
      clienteNome: op.clienteNome,
      seguradoraId: seguradoras.find(s => s.nome === op.seguradoraNome)?.id ?? '',
      planoDesejado: op.planoDesejado ?? '',
      valorEstimado: op.valorEstimado ? String(op.valorEstimado) : '',
      observacao: op.observacao ?? '',
      quantidadeVidas: op.quantidadeVidas ? String(op.quantidadeVidas) : '',
    });
    setBuscaCliente('');
    setModalNova(true);
  }

  async function selecionarClienteNoForm(c: Cliente) {
    setFormOp(f => ({ ...f, clienteId: c.id, clienteNome: c.nome }));
    setBuscaCliente('');
    setAvisoClienteDuplicado(null);

    if (editandoOp) return; // não checa duplicado se está editando a própria

    try {
      const res = await api.get<any>(`/api/corretora/oportunidades/verificar-cliente/${c.id}`);
      if (res.existe) {
        const nomesEtapas: Record<string, string> = { lead: 'Lead', contato: 'Contato', proposta: 'Proposta Enviada', negociacao: 'Negociação' };
        const lista = res.oportunidades.map((o: any) => `${o.planoDesejado || 'oportunidade'} (${nomesEtapas[o.etapa] || o.etapa})`).join(', ');
        setAvisoClienteDuplicado(`${c.nome} já tem ${res.quantidade} oportunidade(s) em aberto: ${lista}`);
      }
    } catch {}
  }

  async function salvarNova() {
    if (!formOp.clienteId) { erro('Selecione um cliente.'); return; }
    setSalvando(true);
    try {
      const payload = {
        clienteId: formOp.clienteId,
        seguradoraId: formOp.seguradoraId || null,
        planoDesejado: formOp.planoDesejado || null,
        valorEstimado: formOp.valorEstimado ? parseFloat(formOp.valorEstimado) : null,
        observacao: formOp.observacao || null,
        quantidadeVidas: formOp.quantidadeVidas ? parseInt(formOp.quantidadeVidas) : null,
      };
      if (editandoOp) {
        await api.put(`/api/corretora/oportunidades/${editandoOp.id}`, payload);
        sucesso('Oportunidade atualizada!');
      } else {
        await api.post('/api/corretora/oportunidades', payload);
        sucesso('Oportunidade criada!');
      }
      setModalNova(false);
      setEditandoOp(null);
      carregar();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSeguradora() {
    if (!novaSeguradora.trim()) return;
    try {
      const nova = await api.post<Seguradora>('/api/corretora/seguradoras', { nome: novaSeguradora.trim() });
      setSeguradoras(prev => [...prev, nova]);
      setFormOp(f => ({ ...f, seguradoraId: nova.id }));
      setNovaSeguradora('');
      setModalSeguradora(false);
      sucesso('Seguradora adicionada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function carregarSeguradorasTodas() {
    api.get<{ id: string; nome: string; ativa: boolean }[]>('/api/corretora/seguradoras?todas=true')
      .then(setSeguradorasTodas)
      .catch(() => {});
  }

  function abrirGerenciarSeguradoras() {
    carregarSeguradorasTodas();
    setModalGerenciarSeguradoras(true);
  }

  function iniciarEdicaoSeguradora(s: { id: string; nome: string }) {
    setEditandoSeguradoraId(s.id);
    setNomeEditSeguradora(s.nome);
  }

  async function salvarEdicaoSeguradora() {
    if (!editandoSeguradoraId || !nomeEditSeguradora.trim()) return;
    try {
      await api.put(`/api/corretora/seguradoras/${editandoSeguradoraId}`, { nome: nomeEditSeguradora.trim() });
      setEditandoSeguradoraId(null);
      carregarSeguradorasTodas();
      api.get<Seguradora[]>('/api/corretora/seguradoras').then(setSeguradoras).catch(() => {});
      sucesso('Seguradora atualizada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function alternarSeguradora(id: string) {
    try {
      await api.patch(`/api/corretora/seguradoras/${id}/ativo`, {});
      carregarSeguradorasTodas();
      api.get<Seguradora[]>('/api/corretora/seguradoras').then(setSeguradoras).catch(() => {});
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function moverEtapa(op: Oportunidade, novaEtapa: string, motivo?: string, valor?: number, contaBancariaId?: string) {
    const novaOrdem = oportunidades.filter(o => o.etapa === novaEtapa).length;
    try {
      await api.patch(`/api/corretora/oportunidades/${op.id}/etapa`, {
        etapa: novaEtapa,
        ordem: novaOrdem,
        motivoPerda: motivo || null,
        valor: valor ?? null,
        contaBancariaId: contaBancariaId || null,
      });
      carregar();
      if (novaEtapa === 'perdido') sucesso('Marcado como perdido.');
      if (novaEtapa === 'ganho') sucesso('Fechado! Comissão lançada no Financeiro.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluirOportunidade() {
    if (!confirmExcluir) return;
    try {
      await api.delete(`/api/corretora/oportunidades/${confirmExcluir.id}`);
      setConfirmExcluir(null);
      carregar();
      sucesso('Removido.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function handleDragStart(id: string) {
    setDragId(id);
  }
  function handleDrop(etapaDestino: string) {
    setDragOverEtapa(null);
    if (!dragId) return;
    const op = oportunidades.find(o => o.id === dragId);
    if (!op || op.etapa === etapaDestino) { setDragId(null); return; }

    if (etapaDestino === 'perdido') {
      setModalPerda(op);
      setDragId(null);
      return;
    }
    if (etapaDestino === 'ganho') {
      abrirModalGanho(op);
      setDragId(null);
      return;
    }
    moverEtapa(op, etapaDestino);
    setDragId(null);
  }

  function abrirModalGanho(op: Oportunidade) {
    setModalGanho(op);
    setValorGanho(op.valorEstimado ? String(op.valorEstimado) : '');
    setContaGanho(contas.find(c => c.ativa)?.id ?? '');
  }

  function confirmarGanho() {
    if (!modalGanho) return;
    moverEtapa(modalGanho, 'ganho', undefined, parseFloat(valorGanho) || 0, contaGanho || undefined);
    setModalGanho(null);
  }

  const clientesFiltrados = clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funil de Vendas</h1>
          <p className="page-subtitle">Acompanhe suas oportunidades do lead ao fechamento</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={abrirGerenciarSeguradoras}><Building2 size={14} /> Seguradoras</button>
          <button className="btn-primary" onClick={abrirNova}><Plus size={15} /> Nova oportunidade</button>
        </div>
      </div>

      <div className="funil-board funil-board-desktop">
        {ETAPAS.map(etapa => {
          const cardsDaEtapa = oportunidades.filter(o => o.etapa === etapa.chave).sort((a, b) => a.ordem - b.ordem);
          const totalEtapa = cardsDaEtapa.reduce((s, o) => s + (o.valorEstimado ?? 0), 0);
          return (
            <div key={etapa.chave}
              className={`funil-coluna${dragOverEtapa === etapa.chave ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverEtapa(etapa.chave); }}
              onDragLeave={() => setDragOverEtapa(null)}
              onDrop={() => handleDrop(etapa.chave)}
            >
              <div className="funil-coluna-header" style={{ borderTopColor: etapa.cor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{etapa.label}</span>
                  <span className="badge badge-accent" style={{ fontSize: 10 }}>{cardsDaEtapa.length}</span>
                </div>
                {totalEtapa > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{fmt(totalEtapa)}</div>}
              </div>

              <div className="funil-cards">
                {cardsDaEtapa.map(op => (
                  <div key={op.id} className="funil-card" draggable onDragStart={() => handleDragStart(op.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => abrirEditar(op)}>{op.clienteNome}</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn-ghost" style={{ padding: 2 }} onClick={() => abrirEditar(op)}>✎</button>
                        <button className="btn-ghost" style={{ padding: 2, color: 'var(--red)' }} onClick={() => setConfirmExcluir(op)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    {op.seguradoraNome && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Building2 size={11} /> {op.seguradoraNome}
                      </div>
                    )}
                    {op.planoDesejado && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{op.planoDesejado}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {op.valorEstimado && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmt(op.valorEstimado)}</span>}
                      {op.quantidadeVidas && <span className="badge badge-accent" style={{ fontSize: 10 }}>👤 {op.quantidadeVidas} vida{op.quantidadeVidas > 1 ? 's' : ''}</span>}
                    </div>
                    {op.observacao && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6 }}>💬 {op.observacao}</div>}
                  </div>
                ))}
                {cardsDaEtapa.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Arraste um card aqui</div>
                )}
              </div>
            </div>
          );
        })}

        {/* Coluna Perdido — fixa no final, colapsada */}
        <div
          className={`funil-coluna funil-coluna-perdido${dragOverEtapa === 'perdido' ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOverEtapa('perdido'); }}
          onDragLeave={() => setDragOverEtapa(null)}
          onDrop={() => handleDrop('perdido')}
        >
          <div className="funil-coluna-header" style={{ borderTopColor: 'var(--red)' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>Perdido</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '20px 8px' }}>
            Arraste aqui para marcar como perdido
          </div>
        </div>
      </div>

      {/* Versão mobile: abas por etapa, sem scroll lateral */}
      <div className="funil-mobile">
        <div className="funil-abas-mobile">
          {[...ETAPAS, { chave: 'perdido', label: 'Perdido', cor: 'var(--red)' }].map(etapa => {
            const qtd = oportunidades.filter(o => o.etapa === etapa.chave).length;
            return (
              <button key={etapa.chave}
                className={`funil-aba-mobile${etapaMobile === etapa.chave ? ' ativa' : ''}`}
                style={etapaMobile === etapa.chave ? { borderColor: etapa.cor, color: etapa.cor } : {}}
                onClick={() => setEtapaMobile(etapa.chave)}>
                {etapa.label} {qtd > 0 && `(${qtd})`}
              </button>
            );
          })}
        </div>

        <div className="funil-cards-mobile-lista">
          {oportunidades.filter(o => o.etapa === etapaMobile).sort((a, b) => a.ordem - b.ordem).map(op => (
            <div key={op.id} className="funil-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{op.clienteNome}</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn-ghost" style={{ padding: 2 }} onClick={() => abrirEditar(op)}>✎</button>
                  <button className="btn-ghost" style={{ padding: 2, color: 'var(--red)' }} onClick={() => setConfirmExcluir(op)}><Trash2 size={12} /></button>
                </div>
              </div>
              {op.seguradoraNome && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Building2 size={11} /> {op.seguradoraNome}
                </div>
              )}
              {op.planoDesejado && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{op.planoDesejado}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                {op.valorEstimado && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmt(op.valorEstimado)}</span>}
                {op.quantidadeVidas && <span className="badge badge-accent" style={{ fontSize: 10 }}>👤 {op.quantidadeVidas} vida{op.quantidadeVidas > 1 ? 's' : ''}</span>}
              </div>
              {op.observacao && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6 }}>💬 {op.observacao}</div>}

              {etapaMobile !== 'perdido' && etapaMobile !== 'ganho' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {(() => {
                    const idx = ETAPAS.findIndex(e => e.chave === etapaMobile);
                    const proxima = ETAPAS[idx + 1];
                    return proxima ? (
                      <button className="btn-primary" style={{ fontSize: 12, flex: 1 }}
                        onClick={() => proxima.chave === 'ganho' ? abrirModalGanho(op) : moverEtapa(op, proxima.chave)}>
                        Avançar → {proxima.label}
                      </button>
                    ) : null;
                  })()}
                  <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setModalPerda(op)}>Perdido</button>
                </div>
              )}
            </div>
          ))}
          {oportunidades.filter(o => o.etapa === etapaMobile).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>Nenhuma oportunidade nesta etapa.</div>
          )}
        </div>
      </div>

      {/* Modal nova oportunidade */}
      {modalNova && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNova(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editandoOp ? 'Editar oportunidade' : 'Nova oportunidade'}</h2>
              <button className="btn-ghost" onClick={() => { setModalNova(false); setEditandoOp(null); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Cliente *</label>
                  {formOp.clienteId ? (
                    <div className="cx-cliente-sel">
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{formOp.clienteNome}</div>
                      <button className="btn-ghost" onClick={() => { setFormOp(f => ({ ...f, clienteId: '', clienteNome: '' })); setAvisoClienteDuplicado(null); }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <input placeholder="Buscar cliente..." value={buscaCliente}
                        onChange={e => { setBuscaCliente(e.target.value); setShowBuscaCliente(true); }}
                        onFocus={() => setShowBuscaCliente(true)}
                        onBlur={() => setTimeout(() => setShowBuscaCliente(false), 150)} />
                      {showBuscaCliente && buscaCliente && (
                        <div className="cx-dropdown">
                          {clientesFiltrados.length === 0 ? (
                            <div className="cx-dropdown-empty">Nenhum cliente encontrado</div>
                          ) : clientesFiltrados.slice(0, 6).map(c => (
                            <button key={c.id} className="cx-dropdown-item" onMouseDown={() => selecionarClienteNoForm(c)}>
                              <div className="cx-drop-nome">{c.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {avisoClienteDuplicado && (
                  <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#d97706' }}>
                    ⚠️ {avisoClienteDuplicado}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Seguradora</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={formOp.seguradoraId} onChange={e => setFormOp(f => ({ ...f, seguradoraId: e.target.value }))} style={{ flex: 1 }}>
                      <option value="">Selecione...</option>
                      {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => setModalSeguradora(true)}>+ Nova</button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Plano desejado</label>
                  <input value={formOp.planoDesejado} onChange={e => setFormOp(f => ({ ...f, planoDesejado: e.target.value }))} placeholder="Ex: Plano Familiar Premium" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Valor estimado (R$)</label>
                    <input type="number" min={0} step={0.01} value={formOp.valorEstimado} onChange={e => setFormOp(f => ({ ...f, valorEstimado: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nº de vidas</label>
                    <input type="number" min={1} value={formOp.quantidadeVidas} onChange={e => setFormOp(f => ({ ...f, quantidadeVidas: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(regras de comissão, nº de vidas, etc.)</span></label>
                  <textarea value={formOp.observacao} onChange={e => setFormOp(f => ({ ...f, observacao: e.target.value }))}
                    rows={3} placeholder="Ex: HapVida Alter, 5 vidas, 2ª parcela dia 20/08" style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setModalNova(false); setEditandoOp(null); }}>Cancelar</button>
              <button className="btn-primary" onClick={salvarNova} disabled={salvando}>
                {salvando ? 'Salvando...' : (editandoOp ? 'Salvar alterações' : 'Criar oportunidade')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal motivo da perda */}
      {modalPerda && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPerda(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Marcar como perdido</h2>
              <button className="btn-ghost" onClick={() => setModalPerda(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{modalPerda.clienteNome}</p>
              <div className="form-group">
                <label className="form-label">Motivo (opcional)</label>
                <input value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)} placeholder="Ex: fechou com outra corretora" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPerda(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { moverEtapa(modalPerda, 'perdido', motivoPerda); setModalPerda(null); setMotivoPerda(''); }}>
                Marcar como perdido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova seguradora */}
      {modalSeguradora && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSeguradora(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Nova seguradora</h2>
              <button className="btn-ghost" onClick={() => setModalSeguradora(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input value={novaSeguradora} onChange={e => setNovaSeguradora(e.target.value)}
                  placeholder="Ex: Bradesco Saúde" onKeyDown={e => e.key === 'Enter' && salvarSeguradora()} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalSeguradora(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarSeguradora}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gerenciar seguradoras */}
      {modalGerenciarSeguradoras && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalGerenciarSeguradoras(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Seguradoras</h2>
              <button className="btn-ghost" onClick={() => setModalGerenciarSeguradoras(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {seguradorasTodas.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma seguradora cadastrada.</p>
                ) : seguradorasTodas.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, opacity: s.ativa ? 1 : 0.5 }}>
                    {editandoSeguradoraId === s.id ? (
                      <input value={nomeEditSeguradora} onChange={e => setNomeEditSeguradora(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && salvarEdicaoSeguradora()}
                        style={{ flex: 1, marginRight: 8 }} autoFocus />
                    ) : (
                      <span style={{ fontSize: 13 }}>{s.nome}{!s.ativa && <span style={{ color: 'var(--text-3)', fontSize: 11 }}> (inativa)</span>}</span>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {editandoSeguradoraId === s.id ? (
                        <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--green)' }} onClick={salvarEdicaoSeguradora}>Salvar</button>
                      ) : (
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => iniciarEdicaoSeguradora(s)}>Editar</button>
                      )}
                      <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => alternarSeguradora(s.id)}>{s.ativa ? 'Desativar' : 'Ativar'}</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Nova seguradora</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={novaSeguradora} onChange={e => setNovaSeguradora(e.target.value)} placeholder="Nome da seguradora" />
                  <button className="btn-primary" onClick={async () => {
                    if (!novaSeguradora.trim()) return;
                    try {
                      const nova = await api.post<Seguradora>('/api/corretora/seguradoras', { nome: novaSeguradora.trim() });
                      setSeguradoras(prev => [...prev, nova]);
                      setNovaSeguradora('');
                      carregarSeguradorasTodas();
                      sucesso('Seguradora adicionada!');
                    } catch (e) {
                      erro((e as Error).message);
                    }
                  }}>Adicionar</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalGerenciarSeguradoras(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fechar venda (mover para Ganho) */}
      {modalGanho && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalGanho(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>🎉 Fechar venda</h2>
              <button className="btn-ghost" onClick={() => setModalGanho(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{modalGanho.clienteNome}</p>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Valor da comissão (R$)</label>
                <input type="number" min={0} step={0.01} value={valorGanho} onChange={e => setValorGanho(e.target.value)} autoFocus />
              </div>
              {contas.length > 0 ? (
                <div className="form-group">
                  <label className="form-label">Conta de recebimento</label>
                  <select value={contaGanho} onChange={e => setContaGanho(e.target.value)}>
                    <option value="">Selecione...</option>
                    {contas.filter(c => c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Nenhuma conta bancária cadastrada — a oportunidade fecha, mas o valor não entra no Financeiro. Cadastre uma conta em Financeiro → Contas.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalGanho(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarGanho}>Fechar venda</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Remover oportunidade</h2>
              <button className="btn-ghost" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Remover <strong style={{ color: 'var(--text-1)' }}>{confirmExcluir.clienteNome}</strong> do funil?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluirOportunidade}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}