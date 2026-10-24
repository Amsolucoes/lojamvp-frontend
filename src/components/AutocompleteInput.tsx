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
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  // A lista é desenhada num portal (fora do modal), para não ficar escondida atrás dos botões nem cortada pela rolagem do modal.
  // Sempre abre para baixo do campo; a altura considera a área visível (com o teclado do celular aberto) e a lista rola.
  function calcularPosicao() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const fundoVisivel = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const disponivel = fundoVisivel - r.bottom - 12;
    setPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.max(96, Math.min(220, disponivel)) });
  }

  useLayoutEffect(() => {
    if (!aberto) return;
    calcularPosicao();
    window.addEventListener('resize', calcularPosicao);
    window.addEventListener('scroll', calcularPosicao, true);
    window.visualViewport?.addEventListener('resize', calcularPosicao);
    window.visualViewport?.addEventListener('scroll', calcularPosicao);
    return () => {
      window.removeEventListener('resize', calcularPosicao);
      window.removeEventListener('scroll', calcularPosicao, true);
      window.visualViewport?.removeEventListener('resize', calcularPosicao);
      window.visualViewport?.removeEventListener('scroll', calcularPosicao);
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
        onFocus={() => { setAberto(true); if (window.matchMedia('(pointer: coarse)').matches) setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250); }}
      />
      {aberto && filtradas.length > 0 && pos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 3000,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          maxHeight: pos.maxHeight, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', boxShadow: 'var(--shadow-lg)',
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