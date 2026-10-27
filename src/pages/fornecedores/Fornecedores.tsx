import { useState } from 'react';
import { Plus, X, Trash2, Truck, Edit2, Phone, Mail, MapPin, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Fornecedor } from '../../types';
import { useToast } from '../../context/ToastContext';
import { formatarTelefone, formatarCep, buscarCepDetalhado } from '../../utils/mascaras';
import { contemTexto } from '../../utils/texto';
import './Fornecedores.css';
import { Paginacao } from '@/components/Paginacao';

function formatarCnpjCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ: 00.000.000/0000-00
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

type FormData = Omit<Fornecedor, 'id' | 'criadoEm' | 'qtdProdutos'>;
const EMPTY: FormData = { nome: '', cnpjCpf: '', telefone: '', email: '', endereco: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', observacoes: '', ativo: true };

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// Endereço em uma linha (usa os campos separados; cai no texto antigo se o cadastro for anterior)
function enderecoCompleto(f: Fornecedor) {
  const temDetalhe = f.rua || f.numero || f.bairro || f.cidade || f.uf;
  if (!temDetalhe) return f.endereco ?? '';
  const ruaNum = [f.rua, f.numero].filter(Boolean).join(', ');
  const cidadeUf = [f.cidade, f.uf].filter(Boolean).join('/');
  return [ruaNum, f.bairro, cidadeUf].filter(Boolean).join(' - ');
}

export function Fornecedores() {
  const { fornecedores, addFornecedor, updateFornecedor, deleteFornecedor } = useApp();
  const { sucesso, erro } = useToast();

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Fornecedor | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(15);

  const [ordem, setOrdem] = useState<{ col: 'nome' | 'produtos'; dir: 1 | -1 }>({ col: 'nome', dir: 1 });
  function ordenarPor(col: 'nome' | 'produtos') {
    setOrdem(o => o.col === col ? { col, dir: (o.dir * -1) as 1 | -1 } : { col, dir: col === 'nome' ? 1 : -1 });
  }
  const iconeOrdem = (col: 'nome' | 'produtos') => ordem.col !== col ? null
    : ordem.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />;

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);
  async function aoDigitarCep(valor: string) {
    const formatado = formatarCep(valor);
    setForm(f => ({ ...f, cep: formatado }));
    setCepNaoEncontrado(false);
    if (formatado.replace(/\D/g, '').length !== 8) return;
    setBuscandoCep(true);
    const dados = await buscarCepDetalhado(formatado);
    setBuscandoCep(false);
    if (!dados) { setCepNaoEncontrado(true); return; }
    setForm(f => ({
      ...f,
      rua: dados.rua || f.rua, bairro: dados.bairro || f.bairro,
      cidade: dados.cidade || f.cidade, uf: dados.uf || f.uf,
    }));
  }

  const lista = fornecedores.filter(f => {
    const passaBusca = !busca ||
      contemTexto(f.nome, busca) ||
      (f.cnpjCpf?.includes(busca) ?? false) ||
      (f.telefone?.includes(busca) ?? false);
    const passaStatus = statusFiltro === 'todos' ? true : statusFiltro === 'ativo' ? f.ativo : !f.ativo;
    return passaBusca && passaStatus;
  }).sort((a, b) => {
    const cmp = ordem.col === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : a.qtdProdutos - b.qtdProdutos;
    return cmp * ordem.dir || a.nome.localeCompare(b.nome, 'pt-BR');
  });
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  function abrirNovo() {
    setForm(EMPTY);
    setCepNaoEncontrado(false);
    setEditId(null);
    setModal('novo');
  }

  function abrirEditar(f: Fornecedor) {
    setForm({
      nome: f.nome, cnpjCpf: f.cnpjCpf ?? '', telefone: f.telefone ?? '',
      email: f.email ?? '', endereco: f.endereco ?? '', observacoes: f.observacoes ?? '',
      cep: f.cep ?? '', rua: f.rua ?? '', numero: f.numero ?? '', bairro: f.bairro ?? '',
      cidade: f.cidade ?? '', uf: f.uf ?? '',
      ativo: f.ativo,
    });
    setCepNaoEncontrado(false);
    setEditId(f.id);
    setModal('editar');
  }

  async function salvar() {
    if (!form.nome.trim()) { erro('Preencha o nome.'); return; }
    setSaving(true);
    try {
      if (modal === 'novo') await addFornecedor(form);
      else if (editId) await updateFornecedor(editId, form);
      setModal(null);
      sucesso(modal === 'novo' ? 'Fornecedor cadastrado!' : 'Fornecedor atualizado!');
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!confirmDel) return;
    try {
      await deleteFornecedor(confirmDel.id);
      setConfirmDel(null);
      sucesso('Fornecedor removido.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <p className="page-subtitle">{fornecedores.length} fornecedor(es) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          <Plus size={15} style={{ verticalAlign: -2 }} /> Novo fornecedor
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Nome, CNPJ/CPF ou telefone..." value={busca}
          onChange={e => { setBusca(e.target.value); setPagina(1); }} style={{ flex: 1, minWidth: 200 }} />
        <select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value as any); setPagina(1); }} style={{ width: 'auto', minWidth: 130 }}>
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

      {fornecedores.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Truck size={36} />
            <p>Nenhum fornecedor cadastrado ainda.</p>
            <button className="btn-primary" onClick={abrirNovo} style={{ marginTop: 12 }}>Cadastrar primeiro fornecedor</button>
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Truck size={36} />
            <p>Nenhum fornecedor encontrado com esse filtro.</p>
          </div>
        </div>
      ) : (
        <>
        {/* Desktop: tabela */}
        <div className="table-wrap forn-tabela-desktop">
          <table>
            <thead>
              <tr>
                <th><button type="button" className="forn-th-sort" onClick={() => ordenarPor('nome')}>Fornecedor{iconeOrdem('nome')}</button></th>
                <th>Contato</th>
                <th>Endereço</th>
                <th style={{ textAlign: 'right' }}><button type="button" className="forn-th-sort" onClick={() => ordenarPor('produtos')}>Produtos{iconeOrdem('produtos')}</button></th>
                <th>Status</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {listaPaginada.map(f => (
                <tr key={f.id} className="forn-linha" style={{ opacity: f.ativo ? 1 : 0.55 }} onClick={() => abrirEditar(f)}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{f.nome}</div>
                    {f.cnpjCpf && <div className="forn-sub">{f.cnpjCpf}</div>}
                  </td>
                  <td>
                    {f.telefone ? <div>{f.telefone}</div> : null}
                    {f.email && <div className="forn-sub">{f.email}</div>}
                    {!f.telefone && !f.email && <span className="forn-vazio">—</span>}
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    {enderecoCompleto(f)
                      ? <div className="forn-endereco" title={enderecoCompleto(f)}>{enderecoCompleto(f)}</div>
                      : <span className="forn-vazio">—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{f.qtdProdutos > 0 ? f.qtdProdutos : <span className="forn-vazio">—</span>}</td>
                  <td>{f.ativo ? <span className="badge badge-green">Ativo</span> : <span className="badge badge-accent">Inativo</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(f)}><Edit2 size={13} /></button>
                      <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => setConfirmDel(f)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Celular: cards */}
        <div className="forn-cards-mobile" style={{ flexDirection: 'column', gap: 10 }}>
          {listaPaginada.map(f => (
            <div key={f.id} className="card" style={{ opacity: f.ativo ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.nome}
                    {!f.ativo && <span className="badge badge-accent" style={{ fontSize: 10 }}>Inativo</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6, fontSize: 13, color: 'var(--text-3)' }}>
                    {f.telefone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{f.telefone}</span>}
                    {f.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{f.email}</span>}
                    {enderecoCompleto(f) && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{enderecoCompleto(f)}</span>}
                    {f.cnpjCpf && <span>CNPJ/CPF: {f.cnpjCpf}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    {f.qtdProdutos} produto(s) deste fornecedor
                  </div>
                  {f.observacoes && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{f.observacoes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(f)}><Edit2 size={14} /></button>
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => setConfirmDel(f)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
          opcoesPorPagina={[15, 30, 60]}
        />
      )}

      {/* Modal novo/editar */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                {modal === 'novo' ? 'Novo fornecedor' : 'Editar fornecedor'}
              </h2>
              <button className="btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Distribuidora ABC" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.telefone ?? ''} onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ/CPF <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input value={form.cnpjCpf ?? ''} onChange={e => setForm(f => ({ ...f, cnpjCpf: formatarCnpjCpf(e.target.value) }))} placeholder="00.000.000/0000-00" />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@fornecedor.com" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
                  <div className="forn-secao">Endereço <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></div>
                </div>
                <div className="form-group">
                  <label className="form-label">CEP</label>
                  <input value={form.cep ?? ''} onChange={e => aoDigitarCep(e.target.value)} inputMode="numeric" placeholder="00000-000" />
                  {(buscandoCep || cepNaoEncontrado) && (
                    <div style={{ fontSize: 11.5, marginTop: 4, color: cepNaoEncontrado ? 'var(--red)' : 'var(--text-3)' }}>
                      {buscandoCep ? 'Buscando CEP...' : 'CEP não encontrado. Preencha manualmente.'}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Rua</label>
                  <input value={form.rua ?? ''} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} placeholder="Rua / Avenida" />
                </div>
                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input value={form.numero ?? ''} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="123" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bairro</label>
                  <input value={form.bairro ?? ''} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cidade</label>
                  <input value={form.cidade ?? ''} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select value={form.uf ?? ''} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))}>
                    <option value="">UF</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {!(form.rua || form.numero || form.bairro || form.cidade || form.uf) && form.endereco && (
                  <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 8, padding: '8px 10px' }}>
                    Endereço antigo cadastrado: <strong style={{ color: 'var(--text-2)' }}>{form.endereco}</strong>. Preencha os campos acima para substituir.
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observações</label>
                  <textarea rows={2} value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Prazo de entrega, condições de pagamento..." />
                </div>
                {modal === 'editar' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', gridColumn: '1/-1' }}>
                    <input type="checkbox" checked={form.ativo} style={{ width: 16, height: 16, margin: 0 }}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                    <span>Fornecedor ativo</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
                {saving ? 'Salvando...' : modal === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Excluir fornecedor</h2>
              <button className="btn-ghost" onClick={() => setConfirmDel(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-1)' }}>{confirmDel.nome}</strong>?
                {confirmDel.qtdProdutos > 0 && ' Como há produtos vinculados, ele será apenas desativado em vez de excluído.'}
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
