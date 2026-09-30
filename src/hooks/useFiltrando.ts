import { useEffect, useRef, useState } from 'react';

// Liga um "loading" breve sempre que algum filtro muda (filtros client-side são instantâneos,
// então sem isso o usuário não percebe que a lista foi refiltrada).
export function useFiltrando(deps: unknown[], ms = 350) {
  const [filtrando, setFiltrando] = useState(false);
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setFiltrando(true);
    const t = setTimeout(() => setFiltrando(false), ms);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return filtrando;
}
