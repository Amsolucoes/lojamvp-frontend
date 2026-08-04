import { ChangeEvent } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function InputMoeda({ value, onChange, placeholder, autoFocus }: Props) {
  const exibido = value
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, '');
    const numero = digitos ? parseInt(digitos, 10) / 100 : 0;
    onChange(numero);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={exibido}
      onChange={handleChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}