export const BANCOS = [
  { id: 'itau', nome: 'Itaú', cor: '#EC7000', sigla: 'Itaú' },
  { id: 'nubank', nome: 'Nubank', cor: '#8A05BE', sigla: 'Nu' },
  { id: 'santander', nome: 'Santander', cor: '#EC0000', sigla: 'S' },
  { id: 'bradesco', nome: 'Bradesco', cor: '#CC092F', sigla: 'B' },
  { id: 'caixa', nome: 'Caixa Econômica', cor: '#0070AD', sigla: 'CEF' },
  { id: 'bb', nome: 'Banco do Brasil', cor: '#FCE300', sigla: 'BB' },
  { id: 'inter', nome: 'Banco Inter', cor: '#FF7A00', sigla: 'Inter' },
  { id: 'c6', nome: 'C6 Bank', cor: '#1B1B1B', sigla: 'C6' },
  { id: 'outro', nome: 'Outro / não informar', cor: 'var(--text-3)', sigla: '🏦' },
];

// Logos reais em /public/bancos (pacote react-bancos, MIT). As marcas pertencem às instituições.
const LOGO_BANCO = new Set(['itau', 'nubank', 'santander', 'bradesco', 'caixa', 'bb', 'inter', 'c6']);

export function BankBadge({ bancoId, tamanho = 22 }: { bancoId?: string | null; tamanho?: number }) {
  const b = BANCOS.find(x => x.id === bancoId);
  if (!b || bancoId === 'outro' || !bancoId) return null;
  if (LOGO_BANCO.has(b.id)) {
    return (
      <img src={`/bancos/${b.id}.svg`} alt={b.nome} title={b.nome} width={tamanho} height={tamanho}
        style={{ borderRadius: tamanho * 0.22, flexShrink: 0, display: 'block' }} />
    );
  }
  return (
    <span title={b.nome} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tamanho, height: tamanho, borderRadius: '50%', background: b.cor,
      color: '#fff', fontSize: tamanho * 0.36, fontWeight: 700, flexShrink: 0,
    }}>
      {b.sigla.length > 3 ? b.sigla.slice(0, 2) : b.sigla}
    </span>
  );
}
