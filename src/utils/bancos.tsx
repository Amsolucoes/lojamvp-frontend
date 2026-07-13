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

export function BankBadge({ bancoId, tamanho = 22 }: { bancoId?: string | null; tamanho?: number }) {
  const b = BANCOS.find(x => x.id === bancoId);
  if (!b || bancoId === 'outro' || !bancoId) return null;
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