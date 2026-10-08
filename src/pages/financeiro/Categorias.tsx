import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Paginacao } from '../../components/Paginacao';
import './Contas.css';

interface Categoria {
  id: string;
  nome: string;
  tipo: string; // pagar | receber | ambos
  icone: string | null;
}

const ICONES_CATEGORIA = ['🏷️','💵','💰','🤑','$','🏠','💧','💡','📶','📦','👤','🧾','💳','🛒','📁','🍽️','🚗','🎓','🏥','🎮'
    ,'✈️','🐾','🎁','📱','💊','⛽','🧹','🎬','📈','📉','🔧','🛠️','🎉','👶','💇','🐶'
    ,'🏢','🏭','🏦','📚','🖥️','🖨️','☎️','🚚','🧴','🪑','🛋️','🧯','🩺','💼','🎨','🧵','✂️','🔌','🔋','🚿'
    ,'🧼','🍔','☕','🍺','🍷','🎵','🎤','⚽','🏋️','🧘','🩹','🧠','⚖️','🌐','🔒','🧊','🧻','🪒','🚪','🌳'];

type Filtro = 'todas' | 'pagar' | 'receber' | 'ambos';
const FORM_VAZIO = { nome: '', tipo: 'ambos', icone: '' };
const ROTULO_TIPO: Record<string, string> = { pagar: 'A pagar', receber: 'A receber', ambos: 'Pagar e receber' };

export function Categorias() {
  const { sucesso, erro } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(15);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  async function carregar() {
    await api.get<Categoria[]>('/api/financeiro/categorias').then(setCategorias).catch(() => {}).finally(() => setCarregando(false));
  }
  useEffect(() => { carregar(); }, []);
  useEffect(() => { setPagina(1); }, [filtro, busca]);

  function abrirNova() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setMostrarForm(true);
  }
  function abrirEditar(c: Categoria) {
    setEditando(c);
    setForm({ nome: c.nome, tipo: c.tipo, icone: c.icone ?? '' });
    setMostrarForm(true);
  }
  function fecharForm() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setMostrarForm(false);
  }
  async function salvar() {
    if (!form.nome.trim()) { erro('Digite o nome da categoria.'); return; }
    try {
      const payload = { nome: form.nome.trim(), tipo: form.tipo, icone: form.icone || null };
      if (editando) await api.put(`/api/financeiro/categorias/${editando.id}`, payload);
      else await api.post('/api/financeiro/categorias', payload);
      sucesso(editando ? 'Categoria atualizada!' : 'Categoria criada!');
      fecharForm();
      carregar();
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function excluir(c: Categoria) {
    try {
      const res = await api.delete<any>(`/api/financeiro/categorias/${c.id}`);
      carregar();
      sucesso(res?.mensagem ?? 'Categoria removida.');
    } catch (e) {
      erro((e as Error).message);
    }
  }
  async function seedPadrao() {
    try {
      await api.post('/api/financeiro/categorias/seed-padrao', {});
      carregar();
      sucesso('Categorias padrão criadas!');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const termo = normalizar(busca);
  const lista = categorias.filter(c =>
    (filtro === 'todas' || c.tipo === filtro) && (!termo || normalizar(c.nome).includes(termo)));
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  return (
    <div className="page fin-page">
      <div className="contas-acoes">
        <button className="btn-primary" onClick={abrirNova}><Plus size={15} /> Nova categoria</button>
        {categorias.length === 0 && !carregando && (
          <button className="btn-secondary" onClick={seedPadrao}>Usar categorias padrão</button>
        )}
      </div>

      {mostrarForm && (
        <div className="card contas-form">
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando ? 'Editar categoria' : 'Nova categoria'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Marketing" autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={{ flex: 1 }} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="ambos">Pagar e Receber</option>
                <option value="pagar">Só Pagar</option>
                <option value="receber">Só Receber</option>
              </select>
              <select style={{ width: 90 }} value={form.icone} onChange={e => setForm(f => ({ ...f, icone: e.target.value }))}>
                {ICONES_CATEGORIA.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={salvar}>{editando ? 'Salvar alterações' : 'Adicionar categoria'}</button>
              <button className="btn-secondary" onClick={fecharForm}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {categorias.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <input type="text" placeholder="Buscar categoria por descrição..." value={busca}
            onChange={e => setBusca(e.target.value)} style={{ width: 340, maxWidth: '100%' }} />
        </div>
      )}

      {categorias.length > 0 && (
        <div className="cat-tabs" style={{ justifyContent: 'center', marginBottom: 16 }}>
          <button className={`cat-tab${filtro === 'todas' ? ' active' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
          <button className={`cat-tab${filtro === 'pagar' ? ' active' : ''}`} onClick={() => setFiltro('pagar')}>A pagar</button>
          <button className={`cat-tab${filtro === 'receber' ? ' active' : ''}`} onClick={() => setFiltro('receber')}>A receber</button>
          <button className={`cat-tab${filtro === 'ambos' ? ' active' : ''}`} onClick={() => setFiltro('ambos')}>Ambos</button>
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="layout-spinner" /></div>
      ) : lista.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '40px 0' }}><p>{categorias.length === 0 ? 'Nenhuma categoria cadastrada.' : busca.trim() ? 'Nenhuma categoria encontrada para essa busca.' : 'Nenhuma categoria neste filtro.'}</p></div></div>
      ) : (
        <>
          <div className="contas-lista">
            {visiveis.map(c => (
              <div key={c.id} className="card conta-card" style={{ padding: '12px 20px' }}>
                <div className="conta-card-info">
                  <span style={{ fontSize: 20 }}>{c.icone}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{ROTULO_TIPO[c.tipo] ?? c.tipo}</div>
                  </div>
                </div>
                <div className="conta-card-acoes">
                  <button className="btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => excluir(c)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <Paginacao
            paginaAtual={paginaSegura}
            totalItens={lista.length}
            porPagina={porPagina}
            onMudarPagina={setPagina}
            onMudarPorPagina={setPorPagina}
            opcoesPorPagina={[15, 30, 50]}
          />
        </>
      )}
    </div>
  );
}
