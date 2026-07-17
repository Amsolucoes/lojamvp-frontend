import { useState, useEffect } from 'react';
import { Users, Calendar, CreditCard, GraduationCap } from 'lucide-react';
import { api } from '../services/api';
import './Dashboard.css';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Turma {
  id: string;
  nome: string;
  diaSemana: number;
  horario: string;
  capacidade: number;
  ativa: boolean;
  qtdAlunos: number;
}

interface Cliente {
  id: string;
}

interface Assinante {
  id: string;
  valor: number;
}

const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function DashboardTurmas() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);

  useEffect(() => {
    api.get<Turma[]>('/api/turmas').then(setTurmas).catch(() => {});
    api.get<Cliente[]>('/api/clientes').then(setClientes).catch(() => {});
    api.get<Assinante[]>('/api/planos/assinantes').then(setAssinantes).catch(() => {});
  }, []);

  const turmasAtivas = turmas.filter(t => t.ativa);
  const totalVagasOcupadas = turmasAtivas.reduce((s, t) => s + t.qtdAlunos, 0);
  const totalCapacidade = turmasAtivas.reduce((s, t) => s + t.capacidade, 0);
  const receitaRecorrente = assinantes.reduce((s, a) => s + (a.valor ?? 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-label"><Users size={12} style={{ verticalAlign: -1 }} /> Alunos cadastrados</div>
          <div className="stat-value">{clientes.length}</div>
          <div className="stat-sub">total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><CreditCard size={12} style={{ verticalAlign: -1 }} /> Assinantes</div>
          <div className="stat-value">{assinantes.length}</div>
          <div className="stat-sub">{fmt(receitaRecorrente)}/mês recorrente</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><GraduationCap size={12} style={{ verticalAlign: -1 }} /> Turmas ativas</div>
          <div className="stat-value">{turmasAtivas.length}</div>
          <div className="stat-sub">{totalVagasOcupadas}/{totalCapacidade} vagas ocupadas</div>
        </div>
      </div>

      <div className="card">
        <div className="dash-card-header">
          <div className="dash-card-title"><Calendar size={15} /> Turmas</div>
        </div>
        {turmasAtivas.length === 0 ? (
          <div className="empty" style={{ padding: '30px 0' }}><p>Nenhuma turma ativa cadastrada.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {turmasAtivas.map(t => {
              const pct = t.capacidade > 0 ? Math.min(100, (t.qtdAlunos / t.capacidade) * 100) : 0;
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{DIAS_ABREV[t.diaSemana]} · {t.horario}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: t.qtdAlunos >= t.capacidade ? 'var(--red)' : 'var(--accent)' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{t.qtdAlunos}/{t.capacidade}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}