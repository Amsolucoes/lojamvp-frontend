import { Users, ShoppingCart, Boxes, BarChart2, TrendingUp } from 'lucide-react';

function Placeholder({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="page">
      <div className="empty" style={{ height: '70vh' }}>
        <Icon size={40} style={{ opacity: 0.2, marginBottom: 8 }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 300, textAlign: 'center' }}>{desc}</p>
      </div>
    </div>
  );
}

export function Clientes() {
  return <Placeholder icon={Users} title="Cadastro de Clientes" desc="Módulo em construção. Será o próximo passo!" />;
}
export function Caixa() {
  return <Placeholder icon={ShoppingCart} title="Caixa (PDV)" desc="Módulo em construção." />;
}
export function Estoque() {
  return <Placeholder icon={Boxes} title="Controle de Estoque" desc="Módulo em construção." />;
}
export function Relatorios() {
  return <Placeholder icon={BarChart2} title="Relatórios" desc="Módulo em construção — disponível na V1.1." />;
}
export function FluxoCaixa() {
  return <Placeholder icon={TrendingUp} title="Fluxo de Caixa" desc="Módulo em construção — disponível na V1.1." />;
}
