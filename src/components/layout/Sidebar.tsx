import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, BarChart2, Boxes, TrendingUp, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import './Sidebar.css';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/produtos',   icon: Package,         label: 'Produtos'       },
  { to: '/clientes',   icon: Users,           label: 'Clientes'       },
  { to: '/caixa',      icon: ShoppingCart,    label: 'Caixa'          },
  { to: '/estoque',    icon: Boxes,           label: 'Estoque'        },
  { to: '/relatorios', icon: BarChart2,       label: 'Relatórios'     },
  { to: '/fluxo',      icon: TrendingUp,      label: 'Fluxo de Caixa' },
];

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function Sidebar() {
  const { produtos } = useApp();
  const { usuario, logout } = useAuth();
  const alertas = produtos.filter(p => p.ativo && p.estoque <= p.estoqueMinimo).length;
  const [nomeLoja, setNomeLoja] = useState('Minha Loja');
  const [corPrimaria, setCorPrimaria] = useState('#e8945a');

  useEffect(() => {
    api.get<any>('/api/cliente/config').then(res => {
      if (res?.nome) setNomeLoja(res.nome);
      if (res?.corPrimaria) setCorPrimaria(res.corPrimaria);
    }).catch(() => {});
  }, []);

  // Aplica a cor dinamicamente no CSS
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', corPrimaria);
    document.documentElement.style.setProperty('--accent-2', corPrimaria + 'cc');
    document.documentElement.style.setProperty('--accent-bg', corPrimaria + '1a');
    document.documentElement.style.setProperty('--accent-border', corPrimaria + '40');
  }, [corPrimaria]);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">✦</div>
        <div>
          <div className="sidebar-logo-name">{nomeLoja}</div>
          <div className="sidebar-logo-sub">Gestão</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
            {label === 'Estoque' && alertas > 0 && (
              <span className="sidebar-badge">{alertas}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{iniciais(usuario?.nome ?? 'U')}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-nome">{usuario?.nome}</div>
          <div className="sidebar-user-role">{usuario?.role === 'admin' ? 'Administrador' : 'Operador'}</div>
        </div>
        <button className="btn-ghost sidebar-logout" onClick={logout} title="Sair">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}