import { useState, useEffect } from 'react';
import { X, Plus, Settings, Repeat } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { BANCOS, BankBadge } from '../../utils/bancos';
import { Paginacao } from '../../components/Paginacao';
import './Contas.css';

interface Conta {
  id: string;
  nome: string;
  saldoInicial: number;
  saldoAtual: number;
  ativa: boolean;
  banco?: string | null;
  limite: number;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORM_VAZIO = { nome: '', saldoInicial: '', banco: '', limite: '' };
const TRANSF_VAZIA = { contaOrigemId: '', contaDestinoId: '', valor: '', registrar: true, observacao: '' };

export function Contas() {
  const { sucesso, erro } = useToast();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const [modalAjuste, setModalAjuste] = useState<Conta | null>(null);
  const [formAjuste, setFormAjuste] = useState({ tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', valor: '', novoSaldo: '', observacao: '' });

  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [formTransf, setFormTransf] = useState(TRANSF_VAZIA);

  async function carregar() {
    await api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {}).finally(() => setCarregando(false));
  }
  useEffect(() => { carregar(); }, []);

  function abrirNova() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setMostrarForm(true);
  }
  function abrirEditar(c: Conta) {
    setEditando(c);
    setForm({ nome: c.nome, saldoInicial: String(c.saldoInicial), banco: c.banco ?? '', limite: String(c.limite ?? '') });
    setMostrarForm(true);
  }
  function fecharForm() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setMostrarForm(false);
  }
  async function salvar() {
    if (!form.nome.trim()) { erro('Digite o nome da conta.'); return; }
    try {
      const payload = { nome: form.nome.trim(), saldoInicial: parseFloat(form.saldoInicial) || 0, banco: form.banco || null, limite: parseFloat(form.limite) || 0 };
      if (editando) await api.put(`/api/financeiro/contas/${editando.id}`, payload);
      else await api.post('/api/financeiro/contas', payload);
      fecharForm();
      carregar();
      sucesso('Conta salva!');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function alternar(c: Conta) {
    await api.patch(`/api/financeiro/contas/${c.id}/ativo`, {});
    carregar();
  }

  function abrirAjuste(c: Conta) {
    setModalAjuste(c);
    setFormAjuste({ tipo: 'entrada', valor: '', novoSaldo: String(c.saldoAtual), observacao: '' });
  }
  async function salvarAjuste() {
    if (!modalAjuste) return;
    try {
      await api.post(`/api/financeiro/contas/${modalAjuste.id}/ajuste`, {
        tipo: formAjuste.tipo,
        valor: formAjuste.tipo !== 'ajuste' ? parseFloat(formAjuste.valor) || 0 : null,
        novoSaldo: parseFloat(formAjuste.novoSaldo) || 0,
        observacao: formAjuste.observacao || null,
      });
      setModalAjuste(null);
      carregar();
      sucesso('Saldo ajustado!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function salvarTransferencia() {
    if (!formTransf.contaOrigemId || !formTransf.contaDestinoId) { erro('Escolha as duas contas.'); return; }
    if (formTransf.contaOrigemId === formTransf.contaDestinoId) { erro('Escolha contas diferentes.'); return; }
    if (!formTransf.valor || parseFloat(formTransf.valor) <= 0) { erro('Informe um valor válido.'); return; }
    try {
      await api.post('/api/financeiro/contas/transferencia', {
        contaOrigemId: formTransf.contaOrigemId,
        contaDestinoId: formTransf.contaDestinoId,
        valor: parseFloat(formTransf.valor),
        registrar: formTransf.registrar,
        observacao: formTransf.observacao || null,
      });
      setModalTransferencia(false);
      setFormTransf(TRANSF_VAZIA);
      carregar();
      sucesso('Transferência realizada!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const ativas = contas.filter(c => c.ativa);
  const totalPaginas = Math.max(1, Math.ceil(contas.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = contas.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);
  const corSaldo = (v: number) => v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-1)';

  return (
    <div className="page fin-page">
      <div className="contas-acoes">
        <button className="btn-primary" onClick={abrirNova}><Plus size={15} /> Nova conta</button>
        <button className="btn-secondary" disabled={ativas.length < 2} title={ativas.length < 2 ? 'É preciso ter pelo menos 2 contas ativas' : undefined}
          onClick={() => setModalTransferencia(true)}>
          <Repeat size={14} /> Transferência entre contas
        </button>
      </div>

      {mostrarForm && (
        <div className="card contas-form">
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando ? 'Editar conta' : 'Nova conta'}</p>
          <div className="contas-form-grid">
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Conta corrente" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Saldo inicial</label>
              <input type="number" step={0.01} value={form.saldoInicial} onChange={e => setForm(f => ({ ...f, saldoInicial: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Limite (cheque especial) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
              <input type="number" min={0} step={0.01} value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Banco</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <button type="button" onClick={() => setForm(f => ({ ...f, banco: '' }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: form.banco === '' ? 'var(--accent-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}>
                Nenhum / não informar
              </button>
              {BANCOS.map(b => (
                <button key={b.id} type="button" onClick={() => setForm(f => ({ ...f, banco: b.id }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: form.banco === b.id ? 'var(--accent-bg)' : 'transparent', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}>
                  <BankBadge bancoId={b.id} tamanho={18} />
                  {b.nome}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" onClick={salvar}>{editando ? 'Salvar' : 'Adicionar conta'}</button>
            <button className="btn-secondary" onClick={fecharForm}>Cancelar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
      ) : contas.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '40px 0' }}><p>Nenhuma conta cadastrada.</p></div></div>
      ) : (
        <>
          <div className="contas-lista">
            {visiveis.map(c => {
              const usado = Math.abs(Math.min(0, c.saldoAtual));
              const disponivel = Math.max(0, c.limite - usado);
              return (
                <div key={c.id} className="card conta-card" style={{ opacity: c.ativa ? 1 : 0.55 }}>
                  <div className="conta-card-info">
                    <BankBadge bancoId={c.banco} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {c.nome} {!c.ativa && <span className="conta-tag-inativa">Inativa</span>}
                      </div>
                      {c.limite > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          Cheque especial: {fmt(disponivel)} / {fmt(c.limite)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="conta-card-saldo">
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Saldo atual</div>
                    <strong style={{ fontSize: 18, color: corSaldo(c.saldoAtual) }}>{fmt(c.saldoAtual)}</strong>
                  </div>
                  <div className="conta-card-acoes">
                    <button className="btn-ghost" onClick={() => abrirAjuste(c)}><Settings size={14} /> Ajustar saldo</button>
                    <button className="btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    <button className="btn-ghost" onClick={() => alternar(c)}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
                  </div>
                </div>
              );
            })}
          </div>
          <Paginacao
            paginaAtual={paginaSegura}
            totalItens={contas.length}
            porPagina={porPagina}
            onMudarPagina={setPagina}
            onMudarPorPagina={setPorPagina}
          />
        </>
      )}

      {/* Ajuste de saldo */}
      {modalAjuste && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAjuste(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Ajustar saldo — {modalAjuste.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalAjuste(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>Saldo atual: <strong style={{ color: 'var(--text-1)' }}>{fmt(modalAjuste.saldoAtual)}</strong></p>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Tipo de ajuste</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: 'entrada', t: 'Entrada' },
                    { v: 'saida', t: 'Saída' },
                    { v: 'ajuste', t: 'Definir saldo' },
                  ].map(op => (
                    <button key={op.v} type="button"
                      className={op.v === formAjuste.tipo ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                      onClick={() => setFormAjuste(f => ({ ...f, tipo: op.v as any }))}>
                      {op.t}
                    </button>
                  ))}
                </div>
              </div>
              {formAjuste.tipo === 'ajuste' ? (
                <div className="form-group">
                  <label className="form-label">Novo saldo (R$)</label>
                  <input type="number" step={0.01} value={formAjuste.novoSaldo} onChange={e => setFormAjuste(f => ({ ...f, novoSaldo: e.target.value }))} />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input type="number" min={0} step={0.01} value={formAjuste.valor} onChange={e => setFormAjuste(f => ({ ...f, valor: e.target.value }))} />
                </div>
              )}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Observação</label>
                <input value={formAjuste.observacao} onChange={e => setFormAjuste(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: Conferência de extrato" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAjuste(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarAjuste}>Salvar ajuste</button>
            </div>
          </div>
        </div>
      )}

      {/* Transferência entre contas */}
      {modalTransferencia && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalTransferencia(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Transferir entre contas</h2>
              <button className="btn-ghost" onClick={() => setModalTransferencia(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">De</label>
                  <select value={formTransf.contaOrigemId} onChange={e => setFormTransf(f => ({ ...f, contaOrigemId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {ativas.map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(c.saldoAtual)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Para</label>
                  <select value={formTransf.contaDestinoId} onChange={e => setFormTransf(f => ({ ...f, contaDestinoId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {ativas.filter(c => c.id !== formTransf.contaOrigemId).map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(c.saldoAtual)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input type="number" min={0.01} step={0.01} value={formTransf.valor} onChange={e => setFormTransf(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formTransf.registrar} style={{ width: 16, height: 16, margin: 0 }}
                    onChange={e => setFormTransf(f => ({ ...f, registrar: e.target.checked }))} />
                  Registrar esta transferência (fica visível no histórico das contas)
                </label>
                {formTransf.registrar && (
                  <div className="form-group">
                    <label className="form-label">Observação <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input value={formTransf.observacao} onChange={e => setFormTransf(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: repasse mensal" />
                  </div>
                )}
                {!formTransf.registrar && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Sem registro: os saldos mudam, mas não fica nenhum rastro no histórico de ajustes.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalTransferencia(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarTransferencia}>Transferir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
