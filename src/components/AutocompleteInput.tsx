import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  // A lista é desenhada num portal (fora do modal), para não ficar escondida atrás dos botões nem cortada pela rolagem do modal
  function calcularPosicao() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 8;
    const acima = r.top - 8;
    if (abaixo < 160 && acima > abaixo) {
      setPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxHeight: Math.min(220, acima) });
    } else {
      setPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.min(220, Math.max(100, abaixo)) });
    }
  }

  useLayoutEffect(() => {
    if (!aberto) return;
    calcularPosicao();
    window.addEventListener('resize', calcularPosicao);
    window.addEventListener('scroll', calcularPosicao, true);
    return () => {
      window.removeEventListener('resize', calcularPosicao);
      window.removeEventListener('scroll', calcularPosicao, true);
    };
  }, [aberto, value]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (ref.current && !ref.current.contains(alvo) && !(menuRef.current && menuRef.current.contains(alvo))) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const normalizadas: Opcao[] = options.map(o => typeof o === 'string' ? { value: o } : o);

  const filtradas = value
    ? normalizadas.filter(o => normalizarTexto(o.value).includes(normalizarTexto(value)) && normalizarTexto(o.value) !== normalizarTexto(value))
    : normalizadas;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
      />
      {aberto && filtradas.length > 0 && pos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, zIndex: 3000,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          maxHeight: pos.maxHeight, overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        }}>
          {filtradas.map(op => (
            <div key={op.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(op.value); setAberto(false); }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              {op.icone ? `${op.icone} ` : ''}{op.value}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}