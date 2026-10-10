import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { InputMoeda } from '../../components/InputMoeda';
import { Paginacao } from '../../components/Paginacao';
import { Financeiro } from './Financeiro';
import { DetalheFatura, FaturaMes } from './FaturasDoMes';
import './Contas.css';

interface Conta { id: string; nome: string; ativa: boolean; }

interface Cartao {
  id: string;
  nome: string;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  contaBancariaId: string;
  ativo: boolean;
  taxaJurosMensal: number;
}

interface ResumoCartao { usado: number; disponivel: number; qtdCompras: number; status: string; }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formVazio = (contaId = '') => ({ nome: '', limite: '', diaFechamento: '10', diaVencimento: '15', contaBancariaId: contaId, taxaJurosMensal: '' });

export function Cartoes() {
  const { sucesso, erro } = useToast();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<Record<string, ResumoCartao>>({});
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [form, setForm] = useState(formVazio());
  const [faturaCartaoId, setFaturaCartaoId] = useState<string | null>(null);
  const [faturasMes, setFaturasMes] = useState<FaturaMes[]>([]);
  const [faturasErro, setFaturasErro] = useState(false);

  function carregar() {
    return Promise.all([
      api.get<Cartao[]>('/api/financeiro/cartoes').then(setCartoes).catch(() => {}),
      api.get<any[]>('/api/financeiro/cartoes-resumo').then(lista => {
        const mapa: Record<string, ResumoCartao> = {};
        lista.forEach(c => { mapa[c.id] = { usado: c.usado, disponivel: c.disponivel, qtdCompras: c.qtdCompras, status: c.status }; });
        setResumo(mapa);
      }).catch(() => {}),
      api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {}),
      (() => {
        const agora = new Date();
        return api.get<FaturaMes[]>(`/api/financeiro/faturas-do-mes?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`)
          .then(r => { setFaturasMes(r); setFaturasErro(false); })
          .catch(() => setFaturasErro(true));
      })(),
    ]).finally(() => setCarregando(false));
  }
  useEffect(() => { carregar(); }, []);

  const contasAtivas = contas.filter(c => c.ativa);

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio(contasAtivas[0]?.id ?? contas[0]?.id ?? ''));
    setMostrarForm(true);
  }
  function abrirEditar(c: Cartao) {
    setEditando(c);
    setForm({
      nome: c.nome, limite: String(c.limite),
      diaFechamento: String(c.diaFechamento), diaVencimento: String(c.diaVencimento),
      contaBancariaId: c.contaBancariaId,
      taxaJurosMensal: String(c.taxaJurosMensal ?? 0),
    });
    setMostrarForm(true);
  }
  function fecharForm() {
    setEditando(null);
    setForm(formVazio());
    setMostrarForm(false);
  }
  async function salvar() {
    if (!form.nome.trim() || !form.contaBancariaId) { erro('Preencha nome e conta vinculada.'); return; }
    try {
      const payload = {
        nome: form.nome.trim(),
        limite: parseFloat(form.limite) || 0,
        diaFechamento: parseInt(form.diaFechamento) || 10,
        diaVencimento: parseInt(form.diaVencimento) || 15,
        contaBancariaId: form.contaBancariaId,
        taxaJurosMensal: parseFloat(form.taxaJurosMensal) || 0,
      };
      if (editando) await api.put(`/api/financeiro/cartoes/${editando.id}`, payload);
      else await api.post('/api/financeiro/cartoes', payload);
      fecharForm();
      carregar();
      sucesso('Cartão salvo!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(cartoes.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = cartoes.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  return (
    <div className="page fin-page">
      <div className="contas-acoes">
        <button className="btn-primary" onClick={abrirNovo}><Plus size={15} /> Novo cartão</button>
      </div>

      {mostrarForm && (
        <div className="card contas-form">
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando ? 'Editar cartão' : 'Novo cartão'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Santander" autoFocus />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Limite (R$)</label>
                <InputMoeda value={parseFloat(form.limite) || 0} onChange={v => setForm(f => ({ ...f, limite: String(v) }))} placeholder="0,00" />
              </div>
              <div className="form-group">
                <label className="form-label">Conta de pagamento</label>
                <select value={form.contaBancariaId} onChange={e => setForm(f => ({ ...f, contaBancariaId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {contasAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dia de fechamento</label>
                <input type="number" min={1} max={28} value={form.diaFechamento} onChange={e => setForm(f => ({ ...f, diaFechamento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Dia de vencimento</label>
                <input type="number" min={1} max={28} value={form.diaVencimento} onChange={e => setForm(f => ({ ...f, diaVencimento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Taxa de juros (% ao mês)</label>
                <input type="number" min={0} step={0.01} value={form.taxaJurosMensal} onChange={e => setForm(f => ({ ...f, taxaJurosMensal: e.target.value }))} placeholder="Ex: 12.5" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={salvar}>{editando ? 'Salvar' : 'Adicionar cartão'}</button>
              <button className="btn-secondary" onClick={fecharForm}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
      ) : cartoes.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '40px 0' }}><p>Nenhum cartão cadastrado.</p></div></div>
      ) : (
        <>
          <div className="contas-lista">
            {visiveis.map(c => {
              const r = resumo[c.id];
              const pct = r && c.limite > 0 ? Math.min(100, (r.usado / c.limite) * 100) : 0;
              return (
                <div key={c.id} className="card cartao-card" style={{ borderColor: pct > 85 ? 'rgba(248,113,113,0.4)' : undefined }}>
                  <div className="cartao-card-topo">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{c.nome}</span>
                        {r && r.qtdCompras > 0 && (
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>{r.qtdCompras} compra{r.qtdCompras > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Fecha dia {c.diaFechamento} · Vence dia {c.diaVencimento}</div>
                    </div>
                    <div className="conta-card-acoes">
                      <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setFaturaCartaoId(c.id)}>Ver fatura</button>
                      <button className="btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    </div>
                  </div>
                  {r && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
                        <strong style={{ fontSize: 18, color: pct > 85 ? 'var(--red)' : 'var(--text-1)' }}>{fmt(r.usado)}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/ {fmt(c.limite)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow, #d97706)' : 'var(--green)', borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Disponível</span>
                        <strong style={{ fontSize: 13, color: r.disponivel >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(r.disponivel)}</strong>
                      </div>
                    </>
                  )}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {(() => {
                      const f = faturasMes.find(x => x.cartaoId === c.id);
                      if (f) return <DetalheFatura f={f} rotulo={`Fatura de ${MESES[new Date().getMonth()]}`} />;
                      if (faturasErro) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Não foi possível carregar a fatura do mês.</span>;
                      return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{carregando ? 'Carregando fatura…' : 'Sem fatura neste mês.'}</span>;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          <Paginacao
            paginaAtual={paginaSegura}
            totalItens={cartoes.length}
            porPagina={porPagina}
            onMudarPagina={setPagina}
            onMudarPorPagina={setPorPagina}
          />
        </>
      )}

      {/* A fatura abre por cima desta tela (mesmo fundo); ao fechar, atualiza os limites */}
      {faturaCartaoId && (
        <Financeiro
          apenasFatura
          cartaoParaFatura={faturaCartaoId}
          aoFecharFatura={() => { setFaturaCartaoId(null); carregar(); }}
        />
      )}
    </div>
  );
}
