export type Tema = 'escuro' | 'theme-light-blue' | 'theme-light-green' | 'theme-light-purple';

const TEMAS: { chave: Tema; nome: string; corPreview: string }[] = [
  { chave: 'escuro', nome: 'Escuro (padrão)', corPreview: '#e8945a' },
  { chave: 'theme-light-blue', nome: 'Claro — Azul', corPreview: '#2563eb' },
  { chave: 'theme-light-green', nome: 'Claro — Verde', corPreview: '#059669' },
  { chave: 'theme-light-purple', nome: 'Claro — Roxo', corPreview: '#7c3aed' },
];

const TODAS_CLASSES: Tema[] = ['theme-light-blue', 'theme-light-green', 'theme-light-purple'];

export function aplicarTema(tema: Tema) {
  const html = document.documentElement;
  TODAS_CLASSES.forEach(c => html.classList.remove(c));
  if (tema !== 'escuro') html.classList.add(tema);
  localStorage.setItem('loja:tema', tema);
}

export function carregarTemaSalvo(): Tema {
  const salvo = localStorage.getItem('loja:tema') as Tema | null;
  return salvo ?? 'escuro';
}

export { TEMAS };