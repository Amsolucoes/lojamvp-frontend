import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/login/Login';
import { Dashboard } from './pages/Dashboard';
import { Produtos } from './pages/produtos/Produtos';
import { Clientes } from './pages/clientes/Clientes';
import { Caixa } from './pages/caixa/Caixa';
import { Estoque } from './pages/estoque/Estoque';
import { Relatorios } from './pages/relatorios/Relatorios';
import { FluxoCaixa } from './pages/fluxo/FluxoCaixa';
import { Servicos } from './pages/servicos/servicos';
import { Cadastro } from './pages/login/Cadastro';
import { Suporte } from './pages/login/Suporte';
import { ToastProvider } from './context/ToastContext';

function Rotas() {
  const { usuario } = useAuth();

  if (!usuario) {
    return (
      <Routes>
        <Route path="/suporte" element={<Suporte />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AppProvider>
      <Routes>
        <Route path="/suporte" element={<Suporte />} />
        <Route element={<Layout />}>
          <Route index             element={<Dashboard />} />
          <Route path="produtos"   element={<Produtos />} />
          <Route path="clientes"   element={<Clientes />} />
          <Route path="caixa"      element={<Caixa />} />
          <Route path="estoque"    element={<Estoque />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="fluxo"      element={<FluxoCaixa />} />
          <Route path="servicos"   element={<Servicos />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  return (
     <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Rotas />
        </BrowserRouter>
      </AuthProvider>
     </ToastProvider>
  );
}
