import { useState } from 'react';
import { aplicarTema, carregarTemaSalvo, TEMAS, Tema } from '../../utils/tema';

export function Configuracoes() {
  const [temaAtual, setTemaAtual] = useState<Tema>(carregarTemaSalvo());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Preferências pessoais de uso do sistema</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Aparência</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          Essa escolha é só sua — fica salva neste navegador, não muda pra outras pessoas que usam o sistema.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {TEMAS.map(t => (
            <button key={t.chave} type="button"
              className={temaAtual === t.chave ? 'btn-primary' : 'btn-secondary'}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              onClick={() => { aplicarTema(t.chave); setTemaAtual(t.chave); }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.corPreview, display: 'inline-block', border: '1px solid rgba(0,0,0,0.15)' }} />
              {t.nome}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}