import { useState, useEffect } from 'react';
import { aplicarTema, carregarTemaSalvo, TEMAS, Tema } from '../../utils/tema';
import { api } from '../../services/api';
import { X } from 'lucide-react';

type ModuloPreco = {
  id: string;
  chave: string;
  nome: string;
  valor: number;
  disponivelParaAtivar: boolean;
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
  const [mensalidadeAtual, setMensalidadeAtual] = useState(0);

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
      if (res?.modulosAtivos && Array.isArray(res.modulosAtivos)) {
        setModulosAtivos(res.modulosAtivos);
      }
      if (res?.mensalidadeValor) {
        setMensalidadeAtual(res.mensalidadeValor);
      }
    }).catch(() => {});
  }, []);

  function handleToggle(mod: ModuloPreco, marcado: boolean) {
    const novaLista = marcado
      ? [...modulosAtivos, mod.chave]
      : modulosAtivos.filter(m => m !== mod.chave);

    // calcula novo valor localmente (igual ao admin)
    const somaModulos = modulosPreco
      .filter(m => novaLista.includes(m.chave))
      .reduce((s, m) => s + m.valor, 0);

    const sessao = getSessao();
    const base = { loja: 89.90, loja_modulos: 89.90, servicos: 79.90, financeiro: 39.90 }[sessao?.tipoPlano ?? ''] ?? 0;
    const novaMensalidade = Math.round((base + somaModulos) * 100) / 100;

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
    } catch (e) {
      alert((e as Error).message);
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
          {modulosPreco.map(mod => {
            const ativo = modulosAtivos.includes(mod.chave);
            return (
              <label key={mod.chave} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: mod.disponivelParaAtivar ? 'pointer' : 'not-allowed',
                opacity: mod.disponivelParaAtivar ? 1 : 0.45,
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
              }}>
                <input
                  type="checkbox"
                  checked={ativo}
                  disabled={!mod.disponivelParaAtivar}
                  style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                  onChange={e => handleToggle(mod, e.target.checked)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{mod.nome}</div>
                  {!mod.disponivelParaAtivar && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Em breve</div>
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