import { ChangeEvent, useState } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  // Habilita valores negativos (ex.: saldo no cheque especial) com um botão de sinal ao lado.
  permitirNegativo?: boolean;
}

export function InputMoeda({ value, onChange, placeholder, autoFocus, className, permitirNegativo }: Props) {
  // Guarda o sinal escolhido enquanto o valor ainda é 0 (não dá para inferir de "0").
  const [negZero, setNegZero] = useState(false);
  const negativo = permitirNegativo && (value < 0 || (value === 0 && negZero));

  const exibido = value
    ? Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, '');
    const numero = digitos ? parseInt(digitos, 10) / 100 : 0;
    if (!permitirNegativo) { onChange(numero); return; }
    onChange(negativo ? -numero : numero);
  }

  function alternarSinal() {
    if (value === 0) { setNegZero(n => !n); return; }
    onChange(-value);
  }

  const input = (
    <input
      type="text"
      inputMode="decimal"
      value={negativo && value !== 0 ? `-${exibido}` : exibido}
      onChange={handleChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
      style={permitirNegativo ? { flex: 1, minWidth: 0 } : undefined}
    />
  );

  if (!permitirNegativo) return input;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
      <button type="button" className="btn-secondary" title={negativo ? 'Valor negativo' : 'Valor positivo'}
        onClick={alternarSinal}
        style={{ padding: '0 14px', fontWeight: 700, fontSize: 16, color: negativo ? 'var(--red)' : 'var(--text-2)' }}>
        {negativo ? '−' : '+'}
      </button>
      {input}
    </div>
  );
}
