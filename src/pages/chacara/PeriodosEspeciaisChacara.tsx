import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, CalendarHeart } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type Periodo = {
  id: number;
  nome: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const VAZIO = { nome: '', dataInicio: '', dataFim: '', valorTotal: 0 };

export function PeriodosEspeciaisChacara() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [selecionado, setSelecionado] = useState<Periodo | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalExcluir, setModalExcluir] = useState<Periodo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => { carregar(); }, []);

  function carregar() {
    setCarregando(true);
    api.get<Periodo[]>('/api/chacara/periodos-especiais')
      .then(setPeriodos)
      .catch(() => toastErro('Erro ao carregar períodos especiais.'))
      .finally(() => setCarregando(false));
  }

  function abrirNovo() {
    setForm(VAZIO);
    setErro('');
    setModal('novo');
  }

  function abrirEditar(p: Periodo) {
    setSelecionado(p);
    setForm({ nome: p.nome, dataInicio: p.dataInicio.slice(0, 10), dataFim: p.dataFim.slice(0, 10), valorTotal: p.valorTotal });
    setErro('');
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim() || !form.dataInicio || !form.dataFim) {
      setErro('Preencha nome, data início e data fim.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (modal === 'novo') {
        await api.post('/api/chacara/periodos-especiais', form);
        sucesso('Período especial criado.');
      } else if (selecionado) {
        await api.put(`/api/chacara/periodos-especiais/${selecionado.id}`, form);
        sucesso('Período especial atualizado.');
      }
      setModal(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!modalExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/api/chacara/periodos-especiais/${modalExcluir.id}`);
      sucesso('Período excluído.');
      setModalExcluir(null);
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  }

  function diasDoPeriodo(p: Periodo) {
    const ini = new Date(p.dataInicio);
    const fim = new Date(p.dataFim);
    return Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
  }

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Datas Especiais</h1>
          <p className="page-subtitle">Preços fixos para Natal, Ano Novo e outros períodos específicos</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo período
        </button>
      </div>

      {periodos.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '30px 0' }}><p>Nenhum período especial cadastrado.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {periodos.map(p => {
            const dias = diasDoPeriodo(p);
            return (
              <div key={p.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                    <CalendarHeart size={15} /> {p.nome}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {fmtData(p.dataInicio)} — {fmtData(p.dataFim)} · {dias} dia(s)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(p.valorTotal)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmt(p.valorTotal / dias)}/dia</div>
                  </div>
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(p)}><Pencil size={14} /></button>
                  <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setModalExcluir(p)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'novo' ? 'Novo período especial' : 'Editar período especial'}</h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Natal, Ano Novo" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data início</label>
                    <input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Data fim</label>
                    <input type="date" value={form.dataFim} min={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor total do período (R$)</label>
                  <input type="number" min={0} step={0.01} value={form.valorTotal}
                    onChange={e => setForm(f => ({ ...f, valorTotal: Number(e.target.value) }))} />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Se o cliente reservar só parte do período, o valor é dividido proporcionalmente pelos dias.
                  </p>
                </div>
              </div>
              {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erro}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir */}
      {modalExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir período</h2>
              <button className="btn-ghost" onClick={() => setModalExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir o período <strong style={{ color: 'var(--text-1)' }}>{modalExcluir.nome}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}