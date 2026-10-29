// Bandeiras de cartão de crédito. Logos em /public/bandeiras (pacote react-bancos, MIT; marcas dos respectivos titulares).
// A Elo não tem logo no pacote — aparece como selo de texto.
export const BANDEIRAS = [
  { id: 'visa', nome: 'Visa' },
  { id: 'mastercard', nome: 'Mastercard' },
  { id: 'elo', nome: 'Elo' },
  { id: 'amex', nome: 'American Express' },
  { id: 'hipercard', nome: 'Hipercard' },
  { id: 'diners', nome: 'Diners Club' },
];

export function BandeiraBadge({ bandeira, tamanho = 22 }: { bandeira?: string | null; tamanho?: number }) {
  const b = BANDEIRAS.find(x => x.id === bandeira);
  if (!b) return null;
  if (b.id === 'elo') {
    return (
      <span title={b.nome} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: tamanho, height: tamanho, borderRadius: tamanho * 0.22, background: '#111', color: '#fff',
        fontSize: tamanho * 0.42, fontWeight: 800, letterSpacing: '-.03em', textTransform: 'lowercase',
      }}>elo</span>
    );
  }
  return (
    <img src={`/bandeiras/${b.id}.svg`} alt={b.nome} title={b.nome} width={tamanho} height={tamanho}
      style={{ borderRadius: tamanho * 0.22, flexShrink: 0, display: 'block' }} />
  );
}

// Escolha da bandeira (clicar de novo na selecionada desmarca)
export function SeletorBandeira({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {BANDEIRAS.map(b => (
        <button key={b.id} type="button" title={b.nome} onClick={() => onChange(valor === b.id ? '' : b.id)}
          style={{
            padding: 4, borderRadius: 10, cursor: 'pointer', lineHeight: 0,
            background: valor === b.id ? 'var(--accent-bg)' : 'transparent',
            border: `1px solid ${valor === b.id ? 'var(--accent)' : 'var(--border)'}`,
            opacity: valor && valor !== b.id ? 0.55 : 1,
          }}>
          <BandeiraBadge bandeira={b.id} tamanho={30} />
        </button>
      ))}
    </div>
  );
}
