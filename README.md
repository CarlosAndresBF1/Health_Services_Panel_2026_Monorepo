# HealthPanel

A self-hosted website monitoring dashboard that tracks uptime, response times, and visual changes for your web applications.

## Overview

HealthPanel provides real-time monitoring of websites and APIs with alerting via email. It captures screenshots, measures response times, and detects downtime — all from a clean, self-hosted dashboard.

---

## Architecture

This project is structured as a **monorepo** using npm workspaces.

```
healthpanel/
├── apps/
│   ├── panel/              # Next.js 14 frontend (App Router)
│   └── api/                # NestJS backend (REST API + monitor engine)
├── packages/
│   └── shared/             # Shared TypeScript types, DTOs, and utilities
├── external-integrations/
│   ├── nestjs/             # Integration guide for NestJS projects
│   ├── laravel/            # Integration guide for Laravel projects
│   └── nextjs/             # Integration guide for Next.js projects
├── docker-compose.yml      # Full stack orchestration
└── .env.example            # Environment variable reference
```

### Apps

| App | Technology | Description |
|-----|-----------|-------------|
| `apps/panel` | Next.js 14, React, TypeScript | Frontend dashboard UI |
| `apps/api` | NestJS, TypeScript, TypeORM | Backend API and monitoring engine |

### Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared TypeScript types, interfaces, DTOs and enums |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Backend | NestJS, TypeScript, TypeORM |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken) |
| Email alerts | SendGrid |
| Screenshots | Puppeteer |
| Container | Docker, Docker Compose |
| Monorepo | npm workspaces |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values before starting:

```bash
cp .env.example .env
```

### Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT_PANEL` | `3044` | Next.js panel port |
| `PORT_API` | `3045` | NestJS API port |
| `PORT_DB` | `5433` | PostgreSQL host port |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PANEL_URL` | `http://localhost:3044` | Public URL of the panel |
| `API_URL` | `http://localhost:3045` | Public URL of the API |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `postgres` | Database host (Docker service name) |
| `DB_PORT` | `5433` | Internal PostgreSQL port |
| `DB_USERNAME` | `healthpanel` | Database user |
| `DB_PASSWORD` | `healthpanel_secret` | Database password |
| `DB_DATABASE` | `healthpanel` | Database name |

### Authentication

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) |
| `ENCRYPTION_KEY` | AES-256 key for encrypting secrets stored in DB |

### Email (SendGrid)

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key (`SG.xxxxx`) |
| `ALERT_EMAIL_FROM` | Sender address for alert emails |
| `ALERT_EMAIL_TO` | Recipient address for alert emails |

### Monitor

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_CHECK_INTERVAL` | `60` | Default check interval in seconds |
| `SCREENSHOT_TIMEOUT` | `15000` | Screenshot capture timeout in milliseconds |

### Seeder

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_USER` | `admin` | Initial admin username |
| `SEED_PASSWORD` | `admin123` | Initial admin password |

---

## Quick Start

> Setup instructions will be completed in Fase 7 once all components are ready.

The final quick start will include:

1. Prerequisites (Docker, Node.js 22.x)
2. Clone and configure environment
3. Start with Docker Compose
4. Access the dashboard
5. Run in development mode

---

## Development

### Prerequisites

- Node.js >= 22.x
- npm >= 10.x
- Docker and Docker Compose

### Workspace Scripts

```bash
# Start all apps in development mode
npm run dev

# Start only the panel
npm run dev:panel

# Start only the API
npm run dev:api

# Build all workspaces
npm run build

# Run all tests
npm run test

# Type-check all workspaces
npm run typecheck

# Lint all workspaces
npm run lint

# Docker operations
npm run docker:up
npm run docker:down
npm run docker:logs
```

---

## License

Private — All rights reserved.
