import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Check, Rocket } from 'lucide-react';
import { api } from '../../services/api';
import { InputMoeda } from '../../components/InputMoeda';
import { SeletorBanco } from '../../utils/bancos';
import { SeletorBandeira } from '../../utils/bandeiras';

interface Conta { id: string; nome: string; ativa: boolean; }
interface Categoria { id: string; nome: string; tipo: string; icone: string | null; }

// As preferências ficam separadas por usuário (e-mail), para não misturar lojas no mesmo navegador.
function usuarioAtual(): string {
  try { return (JSON.parse(localStorage.getItem('loja:sessao') ?? 'null')?.email ?? '').toLowerCase(); } catch { return ''; }
}
const CHAVE_VISTO = () => `loja:fin-passos-visto:${usuarioAtual()}`;      // o assistente já abriu sozinho uma vez
const CHAVE_OCULTAR = () => `loja:fin-passos-ocultar:${usuarioAtual()}`;  // o usuário não quer mais ver o lembrete
// Acesso de suporte (botão do admin): não abre sozinho nem grava preferências
const emSuporte = () => { try { return sessionStorage.getItem('loja:suporte') === '1'; } catch { return false; } };
const ler = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const gravar = (k: string) => { if (emSuporte()) return; try { localStorage.setItem(k, '1'); } catch { /* sem armazenamento */ } };

const ICONES = ['🏠', '💡', '💧', '📶', '🛒', '🚗', '💰', '📦', '💳', '🍽️'];
const PASSOS = ['Boas-vindas', 'Conta', 'Categoria', 'Conta fixa', 'A receber', 'Cartão', 'Pronto'];

// Passo a passo para quem ativa o módulo Financeiro: cria conta, categoria, uma conta fixa e uma conta a receber
// de verdade, explicando para que serve cada coisa. Abre sozinho na primeira vez (sem nenhuma conta) e depois
// vira um lembrete que dá para retomar.
export function PrimeirosPassosFinanceiro({ onAtualizado }: { onAtualizado?: () => void }) {
  const navigate = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ocultar, setOcultar] = useState(() => ler(CHAVE_OCULTAR()));
  const [passo, setPasso] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [feitos, setFeitos] = useState<string[]>([]);

  // formulários de cada passo
  const [fConta, setFConta] = useState({ nome: '', banco: '', saldo: 0 });
  const [fCat, setFCat] = useState({ nome: '', tipo: 'ambos', icone: '🏷️' });
  const [fFixa, setFFixa] = useState({ descricao: '', valor: 0, dia: '10', categoriaId: '', contaId: '' });
  const [fReceber, setFReceber] = useState({ descricao: '', valor: 0, dia: '5', categoriaId: '', contaId: '', repete: true });
  const [fCartao, setFCartao] = useState({ nome: '', limite: 0, fecha: '10', vence: '17', contaId: '', bandeira: '' });

  async function carregarDados() {
    try {
      const [cs, cats] = await Promise.all([
        api.get<Conta[]>('/api/financeiro/contas'),
        api.get<Categoria[]>('/api/financeiro/categorias'),
      ]);
      setContas(cs); setCategorias(cats);
      return { cs, cats };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    carregarDados().then(r => {
      setCarregado(true);
      if (r && r.cs.length === 0 && !ler(CHAVE_VISTO()) && !emSuporte()) abrir(r.cs.length, r.cats.length);
    });
  }, []);

  function abrir(qtdContas = contas.length, qtdCategorias = categorias.length) {
    gravar(CHAVE_VISTO());
    // retoma de onde faltava: conta → categoria → contas fixas
    setPasso(qtdContas === 0 ? 0 : qtdCategorias === 0 ? 2 : 3);
    setErro('');
    setAberto(true);
  }

  const contasAtivas = contas.filter(c => c.ativa);
  const contaPadrao = contasAtivas[0]?.id ?? '';
  const catsPagar = useMemo(() => categorias.filter(c => c.tipo === 'pagar' || c.tipo === 'ambos'), [categorias]);
  const catsReceber = useMemo(() => categorias.filter(c => c.tipo === 'receber' || c.tipo === 'ambos'), [categorias]);

  function fechar(concluido = false) {
    setAberto(false);
    if (concluido) { gravar(CHAVE_OCULTAR()); setOcultar(true); }
    onAtualizado?.();
    window.dispatchEvent(new Event('pullToRefresh'));
  }

  async function executar(acao: () => Promise<string | null>, proximo = true) {
    setOcupado(true); setErro('');
    try {
      const feito = await acao();
      if (feito) setFeitos(f => [...f, feito]);
      await carregarDados();
      if (proximo) setPasso(p => p + 1);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // ── ações de cada passo ──
  const criarConta = () => executar(async () => {
    if (!fConta.nome.trim()) throw new Error('Dê um nome para a conta.');
    await api.post('/api/financeiro/contas', { nome: fConta.nome.trim(), saldoInicial: fConta.saldo || 0, banco: fConta.banco || null, limite: 0 });
    return `Conta "${fConta.nome.trim()}" criada`;
  });
  const usarCategoriasPadrao = () => executar(async () => {
    await api.post('/api/financeiro/categorias/seed-padrao', {});
    return 'Categorias padrão criadas';
  });
  const criarCategoria = () => executar(async () => {
    if (!fCat.nome.trim()) throw new Error('Dê um nome para a categoria.');
    await api.post('/api/financeiro/categorias', { nome: fCat.nome.trim(), tipo: fCat.tipo, icone: fCat.icone });
    const nome = fCat.nome.trim();
    setFCat({ nome: '', tipo: 'ambos', icone: '🏷️' });
    return `Categoria "${nome}" criada`;
  });
  const criarFixa = () => executar(async () => {
    const contaId = fFixa.contaId || contaPadrao;
    if (!contaId) throw new Error('Crie uma conta antes (passo 2).');
    if (!fFixa.descricao.trim() || !(fFixa.valor > 0)) throw new Error('Informe a descrição e o valor.');
    await api.post('/api/financeiro/fixos', {
      contaBancariaId: contaId, tipo: 'pagar', descricao: fFixa.descricao.trim(), categoriaId: fFixa.categoriaId || null,
      observacao: null, valor: fFixa.valor, diaVencimento: parseInt(fFixa.dia) || 10, jaPago: false, dataInicio: null, avisar: true,
    });
    return `Conta fixa "${fFixa.descricao.trim()}" criada`;
  });
  const criarReceber = () => executar(async () => {
    const contaId = fReceber.contaId || contaPadrao;
    if (!contaId) throw new Error('Crie uma conta antes (passo 2).');
    if (!fReceber.descricao.trim() || !(fReceber.valor > 0)) throw new Error('Informe a descrição e o valor.');
    const dia = Math.min(28, Math.max(1, parseInt(fReceber.dia) || 5));
    if (fReceber.repete) {
      await api.post('/api/financeiro/fixos', {
        contaBancariaId: contaId, tipo: 'receber', descricao: fReceber.descricao.trim(), categoriaId: fReceber.categoriaId || null,
        observacao: null, valor: fReceber.valor, diaVencimento: dia, jaPago: false, dataInicio: null, avisar: true,
      });
    } else {
      const hoje = new Date();
      const venc = new Date(hoje.getFullYear(), hoje.getMonth(), dia, 12).toISOString().slice(0, 10);
      await api.post('/api/financeiro/lancamentos/avulso', {
        contaBancariaId: contaId, tipo: 'receber', descricao: fReceber.descricao.trim(), categoriaId: fReceber.categoriaId || null,
        observacao: null, valor: fReceber.valor, vencimento: venc, jaPago: false, avisar: true,
      });
    }
    return `Conta a receber "${fReceber.descricao.trim()}" criada`;
  });
  const criarCartao = () => executar(async () => {
    const contaId = fCartao.contaId || contaPadrao;
    if (!contaId) throw new Error('Crie uma conta antes (passo 2).');
    if (!fCartao.nome.trim()) throw new Error('Dê um nome para o cartão.');
    await api.post('/api/financeiro/cartoes', {
      nome: fCartao.nome.trim(), limite: fCartao.limite || 0, diaFechamento: parseInt(fCartao.fecha) || 10,
      diaVencimento: parseInt(fCartao.vence) || 17, contaBancariaId: contaId, taxaJurosMensal: 0, bandeira: fCartao.bandeira || null,
    });
    return `Cartão "${fCartao.nome.trim()}" criado`;
  });

  const incompleto = carregado && (contas.length === 0 || categorias.length === 0);

  // ── apresentação ──
  const dica = (texto: React.ReactNode) => (
    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>{texto}</p>
  );
  const seletorConta = (valor: string, onChange: (v: string) => void) => (
    <div className="form-group">
      <label className="form-label">Conta</label>
      <select value={valor || contaPadrao} onChange={e => onChange(e.target.value)}>
        {contasAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </div>
  );
  const seletorCategoria = (lista: Categoria[], valor: string, onChange: (v: string) => void) => (
    <div className="form-group">
      <label className="form-label">Categoria</label>
      <select value={valor} onChange={e => onChange(e.target.value)}>
        <option value="">Sem categoria</option>
        {lista.map(c => <option key={c.id} value={c.id}>{c.icone ?? ''} {c.nome}</option>)}
      </select>
    </div>
  );
  const jaTem = (texto: string) => (
    <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', borderRadius: 8, padding: '6px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Check size={14} /> {texto}
    </div>
  );

  function corpo() {
    switch (passo) {
      case 0: return (
        <>
          {dica(<>Vamos configurar o seu <strong>Financeiro</strong> em poucos passos. Você vai criar uma conta, uma categoria, uma conta fixa (como a luz) e uma conta a receber — tudo de verdade, já pronto para usar.</>)}
          <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.9, paddingLeft: 18 }}>
            <li>Dá para <strong>pular</strong> qualquer passo e voltar depois pelo lembrete na tela.</li>
            <li>Leva cerca de 3 minutos.</li>
          </ul>
        </>
      );
      case 1: return (
        <>
          {dica(<><strong>Por que preciso de uma conta?</strong> Todo dinheiro que entra ou sai precisa estar ligado a uma conta — é ela que mostra o seu <strong>saldo</strong> e de onde cada pagamento saiu. Pode ser a conta do banco, a carteira (dinheiro) ou o caixa da loja. Você pode criar quantas quiser depois.</>)}
          {contasAtivas.length > 0 && jaTem(`Você já tem ${contasAtivas.length} conta(s). Pode criar outra ou continuar.`)}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Nome da conta *</label>
            <input value={fConta.nome} onChange={e => setFConta(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Conta Nubank, Carteira, Caixa" autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Quanto tem nela hoje? (saldo inicial)</label>
            <InputMoeda value={fConta.saldo} onChange={v => setFConta(f => ({ ...f, saldo: v }))} placeholder="0,00" permitirNegativo />
          </div>
          <div className="form-group">
            <label className="form-label">Banco <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
            <SeletorBanco valor={fConta.banco} onChange={id => setFConta(f => ({ ...f, banco: id }))} altura={150} />
          </div>
        </>
      );
      case 2: return (
        <>
          {dica(<><strong>Para que servem as categorias?</strong> Elas dizem para onde vai o seu dinheiro (moradia, mercado, salário...). Com elas você vê relatórios, o balanço do mês e faz o planejamento de gastos.</>)}
          {categorias.length > 0 && jaTem(`Você já tem ${categorias.length} categoria(s).`)}
          {categorias.length === 0 && (
            <button className="btn-primary" style={{ width: '100%', marginBottom: 10 }} disabled={ocupado} onClick={usarCategoriasPadrao}>
              Usar categorias padrão (recomendado)
            </button>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 10px' }}>{categorias.length === 0 ? 'Ou crie a sua própria:' : 'Quer criar mais uma?'}</p>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Nome da categoria</label>
            <input value={fCat.nome} onChange={e => setFCat(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Moradia, Salário" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {ICONES.map(i => (
              <button key={i} type="button" onClick={() => setFCat(f => ({ ...f, icone: i }))}
                style={{ fontSize: 18, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', background: fCat.icone === i ? 'var(--accent-bg)' : 'transparent', border: `1px solid ${fCat.icone === i ? 'var(--accent)' : 'var(--border)'}` }}>{i}</button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Vale para</label>
            <select value={fCat.tipo} onChange={e => setFCat(f => ({ ...f, tipo: e.target.value }))}>
              <option value="ambos">Contas a pagar e a receber</option>
              <option value="pagar">Só contas a pagar</option>
              <option value="receber">Só contas a receber</option>
            </select>
          </div>
        </>
      );
      case 3: return (
        <>
          {dica(<><strong>Conta fixa</strong> é aquela que se repete todo mês: luz, água, aluguel, internet. Você lança <strong>uma vez</strong> e o sistema cria o vencimento de todos os meses para você, e ainda pode avisar por e-mail antes de vencer.</>)}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Descrição *</label>
            <input value={fFixa.descricao} onChange={e => setFFixa(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Conta de luz" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <InputMoeda value={fFixa.valor} onChange={v => setFFixa(f => ({ ...f, valor: v }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Vence todo dia</label>
              <input type="number" min={1} max={28} value={fFixa.dia} onChange={e => setFFixa(f => ({ ...f, dia: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {seletorCategoria(catsPagar, fFixa.categoriaId, v => setFFixa(f => ({ ...f, categoriaId: v })))}
            {seletorConta(fFixa.contaId, v => setFFixa(f => ({ ...f, contaId: v })))}
          </div>
        </>
      );
      case 4: return (
        <>
          {dica(<><strong>Conta a receber</strong> é todo dinheiro que vai entrar: salário, aluguel que você recebe, uma venda a prazo. Lançando aqui, você enxerga quanto vai receber no mês e quando.</>)}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Descrição *</label>
            <input value={fReceber.descricao} onChange={e => setFReceber(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Salário" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <InputMoeda value={fReceber.valor} onChange={v => setFReceber(f => ({ ...f, valor: v }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Dia do recebimento</label>
              <input type="number" min={1} max={28} value={fReceber.dia} onChange={e => setFReceber(f => ({ ...f, dia: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            {seletorCategoria(catsReceber, fReceber.categoriaId, v => setFReceber(f => ({ ...f, categoriaId: v })))}
            {seletorConta(fReceber.contaId, v => setFReceber(f => ({ ...f, contaId: v })))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={fReceber.repete} onChange={e => setFReceber(f => ({ ...f, repete: e.target.checked }))} style={{ width: 16, height: 16, margin: 0 }} />
            Se repete todo mês (como o salário)
          </label>
        </>
      );
      case 5: return (
        <>
          {dica(<><strong>Cartão de crédito</strong> <span style={{ color: 'var(--text-3)' }}>(opcional)</span> — cadastre para acompanhar a fatura, o limite usado e o que ainda dá para gastar. Se não usa cartão, é só pular.</>)}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Nome do cartão</label>
            <input value={fCartao.nome} onChange={e => setFCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Limite (R$)</label>
              <InputMoeda value={fCartao.limite} onChange={v => setFCartao(f => ({ ...f, limite: v }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha dia</label>
              <input type="number" min={1} max={28} value={fCartao.fecha} onChange={e => setFCartao(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Vence dia</label>
              <input type="number" min={1} max={28} value={fCartao.vence} onChange={e => setFCartao(f => ({ ...f, vence: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Bandeira</label>
            <SeletorBandeira valor={fCartao.bandeira} onChange={id => setFCartao(f => ({ ...f, bandeira: id }))} />
          </div>
          {seletorConta(fCartao.contaId, v => setFCartao(f => ({ ...f, contaId: v })))}
        </>
      );
      default: return (
        <>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <Rocket size={36} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>Tudo pronto!</p>
          </div>
          {feitos.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {feitos.map((f, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-2)', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}><Check size={14} style={{ color: 'var(--green)' }} /> {f}</div>)}
            </div>
          )}
          {dica('Daqui para a frente: lance suas contas a pagar e a receber, acompanhe o saldo e veja o balanço do mês. Quer ir além?')}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { fechar(true); navigate('/financeiro/planejamento'); }}>Planejar gastos do mês</button>
            <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { fechar(true); navigate('/financeiro/balanco'); }}>Ver o balanço mensal</button>
          </div>
        </>
      );
    }
  }

  // botão principal de cada passo
  function acaoPrincipal() {
    const ultimo = passo === PASSOS.length - 1;
    if (ultimo) return <button className="btn-primary" onClick={() => fechar(true)}>Concluir</button>;
    if (passo === 0) return <button className="btn-primary" onClick={() => setPasso(1)}>Começar</button>;
    const rotulos: Record<number, [string, () => void]> = {
      1: ['Criar conta e continuar', criarConta],
      2: [fCat.nome.trim() ? 'Criar categoria e continuar' : 'Continuar', () => fCat.nome.trim() ? criarCategoria() : setPasso(3)],
      3: ['Criar conta fixa e continuar', criarFixa],
      4: ['Criar conta a receber e continuar', criarReceber],
      5: [fCartao.nome.trim() ? 'Criar cartão e continuar' : 'Continuar', () => fCartao.nome.trim() ? criarCartao() : setPasso(6)],
    };
    const [rotulo, fn] = rotulos[passo];
    return <button className="btn-primary" disabled={ocupado} onClick={fn}>{ocupado ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : rotulo}</button>;
  }

  return (
    <>
      {incompleto && !aberto && !ocultar && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderColor: 'var(--accent-border)', background: 'var(--accent-bg)' }}>
          <Rocket size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Primeiros passos do Financeiro</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Crie sua conta, categorias e os primeiros lançamentos em 3 minutos.</div>
          </div>
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => abrir()}>Continuar</button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { gravar(CHAVE_OCULTAR()); setOcultar(true); }}>Não mostrar mais</button>
        </div>
      )}

      {aberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !ocupado && fechar()}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Primeiros passos — {PASSOS[passo]}</h2>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Passo {passo + 1} de {PASSOS.length}</div>
              </div>
              <button className="btn-ghost" onClick={() => fechar()} disabled={ocupado} title="Fechar (dá para retomar depois)"><X size={16} /></button>
            </div>
            <div style={{ height: 3, background: 'var(--bg-3)' }}>
              <div style={{ height: '100%', width: `${((passo + 1) / PASSOS.length) * 100}%`, background: 'var(--accent)', transition: 'width .2s' }} />
            </div>
            <div className="modal-body">
              {corpo()}
              {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {passo > 0 && <button className="btn-secondary" disabled={ocupado} onClick={() => { setErro(''); setPasso(p => p - 1); }}>Voltar</button>}
                {passo > 0 && passo < PASSOS.length - 1 && <button className="btn-ghost" disabled={ocupado} onClick={() => { setErro(''); setPasso(p => p + 1); }}>Pular</button>}
              </div>
              {acaoPrincipal()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
