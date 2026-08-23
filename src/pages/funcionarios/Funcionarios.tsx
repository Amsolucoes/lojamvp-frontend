import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Users, Edit2, Percent } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatarTelefone, formatarCep, buscarEnderecoPorCep } from '../../utils/mascaras';

interface Servico {
  id: string;
  nome: string;
}

interface ComissaoServico {
  id: string;
  servicoId: string;
  comissaoPercentual: number;
}

interface Profissional {
  id: string;
  nome: string;
  ativo: boolean;
  comissaoPadraoPercentual: number | null;
  diaPagamentoPadrao: number | null;
  tipoRemuneracao: string; // comissao | salario_fixo
  salarioFixo: number | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  comissaoBaseCalculo: string; // total | servico — base de cálculo da comissão em Ordem de Serviço
  comissoesPorServico: ComissaoServico[];
}

interface Conta {
  id: string;
  nome: string;
}

export function Funcionarios() {
  const { sucesso, erro } = useToast();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '', comissaoPadraoPercentual: '', ativo: true, diaPagamentoPadrao: '',
    tipoRemuneracao: 'comissao' as 'comissao' | 'salario_fixo',
    salarioFixo: '', contaBancariaId: '',
    telefone: '', cep: '', endereco: '',
    comissaoBaseCalculo: 'total' as 'total' | 'servico',
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalComissoes, setModalComissoes] = useState<Profissional | null>(null);
  const [novaComissaoServicoId, setNovaComissaoServicoId] = useState('');
  const [novaComissaoValor, setNovaComissaoValor] = useState('');

  const [confirmDel, setConfirmDel] = useState<Profissional | null>(null);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [paginaLista, setPaginaLista] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(15);

  function carregar() {
    setLoading(true);
    api.get<Profissional[]>('/api/funcionarios').then(setProfissionais).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    carregar();
    api.get<Servico[]>('/api/servicos').then(setServicos).catch(() => {});
    api.get<Conta[]>('/api/financeiro/contas').then(setContas).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener('pullToRefresh', carregar);
    return () => window.removeEventListener('pullToRefresh', carregar);
  }, []);

  useEffect(() => { setPaginaLista(1); }, [busca, statusFiltro, itensPorPagina]);

  async function handleCepChange(valor: string) {
    const formatado = formatarCep(valor);
    setForm(f => ({ ...f, cep: formatado }));
    const digitos = formatado.replace(/\D/g, '');
    if (digitos.length === 8) {
      setBuscandoCep(true);
      const resultado = await buscarEnderecoPorCep(formatado);
      if (resultado) setForm(f => ({ ...f, endereco: resultado.slice(0, 200) }));
      setBuscandoCep(false);
    }
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm({
      nome: '', comissaoPadraoPercentual: '', ativo: true, diaPagamentoPadrao: '',
      tipoRemuneracao: 'comissao', salarioFixo: '', contaBancariaId: '',
      telefone: '', cep: '', endereco: '',
      comissaoBaseCalculo: 'total',
    });
    setModal('novo');
  }

  function abrirEditar(p: Profissional) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      comissaoPadraoPercentual: p.comissaoPadraoPercentual != null ? String(p.comissaoPadraoPercentual) : '',
      ativo: p.ativo,
      diaPagamentoPadrao: p.diaPagamentoPadrao != null ? String(p.diaPagamentoPadrao) : '',
      tipoRemuneracao: (p.tipoRemuneracao as 'comissao' | 'salario_fixo') ?? 'comissao',
      salarioFixo: p.salarioFixo != null ? String(p.salarioFixo) : '',
      contaBancariaId: '',
      telefone: p.telefone ?? '',
      cep: p.cep ?? '',
      endereco: p.endereco ?? '',
      comissaoBaseCalculo: (p.comissaoBaseCalculo as 'total' | 'servico') ?? 'total',
    });
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim()) { erro('Preencha o nome.'); return; }
    if (form.tipoRemuneracao === 'salario_fixo' && !form.salarioFixo) {
      erro('Informe o valor do salário fixo.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        comissaoPadraoPercentual: form.comissaoPadraoPercentual ? parseFloat(form.comissaoPadraoPercentual) : null,
        ativo: form.ativo,
        diaPagamentoPadrao: form.diaPagamentoPadrao ? parseInt(form.diaPagamentoPadrao) : null,
        tipoRemuneracao: form.tipoRemuneracao,
        salarioFixo: form.tipoRemuneracao === 'salario_fixo' && form.salarioFixo ? parseFloat(form.salarioFixo) : null,
        contaBancariaId: form.tipoRemuneracao === 'salario_fixo' && form.contaBancariaId ? form.contaBancariaId : null,
        telefone: form.telefone || null,
        cep: form.cep || null,
        endereco: form.endereco || null,
        comissaoBaseCalculo: form.comissaoBaseCalculo,
      };
      if (modal === 'novo') await api.post('/api/funcionarios', payload);
      else await api.put(`/api/funcionarios/${editandoId}`, payload);
      await carregar();
      setModal(null);
      sucesso('Funcionário salvo!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function alternarAtivo(p: Profissional) {
    try {
      await api.patch(`/api/funcionarios/${p.id}/ativo`, {});
      carregar();
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      const res = await api.delete<any>(`/api/funcionarios/${confirmDel.id}`);
      setConfirmDel(null);
      carregar();
      sucesso(res?.mensagem ?? 'Removido.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function abrirComissoes(p: Profissional) {
    setModalComissoes(p);
    setNovaComissaoServicoId('');
    setNovaComissaoValor('');
  }

  async function adicionarComissaoServico() {
    if (!modalComissoes || !novaComissaoServicoId || !novaComissaoValor) {
      erro('Escolha o serviço e informe o percentual.');
      return;
    }
    try {
      await api.post(`/api/funcionarios/${modalComissoes.id}/comissoes-servico`, {
        servicoId: novaComissaoServicoId,
        comissaoPercentual: parseFloat(novaComissaoValor),
      });
      const atualizados = await api.get<Profissional[]>('/api/funcionarios');
      setProfissionais(atualizados);
      const atualizado = atualizados.find(p => p.id === modalComissoes.id);
      if (atualizado) setModalComissoes(atualizado);
      setNovaComissaoServicoId('');
      setNovaComissaoValor('');
      sucesso('Comissão do serviço definida!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  async function removerComissaoServico(comissaoId: string) {
    if (!modalComissoes) return;
    try {
      await api.delete(`/api/funcionarios/comissoes-servico/${comissaoId}`);
      const atualizados = await api.get<Profissional[]>('/api/funcionarios');
      setProfissionais(atualizados);
      const atualizado = atualizados.find(p => p.id === modalComissoes.id);
      if (atualizado) setModalComissoes(atualizado);
      sucesso('Exceção removida.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  function nomeServico(servicoId: string) {
    return servicos.find(s => s.id === servicoId)?.nome ?? '—';
  }

  const profissionaisFiltrados = profissionais.filter(p => {
    const passaBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase());
    const passaStatus = statusFiltro === 'todos' ? true : statusFiltro === 'ativo' ? p.ativo : !p.ativo;
    return passaBusca && passaStatus;
  });
  const totalPaginas = Math.max(1, Math.ceil(profissionaisFiltrados.length / itensPorPagina));
  const paginaAtual = Math.min(paginaLista, totalPaginas);
  const inicioSlice = (paginaAtual - 1) * itensPorPagina;
  const profissionaisPaginados = profissionaisFiltrados.slice(inicioSlice, inicioSlice + itensPorPagina);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="page-subtitle">Cadastro de profissionais e comissões</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo funcionário
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar por nome..." value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as any)} style={{ width: 'auto', minWidth: 130 }}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Só ativos</option>
          <option value="inativo">Só inativos</option>
        </select>
        {(busca || statusFiltro !== 'todos') && (
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setBusca(''); setStatusFiltro('todos'); }}>
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="card"><div className="empty"><div className="spinner" /></div></div>
      ) : profissionais.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Users size={36} />
            <p>Nenhum funcionário cadastrado ainda.</p>
            <button className="btn-primary" onClick={abrirNovo} style={{ marginTop: 12 }}>Cadastrar primeiro funcionário</button>
          </div>
        </div>
      ) : profissionaisFiltrados.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Users size={36} />
            <p>Nenhum funcionário encontrado com esse filtro.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profissionaisPaginados.map(p => (
            <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.nome}
                    {!p.ativo && <span className="badge badge-accent" style={{ fontSize: 10 }}>Inativo</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                    {p.tipoRemuneracao === 'salario_fixo'
                      ? <>Salário fixo: <strong style={{ color: 'var(--text-1)' }}>{p.salarioFixo != null ? p.salarioFixo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'não definido'}</strong></>
                      : <>Comissão padrão: {p.comissaoPadraoPercentual != null ? `${p.comissaoPadraoPercentual}%` : 'não definida'}</>}
                    <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>
                      · Ordem de Serviço: {p.comissaoBaseCalculo === 'servico' ? 'só mão de obra' : 'peça + serviço'}
                    </span>
                  </div>
                  {p.tipoRemuneracao !== 'salario_fixo' && p.comissoesPorServico.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {p.comissoesPorServico.map(c => (
                        <span key={c.id} className="badge badge-accent" style={{ fontSize: 11 }}>
                          {nomeServico(c.servicoId)}: {c.comissaoPercentual}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.tipoRemuneracao !== 'salario_fixo' && (
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => abrirComissoes(p)}>
                      <Percent size={13} /> Comissões
                    </button>
                  )}
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(p)}><Edit2 size={14} /></button>
                  <button className="btn-ghost" title={p.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternarAtivo(p)}>
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => setConfirmDel(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && profissionaisFiltrados.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <select value={itensPorPagina} onChange={e => setItensPorPagina(parseInt(e.target.value))} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}>
            <option value={15}>15 por página</option>
            <option value={30}>30 por página</option>
            <option value={50}>50 por página</option>
          </select>
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-secondary" disabled={paginaAtual <= 1} onClick={() => setPaginaLista(p => Math.max(1, p - 1))} style={{ padding: '4px 10px' }}>Anterior</button>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{paginaAtual} / {totalPaginas}</span>
              <button className="btn-secondary" disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaLista(p => Math.min(totalPaginas, p + 1))} style={{ padding: '4px 10px' }}>Próxima</button>
            </div>
          )}
        </div>
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'novo' ? 'Novo funcionário' : 'Editar funcionário'}</h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: João Silva" autoFocus />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefone <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))} placeholder="(00) 00000-0000" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">CEP <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input value={form.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Endereço {buscandoCep && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(buscando...)</span>}</label>
                    <input value={form.endereco} maxLength={200}
                      onChange={e => setForm(f => ({ ...f, endereco: e.target.value.slice(0, 200) }))} placeholder="Rua, bairro, cidade - UF" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de remuneração</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className={form.tipoRemuneracao === 'comissao' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                      onClick={() => setForm(f => ({ ...f, tipoRemuneracao: 'comissao' }))}>
                      Comissão
                    </button>
                    <button type="button" className={form.tipoRemuneracao === 'salario_fixo' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                      onClick={() => setForm(f => ({ ...f, tipoRemuneracao: 'salario_fixo' }))}>
                      Salário fixo
                    </button>
                  </div>
                </div>

                {form.tipoRemuneracao === 'comissao' ? (
                  <div className="form-group">
                    <label className="form-label">Comissão padrão (%) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                    <input type="number" min={0} max={100} step={0.1} value={form.comissaoPadraoPercentual}
                      onChange={e => setForm(f => ({ ...f, comissaoPadraoPercentual: e.target.value }))} placeholder="Ex: 40" />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      Aplicada a todos os serviços, exceto onde houver uma comissão específica cadastrada.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Valor do salário (R$) *</label>
                      <input type="number" min={0} step={0.01} value={form.salarioFixo}
                        onChange={e => setForm(f => ({ ...f, salarioFixo: e.target.value }))} placeholder="Ex: 1500" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Conta bancária <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                      <select value={form.contaBancariaId} onChange={e => setForm(f => ({ ...f, contaBancariaId: e.target.value }))}>
                        <option value="">Não lançar no Financeiro</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        Se escolher uma conta, o salário vira um lançamento fixo automático em Contas a Pagar.
                      </p>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Dia de pagamento padrão <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="number" min={1} max={28} value={form.diaPagamentoPadrao}
                    onChange={e => setForm(f => ({ ...f, diaPagamentoPadrao: e.target.value }))} placeholder="Ex: 5" />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {form.tipoRemuneracao === 'comissao'
                      ? 'Usado como sugestão de vencimento ao fechar a comissão desse profissional.'
                      : 'Dia do vencimento do lançamento fixo do salário no Financeiro.'}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Comissão em Ordem de Serviço incide sobre</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className={form.comissaoBaseCalculo === 'total' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                      onClick={() => setForm(f => ({ ...f, comissaoBaseCalculo: 'total' }))}>
                      Peça + Serviço
                    </button>
                    <button type="button" className={form.comissaoBaseCalculo === 'servico' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                      onClick={() => setForm(f => ({ ...f, comissaoBaseCalculo: 'servico' }))}>
                      Só Serviço (mão de obra)
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Vale só pra comissão gerada em Ordem de Serviço — comissão de Agendamento já é sempre sobre o preço do serviço.
                  </p>
                </div>
                {modal === 'editar' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.ativo} style={{ width: 16, height: 16, margin: 0 }}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    <span>Funcionário ativo</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : modal === 'novo' ? 'Criar funcionário' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal comissões por serviço */}
      {modalComissoes && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalComissoes(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Comissões — {modalComissoes.nome}</h2>
              <button className="btn-ghost" onClick={() => setModalComissoes(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Comissão padrão: <strong>{modalComissoes.comissaoPadraoPercentual != null ? `${modalComissoes.comissaoPadraoPercentual}%` : 'não definida'}</strong>.
                Cadastre abaixo exceções por serviço específico.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {modalComissoes.comissoesPorServico.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Nenhuma exceção cadastrada — usa sempre a comissão padrão.</p>
                ) : modalComissoes.comissoesPorServico.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>{nomeServico(c.servicoId)} — <strong>{c.comissaoPercentual}%</strong></span>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removerComissaoServico(c.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Nova exceção</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={novaComissaoServicoId} onChange={e => setNovaComissaoServicoId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Selecione o serviço...</option>
                    {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <input type="number" min={0} max={100} step={0.1} value={novaComissaoValor}
                    onChange={e => setNovaComissaoValor(e.target.value)} placeholder="%" style={{ width: 90 }} />
                  <button className="btn-primary" onClick={adicionarComissaoServico}>Adicionar</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalComissoes(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir funcionário</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Excluir <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nome}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                Se ele já tiver atendimentos ou comissões vinculadas, será apenas desativado em vez de excluído.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={excluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}