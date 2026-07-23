import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { aplicarTema, carregarTemaSalvo } from './utils/tema';
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
import { Servicos } from './pages/servicos/Servicos';
import { Agenda } from './pages/agenda/Agenda';
import { Cadastro } from './pages/login/Cadastro';
import { Suporte } from './pages/login/Suporte';
import { AgendamentoPublico } from './pages/publico/AgendamentoPublico';
import { Planos } from './pages/planos/Planos';
import { Financeiro } from './pages/financeiro/Financeiro';
import { BalancoMensal } from './pages/financeiro/BalancoMensal';
import { Configuracoes } from './pages/configuracoes/Configuracoes';
import { Turmas } from './pages/turmas/Turmas';
import { Funil } from './pages/funil/Funil';
import { Apolices } from './pages/apolices/Apolices';
import { ImportarNf } from './pages/nf/ImportarNf';
import { CentralAjuda } from './pages/ajuda/CentralAjuda';
import { ToastProvider } from './context/ToastContext';

function Rotas() {
  const { usuario } = useAuth();

  // Rotas públicas (funcionam com ou sem login)
  // Se a URL é de agendamento público, renderiza direto
  const path = window.location.pathname;
  if (path.startsWith('/agendar/')) {
    return (
      <Routes>
        <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
      </Routes>
    );
  }

  if (!usuario) {
    return (
      <Routes>
        <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
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
        <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
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
          <Route path="agenda"     element={<Agenda />} />
          <Route path="planos"     element={<Planos />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="financeiro/balanco" element={<BalancoMensal />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="turmas"     element={<Turmas />} />
          <Route path="funil"      element={<Funil />} />
          <Route path="apolices"   element={<Apolices />} />
          <Route path="nf"         element={<ImportarNf />} />
          <Route path="ajuda"      element={<CentralAjuda />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  useEffect(() => {
    aplicarTema(carregarTemaSalvo());
  }, []);
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
