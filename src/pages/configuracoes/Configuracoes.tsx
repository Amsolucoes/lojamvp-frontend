import { useState, useEffect } from 'react';
import { aplicarTema, carregarTemaSalvo, TEMAS, Tema } from '../../utils/tema';
import { api } from '../../services/api';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';

type ModuloPreco = {
  id: string;
  chave: string;
  nome: string;
  valor: number;
  disponivelParaAtivar: boolean;
};

const MODULOS_DESCRICAO: Record<string, string> = {
  financeiro: 'Controle de contas a pagar e receber, lançamentos, cartão de crédito, transferências e dashboard financeiro.',
  servicos:   'Agenda de atendimentos, catálogo de serviços, controle de planos e mensalidades de clientes.',
  turmas:     'Aulas em grupo com matrícula fixa, chamada, controle de faltas e remarcações.',
  corretora:  'Funil de vendas (kanban), cadastro de seguradoras, apólices e lançamento automático de comissões.',
  nf:         'Importação de notas fiscais em XML com match automático por GTIN e revisão manual.',
  etiquetas:  'Impressão de etiquetas de produtos com código de barras.',
  chacara_reservas: 'Agenda de reservas com pagamento online, contrato automático e aviso de check-out.',
};

type SessaoLoja = {
  modulosAtivos: string;
  tipoPlano: string;
  mensalidadeValor: number;
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getSessao(): SessaoLoja | null {
  try {
    const s = localStorage.getItem('loja:sessao');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function Configuracoes() {
  const [temaAtual, setTemaAtual] = useState<Tema>(carregarTemaSalvo());
  const [modulosPreco, setModulosPreco] = useState<ModuloPreco[]>([]);
  const [modulosAtivos, setModulosAtivos] = useState<string[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const { temCorretora, temProdutos, soFinanceiro } = useApp();
  const [mensalidadeAtual, setMensalidadeAtual] = useState(0);
  const { erro: toastErro } = useToast();

  // modal de confirmação
  const [modalModulo, setModalModulo] = useState<{
    modulo: ModuloPreco;
    ativando: boolean;
    novaMensalidade: number;
    novaLista: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<ModuloPreco[]>('/api/modulos-preco').then(setModulosPreco).catch(() => {});
    api.get<any>('/api/loja/situacao').then(res => {
      if (res?.modulosAtivos && Array.isArray(res.modulosAtivos))
        setModulosAtivos(res.modulosAtivos);
      if (res?.mensalidadeValor)
        setMensalidadeAtual(res.mensalidadeValor);
      if (res?.modulosAlteradoEm) {
        // calcula diasRestantes de cooldown para cada módulo
        const agora = new Date();
        const cd: Record<string, number> = {};
        for (const [chave, dataStr] of Object.entries(res.modulosAlteradoEm as Record<string, string>)) {
          const dias = 30 - Math.floor((agora.getTime() - new Date(dataStr).getTime()) / 86400000);
          if (dias > 0) cd[chave] = dias;
        }
        setCooldowns(cd);
      }
    }).catch(() => {});
  }, []);

  function handleToggle(mod: ModuloPreco, marcado: boolean) {
    const novaLista = marcado
      ? [...modulosAtivos, mod.chave]
      : modulosAtivos.filter(m => m !== mod.chave);

    const novaMensalidade = marcado
      ? Math.round((mensalidadeAtual + mod.valor) * 100) / 100
      : Math.round(Math.max(0, mensalidadeAtual - mod.valor) * 100) / 100;

    setModalModulo({ modulo: mod, ativando: marcado, novaMensalidade, novaLista });
  }

  async function confirmarModulo() {
    if (!modalModulo) return;
    setSaving(true);
    try {
      const res = await api.patch<{ modulosAtivos: string; mensalidadeValor: number }>(
        '/api/loja/modulos',
        { chave: modalModulo.modulo.chave, ativar: modalModulo.ativando }
      );
      // atualiza estado local
      const ativos = res.modulosAtivos.split(',').map(m => m.trim()).filter(Boolean);
      setModulosAtivos(ativos);
      setMensalidadeAtual(res.mensalidadeValor);
      const sessao = getSessao();
      if (sessao) {
        localStorage.setItem('loja:sessao', JSON.stringify({
          ...sessao,
          modulosAtivos: res.modulosAtivos,
          mensalidadeValor: res.mensalidadeValor,
        }));
      }
      window.dispatchEvent(new Event('modulosAlterados'));
      setModalModulo(null);
    } catch (e: any) {
      toastErro(e?.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Preferências pessoais de uso do sistema</p>
        </div>
      </div>

      {/* Aparência */}
      <div className="card" style={{ maxWidth: 520, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Aparência</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          Essa escolha é só sua — fica salva neste navegador, não muda pra outras pessoas que usam o sistema.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {TEMAS.map(t => (
            <button key={t.chave} type="button"
              className={temaAtual === t.chave ? 'btn-primary' : 'btn-secondary'}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              onClick={() => { aplicarTema(t.chave); setTemaAtual(t.chave); }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.corPreview, display: 'inline-block', border: '1px solid rgba(0,0,0,0.15)' }} />
              {t.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Módulos ativos</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
          Ative ou desative módulos do sistema. Cada módulo altera o valor da sua mensalidade.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
          Mensalidade atual: <strong>{fmt(mensalidadeAtual)}/mês</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modulosPreco
            .filter(mod => {
              // NF só faz sentido pra loja com produtos físicos
              if (mod.chave === 'nf' && !temProdutos) return false;
              // Módulos ainda não disponíveis (em breve) ficam escondidos por completo
              if (!mod.disponivelParaAtivar) return false;
              // Corretora e Turmas não fazem sentido pra loja com produtos (retail) —
              // só aparecem se por algum motivo já estiverem ativos nela
              if ((mod.chave === 'corretora' || mod.chave === 'turmas') && temProdutos && !modulosAtivos.includes(mod.chave)) {
                return false;
              }
              // Corretora, Serviços e Turmas são um grupo mutuamente exclusivo:
              // mostra os disponíveis até um ser ativado, depois esconde os outros
              const grupoExclusivo = ['corretora', 'servicos', 'turmas'];
              if (grupoExclusivo.includes(mod.chave)) {
                const algumAtivo = grupoExclusivo.find(chave => modulosAtivos.includes(chave));
                if (algumAtivo && algumAtivo !== mod.chave) return false;
              }
              return true;
            })
            .map(mod => {
            const ativo = modulosAtivos.includes(mod.chave);
            const emCooldown = !!cooldowns[mod.chave];
            const travadoPeloPlano = mod.chave === 'financeiro' && soFinanceiro;
            return (
            <label key={mod.chave} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: (mod.disponivelParaAtivar && !emCooldown && !travadoPeloPlano) ? 'pointer' : 'not-allowed',
                opacity: (mod.disponivelParaAtivar && !emCooldown) ? 1 : 0.55,
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
              }}>
                <input
                  type="checkbox"
                  checked={ativo || travadoPeloPlano}
                  disabled={!mod.disponivelParaAtivar || emCooldown || travadoPeloPlano}
                  style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                  onChange={e => handleToggle(mod, e.target.checked)}
                />
                <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{mod.nome}</span>
                  {MODULOS_DESCRICAO[mod.chave] && (
                    <span
                      title={MODULOS_DESCRICAO[mod.chave]}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 15, height: 15, borderRadius: '50%',
                        border: '1px solid var(--text-3)', color: 'var(--text-3)',
                        fontSize: 10, fontWeight: 600, cursor: 'default', flexShrink: 0,
                        lineHeight: 1, userSelect: 'none',
                      }}>
                      ?
                    </span>
                  )}
                </div>
                {!mod.disponivelParaAtivar && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Em breve</div>
                )}
                {mod.disponivelParaAtivar && emCooldown && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Disponível para alterar em {cooldowns[mod.chave]}d
                  </div>
                )}
                {travadoPeloPlano && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Incluído no seu plano Financeiro Puro
                  </div>
                )}
              </div>
                {mod.valor > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: ativo ? 'var(--green)' : 'var(--text-3)',
                  }}>
                    {ativo ? '' : '+'}{fmt(mod.valor)}/mês
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Modal confirmação de módulo */}
      {modalModulo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalModulo(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modalModulo.ativando ? 'Ativar módulo' : 'Desativar módulo'}
              </h2>
              <button className="btn-ghost" onClick={() => setModalModulo(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>
                {modalModulo.ativando
                  ? <>Você está ativando o módulo <strong>{modalModulo.modulo.nome}</strong>.</>
                  : <>Você está desativando o módulo <strong>{modalModulo.modulo.nome}</strong>.</>
                }
              </p>
              <div style={{
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-3)' }}>Mensalidade atual</span>
                  <span>{fmt(mensalidadeAtual)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: 'var(--text-3)' }}>
                    {modalModulo.ativando ? 'Acréscimo' : 'Desconto'}
                  </span>
                  <span style={{ color: modalModulo.ativando ? 'var(--red)' : 'var(--green)' }}>
                    {modalModulo.ativando ? '+' : '-'}{fmt(modalModulo.modulo.valor)}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                  <span>Nova mensalidade</span>
                  <span>{fmt(modalModulo.novaMensalidade)}/mês</span>
                </div>
              </div>
              {!modalModulo.ativando && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
                  Ao desativar, você perde acesso a esse módulo imediatamente. Os dados ficam salvos e voltam se reativar.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalModulo(null)}>Cancelar</button>
              <button
                className={modalModulo.ativando ? 'btn-primary' : 'btn-danger'}
                onClick={confirmarModulo}
                disabled={saving}
              >
                {saving ? 'Salvando...' : modalModulo.ativando ? 'Ativar módulo' : 'Desativar módulo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}