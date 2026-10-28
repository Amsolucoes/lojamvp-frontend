import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Users, X, Phone, Mail, MapPin, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Cliente } from '../../types';
import { api } from '../../services/api';
import './Clientes.css';
import { Paginacao } from '@/components/Paginacao';
import { contemTexto } from '../../utils/texto';

type FormData = Omit<Cliente, 'id' | 'criadoEm'>;
const EMPTY: FormData = { nome: '', telefone: '', cpf: '', email: '', endereco: '', observacoes: '', dataNascimento: undefined };

function fmtTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return v;
}

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

interface OrdemServicoCliente {
  id: string;
  veiculoDescricao: string | null;
  placa: string | null;
  status: string;
  valorTotal: number;
  criadoEm: string;
  concluidoEm: string | null;
  itens: { descricao: string; quantidade: number; valorTotal: number }[];
}
const OS_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado',
};
const OS_STATUS_BADGE: Record<string, string> = {
  pendente: 'badge-accent', em_andamento: 'badge-yellow', concluido: 'badge-green', cancelado: 'badge-red',
};

export function Clientes() {
  const { clientes, vendas, trocas, soServicos, addCliente, updateCliente, deleteCliente, temCorretora, temTurmas, temProdutos, temServicos: temServicosCtx } = useApp();
  const ehAluno = temTurmas && !temProdutos && !temServicosCtx;
  const label = ehAluno ? 'aluno' : 'cliente';
  const labelCap = ehAluno ? 'Aluno' : 'Cliente';
  const labelPlural = ehAluno ? 'Alunos' : 'Clientes';
  const [busca, setBusca]    = useState('');
  const [modal, setModal]    = useState<'novo' | 'editar' | 'ver' | null>(null);
  const [editId, setEditId]  = useState<string | null>(null);
  const [form, setForm]      = useState<FormData>(EMPTY);
  const [confirmDel, setDel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [servicosCliente, setServicosCliente] = useState<any[]>([]);
  const [ordensServicoCliente, setOrdensServicoCliente] = useState<OrdemServicoCliente[]>([]);
  const [resumoServicos, setResumoServicos] = useState<Record<string, { qtd: number; total: number }>>({});
  const [resumoOS, setResumoOS] = useState<Record<string, { qtd: number; total: number; temAndamento: boolean }>>({});
  const [temServicos, setTemServicos] = useState(false);
  const [assinantesIds, setAssinantesIds] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(12);

  type ColunaOrdem = 'nome' | 'credito' | 'compras' | 'gasto' | 'ultima';
  const [ordem, setOrdem] = useState<{ col: ColunaOrdem; dir: 1 | -1 }>({ col: 'nome', dir: 1 });
  function ordenarPor(col: ColunaOrdem) {
    setOrdem(o => o.col === col ? { col, dir: (o.dir * -1) as 1 | -1 } : { col, dir: col === 'nome' ? 1 : -1 });
  }

  // Resumo de compras por cliente, calculado uma vez (evita varrer as vendas a cada linha)
  const resumoVendas = useMemo(() => {
    const mapa: Record<string, { qtd: number; total: number; ultima: any }> = {};
    for (const v of vendas) {
      if (!v.clienteId) continue;
      const r = mapa[v.clienteId] ?? (mapa[v.clienteId] = { qtd: 0, total: 0, ultima: null });
      r.qtd++; r.total += v.totalFinal;
      if (!r.ultima || new Date(v.criadaEm).getTime() > new Date(r.ultima.criadaEm).getTime()) r.ultima = v;
    }
    return mapa;
  }, [vendas]);

  const filtrados = clientes.filter(c =>
    contemTexto(c.nome, busca) ||
    c.telefone.includes(busca) ||
    (c.cpf?.includes(busca) ?? false)
  );
  const lista = [...filtrados].sort((a, b) => {
    const valor = (c: Cliente) => {
      const r = resumoVendas[c.id];
      switch (ordem.col) {
        case 'credito': return c.creditoLoja ?? 0;
        case 'compras': return r?.qtd ?? 0;
        case 'gasto':   return r?.total ?? 0;
        case 'ultima':  return r?.ultima ? new Date(r.ultima.criadaEm).getTime() : 0;
        default:        return c.nome;
      }
    };
    const va = valor(a), vb = valor(b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number);
    return cmp * ordem.dir || a.nome.localeCompare(b.nome, 'pt-BR');
  });

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  useEffect(() => { setPagina(1); }, [busca, porPagina]);

  function abrirNovo() { setForm(EMPTY); setEditId(null); setModal('novo'); }

  function abrirEditar(c: Cliente) {
    setForm({ 
      nome: c.nome, telefone: c.telefone, cpf: c.cpf ?? '', 
      email: c.email ?? '', endereco: c.endereco ?? '', 
      observacoes: c.observacoes ?? '', 
      dataNascimento: c.dataNascimento ? c.dataNascimento.split('T')[0] : undefined 
    });
    setEditId(c.id);
    setModal('editar');
  }

  function abrirVer(c: Cliente) {
    setForm({ 
      nome: c.nome, telefone: c.telefone, cpf: c.cpf ?? '', 
      email: c.email ?? '', endereco: c.endereco ?? '', 
      observacoes: c.observacoes ?? '', 
      dataNascimento: c.dataNascimento ? c.dataNascimento.split('T')[0] : undefined 
    });
    setEditId(c.id);
    setModal('ver');
    setServicosCliente([]);
    api.get<any[]>(`/api/agendamentos/cliente/${c.id}`)
      .then(res => setServicosCliente(res.filter(s => s.status !== 'cancelado')))
      .catch(() => setServicosCliente([]));
    setOrdensServicoCliente([]);
    api.get<OrdemServicoCliente[]>(`/api/ordemservico/orcamentos/cliente/${c.id}`)
      .then(setOrdensServicoCliente)
      .catch(() => setOrdensServicoCliente([]));
  }

  async function salvar() {
    if (!form.nome.trim() || !form.telefone.trim()) return;
    try {
      if (modal === 'novo') await addCliente(form);
      else if (editId) await updateCliente(editId, form);
      setModal(null);
      setToast(modal === 'novo' ? `${labelCap} cadastrado!` : `${labelCap} atualizado!`);
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(`Erro ao salvar ${label}`);
      setTimeout(() => setToast(null), 2500);
    }
  }

  function totalGasto(clienteId: string) { return resumoVendas[clienteId]?.total ?? 0; }
  function qtdCompras(clienteId: string) { return resumoVendas[clienteId]?.qtd ?? 0; }
  function ultimaCompra(clienteId: string) { return resumoVendas[clienteId]?.ultima ?? null; }

  function qtdServicos(clienteId: string) {
    return resumoServicos[clienteId]?.qtd ?? 0;
  }
  function totalServicos(clienteId: string) {
    return resumoServicos[clienteId]?.total ?? 0;
  }
  function qtdOS(clienteId: string) {
    return resumoOS[clienteId]?.qtd ?? 0;
  }
  function totalOS(clienteId: string) {
    return resumoOS[clienteId]?.total ?? 0;
  }
  function osTemAndamento(clienteId: string) {
    return resumoOS[clienteId]?.temAndamento ?? false;
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const clienteAtivo = editId ? clientes.find(c => c.id === editId) : null;

  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  useEffect(() => {
    api.get<any[]>('/api/agendamentos/resumo-clientes')
      .then(res => {
        const mapa: Record<string, { qtd: number; total: number }> = {};
        res.forEach(r => { mapa[r.clienteId] = { qtd: r.qtd, total: r.total }; });
        setResumoServicos(mapa);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<any[]>('/api/ordemservico/resumo-clientes')
      .then(res => {
        const mapa: Record<string, { qtd: number; total: number; temAndamento: boolean }> = {};
        res.forEach(r => { mapa[r.clienteId] = { qtd: r.qtd, total: r.total, temAndamento: r.temAndamento }; });
        setResumoOS(mapa);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<any>('/api/loja/situacao')
      .then(res => setTemServicos(Array.isArray(res?.modulosAtivos) && res.modulosAtivos.includes('servicos')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<any[]>('/api/planos/assinantes')
      .then(res => setAssinantesIds(new Set(res.map(a => a.clienteId))))
      .catch(() => {});
  }, []);

  const mostrarCompras = !soServicos && !temCorretora;
  const temOS = Object.keys(resumoOS).length > 0;
  const iconeOrdem = (col: ColunaOrdem) => ordem.col !== col ? null
    : ordem.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{labelPlural}</h1>
          <p className="page-subtitle">{clientes.length} {label}(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo {label}
        </button>
      </div>

      {/* Resumo da base */}
      {clientes.length > 0 && (() => {
        const agora = new Date();
        const novosNoMes = clientes.filter(c => { const d = new Date(c.criadoEm); return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear(); }).length;
        const comCredito = clientes.filter(c => (c.creditoLoja ?? 0) > 0);
        const totalCredito = comCredito.reduce((t, c) => t + (c.creditoLoja ?? 0), 0);
        const aniversariantes = clientes.filter(c => c.dataNascimento && new Date(c.dataNascimento).getUTCMonth() === agora.getMonth()).length;
        return (
          <div className="dash-stats" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-label">{labelPlural}</div><div className="stat-value">{clientes.length}</div><div className="stat-sub">{novosNoMes} novo(s) neste mês</div></div>
            <div className="stat-card"><div className="stat-label">Aniversariantes</div><div className="stat-value">{aniversariantes}</div><div className="stat-sub">neste mês</div></div>
            <div className="stat-card"><div className="stat-label">Crédito na loja</div><div className="stat-value">{fmt(totalCredito)}</div><div className="stat-sub">{comCredito.length} cliente(s) com saldo</div></div>
          </div>
        );
      })()}

      {/* Busca */}
      <div className="cli-filters">
        <div className="search-wrap" style={{ maxWidth: 360 }}>
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de cards */}
      {lista.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Users size={36} />
            <p>Nenhum {label} encontrado.</p>
          </div>
        </div>
      ) : (
        <>
        {/* Desktop: tabela */}
        <div className="card cli-tabela-desktop" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><button type="button" className="cli-th-sort" onClick={() => ordenarPor('nome')}>{labelCap}{iconeOrdem('nome')}</button></th>
                <th>Contato</th>
                <th>Aniversário</th>
                <th style={{ textAlign: 'right' }}><button type="button" className="cli-th-sort" onClick={() => ordenarPor('credito')}>Crédito{iconeOrdem('credito')}</button></th>
                {mostrarCompras && <th style={{ textAlign: 'right' }}><button type="button" className="cli-th-sort" onClick={() => ordenarPor('compras')}>Compras{iconeOrdem('compras')}</button></th>}
                {mostrarCompras && <th style={{ textAlign: 'right' }}><button type="button" className="cli-th-sort" onClick={() => ordenarPor('gasto')}>Total gasto{iconeOrdem('gasto')}</button></th>}
                {temServicos && <th style={{ textAlign: 'right' }}>Serviços</th>}
                {temOS && <th style={{ textAlign: 'right' }}>Ordens de serviço</th>}
                {mostrarCompras && <th><button type="button" className="cli-th-sort" onClick={() => ordenarPor('ultima')}>Última compra{iconeOrdem('ultima')}</button></th>}
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {listaPaginada.map(c => {
                const ultima = ultimaCompra(c.id);
                return (
                  <tr key={c.id} className="cli-linha" onClick={() => abrirVer(c)}>
                    <td>
                      <div className="cli-celula-nome">
                        <div className="cli-avatar cli-avatar-sm">{iniciais(c.nome)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cli-nome-tab">{c.nome}{assinantesIds.has(c.id) && <span className="cli-plano-flag">⭐ Plano</span>}</div>
                          {c.cpf && <div className="cli-sub-tab">{c.cpf}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{c.telefone}</div>
                      {c.email && <div className="cli-sub-tab">{c.email}</div>}
                    </td>
                    <td>{c.dataNascimento ? new Date(c.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : <span className="cli-vazio">—</span>}</td>
                    <td style={{ textAlign: 'right', color: (c.creditoLoja ?? 0) > 0 ? 'var(--green)' : undefined, fontWeight: (c.creditoLoja ?? 0) > 0 ? 600 : undefined }}>
                      {(c.creditoLoja ?? 0) > 0 ? fmt(c.creditoLoja ?? 0) : <span className="cli-vazio">—</span>}
                    </td>
                    {mostrarCompras && <td style={{ textAlign: 'right' }}>{qtdCompras(c.id) || <span className="cli-vazio">—</span>}</td>}
                    {mostrarCompras && <td style={{ textAlign: 'right', color: totalGasto(c.id) > 0 ? 'var(--green)' : undefined, fontWeight: 600 }}>{totalGasto(c.id) > 0 ? fmt(totalGasto(c.id)) : <span className="cli-vazio">—</span>}</td>}
                    {temServicos && <td style={{ textAlign: 'right' }}>{qtdServicos(c.id) > 0 ? <><span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(totalServicos(c.id))}</span><div className="cli-sub-tab">{qtdServicos(c.id)} serviço(s)</div></> : <span className="cli-vazio">—</span>}</td>}
                    {temOS && <td style={{ textAlign: 'right' }}>{qtdOS(c.id) > 0 ? <><span style={{ color: osTemAndamento(c.id) ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>{fmt(totalOS(c.id))}</span><div className="cli-sub-tab">{qtdOS(c.id)} ordem(ns){osTemAndamento(c.id) ? ' · em andamento' : ''}</div></> : <span className="cli-vazio">—</span>}</td>}
                    {mostrarCompras && <td>{ultima ? new Date(ultima.criadaEm).toLocaleDateString('pt-BR') : <span className="cli-vazio">—</span>}</td>}
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => abrirEditar(c)} title="Editar"><Edit2 size={13} /></button>
                        <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setDel(c.id)} title="Excluir"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Celular: cards */}
        <div className="cli-grid cli-cards-mobile">
          {listaPaginada.map(c => {
            const compras = qtdCompras(c.id);
            const gasto   = totalGasto(c.id);
            const ultima  = ultimaCompra(c.id);
            return (
              <div key={c.id} className="cli-card" onClick={() => abrirVer(c)}>
                <div className="cli-card-top">
                  <div className="cli-avatar">{iniciais(c.nome)}</div>
                  <div className="cli-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost" onClick={() => abrirEditar(c)} title="Editar"><Edit2 size={13} /></button>
                    <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setDel(c.id)} title="Excluir"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="cli-nome">
                  {c.nome}
                  {assinantesIds.has(c.id) && <span className="cli-plano-flag">⭐ Plano</span>}
                </div>
                <div className="cli-info"><Phone size={12} />{c.telefone}</div>
                {c.email && <div className="cli-info"><Mail size={12} />{c.email}</div>}
                {c.dataNascimento && (
                  <div className="cli-info">
                    🎂 {new Date(c.dataNascimento).toLocaleDateString('pt-BR')}
                  </div>
                )}
                {(c.creditoLoja ?? 0) > 0 && (
                  <div className="cli-info" style={{ color: 'var(--green)', fontWeight: 600 }}>
                    💰 Crédito: {fmt(c.creditoLoja ?? 0)}
                  </div>
                )}
                <div className="cli-divider" />
                <div className="cli-stats">
                  {!soServicos && !temCorretora && (
                    <div>
                      <div className="cli-stat-val" style={{ color: 'var(--green)' }}>{fmt(gasto)}</div>
                      <div className="cli-stat-label">{compras} compra(s)</div>
                    </div>
                  )}
                  {temServicos && (
                    <div>
                      <div className="cli-stat-val" style={{ color: 'var(--green)' }}>{fmt(totalServicos(c.id))}</div>
                      <div className="cli-stat-label">{qtdServicos(c.id)} serviço(s)</div>
                    </div>
                  )}
                </div>
                {qtdOS(c.id) > 0 && (
                  <div className="cli-stats" style={{ marginTop: 10 }}>
                    <div>
                      <div className="cli-stat-val" style={{ color: osTemAndamento(c.id) ? 'var(--yellow)' : 'var(--green)' }}>
                        {fmt(totalOS(c.id))}
                      </div>
                      <div className="cli-stat-label">
                        {qtdOS(c.id)} ordem{qtdOS(c.id) > 1 ? 's' : ''} de serviço{osTemAndamento(c.id) ? ' (em andamento)' : ''}
                      </div>
                    </div>
                  </div>
                )}
                {ultima && !temCorretora && (
                  <div className="cli-ultima">
                    Última compra: {new Date(ultima.criadaEm).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      {lista.length > 0 && (
        <Paginacao
          paginaAtual={paginaSegura}
          totalItens={lista.length}
          porPagina={porPagina}
          onMudarPagina={setPagina}
          onMudarPorPagina={setPorPagina}
          opcoesPorPagina={[12, 24, 48]}
        />
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal === 'novo' ? `Novo ${label}` : `Editar ${label}`}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome completo *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria Silva" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone / WhatsApp *</label>
                  <input
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: fmtTel(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    value={form.cpf}
                    onChange={e => setForm(f => ({ ...f, cpf: fmtCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de nascimento <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="date"
                    value={form.dataNascimento ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value || undefined }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observações</label>
                  <textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Preferências, alergias, anotações..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={!form.nome.trim() || !form.telefone.trim()}>
                {modal === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver cliente */}
      {modal === 'ver' && clienteAtivo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cli-avatar cli-avatar-lg">{iniciais(clienteAtivo.nome)}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{clienteAtivo.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {labelCap} desde {new Date(clienteAtivo.criadoEm).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* Stats */}
              <div className="cli-modal-stats">
                {!soServicos && !temCorretora && (
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-label">Compras</div>
                    <div className="stat-value">{qtdCompras(clienteAtivo.id)}</div>
                  </div>
                )}
                {!soServicos && !temCorretora && (
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-label">Total gasto</div>
                    <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>
                      {fmt(totalGasto(clienteAtivo.id))}
                    </div>
                  </div>
                )}
                {temServicos && (
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-label">Serviços</div>
                    <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>
                      {fmt(totalServicos(clienteAtivo.id))}
                    </div>
                  </div>
                )}
                {(clienteAtivo.creditoLoja ?? 0) > 0 && (
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-label">Crédito na loja</div>
                    <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>
                      {fmt(clienteAtivo.creditoLoja ?? 0)}
                    </div>
                  </div>
                )}
              </div>

              {/* Dados */}
              <div className="cli-detail-list">
                <div className="cli-detail-row"><Phone size={14} /><span>{clienteAtivo.telefone}</span></div>
                {clienteAtivo.email    && <div className="cli-detail-row"><Mail size={14} /><span>{clienteAtivo.email}</span></div>}
                {clienteAtivo.endereco && <div className="cli-detail-row"><MapPin size={14} /><span>{clienteAtivo.endereco}</span></div>}
                {clienteAtivo.cpf      && <div className="cli-detail-row"><FileText size={14} /><span>CPF: {clienteAtivo.cpf}</span></div>}
                {clienteAtivo.dataNascimento && (
                  <div className="cli-detail-row">
                    <span style={{ fontSize: 14 }}>🎂</span>
                    <span>Nascimento: {new Date(clienteAtivo.dataNascimento).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {clienteAtivo.observacoes && (
                  <div className="cli-obs">{clienteAtivo.observacoes}</div>
                )}
              </div>

              {/* Histórico de compras */}
              {!temCorretora && qtdCompras(clienteAtivo.id) > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Histórico de compras
                  </div>
                  {/* Desktop */}
                  <div className="table-wrap cli-hist-desktop">
                    <table>
                      <thead>
                        <tr><th>Data</th><th>Itens</th><th>Pagamento</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {vendas
                          .filter(v => v.clienteId === clienteAtivo.id)
                          .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                          .map(v => (
                            <tr key={v.id}>
                              <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(v.criadaEm).toLocaleDateString('pt-BR')}</td>
                              <td style={{ fontSize: 12 }}>{v.itens.length} item(s)</td>
                              <td><span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>{v.formaPagamento}</span></td>
                              <td style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(v.totalFinal)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="cli-hist-mobile">
                    {vendas
                      .filter(v => v.clienteId === clienteAtivo.id)
                      .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                      .map(v => (
                        <div key={v.id} className="cli-hist-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(v.criadaEm).toLocaleDateString('pt-BR')}</span>
                            <span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(v.totalFinal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{v.itens.length} item(s)</span>
                            <span className={`badge badge-${v.formaPagamento === 'pix' ? 'blue' : v.formaPagamento === 'dinheiro' ? 'green' : 'accent'}`}>{v.formaPagamento}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {/* Histórico de serviços */}
              {servicosCliente.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    ✂️ Histórico de serviços
                  </div>
                  {/* Desktop */}
                  <div className="table-wrap cli-hist-desktop">
                    <table>
                      <thead>
                        <tr><th>Data</th><th>Serviço</th><th>Status</th><th>Valor</th></tr>
                      </thead>
                      <tbody>
                        {servicosCliente.map(s => (
                          <tr key={s.id}>
                            <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(s.dataHora).toLocaleDateString('pt-BR')}</td>
                            <td style={{ fontSize: 12 }}>{s.nomeServico}</td>
                            <td>
                              {s.status === 'concluido'
                                ? <span className="badge badge-green">Concluído</span>
                                : <span className="badge badge-blue">Agendado</span>}
                            </td>
                            <td style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(s.preco)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="cli-hist-mobile">
                    {servicosCliente.map(s => (
                      <div key={s.id} className="cli-hist-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(s.dataHora).toLocaleDateString('pt-BR')}</span>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(s.preco)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.nomeServico}</span>
                          {s.status === 'concluido'
                            ? <span className="badge badge-green">Concluído</span>
                            : <span className="badge badge-blue">Agendado</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Histórico de ordens de serviço */}
              {ordensServicoCliente.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    🔧 Histórico de ordens de serviço
                  </div>
                  {/* Desktop */}
                  <div className="table-wrap cli-hist-desktop">
                    <table>
                      <thead>
                        <tr><th>Data</th><th>Veículo</th><th>Itens</th><th>Status</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {ordensServicoCliente.map(o => (
                          <tr key={o.id}>
                            <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                              {new Date(o.concluidoEm ?? o.criadoEm).toLocaleDateString('pt-BR')}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {o.veiculoDescricao ?? '—'}{o.placa ? ` · ${o.placa}` : ''}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                              {o.itens.map((i, idx) => (
                                <div key={idx}>{i.descricao} ×{i.quantidade}</div>
                              ))}
                            </td>
                            <td><span className={`badge ${OS_STATUS_BADGE[o.status] ?? 'badge-accent'}`}>{OS_STATUS_LABEL[o.status] ?? o.status}</span></td>
                            <td style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(o.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="cli-hist-mobile">
                    {ordensServicoCliente.map(o => (
                      <div key={o.id} className="cli-hist-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {new Date(o.concluidoEm ?? o.criadoEm).toLocaleDateString('pt-BR')}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(o.valorTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            {o.veiculoDescricao ?? '—'}{o.placa ? ` · ${o.placa}` : ''}
                          </span>
                          <span className={`badge ${OS_STATUS_BADGE[o.status] ?? 'badge-accent'}`}>{OS_STATUS_LABEL[o.status] ?? o.status}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
                          {o.itens.map((i, idx) => (
                            <div key={idx}>{i.descricao} ×{i.quantidade}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Histórico de trocas */}
              {(trocas ?? []).filter(t => t.clienteId === clienteAtivo.id).length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                  🔄 Histórico de trocas
                </div>
                {/* Desktop */}
                <div className="table-wrap cli-hist-desktop">
                  <table>
                    <thead>
                      <tr><th>Data</th><th>Devolvido</th><th>Novo</th><th>Resultado</th></tr>
                    </thead>
                    <tbody>
                      {(trocas ?? [])
                        .filter(t => t.clienteId === clienteAtivo.id)
                        .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                        .map(t => (
                          <tr key={t.id}>
                            <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(t.criadaEm).toLocaleDateString('pt-BR')}</td>
                            <td style={{ fontSize: 12 }}>{fmt(t.totalDevolvido)}</td>
                            <td style={{ fontSize: 12 }}>{fmt(t.totalNovo)}</td>
                            <td style={{ fontSize: 12, fontWeight: 500 }}>
                              {t.diferenca > 0 ? <span style={{ color: 'var(--red)' }}>Pagou {fmt(t.diferenca)}</span>
                                : t.diferenca < 0 ? <span style={{ color: 'var(--green)' }}>+{fmt(t.creditoGerado)} crédito</span>
                                : <span style={{ color: 'var(--text-3)' }}>Sem diferença</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile */}
                <div className="cli-hist-mobile">
                  {(trocas ?? [])
                    .filter(t => t.clienteId === clienteAtivo.id)
                    .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime())
                    .map(t => (
                      <div key={t.id} className="cli-hist-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(t.criadaEm).toLocaleDateString('pt-BR')}</span>
                          {t.diferenca > 0 ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Pagou {fmt(t.diferenca)}</span>
                            : t.diferenca < 0 ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{fmt(t.creditoGerado)}</span>
                            : <span style={{ color: 'var(--text-3)' }}>Sem dif.</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                          Devolvido {fmt(t.totalDevolvido)} → Novo {fmt(t.totalNovo)}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => abrirEditar(clienteAtivo)}>Editar dados</button>
              <button className="btn-primary" onClick={() => setModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir {label}</h2>
              <button className="btn-ghost" onClick={() => setDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>
                  {clientes.find(c => c.id === confirmDel)?.nome}
                </strong>? O histórico será mantido.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteCliente(confirmDel); setDel(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-2)', border: '1px solid var(--accent-border)',
          color: 'var(--text-1)', padding: '12px 24px', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)', zIndex: 200, fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--green)' }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}
