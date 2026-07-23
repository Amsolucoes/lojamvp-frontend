import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type ConfigPreco = {
  valorDiariaSemana: number;
  valorDiariaFimSemana: number;
  valorDiariaFimSemanaGrande: number;
  valorPacote2DiasFimSemana: number;
  valorPacote2DiasFimSemanaGrande: number;
  limitePessoasPacotePequeno: number;
  minimoPessoas: number;
  valorTaxaLimpeza: number;
  valorMultaNaoLimpeza: number;
};

const CAMPOS: { chave: keyof ConfigPreco; label: string; tipo: 'moeda' | 'numero'; ajuda: string }[] = [
  { chave: 'valorDiariaSemana', label: 'Diária (segunda a quinta)', tipo: 'moeda', ajuda: '1 dia, qualquer quantidade de pessoas' },
  { chave: 'valorDiariaFimSemana', label: 'Diária fim de semana (sexta a domingo)', tipo: 'moeda', ajuda: 'Até o limite de pessoas abaixo' },
  { chave: 'valorDiariaFimSemanaGrande', label: 'Diária fim de semana — grupo grande', tipo: 'moeda', ajuda: 'Acima do limite de pessoas abaixo' },
  { chave: 'valorPacote2DiasFimSemana', label: 'Pacote 2 dias (sex+sáb ou sáb+dom)', tipo: 'moeda', ajuda: 'Até o limite de pessoas abaixo' },
  { chave: 'valorPacote2DiasFimSemanaGrande', label: 'Pacote 2 dias — grupo grande', tipo: 'moeda', ajuda: 'Acima do limite de pessoas abaixo' },
  { chave: 'limitePessoasPacotePequeno', label: 'Limite de pessoas (grupo pequeno)', tipo: 'numero', ajuda: 'Acima disso, usa os valores de "grupo grande"' },
  { chave: 'minimoPessoas', label: 'Mínimo de pessoas por reserva', tipo: 'numero', ajuda: 'O site público não permite reservar com menos que isso' },
  { chave: 'valorTaxaLimpeza', label: 'Taxa de limpeza', tipo: 'moeda', ajuda: 'Cobrada junto no pagamento quando ultrapassa o limite de pessoas' },
  { chave: 'valorMultaNaoLimpeza', label: 'Multa por não limpar ao sair', tipo: 'moeda', ajuda: 'Só informativa — avisada ao cliente, cobrança é manual' },
];

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ConfiguracaoPrecoChacara() {
  const [config, setConfig] = useState<ConfigPreco | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => {
    api.get<ConfigPreco>('/api/chacara/configuracao-preco')
      .then(setConfig)
      .catch(() => toastErro('Erro ao carregar configuração de preço.'))
      .finally(() => setCarregando(false));
  }, []);

  function atualizarCampo(chave: keyof ConfigPreco, valor: string) {
    if (!config) return;
    const numero = valor === '' ? 0 : Number(valor);
    setConfig({ ...config, [chave]: numero });
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const atualizado = await api.put<ConfigPreco>('/api/chacara/configuracao-preco', config);
      setConfig(atualizado);
      sucesso('Configuração de preço salva.');
    } catch (e: any) {
      toastErro(e?.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

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
          <p className="page-subtitle">Configure os valores de diária, pacotes e taxas da chácara</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CAMPOS.map(campo => (
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
                  value={config[campo.chave]}
                  onChange={e => atualizarCampo(campo.chave, e.target.value)}
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

        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Prévia dos valores atuais</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
          <div>Seg a qui (1 dia): <strong>{fmt(config.valorDiariaSemana)}</strong></div>
          <div>Sex a dom (1 dia, até {config.limitePessoasPacotePequeno} pessoas): <strong>{fmt(config.valorDiariaFimSemana)}</strong></div>
          <div>Sex a dom (1 dia, acima de {config.limitePessoasPacotePequeno} pessoas): <strong>{fmt(config.valorDiariaFimSemanaGrande)}</strong></div>
          <div>Sex+sáb ou sáb+dom (até {config.limitePessoasPacotePequeno} pessoas): <strong>{fmt(config.valorPacote2DiasFimSemana)}</strong></div>
          <div>Sex+sáb ou sáb+dom (acima de {config.limitePessoasPacotePequeno} pessoas): <strong>{fmt(config.valorPacote2DiasFimSemanaGrande)}</strong></div>
          <div>Taxa de limpeza (acima de {config.limitePessoasPacotePequeno} pessoas): <strong>{fmt(config.valorTaxaLimpeza)}</strong></div>
          <div>Multa por não limpar (informativa): <strong>{fmt(config.valorMultaNaoLimpeza)}</strong></div>
        </div>
      </div>
    </div>
  );
}