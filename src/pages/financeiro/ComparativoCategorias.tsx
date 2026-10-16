import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Equal, Trophy } from 'lucide-react';
import { api } from '../../services/api';

// Despesas por categoria: mês escolhido x mês anterior, e o melhor mês do ano de cada categoria.

interface CategoriaComparativo {
  nome: string;
  icone: string;
  atual: number;
  anterior: number;
  diferenca: number;
  variacaoPct: number | null;
  melhorMes: number | null;
  melhorValor: number | null;
}

interface Comparativo {
  ano: number;
  mes: number;
  anterior: { ano: number; mes: number };
  totalAtual: number;
  totalAnterior: number;
  categorias: CategoriaComparativo[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function Variacao({ diferenca, pct }: { diferenca: number; pct: number | null }) {
  if (Math.abs(diferenca) < 0.005) {
    return <span style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Equal size={12} /> igual</span>;
  }
  const menos = diferenca < 0;
  const cor = menos ? 'var(--green)' : 'var(--red)';
  return (
    <span style={{ color: cor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      {menos ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
      {fmt(Math.abs(diferenca))}{pct !== null && ` (${menos ? '-' : '+'}${Math.abs(pct).toFixed(0)}%)`}
    </span>
  );
}

export function ComparativoCategorias({ ano, mes, desmembrar, onSelecionar }: { ano: number; mes: number; desmembrar: boolean; onSelecionar?: (nome: string) => void }) {
  const [dados, setDados] = useState<Comparativo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api.get<Comparativo>(`/api/financeiro/balanco-comparativo?ano=${ano}&mes=${mes}&desmembrar=${desmembrar}`)
      .then(r => { if (ativo) { setDados(r); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [ano, mes, desmembrar]);

  const nomeAnterior = dados ? `${MESES_ABREV[dados.anterior.mes - 1]}` : '';
  const nomeAtual = MESES_ABREV[mes - 1];

  return (
    <div className="card" style={{ marginTop: 20, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Comparativo de despesas por categoria</div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        {nomeAtual} contra {nomeAnterior || 'o mês anterior'} · e o melhor mês do ano de cada categoria (menor gasto).
      </p>

      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><div className="layout-spinner" style={{ width: 22, height: 22 }} /></div>
      ) : erro || !dados ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '10px 0' }}>Não foi possível carregar o comparativo.</p>
      ) : dados.categorias.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '10px 0' }}>Sem despesas nesses dois meses.</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 0 10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <strong>Total</strong>
            <span style={{ color: 'var(--text-3)' }}>{nomeAnterior}: {fmt(dados.totalAnterior)} → {nomeAtual}: <span style={{ color: 'var(--text-1)' }}>{fmt(dados.totalAtual)}</span></span>
            <Variacao diferenca={dados.totalAtual - dados.totalAnterior} pct={dados.totalAnterior > 0 ? ((dados.totalAtual - dados.totalAnterior) / dados.totalAnterior) * 100 : null} />
          </div>

          {dados.categorias.map(c => {
            const ehMelhor = c.melhorMes === mes && c.atual > 0;
            return (
              <div key={c.nome} onClick={onSelecionar ? () => onSelecionar(c.nome) : undefined} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: onSelecionar ? 'pointer' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.icone} {c.nome}</span>
                  <Variacao diferenca={c.diferenca} pct={c.variacaoPct} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-3)', marginTop: 3, flexWrap: 'wrap' }}>
                  <span>{nomeAnterior}: {fmt(c.anterior)} → {nomeAtual}: <span style={{ color: 'var(--text-2)' }}>{fmt(c.atual)}</span></span>
                  {c.melhorMes !== null && c.melhorValor !== null && (
                    <span style={{ color: ehMelhor ? 'var(--green)' : 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Trophy size={11} /> {ehMelhor ? 'Melhor mês do ano!' : `Melhor mês: ${MESES_ABREV[c.melhorMes - 1]} (${fmt(c.melhorValor)})`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
