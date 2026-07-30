import { useState, useEffect, useRef } from 'react';
import { aplicarTema, carregarTemaSalvo, TEMAS, Tema } from '../../utils/tema';
import { api } from '../../services/api';
import { X, Save, Upload } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import './Configuracoes.css';

const CLOUDINARY_CLOUD = 'dnwnwshvq';
const CLOUDINARY_PRESET = 'loja-logos';

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
  funcionarios: 'Comissão de profissionais, fechamento de pagamento e integração com o Financeiro.',
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
  const { temCorretora, temProdutos, soFinanceiro, temChacaraReservas, temServicos, tipoPlano } = useApp();
  const [mensalidadeAtual, setMensalidadeAtual] = useState(0);
  const [slugChacara, setSlugChacara] = useState('');
  const [slugAtual, setSlugAtual] = useState('');
  const [salvandoSlug, setSalvandoSlug] = useState(false);
  const [erroSlug, setErroSlug] = useState('');
  const { erro: toastErro, sucesso: toastSucesso } = useToast();

  // modal de confirmação
  const [modalModulo, setModalModulo] = useState<{
    modulo: ModuloPreco;
    ativando: boolean;
    novaMensalidade: number;
    novaLista: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Identidade da loja (logo/nome/cor) ──────────────────────────
  const [formIdentidade, setFormIdentidade] = useState({ nome: '', corPrimaria: '#6366f1', logoUrl: '' });
  const [loadingIdentidade, setLoadingIdentidade] = useState(true);
  const [savingIdentidade, setSavingIdentidade] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [identidadeOk, setIdentidadeOk] = useState(false);
  const [identidadeErro, setIdentidadeErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── E-mail de acesso ─────────────────────────────────────────────
  const [emailForm, setEmailForm] = useState({ novoEmail: '', senhaAtual: '' });
  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [emailOk, setEmailOk] = useState('');
  const [emailErro, setEmailErro] = useState('');

  // ── Senha ────────────────────────────────────────────────────────
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senhaOk, setSenhaOk] = useState('');
  const [senhaErro, setSenhaErro] = useState('');

  // ── Agendamento online ───────────────────────────────────────────
  const [agConfig, setAgConfig] = useState({ ativo: false, confirmacao: 'aprovacao', slug: '' });
  const [salvandoAg, setSalvandoAg] = useState(false);
  const [agOk, setAgOk] = useState('');
  const [agErro, setAgErro] = useState('');

  useEffect(() => {
    api.get<ModuloPreco[]>('/api/modulos-preco').then(setModulosPreco).catch(() => {});
    api.get<any>('/api/loja/situacao').then(res => {
      if (res?.modulosAtivos && Array.isArray(res.modulosAtivos))
        setModulosAtivos(res.modulosAtivos);
      if (res?.mensalidadeValor)
        setMensalidadeAtual(res.mensalidadeValor);
      if (res?.slug) {
        setSlugAtual(res.slug);
        setSlugChacara(res.slug);
      }
      setAgConfig({
        ativo: res?.agendamentoOnlineAtivo ?? false,
        confirmacao: res?.agendamentoOnlineConfirmacao ?? 'aprovacao',
        slug: res?.slug ?? '',
      });
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

  useEffect(() => {
    api.get<any>('/api/cliente/config').then(res => {
      setFormIdentidade({ nome: res.nome ?? '', corPrimaria: res.corPrimaria ?? '#6366f1', logoUrl: res.logoUrl ?? '' });
    }).catch(() => {}).finally(() => setLoadingIdentidade(false));
  }, []);

  async function uploadLogo(file: File) {
    setUploading(true); setIdentidadeErro('');
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', CLOUDINARY_PRESET);
      data.append('folder', 'logos');

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Erro no upload');
      setFormIdentidade(f => ({ ...f, logoUrl: json.secure_url }));
    } catch (e) {
      setIdentidadeErro('Erro ao fazer upload: ' + (e as Error).message);
    } finally { setUploading(false); }
  }

  async function salvarIdentidade() {
    setSavingIdentidade(true); setIdentidadeErro(''); setIdentidadeOk(false);
    try {
      await api.patch('/api/cliente/config', formIdentidade);
      setIdentidadeOk(true);
      setTimeout(() => setIdentidadeOk(false), 3000);
    } catch (e) { setIdentidadeErro((e as Error).message); }
    finally { setSavingIdentidade(false); }
  }

  async function trocarEmail() {
    setEmailErro(''); setEmailOk('');
    if (!emailForm.novoEmail.trim() || !emailForm.senhaAtual) {
      setEmailErro('Preencha o novo e-mail e sua senha atual.');
      return;
    }
    setTrocandoEmail(true);
    try {
      await api.patch('/api/cliente/email', emailForm);
      setEmailOk('E-mail atualizado! Use o novo e-mail no próximo login.');
      setEmailForm({ novoEmail: '', senhaAtual: '' });
    } catch (e) {
      setEmailErro((e as Error).message);
    } finally {
      setTrocandoEmail(false);
    }
  }

  async function trocarSenha() {
    setSenhaErro(''); setSenhaOk('');
    if (!senhaForm.senhaAtual || !senhaForm.novaSenha) {
      setSenhaErro('Preencha todos os campos.');
      return;
    }
    if (senhaForm.novaSenha.length < 8) {
      setSenhaErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      setSenhaErro('A confirmação não confere.');
      return;
    }
    setTrocandoSenha(true);
    try {
      await api.post('/api/auth/trocar-senha', { senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha });
      setSenhaOk('Senha alterada com sucesso!');
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
    } catch (e) {
      setSenhaErro((e as Error).message);
    } finally {
      setTrocandoSenha(false);
    }
  }

  async function salvarAgendamento() {
    setAgErro(''); setAgOk('');
    if (agConfig.ativo && !agConfig.slug.trim()) {
      setAgErro('Defina um link (slug) antes de ativar.');
      return;
    }
    setSalvandoAg(true);
    try {
      const res = await api.patch<any>('/api/loja/agendamento-online', {
        ativo: agConfig.ativo,
        confirmacao: agConfig.confirmacao,
        slug: agConfig.slug.trim() || null,
      });
      setAgConfig({
        ativo: res.agendamentoOnlineAtivo,
        confirmacao: res.agendamentoOnlineConfirmacao,
        slug: res.slug ?? '',
      });
      setAgOk('Configuração salva!');
      setTimeout(() => setAgOk(''), 3000);
    } catch (e) {
      setAgErro((e as Error).message);
    } finally {
      setSalvandoAg(false);
    }
  }

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

  async function salvarSlugChacara() {
    setErroSlug('');
    if (!slugChacara.trim()) {
      setErroSlug('Informe um link.');
      return;
    }
    setSalvandoSlug(true);
    try {
      const res = await api.patch<{ slug: string }>('/api/loja/slug', { slug: slugChacara.trim() });
      setSlugAtual(res.slug);
      setSlugChacara(res.slug);
    } catch (e: any) {
      setErroSlug(e?.message ?? 'Erro ao salvar link.');
    } finally {
      setSalvandoSlug(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Preferências pessoais e da loja</p>
        </div>
      </div>

      <div className="config-grid">

      {/* Identidade da loja */}
      {!loadingIdentidade && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Identidade da loja</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
            Logo, nome e cor aparecem na tela de login e no topo do sistema.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Logo da loja</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', background: 'var(--bg-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {formIdentidade.logoUrl
                    ? <img src={formIdentidade.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 28 }}>✦</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                  <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {uploading
                      ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Enviando...</>
                      : <><Upload size={14} /> Upload da logo</>}
                  </button>
                  {formIdentidade.logoUrl && (
                    <button className="btn-ghost" onClick={() => setFormIdentidade(f => ({ ...f, logoUrl: '' }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12 }}>
                      <X size={12} /> Remover logo
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>PNG, JPG ou SVG. Recomendado: 200x200px</p>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome da loja</label>
              <input value={formIdentidade.nome} onChange={e => setFormIdentidade(f => ({ ...f, nome: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Cor principal</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={formIdentidade.corPrimaria}
                  onChange={e => setFormIdentidade(f => ({ ...f, corPrimaria: e.target.value }))}
                  style={{ width: 48, height: 40, padding: 2, flex: 'none' }} />
                <input value={formIdentidade.corPrimaria}
                  onChange={e => setFormIdentidade(f => ({ ...f, corPrimaria: e.target.value }))}
                  placeholder="#6366f1" />
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: formIdentidade.corPrimaria, opacity: .8 }} />
            </div>

            {identidadeErro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{identidadeErro}</p>}
            {identidadeOk && <p style={{ color: 'var(--green)', fontSize: 13 }}>✓ Salvo!</p>}

            <button className="btn-primary" onClick={salvarIdentidade} disabled={savingIdentidade}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={15} /> {savingIdentidade ? 'Salvando...' : 'Salvar identidade'}
            </button>
          </div>
        </div>
      )}

      {/* Aparência */}
      <div className="card">
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

      {/* E-mail de acesso */}
      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600 }}>E-mail de acesso</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 16 }}>
          ⚠️ Ao trocar, você passará a entrar no sistema com o novo e-mail.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Novo e-mail</label>
            <input type="email" value={emailForm.novoEmail}
              onChange={e => setEmailForm(f => ({ ...f, novoEmail: e.target.value }))}
              placeholder="novo@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Sua senha atual</label>
            <input type="password" value={emailForm.senhaAtual}
              onChange={e => setEmailForm(f => ({ ...f, senhaAtual: e.target.value }))}
              placeholder="Confirme com sua senha" />
          </div>
          {emailErro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{emailErro}</p>}
          {emailOk && <p style={{ color: 'var(--green)', fontSize: 13 }}>✓ {emailOk}</p>}
          <button className="btn-secondary" onClick={trocarEmail} disabled={trocandoEmail}
            style={{ alignSelf: 'flex-start' }}>
            {trocandoEmail ? 'Trocando...' : 'Trocar e-mail'}
          </button>
        </div>
      </div>

      {/* Senha */}
      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Senha</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Senha atual</label>
            <input type="password" value={senhaForm.senhaAtual}
              onChange={e => setSenhaForm(f => ({ ...f, senhaAtual: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            <input type="password" value={senhaForm.novaSenha}
              onChange={e => setSenhaForm(f => ({ ...f, novaSenha: e.target.value }))} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nova senha</label>
            <input type="password" value={senhaForm.confirmarSenha}
              onChange={e => setSenhaForm(f => ({ ...f, confirmarSenha: e.target.value }))} />
          </div>
          {senhaErro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{senhaErro}</p>}
          {senhaOk && <p style={{ color: 'var(--green)', fontSize: 13 }}>✓ {senhaOk}</p>}
          <button className="btn-secondary" onClick={trocarSenha} disabled={trocandoSenha}
            style={{ alignSelf: 'flex-start' }}>
            {trocandoSenha ? 'Trocando...' : 'Alterar senha'}
          </button>
        </div>
      </div>

      {/* Agendamento online */}
      {temServicos && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Agendamento online</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 16 }}>
            Deixe seus clientes agendarem sozinhos por um link. Divulgue no Instagram, WhatsApp, onde quiser.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={agConfig.ativo}
                style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                onChange={e => setAgConfig(c => ({ ...c, ativo: e.target.checked }))} />
              <span>Ativar agendamento online</span>
            </label>

            <div className="form-group">
              <label className="form-label">Seu link personalizado</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>app.aldevsoftware.com.br/agendar/</span>
                <input value={agConfig.slug}
                  onChange={e => setAgConfig(c => ({ ...c, slug: e.target.value }))}
                  placeholder="minha-loja" style={{ flex: 1, minWidth: 140 }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Use letras, números e hífens. Ex: banho-da-ana
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Quando o cliente agenda</label>
              <select value={agConfig.confirmacao}
                onChange={e => setAgConfig(c => ({ ...c, confirmacao: e.target.value }))}>
                <option value="aprovacao">Preciso aprovar cada agendamento</option>
                <option value="automatico">Confirmar automaticamente</option>
              </select>
            </div>

            {agConfig.ativo && agConfig.slug && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  app.aldevsoftware.com.br/agendar/{agConfig.slug}
                </span>
                <button className="btn-ghost" style={{ flexShrink: 0, fontSize: 12 }}
                  onClick={() => navigator.clipboard.writeText(`https://app.aldevsoftware.com.br/agendar/${agConfig.slug}`)}>
                  Copiar
                </button>
              </div>
            )}

            {agErro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{agErro}</p>}
            {agOk && <p style={{ color: 'var(--green)', fontSize: 13 }}>✓ {agOk}</p>}

            <button className="btn-primary" onClick={salvarAgendamento} disabled={salvandoAg}
              style={{ alignSelf: 'flex-start' }}>
              {salvandoAg ? 'Salvando...' : 'Salvar agendamento online'}
            </button>
          </div>
        </div>
      )}

      {/* Módulos */}
      <div className="card">
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

              const grupoExclusivo = ['corretora', 'servicos', 'turmas'];

              // Corretora e Turmas não fazem sentido pra loja com produtos (retail) —
              // só aparecem se por algum motivo já estiverem ativos nela
              if ((mod.chave === 'corretora' || mod.chave === 'turmas') && temProdutos && !modulosAtivos.includes(mod.chave)) {
                return false;
              }

              // Planos "fechados" (identidade própria, sem relação com retail/serviços)
              // não devem oferecer o trio Serviços/Corretora/Turmas — a não ser que
              // por algum motivo já estejam ativos (grandfather)
              const planosFechados = ['financeiro', 'chacara'];
              if (grupoExclusivo.includes(mod.chave) && planosFechados.includes(tipoPlano) && !modulosAtivos.includes(mod.chave)) {
                return false;
              }

              // Reservas de Chácara só faz sentido pra loja do tipo "chacara" —
              // esconde de Turmas, Corretora, Financeiro Puro, Loja, Loja+Serviço, etc.
              if (mod.chave === 'chacara_reservas' && tipoPlano !== 'chacara' && !modulosAtivos.includes(mod.chave)) {
                return false;
              }

              // Funcionários (comissão por atendimento) não faz sentido pra loja do tipo chácara —
              // fica disponível pra outros tipos (retail, serviços), grandfather se já ativo
              if (mod.chave === 'funcionarios' && tipoPlano === 'chacara' && !modulosAtivos.includes(mod.chave)) {
                return false;
              }

              // Corretora, Serviços e Turmas são um grupo mutuamente exclusivo:
              // mostra os disponíveis até um ser ativado, depois esconde os outros
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

      {temChacaraReservas && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Link do site da chácara</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Este é o link que você vai divulgar pros clientes reservarem online.
          </p>

          <div className="form-group">
            <label className="form-label">Seu link personalizado</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>app.aldevsoftware.com.br/chacara-site/</span>
              <input value={slugChacara}
                onChange={e => setSlugChacara(e.target.value)}
                placeholder="minha-chacara" style={{ flex: 1, minWidth: 140 }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Use letras, números e hífens. Ex: chacara-familia-cardoso
            </p>
          </div>

          {slugAtual && (
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 12, wordBreak: 'break-all' }}>
                app.aldevsoftware.com.br/chacara-site/{slugAtual}
              </span>
              <button className="btn-ghost" style={{ flexShrink: 0, fontSize: 12 }}
                onClick={() => navigator.clipboard.writeText(`https://app.aldevsoftware.com.br/chacara-site/${slugAtual}`)}>
                Copiar
              </button>
            </div>
          )}

          {erroSlug && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erroSlug}</p>}

          <button className="btn-primary" onClick={salvarSlugChacara} disabled={salvandoSlug} style={{ marginTop: 14 }}>
            {salvandoSlug ? 'Salvando...' : 'Salvar link'}
          </button>
        </div>
      )}

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