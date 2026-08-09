import { useEffect, useState } from 'react';

type OpcaoAcao = { label: string; cor: string; aoClicar: () => void };

type AcaoBottomNav =
  | { tipo: 'unica'; corBg: string; corBorda: string; aoClicar: () => void }
  | { tipo: 'multipla'; opcoes: OpcaoAcao[] }
  | null;

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