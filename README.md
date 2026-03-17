# Futgol - Gestão de Peladas

Sistema completo para gestão de peladas e futebol amador com grupos, jogadores, partidas, arena ao vivo, financeiro, estatísticas, gamificação e marketplace de quadras.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4 + Zustand + Radix UI
- **Backend**: Express + PostgreSQL + JWT + Zod + bcrypt
- **IA**: Google Gemini (balanceamento de times)
- **PWA**: Service Worker + Web Push Notifications

## Setup Local

### Pré-requisitos

- Node.js 20+
- PostgreSQL 16+

### Configuração

```bash
# Clone e copie o .env
cp .env.example server/.env

# Instale dependências
cd server && npm install
cd ../client && npm install

# Inicie o banco (Docker)
docker-compose up -d db

# Inicie o servidor
cd server && npm run dev

# Em outro terminal, inicie o client
cd client && npm run dev
```

O client roda em `http://localhost:3000` e o server em `http://localhost:3001`.

## Testes

```bash
# Testes do servidor
cd server && npm test

# Testes do cliente
cd client && npm test

# Testes E2E (necessário server + client rodando)
npx playwright test
```

## CI/CD

O GitHub Actions roda automaticamente em push para `main`/`develop`:
- Lint (ESLint + Prettier)
- Testes unitários (Vitest)
- Build
- Testes E2E (Playwright)

## Arquitetura

```
futgol/
├── client/               # React SPA
│   ├── components/       # Componentes de tela
│   ├── services/         # API, Auth, Push, Storage
│   ├── stores/           # Zustand stores
│   └── test/             # Testes unitários
├── server/               # Express API
│   ├── api/              # Route handlers
│   │   ├── auth/         # Login, Register, Me, Profile
│   │   ├── middleware/   # Auth global, Validation (Zod)
│   │   ├── ai/           # Balanceamento de times (Gemini)
│   │   ├── achievements/ # Gamificação
│   │   ├── marketplace/  # Busca, Reserva, Reviews
│   │   ├── push/         # Web Push Notifications
│   │   └── whatsapp/     # Compartilhamento WhatsApp
│   └── server/           # Entry point
├── e2e/                  # Playwright E2E tests
└── .github/workflows/    # CI/CD
```

## Features

- Autenticação com JWT + bcrypt + rate limiting
- Grupos com convites e sistema de admin
- Partidas com confirmação, times, placar e MVP
- IA para balanceamento de times (Google Gemini)
- Sistema de gamificação (conquistas, ranking, XP, níveis)
- Marketplace de quadras (busca, reserva, avaliações)
- Integração WhatsApp (convites, resumos, lembretes)
- Push Notifications (PWA)
- Financeiro (caixa, mensalidades, rateio)
- Estatísticas detalhadas

## Variáveis de Ambiente

Veja `.env.example` para todas as variáveis necessárias.
