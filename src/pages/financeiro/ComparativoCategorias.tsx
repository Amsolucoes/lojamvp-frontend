import { useEffect, useState } from 'react';
import { X, BarChart3, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../services/api';
import { normalizarTexto } from '../../utils/texto';

// Despesas por categoria mês a mês no ano (tabela), com o menor e o maior mês de cada categoria em destaque.

interface CategoriaAno { nome: string; icone: string; serie: number[]; }
interface DadosAno { ano: number; totaisMes: number[]; categorias: CategoriaAno[]; }

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function Seta({ ativo, dir }: { ativo: boolean; dir?: 'asc' | 'desc' }) {
  if (!ativo) return null;
  return dir === 'asc' ? <ArrowUp size={11} style={{ marginLeft: 3, verticalAlign: -1 }} /> : <ArrowDown size={11} style={{ marginLeft: 3, verticalAlign: -1 }} />;
}

function TabelaAno({ ano, mes, desmembrar, onSelecionar }: { ano: number; mes: number; desmembrar: boolean; onSelecionar?: (nome: string, mes: number) => void }) {
  const [dados, setDados] = useState<DadosAno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  // Ordenação ao clicar no cabeçalho: categoria (A→Z), mês ou total; clicar de novo inverte, e uma terceira vez volta ao padrão
  const [ordem, setOrdem] = useState<{ col: 'nome' | 'total' | number; dir: 'asc' | 'desc' } | null>(null);

  function ordenarPor(col: 'nome' | 'total' | number) {
    setOrdem(o => !o || o.col !== col ? { col, dir: col === 'nome' ? 'asc' : 'desc' } : o.dir === (col === 'nome' ? 'asc' : 'desc') ? { col, dir: col === 'nome' ? 'desc' : 'asc' } : null);
  }

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api.get<DadosAno>(`/api/financeiro/balanco-comparativo?ano=${ano}&mes=${mes}&desmembrar=${desmembrar}`)
      .then(r => { if (ativo) { setDados(r); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [ano, mes, desmembrar]);

  if (carregando) return <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><div className="layout-spinner" style={{ width: 22, height: 22 }} /></div>;
  if (erro || !dados) return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>Não foi possível carregar o comparativo.</p>;
  if (dados.categorias.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>Sem despesas neste ano.</p>;

  const categoriasOrdenadas = [...dados.categorias];
  if (ordem) {
    const f = ordem.dir === 'asc' ? 1 : -1;
    categoriasOrdenadas.sort((a, b) => {
      if (ordem.col === 'nome') return f * normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome), 'pt-BR');
      const va = ordem.col === 'total' ? a.serie.reduce((x, y) => x + y, 0) : a.serie[ordem.col];
      const vb = ordem.col === 'total' ? b.serie.reduce((x, y) => x + y, 0) : b.serie[ordem.col];
      return f * (va - vb);
    });
  }

  const agora = new Date();
  const ultimo = ano < agora.getFullYear() ? 12 : ano === agora.getFullYear() ? agora.getMonth() + 1 : 0;
  const cel: React.CSSProperties = { padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 12.5, borderBottom: '1px solid var(--border)' };
  const primeira: React.CSSProperties = { ...cel, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-2)', zIndex: 1, minWidth: 130, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...primeira, fontWeight: 600, color: ordem?.col === 'nome' ? 'var(--text-1)' : 'var(--text-3)', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => ordenarPor('nome')} title="Ordenar por categoria (A–Z)">
              Categoria <Seta ativo={ordem?.col === 'nome'} dir={ordem?.dir} />
            </th>
            {MESES_ABREV.map((m, i) => (
              <th key={m} onClick={() => ordenarPor(i)} title={`Ordenar por ${m}`}
                style={{ ...cel, fontWeight: 600, cursor: 'pointer', userSelect: 'none', color: ordem?.col === i || i + 1 === mes ? 'var(--text-1)' : 'var(--text-3)' }}>
                {m}<Seta ativo={ordem?.col === i} dir={ordem?.dir} />
              </th>
            ))}
            <th onClick={() => ordenarPor('total')} title="Ordenar pelo total" style={{ ...cel, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
              Total<Seta ativo={ordem?.col === 'total'} dir={ordem?.dir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {categoriasOrdenadas.map(c => {
            const validos = c.serie.slice(0, ultimo).filter(v => v > 0);
            const menor = validos.length > 1 ? Math.min(...validos) : null;
            const maior = validos.length > 1 ? Math.max(...validos) : null;
            return (
              <tr key={c.nome}>
                <td style={primeira} title={c.nome}>{c.icone} {c.nome}</td>
                {c.serie.map((v, i) => {
                  const cor = v > 0 && i < ultimo ? (v === menor ? 'var(--green)' : v === maior ? 'var(--red)' : undefined) : undefined;
                  return (
                    <td key={i} onClick={v > 0 && onSelecionar ? () => onSelecionar(c.nome, i + 1) : undefined}
                      style={{ ...cel, color: v > 0 ? cor : 'var(--text-3)', fontWeight: cor ? 700 : 400, cursor: v > 0 && onSelecionar ? 'pointer' : undefined, opacity: i >= ultimo ? 0.6 : 1 }}>
                      {v > 0 ? fmt(v) : '–'}
                    </td>
                  );
                })}
                <td style={{ ...cel, fontWeight: 700 }}>{fmt(c.serie.reduce((a, b) => a + b, 0))}</td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...primeira, fontWeight: 700 }}>Total</td>
            {dados.totaisMes.map((v, i) => <td key={i} style={{ ...cel, fontWeight: 700 }}>{v > 0 ? fmt(v) : '–'}</td>)}
            <td style={{ ...cel, fontWeight: 700 }}>{fmt(dados.totaisMes.reduce((a, b) => a + b, 0))}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>Verde</span> = mês de menor gasto da categoria · <span style={{ color: 'var(--red)', fontWeight: 700 }}>vermelho</span> = maior gasto (só meses já ocorridos). Toque num valor para ver os lançamentos.
      </p>
    </div>
  );
}

export function ComparativoCategorias({ ano, mes, desmembrar, onSelecionar }: { ano: number; mes: number; desmembrar: boolean; onSelecionar?: (nome: string, mes: number, ano: number) => void }) {
  const [aberto, setAberto] = useState(false);
  const [anoTabela, setAnoTabela] = useState(ano);
  useEffect(() => { setAnoTabela(ano); }, [ano]);
  return (
    <>
      <button className="btn-secondary" onClick={() => setAberto(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <BarChart3 size={15} /> Comparativo do ano
      </button>
      {aberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 1100, width: '96vw' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Despesas por categoria
                <button className="btn-ghost" onClick={() => setAnoTabela(a => a - 1)} style={{ padding: 4 }}><ChevronLeft size={16} /></button>
                {anoTabela}
                <button className="btn-ghost" onClick={() => setAnoTabela(a => a + 1)} style={{ padding: 4 }}><ChevronRight size={16} /></button>
              </h3>
              <button className="btn-ghost" onClick={() => setAberto(false)} style={{ padding: 6 }}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <TabelaAno ano={anoTabela} mes={mes} desmembrar={desmembrar}
                onSelecionar={onSelecionar ? ((n, m) => onSelecionar(n, m, anoTabela)) : undefined} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
