# HealthPanel

A self-hosted website monitoring dashboard that tracks uptime, response times, and visual changes for your web applications.

## Overview

HealthPanel provides real-time monitoring of websites and APIs with alerting via email. It captures screenshots, measures response times, and detects downtime — all from a clean, self-hosted dashboard.

### Key Features

- **Real-time monitoring** — Periodic health checks with configurable intervals
- **Incident detection** — Automatic incident creation on downtime, resolution on recovery
- **Email alerts** — SendGrid-powered alerts with screenshot and log attachments
- **Live dashboard** — WebSocket-based real-time status updates
- **Screenshot capture** — Puppeteer-powered screenshots on incidents (web services)
- **Log collection** — Remote log fetching from monitored services
- **HMAC authentication** — Cryptographic auth between monitor and monitored services
- **External integrations** — Ready-made endpoints for NestJS, Laravel, and Next.js
- **Data retention** — Automatic cleanup of old health checks and screenshots (30 days)

---

## Architecture

This project is structured as a **pnpm monorepo**.

```
healthpanel/
├── apps/
│   ├── panel/              # Next.js 15 frontend (App Router)
│   └── api/                # NestJS backend (REST API + monitor engine)
├── packages/
│   └── shared/             # Shared TypeScript types and constants
├── external-integrations/
│   ├── nestjs/             # Integration for NestJS projects
│   ├── laravel/            # Integration for Laravel projects
│   └── nextjs/             # Integration for Next.js projects
├── scripts/
│   └── backup-db.sh        # PostgreSQL backup script
├── docker-compose.yml      # Development stack
├── docker-compose.prod.yml # Production stack
└── .env.example            # Environment variable reference
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts |
| Backend | NestJS 10, TypeScript, TypeORM 0.3 |
| Database | PostgreSQL 17 |
| Real-time | Socket.IO (WebSockets) |
| Auth | JWT + bcrypt |
| Encryption | AES-256-GCM (monitor secrets), HMAC-SHA256 (request signing) |
| Email | SendGrid |
| Screenshots | Puppeteer |
| Container | Docker, Docker Compose |
| Monorepo | pnpm workspaces |

### Module Architecture (API)

```
AppModule
├── AuthModule          # JWT login, password reset, change password
├── ServicesModule       # CRUD for monitored services
├── HealthCheckerModule  # Cron-based health checks, incident detection, cleanup
├── AlertsModule         # Email alerts, screenshots, log collection
└── LogsModule           # Remote log proxy for monitored services
```

---

## Prerequisites

- **Docker** and **Docker Compose** v2+
- **Node.js** >= 22.x (for local development)
- **pnpm** >= 9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **SendGrid** account and API key (for email alerts)

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url> healthpanel
cd healthpanel
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables) below).

### 2. Start with Docker (recommended)

```bash
# Development (hot-reload, volume mounts)
docker compose up -d

# Production (optimized builds, health checks, non-root)
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Run database migrations and seeders

```bash
# Run migrations
docker exec -it healthpanel_api pnpm --filter=@healthpanel/api migration:run

# Seed initial data (admin user + demo services)
docker exec -it healthpanel_api pnpm --filter=@healthpanel/api seed
```

### 4. Access the dashboard

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3044 |
| API | http://localhost:3045 |

Login with the seeded admin account (default: `admin` / `admin123`).

---

## Development

### Local setup (without Docker)

```bash
# Install dependencies
corepack enable
pnpm install

# Start PostgreSQL (Docker or local)
docker compose up postgres -d

# Run migrations
pnpm --filter=@healthpanel/api migration:run

# Seed data
pnpm --filter=@healthpanel/api seed

# Start all apps in development mode
pnpm dev
```

### Workspace scripts

```bash
# Start all apps
pnpm dev

# Start individually
pnpm dev:panel          # Next.js panel on :3044
pnpm dev:api            # NestJS API on :3045

# Build
pnpm build              # Build all
pnpm build:panel        # Build panel only
pnpm build:api          # Build API only

# Test
pnpm test               # Run all tests
pnpm test:api           # Run API tests only

# Quality
pnpm lint               # Lint all workspaces
pnpm lint:fix           # Auto-fix lint issues
pnpm typecheck          # Type-check all workspaces

# Docker
pnpm docker:up          # docker compose up -d
pnpm docker:down        # docker compose down
pnpm docker:logs        # docker compose logs -f
pnpm docker:build       # docker compose build

# Clean
pnpm clean              # Remove all node_modules and dist
```

### Database migrations

```bash
# Generate a new migration from entity changes
pnpm --filter=@healthpanel/api migration:generate src/database/migrations/MigrationName

# Create an empty migration
pnpm --filter=@healthpanel/api migration:create src/database/migrations/MigrationName

# Run pending migrations
pnpm --filter=@healthpanel/api migration:run

# Revert last migration
pnpm --filter=@healthpanel/api migration:revert
```

### Database backup

```bash
# Run backup (creates timestamped .sql.gz in backups/)
./scripts/backup-db.sh

# Backups older than 30 days are automatically deleted
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

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
| `ENCRYPTION_KEY` | AES-256 key for encrypting monitor secrets in the DB |

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
| `SCREENSHOT_TIMEOUT` | `15000` | Screenshot capture timeout in ms |

### Seeder

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_USER` | `admin` | Initial admin username |
| `SEED_PASSWORD` | `admin123` | Initial admin password |

---

## Adding a Monitored Service

### Via the Dashboard

1. Log in to the panel
2. Navigate to the Dashboard
3. Click **"Add Service"**
4. Fill in:
   - **Name** — Descriptive name
   - **URL** — Base URL of the service (e.g., `https://myapp.com`)
   - **Type** — `api_nestjs`, `api_laravel`, `web_nextjs`, or `generic`
   - **Health Endpoint** — Path to the health check endpoint (default: `/health`)
   - **Logs Endpoint** — Path to the logs endpoint (default: `/logs`)
   - **Check Interval** — Seconds between checks (default: 60)
5. Save — monitoring starts automatically

### Service Types

| Type | Description | Screenshot | Logs |
|------|-------------|------------|------|
| `api_nestjs` | NestJS API backend | No | Yes |
| `api_laravel` | Laravel API backend | No | Yes |
| `web_nextjs` | Next.js web application | Yes | Yes |
| `generic` | Any HTTP endpoint | No | No |

---

## External Integrations

To monitor a service, it needs to expose health and logs endpoints authenticated via HMAC-SHA256. Ready-made integrations are provided:

### NestJS

Copy files from `external-integrations/nestjs/src/` into your project. See [external-integrations/nestjs/README.md](external-integrations/nestjs/README.md).

### Laravel

Copy files from `external-integrations/laravel/` into your project. See [external-integrations/laravel/README.md](external-integrations/laravel/README.md).

### Next.js

Copy files from `external-integrations/nextjs/` into your project. See [external-integrations/nextjs/README.md](external-integrations/nextjs/README.md).

### Custom Integration

Any HTTP service can be monitored by implementing two endpoints:

1. **`GET /health`** — Returns HTTP 200 with `{ status: "ok" }`
2. **`GET /logs?lines=100`** — Returns recent application logs

Both endpoints must validate HMAC-SHA256 signatures sent in request headers:
- `x-monitor-key` — API key identifying the monitor
- `x-monitor-timestamp` — Unix timestamp (requests older than 5 minutes are rejected)
- `x-monitor-signature` — HMAC-SHA256 of `{timestamp}:GET:{path}` using the shared secret

---

## How Monitoring Works

1. **Scheduling** — On startup, the API loads all active services and creates interval timers
2. **Health Check** — Each check sends a signed HTTP GET to the service's health endpoint
3. **Classification**:
   - `UP` — HTTP 2xx and response time < 3 seconds
   - `DEGRADED` — HTTP 2xx but response time > 3 seconds
   - `DOWN` — Non-2xx status code, timeout, or connection error
4. **Retry** — On `DOWN`, one automatic retry before marking as down
5. **Incident Detection** — If `DOWN` and no open incident → create incident
6. **Alert** — On new incident: capture screenshot (web types) + collect logs + send email
7. **Resolution** — When service returns to `UP` → resolve incident + send recovery email
8. **Broadcast** — Every check result is broadcast via WebSocket to the dashboard

### SSRF Protection

Health checks block requests to:
- `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`
- Private IP ranges: `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`

---

## Security

- **JWT authentication** on all data endpoints (except login, forgot-password, reset-password)
- **bcrypt** password hashing (12+ salt rounds)
- **AES-256-GCM** encryption for monitor secrets at rest
- **HMAC-SHA256** request signing with replay attack protection (5-minute window)
- **ValidationPipe** with `whitelist` and `forbidNonWhitelisted` (rejects unknown fields)
- **SSRF prevention** — blocks requests to private IPs and localhost
- **Non-root Docker containers** in production
- **Graceful shutdown** hooks for clean process termination
- **TypeORM migrations-only** — `synchronize: false` enforced
- **Password reset tokens** expire after 1 hour and can only be used once
- **Data retention** — automatic cleanup of records older than 30 days

---

## Production Deployment

### Docker Compose (production)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Production features:
- Multi-stage Docker builds (smaller images)
- Non-root users in all containers
- Container health checks with restart policies
- No volume mounts (code baked into images)
- TypeORM retry with backoff (10 attempts, 3s delay)
- Chromium pre-installed for Puppeteer screenshots

### Backup

```bash
# Manual backup
./scripts/backup-db.sh

# Schedule with cron (daily at 2 AM)
0 2 * * * /path/to/healthpanel/scripts/backup-db.sh
```

---

## Testing

```bash
# Run all tests
pnpm test:api

# Run with verbose output
cd apps/api && npx jest --verbose

# Run a specific test file
cd apps/api && npx jest --testPathPattern="health-checker.service.spec"
```

### Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| auth.service.spec | 22 | Login, password hashing, reset tokens |
| auth.controller.spec | 8 | Auth endpoint behavior |
| security.spec | 12 | Security invariants (bcrypt, JWT, no hardcoded secrets) |
| security-audit.spec | 30 | OWASP top-10 audit (access control, crypto, SSRF) |
| services.service.spec | 20 | Service CRUD with soft delete |
| health-checker.service.spec | 19 | Health checks, retry, SSRF, scheduling |
| incident.service.spec | 6 | Incident lifecycle |
| cleanup.service.spec | 10 | Data retention cleanup |
| e2e-flow.spec | 7 | Full check → incident → alert lifecycle |
| alert-orchestrator.service.spec | 7 | Alert orchestration |
| alerts.service.spec | 14 | Email alerts (SendGrid) |
| settings.controller.spec | 10 | Alert settings CRUD |
| log-collector.service.spec | 14 | Remote log collection |
| logs.controller.spec | 10 | Logs proxy endpoint |
| nestjs-monitor-guard.spec | 7 | NestJS HMAC guard |
| nextjs-validate-request.spec | 8 | Next.js HMAC validation |
| cross-framework-hmac.spec | 5 | Cross-framework HMAC consistency |

**Total: 18 suites, 226 tests**

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs api
docker compose logs panel

# Verify env vars
docker compose config
```

### Database connection errors

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Run migrations manually
docker exec -it healthpanel_api pnpm --filter=@healthpanel/api migration:run
```

### Screenshots not working

- Ensure Chromium is installed in the container (production Dockerfile handles this)
- Check `PUPPETEER_EXECUTABLE_PATH` env var
- Verify the `screenshots/` directory has write permissions

### Email alerts not sending

- Verify `SENDGRID_API_KEY` is set and valid
- Check `ALERT_EMAIL_FROM` is a verified sender in SendGrid
- Check API logs: `docker compose logs api | grep -i sendgrid`

### Health checks failing

- Verify the monitored service has the correct health/logs endpoints
- Check that the `monitorApiKey` and `monitorSecret` match on both sides
- Ensure the service URL is accessible from the Docker network (not localhost)

---

## License

Private — All rights reserved.
