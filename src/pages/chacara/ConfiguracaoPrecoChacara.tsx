import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './ChacaraForm.css';

type ConfigGeral = {
  minimoPessoas: number;
  limitePessoasParaTaxaLimpeza: number;
  valorTaxaLimpeza: number;
  valorMultaNaoLimpeza: number;
  percentualEntradaMinimo: number;
};

type Faixa = {
  id: number;
  pessoasAte: number;
  valorDiariaSemana: number;
  valorDiariaFimSemana: number;
  valorPacote2DiasFimSemana: number;
};

const CAMPOS_GERAIS: { chave: keyof ConfigGeral; label: string; tipo: 'moeda' | 'numero'; ajuda: string }[] = [
  { chave: 'minimoPessoas', label: 'Mínimo de pessoas por reserva', tipo: 'numero', ajuda: 'O site público não permite reservar com menos que isso' },
  { chave: 'limitePessoasParaTaxaLimpeza', label: 'Limite para cobrar taxa de limpeza', tipo: 'numero', ajuda: 'Acima desse número de pessoas, cobra a taxa abaixo' },
  { chave: 'valorTaxaLimpeza', label: 'Taxa de limpeza', tipo: 'moeda', ajuda: 'Cobrada junto no pagamento quando ultrapassa o limite acima' },
  { chave: 'valorMultaNaoLimpeza', label: 'Multa por não limpar ao sair', tipo: 'moeda', ajuda: 'Só informativa — avisada ao cliente, cobrança é manual' },
  { chave: 'percentualEntradaMinimo', label: '% mínimo de entrada', tipo: 'numero', ajuda: 'Só uma sugestão exibida na tela de reservas' },
];

const FAIXA_VAZIA = { pessoasAte: 0, valorDiariaSemana: 0, valorDiariaFimSemana: 0, valorPacote2DiasFimSemana: 0 };

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ConfiguracaoPrecoChacara() {
  const [config, setConfig] = useState<ConfigGeral | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const { sucesso, erro: toastErro } = useToast();

  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [modal, setModal] = useState<'nova' | 'editar' | null>(null);
  const [selecionada, setSelecionada] = useState<Faixa | null>(null);
  const [formFaixa, setFormFaixa] = useState(FAIXA_VAZIA);
  const [salvandoFaixa, setSalvandoFaixa] = useState(false);
  const [erroFaixa, setErroFaixa] = useState('');
  const [modalExcluir, setModalExcluir] = useState<Faixa | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    api.get<ConfigGeral>('/api/chacara/configuracao-preco')
      .then(setConfig)
      .catch(() => toastErro('Erro ao carregar configuração de preço.'))
      .finally(() => setCarregando(false));
    carregarFaixas();
  }, []);

  function carregarFaixas() {
    api.get<Faixa[]>('/api/chacara/faixas-preco').then(setFaixas).catch(() => {});
  }

  function atualizarCampo(chave: keyof ConfigGeral, valor: string) {
    if (!config) return;
    const numero = valor === '' ? 0 : Number(valor);
    setConfig({ ...config, [chave]: numero });
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const atualizado = await api.put<ConfigGeral>('/api/chacara/configuracao-preco', config);
      setConfig(atualizado);
      sucesso('Configuração salva.');
    } catch (e: any) {
      toastErro(e?.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirNovaFaixa() {
    setFormFaixa(FAIXA_VAZIA);
    setErroFaixa('');
    setModal('nova');
  }

  function abrirEditarFaixa(f: Faixa) {
    setSelecionada(f);
    setFormFaixa({
      pessoasAte: f.pessoasAte,
      valorDiariaSemana: f.valorDiariaSemana,
      valorDiariaFimSemana: f.valorDiariaFimSemana,
      valorPacote2DiasFimSemana: f.valorPacote2DiasFimSemana,
    });
    setErroFaixa('');
    setModal('editar');
  }

  async function salvarFaixa() {
    if (formFaixa.pessoasAte <= 0) {
      setErroFaixa('Informe um limite de pessoas válido.');
      return;
    }
    setSalvandoFaixa(true);
    setErroFaixa('');
    try {
      if (modal === 'nova') {
        await api.post('/api/chacara/faixas-preco', formFaixa);
        sucesso('Faixa criada.');
      } else if (selecionada) {
        await api.put(`/api/chacara/faixas-preco/${selecionada.id}`, formFaixa);
        sucesso('Faixa atualizada.');
      }
      setModal(null);
      carregarFaixas();
    } catch (e) {
      setErroFaixa((e as Error).message);
    } finally {
      setSalvandoFaixa(false);
    }
  }

  async function confirmarExclusaoFaixa() {
    if (!modalExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/api/chacara/faixas-preco/${modalExcluir.id}`);
      sucesso('Faixa excluída.');
      setModalExcluir(null);
      carregarFaixas();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  }

  const faixasOrdenadas = [...faixas].sort((a, b) => a.pessoasAte - b.pessoasAte);

  if (carregando) {
    return <div className="page"><p>Carregando...</p></div>;
  }

  if (!config) {
    return <div className="page"><p>Não foi possível carregar a configuração.</p></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Preço das reservas</h1>
          <p className="page-subtitle">Configure as regras gerais e os valores por faixa de pessoas</p>
        </div>
      </div>

      {/* Configurações gerais */}
      <div className="card chacara-card-wide">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Configurações gerais</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          Regras que valem para qualquer faixa de pessoas.
        </p>
        <div className="chacara-grid-2">
          {CAMPOS_GERAIS.map(campo => (
            <div key={campo.chave}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                {campo.label}
              </label>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{campo.ajuda}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {campo.tipo === 'moeda' && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>R$</span>}
                <input
                  type="number"
                  min={0}
                  step={campo.tipo === 'moeda' ? '0.01' : '1'}
                  value={config[campo.chave] === 0 ? '' : config[campo.chave]}
                  onChange={e => atualizarCampo(campo.chave, e.target.value)}
                  onFocus={e => e.target.select()}
                  style={{
                    width: 140, padding: '8px 10px', fontSize: 13,
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-3)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>

      {/* Faixas de preço */}
      <div className="card chacara-card-wide" style={{ marginTop: 20 }}>
        <div className="page-header" style={{ marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Faixas de preço por quantidade de pessoas</div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              Cada faixa vale até o limite de pessoas indicado. A reserva usa a menor faixa que cobre a quantidade escolhida pelo cliente.
            </p>
          </div>
          <button className="btn-primary" onClick={abrirNovaFaixa}>
            <Plus size={15} style={{ verticalAlign: -2 }} /> Nova faixa
          </button>
        </div>

        {faixasOrdenadas.length === 0 ? (
          <div className="empty" style={{ padding: '30px 0' }}>
            <p>Nenhuma faixa cadastrada ainda. Sem faixas, o site público não consegue calcular valores.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {faixasOrdenadas.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                padding: '12px 14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, minWidth: 110 }}>Até {f.pessoasAte} pessoas</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Seg a qui</div>
                    <strong>{fmt(f.valorDiariaSemana)}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Sex a dom (1 dia)</div>
                    <strong>{fmt(f.valorDiariaFimSemana)}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Pacote 2 dias fim de semana</div>
                    <strong>{fmt(f.valorPacote2DiasFimSemana)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditarFaixa(f)}><Pencil size={14} /></button>
                  <button className="btn-ghost" title="Excluir" style={{ color: 'var(--red)' }} onClick={() => setModalExcluir(f)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nova/editar faixa */}
      {(modal === 'nova' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'nova' ? 'Nova faixa de preço' : 'Editar faixa de preço'}</h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Até quantas pessoas</label>
                  <input type="number" min={1} value={formFaixa.pessoasAte === 0 ? '' : formFaixa.pessoasAte}
                    onChange={e => setFormFaixa(f => ({ ...f, pessoasAte: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    onFocus={e => e.target.select()} />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Ex: 50, 100, 200, 500, 1000 — a reserva usa a menor faixa que cobre a quantidade de pessoas escolhida.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Diária segunda a quinta (R$)</label>
                  <input type="number" min={0} step={0.01} value={formFaixa.valorDiariaSemana === 0 ? '' : formFaixa.valorDiariaSemana}
                    onChange={e => setFormFaixa(f => ({ ...f, valorDiariaSemana: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    onFocus={e => e.target.select()} />
                </div>
                <div className="form-group">
                  <label className="form-label">Diária sexta a domingo, 1 dia (R$)</label>
                  <input type="number" min={0} step={0.01} value={formFaixa.valorDiariaFimSemana === 0 ? '' : formFaixa.valorDiariaFimSemana}
                    onChange={e => setFormFaixa(f => ({ ...f, valorDiariaFimSemana: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    onFocus={e => e.target.select()} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pacote 2 dias fim de semana — sex+sáb ou sáb+dom (R$)</label>
                  <input type="number" min={0} step={0.01} value={formFaixa.valorPacote2DiasFimSemana === 0 ? '' : formFaixa.valorPacote2DiasFimSemana}
                    onChange={e => setFormFaixa(f => ({ ...f, valorPacote2DiasFimSemana: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    onFocus={e => e.target.select()} />
                </div>
              </div>
              {erroFaixa && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erroFaixa}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarFaixa} disabled={salvandoFaixa}>
                {salvandoFaixa ? 'Salvando...' : 'Salvar faixa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir faixa */}
      {modalExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir faixa</h2>
              <button className="btn-ghost" onClick={() => setModalExcluir(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir a faixa <strong style={{ color: 'var(--text-1)' }}>até {modalExcluir.pessoasAte} pessoas</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarExclusaoFaixa} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}