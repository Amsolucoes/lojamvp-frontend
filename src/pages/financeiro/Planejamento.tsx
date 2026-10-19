import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, PiggyBank } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { InputMoeda } from '../../components/InputMoeda';
import './Planejamento.css';

interface LinhaCategoria {
  categoriaId: string; nome: string; icone: string; ativo: boolean; valor: number;
  gastoAvulso: number; gastoCartao: number; gasto: number;
}
interface Meta { id: string; nome: string; icone: string | null; valorAlvo: number; valorGuardado: number; dataAlvo: string | null; porMes: number | null; }
interface Plano {
  ano: number; mes: number;
  receitaPlanejada: number | null; receitaPrevista: number; receita: number;
  percentualPoupanca: number; poupar: number; disponivelParaGastar: number;
  totalPlanejado: number; gastoPlanejadas: number; gastoTotal: number;
  categorias: LinhaCategoria[]; metas: Meta[];
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ICONES_META = ['🎯', '🏖️', '✈️', '🚗', '🏠', '🎓', '💍', '🛡️', '💻', '📱', '🎁', '🐷'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const META_VAZIA = { nome: '', icone: '🎯', valorAlvo: 0, valorGuardado: 0, dataAlvo: '' };

export function Planejamento() {
  const navigate = useNavigate();
  const { sucesso, erro } = useToast();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Edição local (só vai para o servidor ao salvar)
  const [edit, setEdit] = useState<Record<string, { ativo: boolean; valor: number }>>({});
  const [receitaEdit, setReceitaEdit] = useState(0);
  const [percEdit, setPercEdit] = useState(30);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [modalMeta, setModalMeta] = useState<null | { id: string | null }>(null);
  const [formMeta, setFormMeta] = useState(META_VAZIA);
  const [modalAporte, setModalAporte] = useState<Meta | null>(null);
  const [aporte, setAporte] = useState(0);
  const [aporteSinal, setAporteSinal] = useState<1 | -1>(1);

  async function carregar() {
    setCarregando(true);
    try {
      const p = await api.get<Plano>(`/api/financeiro/planejamento?ano=${ano}&mes=${mes + 1}`);
      setPlano(p);
      const e: Record<string, { ativo: boolean; valor: number }> = {};
      p.categorias.forEach(c => { e[c.categoriaId] = { ativo: c.ativo, valor: c.valor }; });
      setEdit(e);
      setReceitaEdit(p.receitaPlanejada ?? 0);
      setPercEdit(p.percentualPoupanca);
    } catch {
      erro('Não foi possível carregar o planejamento.');
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, [ano, mes]);

  function navMes(delta: number) {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  }

  const alterado = useMemo(() => {
    if (!plano) return false;
    if ((plano.receitaPlanejada ?? 0) !== receitaEdit || plano.percentualPoupanca !== percEdit) return true;
    return plano.categorias.some(c => {
      const e = edit[c.categoriaId];
      return e && (e.ativo !== c.ativo || e.valor !== c.valor);
    });
  }, [plano, edit, receitaEdit, percEdit]);

  // Totais recalculados com a edição em andamento
  const calc = useMemo(() => {
    if (!plano) return null;
    const ativas = plano.categorias.filter(c => edit[c.categoriaId]?.ativo);
    const totalPlanejado = ativas.reduce((s, c) => s + (edit[c.categoriaId]?.valor ?? 0), 0);
    const gastoPlanejadas = ativas.reduce((s, c) => s + c.gasto, 0);
    const receita = receitaEdit > 0 ? receitaEdit : plano.receitaPrevista;
    const poupar = Math.round(receita * percEdit) / 100;
    const disponivel = receita - poupar;
    const estouradas = ativas.filter(c => (edit[c.categoriaId]?.valor ?? 0) > 0 && c.gasto > (edit[c.categoriaId]?.valor ?? 0));
    return { totalPlanejado, gastoPlanejadas, receita, poupar, disponivel, estouradas };
  }, [plano, edit, receitaEdit, percEdit]);

  async function salvar() {
    if (!plano) return;
    setSalvando(true);
    try {
      await api.put('/api/financeiro/planejamento/config', { receitaPlanejada: receitaEdit > 0 ? receitaEdit : null, percentualPoupanca: percEdit });
      await api.put('/api/financeiro/planejamento/categorias', {
        itens: plano.categorias.map(c => ({ categoriaId: c.categoriaId, ativo: edit[c.categoriaId]?.ativo ?? false, valor: edit[c.categoriaId]?.valor ?? 0 })),
      });
      sucesso('Planejamento salvo.');
      await carregar();
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function abrirMeta(m: Meta | null) {
    setFormMeta(m ? { nome: m.nome, icone: m.icone ?? '🎯', valorAlvo: m.valorAlvo, valorGuardado: m.valorGuardado, dataAlvo: m.dataAlvo ? m.dataAlvo.slice(0, 7) : '' } : META_VAZIA);
    setModalMeta({ id: m?.id ?? null });
  }

  async function salvarMeta() {
    if (!modalMeta) return;
    if (!formMeta.nome.trim() || formMeta.valorAlvo <= 0) { erro('Informe o nome e o valor da meta.'); return; }
    const corpo = {
      nome: formMeta.nome, icone: formMeta.icone, valorAlvo: formMeta.valorAlvo, valorGuardado: formMeta.valorGuardado,
      dataAlvo: formMeta.dataAlvo ? `${formMeta.dataAlvo}-01` : null,
    };
    try {
      if (modalMeta.id) await api.put(`/api/financeiro/planejamento/metas/${modalMeta.id}`, corpo);
      else await api.post('/api/financeiro/planejamento/metas', corpo);
      setModalMeta(null);
      sucesso('Meta salva.');
      await carregar();
    } catch (e) { erro((e as Error).message); }
  }

  async function excluirMeta(m: Meta) {
    if (!window.confirm(`Excluir a meta "${m.nome}"?`)) return;
    try { await api.delete(`/api/financeiro/planejamento/metas/${m.id}`); await carregar(); }
    catch (e) { erro((e as Error).message); }
  }

  async function confirmarAporte() {
    if (!modalAporte || aporte <= 0) return;
    try {
      await api.post(`/api/financeiro/planejamento/metas/${modalAporte.id}/aportar`, { valor: aporte * aporteSinal });
      setModalAporte(null); setAporte(0); setAporteSinal(1);
      await carregar();
    } catch (e) { erro((e as Error).message); }
  }

  const visiveis = (plano?.categorias ?? []).filter(c => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button className="btn-ghost" onClick={() => navigate('/financeiro')} style={{ padding: 8 }}><ArrowLeft size={18} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Planejamento</h1>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '4px 0 0 46px' }}>
        Defina quanto quer gastar por categoria e acompanhe o mês. O mesmo planejamento vale para todos os meses.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
        <button className="btn-secondary" onClick={() => navMes(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: 16, minWidth: 150, textAlign: 'center' }}>{MESES[mes]} {ano}</span>
        <button className="btn-secondary" onClick={() => navMes(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
      </div>

      {carregando || !plano || !calc ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
      ) : (
        <>
          <div className="plan-resumo">
            <div className="stat-card">
              <div className="stat-label">Planejado para gastar</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(calc.totalPlanejado)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Planejado para receber</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--green)' }}>{fmt(calc.receita)}</div>
              {receitaEdit <= 0 && plano.receitaPrevista > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>previsto nos lançamentos</div>}
            </div>
            <div className="stat-card">
              <div className="stat-label">Já gasto (planejadas)</div>
              <div className="stat-value" style={{ fontSize: 20, color: calc.gastoPlanejadas > calc.totalPlanejado && calc.totalPlanejado > 0 ? 'var(--red)' : 'var(--text-1)' }}>{fmt(calc.gastoPlanejadas)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{calc.totalPlanejado - calc.gastoPlanejadas >= 0 ? 'Ainda pode gastar' : 'Passou do teto'}</div>
              <div className="stat-value" style={{ fontSize: 20, color: calc.totalPlanejado - calc.gastoPlanejadas >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(Math.abs(calc.totalPlanejado - calc.gastoPlanejadas))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}><PiggyBank size={16} /> Receita e quanto guardar</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label">Quanto planeja receber no mês</label>
                <InputMoeda value={receitaEdit} onChange={setReceitaEdit} placeholder={plano.receitaPrevista > 0 ? fmt(plano.receitaPrevista) : '0,00'} />
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Vazio = usa o que já está lançado a receber no mês ({fmt(plano.receitaPrevista)}).</p>
              </div>
              <div style={{ flex: '0 1 150px' }}>
                <label className="form-label">Guardar (% da receita)</label>
                <input type="number" min={0} max={100} value={percEdit} onChange={e => setPercEdit(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              <div style={{ flex: '1 1 200px', fontSize: 13 }}>
                <div>Guardar: <strong>{fmt(calc.poupar)}</strong></div>
                <div>Sobra para gastar: <strong style={{ color: calc.disponivel >= 0 ? 'var(--text-1)' : 'var(--red)' }}>{fmt(calc.disponivel)}</strong></div>
              </div>
            </div>
          </div>

          <div className="plan-alertas">
            {calc.receita <= 0 && <div className="plan-alerta">Informe quanto pretende receber no mês para ver quanto precisa guardar e quanto sobra para gastar.</div>}
            {calc.receita > 0 && calc.totalPlanejado > calc.disponivel && (
              <div className="plan-alerta ruim">O que você planejou gastar ({fmt(calc.totalPlanejado)}) passa em {fmt(calc.totalPlanejado - calc.disponivel)} do que sobra depois de guardar {percEdit}% ({fmt(calc.disponivel)}).</div>
            )}
            {calc.receita > 0 && calc.totalPlanejado > 0 && calc.totalPlanejado <= calc.disponivel && (
              <div className="plan-alerta ok">Planejamento dentro do que sobra depois de guardar {percEdit}%: sobram {fmt(calc.disponivel - calc.totalPlanejado)} de folga.</div>
            )}
            {calc.totalPlanejado > 0 && calc.gastoPlanejadas > calc.totalPlanejado && (
              <div className="plan-alerta ruim">Você passou do teto planejado em {fmt(calc.gastoPlanejadas - calc.totalPlanejado)} neste mês.</div>
            )}
            {calc.estouradas.map(c => (
              <div key={c.categoriaId} className="plan-alerta ruim">{c.icone} {c.nome}: gastou {fmt(c.gasto)} para um teto de {fmt(edit[c.categoriaId]?.valor ?? 0)} (+{fmt(c.gasto - (edit[c.categoriaId]?.valor ?? 0))}).</div>
            ))}
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Categorias</div>
              <input placeholder="Buscar categoria..." value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 240 }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              Marque as categorias que quer planejar e informe o teto do mês. O gasto soma o que foi lançado como débito/avulso e as compras no cartão pela data da compra.
            </p>
            {visiveis.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0' }}>Nenhuma categoria encontrada. Cadastre categorias de despesa em Categorias.</p>}
            {visiveis.map(c => {
              const e = edit[c.categoriaId] ?? { ativo: false, valor: 0 };
              const pct = e.valor > 0 ? (c.gasto / e.valor) * 100 : 0;
              const passou = e.ativo && e.valor > 0 && c.gasto > e.valor;
              const larg = (parte: number) => (e.valor > 0 ? Math.min(100, (parte / e.valor) * 100) : 0);
              return (
                <div key={c.categoriaId} className="plan-linha" style={{ opacity: e.ativo ? 1 : 0.7 }}>
                  <div className="plan-linha-topo">
                    <div className="plan-linha-nome" style={{ cursor: 'pointer', justifyContent: 'flex-start' }}
                      onClick={() => setEdit(s => ({ ...s, [c.categoriaId]: { ...e, ativo: !e.ativo } }))}>
                      <input type="checkbox" checked={e.ativo} readOnly style={{ width: 18, height: 18, flex: 'none', padding: 0 }} />
                      <span>{c.icone}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                    </div>
                    <div className="plan-linha-valor">
                      <InputMoeda value={e.valor} onChange={v => setEdit(s => ({ ...s, [c.categoriaId]: { ...e, valor: v } }))} placeholder="Teto do mês" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)', margin: '8px 0 4px' }}>
                    <span>
                      Gasto: <strong style={{ color: passou ? 'var(--red)' : 'var(--text-2)' }}>{fmt(c.gasto)}</strong>
                      {c.gasto > 0 && <> · 💳 cartão {fmt(c.gastoCartao)} · débito/avulso {fmt(c.gastoAvulso)}</>}
                    </span>
                    {e.ativo && e.valor > 0 && (
                      <span style={{ color: passou ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                        {passou ? `Passou ${fmt(c.gasto - e.valor)}` : `Resta ${fmt(e.valor - c.gasto)}`} ({pct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {e.ativo && e.valor > 0 && (
                    <div className="plan-bar" title={`Cartão ${fmt(c.gastoCartao)} · débito/avulso ${fmt(c.gastoAvulso)}`}>
                      <span style={{ width: `${larg(c.gastoAvulso)}%`, background: passou ? 'var(--red)' : 'var(--green)' }} />
                      <span style={{ width: `${Math.min(larg(c.gastoCartao), 100 - larg(c.gastoAvulso))}%`, background: passou ? 'rgba(248,113,113,.55)' : 'rgba(74,222,128,.5)' }} />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={salvar} disabled={salvando || !alterado} style={{ width: 'auto', minWidth: 180 }}>
                {salvando ? 'Salvando...' : alterado ? 'Salvar planejamento' : 'Planejamento salvo'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 10px' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Metas</div>
            <button className="btn-secondary" onClick={() => abrirMeta(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Nova meta</button>
          </div>
          {plano.metas.length === 0 ? (
            <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>
              Crie metas para o que quer conquistar: férias, um carro novo, uma reserva de emergência. Informe o valor e a data, e veja quanto precisa guardar por mês.
            </div>
          ) : (
            <div className="plan-metas">
              {plano.metas.map(m => {
                const pct = m.valorAlvo > 0 ? Math.min(100, (m.valorGuardado / m.valorAlvo) * 100) : 0;
                const concluida = m.valorGuardado >= m.valorAlvo;
                return (
                  <div key={m.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.icone ?? '🎯'} {m.nome}</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn-ghost" onClick={() => abrirMeta(m)} style={{ padding: 6 }}><Pencil size={14} /></button>
                        <button className="btn-ghost" onClick={() => excluirMeta(m)} style={{ padding: 6 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, margin: '8px 0 6px' }}><strong>{fmt(m.valorGuardado)}</strong> <span style={{ color: 'var(--text-3)' }}>de {fmt(m.valorAlvo)} ({pct.toFixed(0)}%)</span></div>
                    <div className="plan-bar"><span style={{ width: `${pct}%`, background: concluida ? 'var(--green)' : 'var(--accent)' }} /></div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      {concluida ? '🎉 Meta alcançada!' : m.porMes !== null
                        ? <>Guarde <strong style={{ color: 'var(--text-2)' }}>{fmt(m.porMes)}/mês</strong> até {m.dataAlvo ? new Date(m.dataAlvo).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}</>
                        : <>Faltam {fmt(m.valorAlvo - m.valorGuardado)}</>}
                    </div>
                    {!concluida && (
                      <button className="btn-secondary" onClick={() => { setModalAporte(m); setAporte(0); setAporteSinal(1); }} style={{ marginTop: 10, width: '100%' }}>Guardar / retirar valor</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modalMeta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMeta(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{modalMeta.id ? 'Editar meta' : 'Nova meta'}</h3>
              <button className="btn-ghost" onClick={() => setModalMeta(null)} style={{ padding: 6 }}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input value={formMeta.nome} onChange={e => setFormMeta(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Férias, Carro novo, Reserva de emergência" />
              </div>
              <div className="form-group">
                <label className="form-label">Ícone</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICONES_META.map(i => (
                    <button key={i} type="button" onClick={() => setFormMeta(f => ({ ...f, icone: i }))}
                      className={formMeta.icone === i ? 'btn-primary' : 'btn-secondary'} style={{ padding: '4px 8px', fontSize: 16, width: 'auto' }}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Valor da meta</label>
                <InputMoeda value={formMeta.valorAlvo} onChange={v => setFormMeta(f => ({ ...f, valorAlvo: v }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Já guardado</label>
                <InputMoeda value={formMeta.valorGuardado} onChange={v => setFormMeta(f => ({ ...f, valorGuardado: v }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Alcançar até (opcional)</label>
                <input type="month" value={formMeta.dataAlvo} onChange={e => setFormMeta(f => ({ ...f, dataAlvo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalMeta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarMeta}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {modalAporte && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAporte(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>{modalAporte.icone ?? '🎯'} {modalAporte.nome}</h3>
              <button className="btn-ghost" onClick={() => setModalAporte(null)} style={{ padding: 6 }}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="cx-tipo-toggle">
                <button className={aporteSinal === 1 ? 'active' : ''} onClick={() => setAporteSinal(1)}>Guardar</button>
                <button className={aporteSinal === -1 ? 'active' : ''} onClick={() => setAporteSinal(-1)}>Retirar</button>
              </div>
              <InputMoeda value={aporte} onChange={setAporte} autoFocus />
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Isso só atualiza o valor da meta aqui; não movimenta suas contas.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAporte(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarAporte} disabled={aporte <= 0}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
