import './Paginacao.css';

interface PaginacaoProps {
  paginaAtual: number;
  totalItens: number;
  porPagina: number;
  onMudarPagina: (pagina: number) => void;
  onMudarPorPagina: (porPagina: number) => void;
  opcoesPorPagina?: number[];
}

// Componente controlado: o pai continua dono do estado (paginaAtual, porPagina)
// e só recebe de volta os callbacks. Ao trocar "por página", já reseta pra
// página 1 sozinho — nenhuma tela precisa lembrar de fazer isso manualmente.
export function Paginacao({
  paginaAtual, totalItens, porPagina, onMudarPagina, onMudarPorPagina,
  opcoesPorPagina = [12, 24, 48],
}: PaginacaoProps) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina));
  const paginaSegura = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina + 1;
  const fim = Math.min(paginaSegura * porPagina, totalItens);

  return (
    <div className="paginacao-wrap">
      <div className="paginacao-info">
        Mostrando {inicio}–{fim} de {totalItens}
      </div>
      <div className="paginacao-controles">
        <select
          value={porPagina}
          onChange={e => { onMudarPorPagina(+e.target.value); onMudarPagina(1); }}
          className="paginacao-select"
        >
          {opcoesPorPagina.map(n => (
            <option key={n} value={n}>{n} por página</option>
          ))}
        </select>
        <div className="paginacao-botoes">
          <button className="btn-secondary" disabled={paginaSegura <= 1}
            onClick={() => onMudarPagina(Math.max(1, paginaSegura - 1))}>
            Anterior
          </button>
          <span className="paginacao-atual">{paginaSegura} / {totalPaginas}</span>
          <button className="btn-secondary" disabled={paginaSegura >= totalPaginas}
            onClick={() => onMudarPagina(Math.min(totalPaginas, paginaSegura + 1))}>
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}