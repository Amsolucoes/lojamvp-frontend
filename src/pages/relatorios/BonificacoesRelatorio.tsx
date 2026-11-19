import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ResumoBonificacoes } from '../../types';

// Quanto a loja gastou em brindes (bonificações) no período do relatório: total, por produto e por cliente (do que mais custou ao que menos custou).
// Só aparece para o administrador (mostra o custo dos produtos) e quando houve brinde no período.

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BonificacoesRelatorio({ de, ate }: { de?: string; ate?: string }) {
  const [resumo, setResumo] = useState<ResumoBonificacoes | null>(null);

  useEffect(() => {
    const filtros = [de ? `de=${de}` : '', ate ? `ate=${ate}` : ''].filter(Boolean).join('&');
    api.get<ResumoBonificacoes>(`/api/bonificacoes/resumo${filtros ? `?${filtros}` : ''}`).then(setResumo).catch(() => setResumo(null));
  }, [de, ate]);

  if (!resumo || resumo.totalBonificacoes === 0) return null;

  return (
    <div className="card rel-card">
      <div className="rel-card-title">🎁 Brindes dados (bonificações)</div>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        {resumo.totalBonificacoes} brinde(s) · {resumo.totalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un. ·{' '}
        custo para a loja: <strong style={{ color: 'var(--red)' }}>{fmt(resumo.totalCusto)}</strong>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Produto</th><th style={{ textAlign: 'right' }}>Qtd</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
          <tbody>
            {resumo.porProduto.slice(0, 8).map(p => (
              <tr key={`${p.produtoId}-${p.nomeProduto}`}>
                <td>{p.nomeProduto}</td>
                <td style={{ textAlign: 'right' }}>{p.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.custo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Cliente</th><th style={{ textAlign: 'right' }}>Brindes</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
          <tbody>
            {resumo.porCliente.slice(0, 8).map(c => (
              <tr key={`${c.clienteId}-${c.nomeCliente}`}>
                <td>{c.nomeCliente}</td>
                <td style={{ textAlign: 'right' }}>{c.bonificacoes}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.custo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
