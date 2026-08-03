import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AutocompleteInput({ value, options, onChange, placeholder }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const filtradas = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()) && o.toLowerCase() !== value.toLowerCase())
    : options;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
      />
      {aberto && filtradas.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        }}>
          {filtradas.map(op => (
            <div key={op}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(op); setAberto(false); }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              {op}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}