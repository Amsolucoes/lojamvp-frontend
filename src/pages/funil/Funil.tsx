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
  const [buscaCliente, setBuscaCliente] = useState('');
  const [showBuscaCliente, setShowBuscaCliente] = useState(false);
  const [formOp, setFormOp] = useState({ clienteId: '', clienteNome: '', seguradoraId: '', planoDesejado: '', valorEstimado: '' });
  const [salvando, setSalvando] = useState(false);

  const [modalPerda, setModalPerda] = useState<Oportunidade | null>(null);
  const [motivoPerda, setMotivoPerda] = useState('');

  const [confirmExcluir, setConfirmExcluir] = useState<Oportunidade | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);

  function carregar() {
    api.get<Oportunidade[]>('/api/corretora/oportunidades').then(setOportunidades).catch(() => {});
  }

  useEffect(() => {
    carregar();
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    api.get<Seguradora[]>('/api/corretora/seguradoras').then(setSeguradoras).catch(() => {});
  }, []);

  function abrirNova() {
    setFormOp({ clienteId: '', clienteNome: '', seguradoraId: '', planoDesejado: '', valorEstimado: '' });
    setBuscaCliente('');
    setModalNova(true);
  }

  async function salvarNova() {
    if (!formOp.clienteId) { erro('Selecione um cliente.'); return; }
    setSalvando(true);
    try {
      await api.post('/api/corretora/oportunidades', {
        clienteId: formOp.clienteId,
        seguradoraId: formOp.seguradoraId || null,
        planoDesejado: formOp.planoDesejado || null,
        valorEstimado: formOp.valorEstimado ? parseFloat(formOp.valorEstimado) : null,
      });
      setModalNova(false);
      carregar();
      sucesso('Oportunidade criada!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function moverEtapa(op: Oportunidade, novaEtapa: string, motivo?: string) {
    const novaOrdem = oportunidades.filter(o => o.etapa === novaEtapa).length;
    try {
      await api.patch(`/api/corretora/oportunidades/${op.id}/etapa`, {
        etapa: novaEtapa,
        ordem: novaOrdem,
        motivoPerda: motivo || null,
      });
      carregar();
      if (novaEtapa === 'perdido') sucesso('Marcado como perdido.');
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
    moverEtapa(op, etapaDestino);
    setDragId(null);
  }

  const clientesFiltrados = clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funil de Vendas</h1>
          <p className="page-subtitle">Acompanhe suas oportunidades do lead ao fechamento</p>
        </div>
        <button className="btn-primary" onClick={abrirNova}><Plus size={15} /> Nova oportunidade</button>
      </div>

      <div className="funil-board">
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
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{op.clienteNome}</div>
                      <button className="btn-ghost" style={{ padding: 2, color: 'var(--red)' }} onClick={() => setConfirmExcluir(op)}><Trash2 size={12} /></button>
                    </div>
                    {op.seguradoraNome && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Building2 size={11} /> {op.seguradoraNome}
                      </div>
                    )}
                    {op.planoDesejado && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{op.planoDesejado}</div>}
                    {op.valorEstimado && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginTop: 6 }}>{fmt(op.valorEstimado)}</div>}
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

      {/* Modal nova oportunidade */}
      {modalNova && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNova(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Nova oportunidade</h2>
              <button className="btn-ghost" onClick={() => setModalNova(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Cliente *</label>
                  {formOp.clienteId ? (
                    <div className="cx-cliente-sel">
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{formOp.clienteNome}</div>
                      <button className="btn-ghost" onClick={() => setFormOp(f => ({ ...f, clienteId: '', clienteNome: '' }))}><X size={13} /></button>
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
                            <button key={c.id} className="cx-dropdown-item" onMouseDown={() => { setFormOp(f => ({ ...f, clienteId: c.id, clienteNome: c.nome })); setBuscaCliente(''); }}>
                              <div className="cx-drop-nome">{c.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Seguradora</label>
                  <select value={formOp.seguradoraId} onChange={e => setFormOp(f => ({ ...f, seguradoraId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Plano desejado</label>
                  <input value={formOp.planoDesejado} onChange={e => setFormOp(f => ({ ...f, planoDesejado: e.target.value }))} placeholder="Ex: Plano Familiar Premium" />
                </div>

                <div className="form-group">
                  <label className="form-label">Valor estimado (R$)</label>
                  <input type="number" min={0} step={0.01} value={formOp.valorEstimado} onChange={e => setFormOp(f => ({ ...f, valorEstimado: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalNova(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarNova} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Criar oportunidade'}
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