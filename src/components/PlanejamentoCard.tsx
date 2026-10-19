import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

interface Resumo {
  receita: number; poupar: number; disponivelParaGastar: number; totalPlanejado: number; gastoPlanejadas: number;
  categorias: { ativo: boolean; valor: number; gasto: number; nome: string }[];
  metas: { valorAlvo: number; valorGuardado: number }[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Card do dashboard (desktop e mobile): quanto do planejamento do mês já foi gasto.
export function PlanejamentoCard({ compacto = false }: { compacto?: boolean }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const agora = new Date();
    api.get<Resumo>(`/api/financeiro/planejamento?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`)
      .then(setDados).catch(() => {}).finally(() => setCarregando(false));
  }, []);

  const ativas = dados?.categorias.filter(c => c.ativo && c.valor > 0) ?? [];
  const estouradas = ativas.filter(c => c.gasto > c.valor);
  const total = dados?.totalPlanejado ?? 0;
  const gasto = dados?.gastoPlanejadas ?? 0;
  const pct = total > 0 ? Math.min(100, (gasto / total) * 100) : 0;
  const passou = total > 0 && gasto > total;
  const metasAbertas = dados?.metas.filter(m => m.valorGuardado < m.valorAlvo).length ?? 0;

  return (
    <div className="card" style={{ marginBottom: 16, cursor: 'pointer', padding: compacto ? 14 : undefined }} onClick={() => navigate('/financeiro/planejamento')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}><Target size={15} /> Planejamento do mês</div>
        <ChevronRight size={16} color="var(--text-3)" />
      </div>
      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><div className="layout-spinner" style={{ width: 20, height: 20 }} /></div>
      ) : ativas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Defina quanto quer gastar por categoria e acompanhe suas metas. Toque para começar.</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: passou ? 'var(--red)' : 'var(--text-1)' }}>{fmt(gasto)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>de {fmt(total)} planejados</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden', margin: '8px 0' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: passou ? 'var(--red)' : pct > 85 ? 'var(--yellow, #d97706)' : 'var(--green)' }} />
          </div>
          <div style={{ fontSize: 12, color: passou ? 'var(--red)' : 'var(--text-3)' }}>
            {passou ? `Passou do teto em ${fmt(gasto - total)}` : `Ainda pode gastar ${fmt(total - gasto)}`}
            {estouradas.length > 0 && ` · ${estouradas.length} categoria${estouradas.length > 1 ? 's' : ''} acima do teto`}
          </div>
          {(dados?.poupar ?? 0) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              Guardar no mês: <strong style={{ color: 'var(--text-2)' }}>{fmt(dados!.poupar)}</strong>
              {metasAbertas > 0 && ` · ${metasAbertas} meta${metasAbertas > 1 ? 's' : ''} em andamento`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
