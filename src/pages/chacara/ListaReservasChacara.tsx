import { useState, useEffect } from 'react';
import { Calendar, Check, Mail, FileCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type Reserva = {
  id: number;
  dataInicio: string;
  dataFim: string;
  pessoas: number;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  valor: number;
  status: string;
  contratoEnviadoEm: string | null;
  criadoEm: string;
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  pendente_pagamento: { label: 'Pendente', cor: 'var(--yellow)' },
  confirmada: { label: 'Confirmada', cor: 'var(--green)' },
  cancelada: { label: 'Cancelada', cor: 'var(--red)' },
  expirada: { label: 'Expirada', cor: 'var(--text-3)' },
};

export function ListaReservasChacara() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendente_pagamento' | 'confirmada'>('todas');
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setCarregando(true);
    api.get<Reserva[]>('/api/chacara/reservas')
      .then(setReservas)
      .catch(() => toastErro('Erro ao carregar reservas.'))
      .finally(() => setCarregando(false));
  }

  async function confirmar(id: number) {
    setConfirmando(id);
    try {
      await api.patch(`/api/chacara/reservas/${id}/confirmar`, {});
      sucesso('Reserva confirmada! E-mail e contrato enviados.');
      carregar();
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setConfirmando(null);
    }
  }

  const lista = reservas.filter(r => filtro === 'todas' || r.status === filtro);

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Acompanhe e confirme as reservas da chácara</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['todas', 'pendente_pagamento', 'confirmada'] as const).map(f => (
          <button key={f} className={filtro === f ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : STATUS_LABEL[f].label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '30px 0' }}><p>Nenhuma reserva encontrada.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(r => {
            const statusInfo = STATUS_LABEL[r.status] ?? { label: r.status, cor: 'var(--text-3)' };
            return (
              <div key={r.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{r.clienteEmail} · {r.clienteTelefone}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
                      <Calendar size={13} /> {fmtData(r.dataInicio)} — {fmtData(r.dataFim)} · {r.pessoas} pessoa(s)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(r.valor)}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusInfo.cor }}>{statusInfo.label}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.contratoEnviadoEm ? (
                      <><FileCheck size={13} color="var(--green)" /> Contrato enviado em {fmtData(r.contratoEnviadoEm)}</>
                    ) : (
                      <><Mail size={13} /> Contrato ainda não enviado</>
                    )}
                  </div>

                  {r.status === 'pendente_pagamento' && (
                    <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => confirmar(r.id)} disabled={confirmando === r.id}>
                      <Check size={13} /> {confirmando === r.id ? 'Confirmando...' : 'Confirmar pagamento manual'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}