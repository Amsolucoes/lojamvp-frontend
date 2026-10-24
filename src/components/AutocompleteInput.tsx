import { useState, useRef, useEffect } from 'react';
import { normalizarTexto } from '../utils/texto';

interface Opcao {
  value: string;
  icone?: string | null;
}

interface Props {
  value: string;
  options: (string | Opcao)[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AutocompleteInput({ value, options, onChange, placeholder }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('touchstart', aoClicarFora);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('touchstart', aoClicarFora);
    };
  }, []);

  const normalizadas: Opcao[] = options.map(o => typeof o === 'string' ? { value: o } : o);

  const filtradas = value
    ? normalizadas.filter(o => normalizarTexto(o.value).includes(normalizarTexto(value)) && normalizarTexto(o.value) !== normalizarTexto(value))
    : normalizadas;

  // A lista fica ancorada logo abaixo do campo (nunca para cima). O contêiner ganha z-index alto enquanto aberto
  // para ficar na frente dos botões; se faltar espaço, o formulário rola e a lista rola por conta própria.
  return (
    <div ref={ref} style={{ position: 'relative', zIndex: aberto ? 60 : undefined }}>
      <input
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => {
          setAberto(true);
          // No celular, leva o campo para o alto da área visível para dar espaço à lista acima do teclado
          if (window.matchMedia('(pointer: coarse)').matches) {
            setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
          }
        }}
      />
      {aberto && filtradas.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          marginTop: 4, maxHeight: 200, overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch', boxShadow: 'var(--shadow-lg)',
        }}>
          {filtradas.map(op => (
            <div key={op.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(op.value); setAberto(false); }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              {op.icone ? `${op.icone} ` : ''}{op.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
