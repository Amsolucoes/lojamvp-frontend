import { useEffect, useState } from 'react';

type AcaoBottomNav = { corBg: string; corBorda: string; aoClicar: () => void } | null;

let acaoAtual: AcaoBottomNav = null;
let ouvintes: Array<(a: AcaoBottomNav) => void> = [];

export function setBottomNavAction(acao: AcaoBottomNav) {
  acaoAtual = acao;
  ouvintes.forEach(fn => fn(acaoAtual));
}

export function useBottomNavAction() {
  const [acao, setAcao] = useState<AcaoBottomNav>(acaoAtual);
  useEffect(() => {
    ouvintes.push(setAcao);
    return () => { ouvintes = ouvintes.filter(fn => fn !== setAcao); };
  }, []);
  return acao;
}