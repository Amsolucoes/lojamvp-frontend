import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronDown, Percent } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Paginacao } from '@/components/Paginacao';
import './Produtos.css';
import './Precificacao.css';

type Edicao = { precoCusto: number; precoVenda: number };
type AlvoReajuste = 'custo' | 'venda' | 'ambos';

export function Precificacao() {
  const navigate = useNavigate();
  const { produtos, recarregar } = useApp();
  const { sucesso, erro } = useToast();

  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string>('todas');
  const [catMenuAberto, setCatMenuAberto] = useState(false);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [salvando, setSalvando] = useState(false);

  const [alvoReajuste, setAlvoReajuste] = useState<AlvoReajuste>('venda');
  const [percentualReajuste, setPercentualReajuste] = useState('');
  const [confirmReajuste, setConfirmReajuste] = useState(false);

  useEffect(() => {
    api.get<any[]>('/api/categorias').then(setCats).catch(() => {});
  }, []);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setCatMenuAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const lista = produtos.filter(p => {
    const ok = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
               (p.codigoBarras?.includes(busca) ?? false);
    const catOk = catFiltro === 'todas' || p.categoria === catFiltro;
    return ok && catOk;
  });

  const usarSelectCategoria = cats.length > 10;
  const catsOrdenadas = [...cats].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const produtosParaContagem = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigoBarras?.includes(busca) ?? false)
  );
  const contagemPorCategoria: Record<string, number> = {};
  produtosParaContagem.forEach(p => { contagemPorCategoria[p.categoria] = (contagemPorCategoria[p.categoria] ?? 0) + 1; });

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const listaPaginada = lista.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  const totalEditados = Object.keys(edicoes).length;

  function valorAtual(id: string, campo: keyof Edicao, original: number) {
    return edicoes[id]?.[campo] ?? original;
  }

  function editarCampo(id: string, campo: keyof Edicao, valor: number, original: Edicao) {
    setEdicoes(prev => ({
      ...prev,
      [id]: { ...original, ...prev[id], [campo]: valor },
    }));
  }

  function margem(precoCusto: number, precoVenda: number) {
    if (precoCusto === 0) return null;
    return ((precoVenda - precoCusto) / precoCusto * 100).toFixed(0);
  }

  function aplicarReajuste() {
    const pct = parseFloat(percentualReajuste.replace(',', '.'));
    if (isNaN(pct) || pct === 0) { erro('Digite um percentual válido.'); return; }

    setEdicoes(prev => {
      const novo = { ...prev };
      for (const p of lista) {
        const atual = novo[p.id] ?? { precoCusto: p.precoCusto, precoVenda: p.precoVenda };
        const fator = 1 + pct / 100;
        const novoCusto = alvoReajuste !== 'venda' ? Math.round(atual.precoCusto * fator * 100) / 100 : atual.precoCusto;
        const novaVenda = alvoReajuste !== 'custo' ? Math.round(atual.precoVenda * fator * 100) / 100 : atual.precoVenda;
        novo[p.id] = { precoCusto: novoCusto, precoVenda: novaVenda };
      }
      return novo;
    });
    setConfirmReajuste(false);
    sucesso(`Reajuste aplicado a ${lista.length} produto(s). Confira e salve.`);
  }

  async function salvar() {
    if (totalEditados === 0) return;
    setSalvando(true);
    try {
      const payload = {
        produtos: Object.entries(edicoes).map(([id, v]) => ({
          id, precoCusto: v.precoCusto, precoVenda: v.precoVenda,
        })),
      };
      await api.put('/api/produtos/precos-em-lote', payload);
      await recarregar();
      setEdicoes({});
      sucesso(`${totalEditados} produto(s) atualizado(s) com sucesso.`);
    } catch (e) {
      erro('Erro ao salvar preços: ' + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn-ghost precif-voltar" onClick={() => navigate('/produtos')}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="page-title">Precificação</h1>
          <p className="page-subtitle">{lista.length} produto(s) — altere custo e venda em lote</p>
        </div>
        <div className="prod-header-actions">
          <button className="btn-primary" onClick={salvar} disabled={totalEditados === 0 || salvando}>
            {salvando ? 'Salvando...' : `Salvar alterações${totalEditados > 0 ? ` (${totalEditados})` : ''}`}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="prod-filters">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nome ou código..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {usarSelectCategoria ? (
          <div className="cat-select-wrap" ref={catMenuRef}>
            <button type="button" className="cat-select-btn" onClick={() => setCatMenuAberto(v => !v)}>
              <span>Categoria: {catFiltro === 'todas' ? 'todas' : catFiltro}</span>
              <ChevronDown size={14} style={{ transform: catMenuAberto ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
            </button>
            {catMenuAberto && (
              <div className="cat-select-menu">
                <button type="button" className={`cat-select-item${catFiltro === 'todas' ? ' active' : ''}`}
                  onClick={() => { setCatFiltro('todas'); setCatMenuAberto(false); }}>
                  <span>Todas</span><span className="cat-select-count">{produtosParaContagem.length}</span>
                </button>
                {catsOrdenadas.map(c => (
                  <button type="button" key={c.id} className={`cat-select-item${catFiltro === c.nome ? ' active' : ''}`}
                    onClick={() => { setCatFiltro(c.nome); setCatMenuAberto(false); }}>
                    <span>{c.nome}</span><span className="cat-select-count">{contagemPorCategoria[c.nome] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="cat-tabs">
            <button className={`cat-tab${catFiltro === 'todas' ? ' active' : ''}`} onClick={() => setCatFiltro('todas')}>Todas</button>
            {cats.map(c => (
              <button key={c.id} className={`cat-tab${catFiltro === c.nome ? ' active' : ''}`} onClick={() => setCatFiltro(c.nome)}>
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reajuste em massa */}
      <div className="card precif-reajuste">
        <Percent size={15} style={{ color: 'var(--text-3)' }} />
        <span>Reajustar</span>
        <select value={alvoReajuste} onChange={e => setAlvoReajuste(e.target.value as AlvoReajuste)}>
          <option value="custo">Preço de custo</option>
          <option value="venda">Preço de venda</option>
          <option value="ambos">Custo e venda</option>
        </select>
        <span>em</span>
        <input
          type="text" inputMode="decimal" placeholder="ex: 10 ou -5"
          className="precif-reajuste-input"
          value={percentualReajuste}
          onChange={e => setPercentualReajuste(e.target.value)}
        />
        <span>%</span>
        <button className="btn-secondary" onClick={() => setConfirmReajuste(true)} disabled={lista.length === 0}>
          Aplicar aos {lista.length} produto(s) filtrado(s)
        </button>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th><th>Categoria</th>
                    <th>Preço de custo</th><th>Preço de venda</th><th>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPaginada.map(p => {
                    const editado = !!edicoes[p.id];
                    const custo = valorAtual(p.id, 'precoCusto', p.precoCusto);
                    const venda = valorAtual(p.id, 'precoVenda', p.precoVenda);
                    const marg = margem(custo, venda);
                    return (
                      <tr key={p.id} className={editado ? 'precif-linha-editada' : undefined}>
                        <td>
                          <div className="prod-nome">{p.nome}</div>
                          {p.codigoBarras && <div className="prod-cod">{p.codigoBarras}</div>}
                        </td>
                        <td><span className="badge badge-accent">{p.categoria}</span></td>
                        <td>
                          <input
                            type="number" step="0.01" min={0}
                            className="precif-input"
                            value={custo}
                            onChange={e => editarCampo(p.id, 'precoCusto', parseFloat(e.target.value) || 0,
                              { precoCusto: p.precoCusto, precoVenda: p.precoVenda })}
                          />
                        </td>
                        <td>
                          <input
                            type="number" step="0.01" min={0}
                            className="precif-input"
                            value={venda}
                            onChange={e => editarCampo(p.id, 'precoVenda', parseFloat(e.target.value) || 0,
                              { precoCusto: p.precoCusto, precoVenda: p.precoVenda })}
                          />
                        </td>
                        <td>{marg && <span className="badge badge-green">+{marg}%</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <Paginacao
                paginaAtual={paginaSegura}
                totalItens={lista.length}
                porPagina={porPagina}
                onMudarPagina={setPaginaAtual}
                onMudarPorPagina={setPorPagina}
              />
            </div>
          </>
        )}
      </div>

      {/* Confirmação do reajuste em massa */}
      {confirmReajuste && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmReajuste(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Confirmar reajuste</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
                Isso vai alterar{' '}
                <strong style={{ color: 'var(--text-1)' }}>
                  {alvoReajuste === 'ambos' ? 'o custo e a venda' : alvoReajuste === 'custo' ? 'o custo' : 'a venda'}
                </strong>{' '}
                de <strong style={{ color: 'var(--text-1)' }}>{lista.length} produto(s)</strong> filtrado(s) em{' '}
                <strong style={{ color: 'var(--text-1)' }}>{percentualReajuste || 0}%</strong>.
                Nada é salvo ainda — você pode conferir e ajustar linha a linha antes de clicar em "Salvar alterações".
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmReajuste(false)}>Cancelar</button>
              <button className="btn-primary" onClick={aplicarReajuste}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}