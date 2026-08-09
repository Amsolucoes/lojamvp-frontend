import { useEffect, useState } from 'react';

let ativo = false;
let ouvintes: Array<(a: boolean) => void> = [];

export function setMobileShellOverride(valor: boolean) {
  ativo = valor;
  ouvintes.forEach(fn => fn(ativo));
}

export function useMobileShellOverride() {
  const [valor, setValor] = useState(ativo);
  useEffect(() => {
    ouvintes.push(setValor);
    return () => { ouvintes = ouvintes.filter(fn => fn !== setValor); };
  }, []);
  return valor;
}