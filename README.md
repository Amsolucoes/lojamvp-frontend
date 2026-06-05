# Loja MVP — Sistema de Gestão

Sistema web de gestão para loja de semi joias e maquiagem.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Estilo**: CSS puro com variáveis (sem Tailwind — mais fácil de customizar)
- **Estado**: React Context + localStorage (por enquanto; trocar por API quando o backend estiver pronto)
- **Roteamento**: React Router v6
- **Ícones**: Lucide React

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento
npm run dev

# 3. Build para produção
npm run build
```

Abre em `http://localhost:5173`

## Estrutura

```
src/
├── components/
│   └── layout/         # Sidebar + Layout
├── context/
│   └── AppContext.tsx   # Estado global (produtos, clientes, vendas)
├── pages/
│   ├── Dashboard.tsx
│   ├── produtos/       # Cadastro de Produtos (completo)
│   ├── clientes/       # Em construção
│   ├── caixa/          # Em construção
│   └── estoque/        # Em construção
├── types.ts            # Interfaces TypeScript
└── index.css           # Design tokens + estilos globais
```

## Módulos

| Módulo | Status |
|--------|--------|
| Dashboard | ✅ Pronto |
| Cadastro de Produtos | ✅ Pronto |
| Cadastro de Clientes | 🔨 Em construção |
| Caixa (PDV) | 🔨 Em construção |
| Controle de Estoque | 🔨 Em construção |
| Relatórios | 📋 V1.1 |
| Fluxo de Caixa | 📋 V1.1 |

## Conectar com o backend C# (quando pronto)

Substitua as funções no `AppContext.tsx`:

```typescript
// ANTES (local)
const addProduto = (p) => setProdutos(prev => [...prev, { ...p, id: gerarId() }]);

// DEPOIS (API)
const addProduto = async (p) => {
  const res = await fetch('/api/produtos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  const novo = await res.json();
  setProdutos(prev => [...prev, novo]);
};
```
