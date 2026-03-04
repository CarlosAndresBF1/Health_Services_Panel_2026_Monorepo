# HealthPanel - Project Plan

## Executive Summary

Real-time monitoring dashboard for APIs (NestJS, Laravel) and websites (Next.js). Includes automated health checks, log visualization, email alerts with screenshots and enriched context. Monorepo with Next.js (panel) and NestJS (API). Dockerized with hot reload for local development.

---

## Architectural Decisions

| Aspect | Decision |
|---|---|
| Structure | Monorepo (`apps/panel` + `apps/api`) |
| Frontend | Next.js 15 LTS (App Router) |
| Backend/API | NestJS (latest LTS version) |
| Node.js | Latest LTS version (v22.x) |
| ORM | TypeORM with migrations and seeders (NO synchronize) |
| Database | PostgreSQL (configurable port, persistent volume) |
| Log monitoring | `/logs` endpoints on each external project |
| Authentication | Simple login (username/password) with test user seeder |
| Screenshots | Puppeteer (headless Chrome) |
| Alerts | SendGrid API |
| Containers | Docker + Docker Compose (hot reload in dev) |
| Target scale | 10-30 services |
| Real-time | WebSockets (Socket.IO via NestJS Gateway) |
| Testing | Jest + security checks per phase |
| Language | Strict TypeScript in both apps (panel + api) |
| UI Theme | Enterprise Security Dark Theme (see Design System section) |
| External endpoint security | HMAC-SHA256 signed requests (see Security section) |

---

## Design System - Enterprise Security Theme

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#111827` | Component backgrounds, cards, sidebar |
| `--primary-hover` | `#0B1220` | Hover states for primary components |
| `--accent` | `#C8A951` | Primary buttons, premium badges, active indicators, links |
| `--accent-tech` | `#60A5FA` | Charts, real-time data, info badges, secondary links |
| `--background` | `#0A0F1A` | Main app background |
| `--surface` | `#111827` | Cards, modals, dropdowns, table rows |
| `--text-primary` | `#F3F4F6` | Main text, headings, values |
| `--text-muted` | `#9CA3AF` | Secondary text, labels, timestamps |

### Status Colors (Health Checks)

| State | Color | Usage |
|---|---|---|
| UP / Online | `#22C55E` (green-500) | Green indicator, "Online" badge |
| DOWN / Offline | `#EF4444` (red-500) | Red indicator, "Offline" badge, alerts |
| DEGRADED / Slow | `#F59E0B` (amber-500) | Yellow indicator, "Degraded" badge |
| UNKNOWN / Pending | `#6B7280` (gray-500) | No data yet |

### Tailwind Config Override

```typescript
// apps/panel/tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#111827',
          hover: '#0B1220',
        },
        accent: {
          DEFAULT: '#C8A951',
          tech: '#60A5FA',
        },
        background: '#0A0F1A',
        surface: '#111827',
        'text-primary': '#F3F4F6',
        'text-muted': '#9CA3AF',
        status: {
          up: '#22C55E',
          down: '#EF4444',
          degraded: '#F59E0B',
          unknown: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
};
```

### UI Guidelines

- **General style**: Dark enterprise, minimalist, subtle borders (`border-white/10`)
- **Cards**: `bg-surface border border-white/10 rounded-lg` with hover `hover:border-accent/30`
- **Sidebar**: `bg-primary` fixed on the left, icons + labels, accent gold for active item
- **Primary buttons**: `bg-accent text-background hover:bg-accent/90` (gold on dark)
- **Secondary buttons**: `bg-white/5 text-text-primary border border-white/10`
- **Tables**: Alternating rows with `bg-surface` and `bg-background`, hover `bg-white/5`
- **LogViewer**: Background `#0A0F1A`, font `font-mono`, text `text-text-muted`, errors in `text-status-down`
- **Charts**: Main line in `accent-tech` (#60A5FA), fill with 10% opacity
- **Type badges**: NestJS (red-500), Laravel (orange-500), Next.js (white)
- **Transitions**: `transition-all duration-200`
- **Shadows**: Minimal, use semi-transparent borders instead
- **Subtle glassmorphism**: In modals `bg-surface/95 backdrop-blur-sm`

---

## Security Model for External Endpoints

### Problem

HealthPanel needs to query `/health` and `/logs` endpoints on external projects (NestJS, Laravel, Next.js). These endpoints expose sensitive information (logs, system status). A robust authentication mechanism is needed that:

1. Does not depend on a centralized auth service
2. Is easy to implement in each framework
3. Protects against replay attacks
4. Allows revoking access individually per service

### Solution: HMAC-SHA256 Signed Requests

Each monitored service has a **secret key** shared between HealthPanel and the service. Requests are signed with HMAC-SHA256.

#### Authentication flow

```
HealthPanel (API)                          External Service
      │                                          │
      │  1. Generate signature:                  │
      │     timestamp = Date.now()               │
      │     payload = "${timestamp}:${method}:${path}"
      │     signature = HMAC-SHA256(payload, secret_key)
      │                                          │
      │  2. HTTP GET /health                     │
      │     Headers:                             │
      │       X-Monitor-Key: {service_api_key}   │
      │       X-Monitor-Timestamp: {timestamp}   │
      │       X-Monitor-Signature: {signature}   │
      │  ─────────────────────────────────────► │
      │                                          │
      │                  3. Service validates:   │
      │                     - API key exists     │
      │                     - Timestamp < 5 min  │
      │                     - Recalculates HMAC  │
      │                     - Compares signatures │
      │                                          │
      │  ◄─────────────────────────────────────  │
      │  4. 200 OK { status: 'ok', ... }         │
      │     or 401 Unauthorized                  │
```

#### Request headers

| Header | Value | Purpose |
|---|---|---|
| `X-Monitor-Key` | Service API key | Identify which monitor is making the request |
| `X-Monitor-Timestamp` | Unix timestamp (ms) | Prevent replay attacks (5 min window) |
| `X-Monitor-Signature` | HMAC-SHA256 hex | Verify integrity and authenticity |

#### Signature generation (HealthPanel - sender side)

```typescript
// apps/api/src/common/utils/hmac-signer.ts
import { createHmac } from 'crypto';

export function signRequest(
  secretKey: string,
  method: string,
  path: string,
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
  const signature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  return { timestamp, signature };
}
```

#### Signature validation (External service - receiver side)

```typescript
// Generic validation example
function validateMonitorRequest(
  apiKey: string,
  timestamp: string,
  signature: string,
  method: string,
  path: string,
  secretKey: string,
): boolean {
  // 1. Verify the timestamp is not older than 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false; // Replay attack or out-of-sync clock
  }

  // 2. Recalculate the signature
  const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
  const expectedSignature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  // 3. Timing-safe comparison
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}
```

#### Data stored per service

```typescript
// In Service entity
@Entity('services')
class Service {
  // ...
  monitor_api_key: string;    // Public key to identify the monitor
  monitor_secret: string;     // HMAC secret (encrypted in DB)
  // ...
}
```

- When registering a service in HealthPanel, an `api_key` + `secret` pair is generated
- The `secret` is stored encrypted in the DB (AES-256)
- Both values are shown ONCE to the user so they can configure the external service
- The `api_key` can always be viewed; the `secret` only when generated or regenerated

#### Implementation per framework

**NestJS (Guard)**:
```typescript
@Injectable()
export class MonitorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-monitor-key'];
    const timestamp = request.headers['x-monitor-timestamp'];
    const signature = request.headers['x-monitor-signature'];
    // Find secret by apiKey → validate HMAC
  }
}
```

**Laravel (Middleware)**:
```php
class MonitorAuthMiddleware {
  public function handle($request, Closure $next) {
    $apiKey = $request->header('X-Monitor-Key');
    $timestamp = $request->header('X-Monitor-Timestamp');
    $signature = $request->header('X-Monitor-Signature');
    // Find secret by apiKey → validate HMAC with hash_hmac('sha256', ...)
  }
}
```

**Next.js (Middleware)**:
```typescript
// middleware.ts or inside the route handler
const apiKey = request.headers.get('x-monitor-key');
const timestamp = request.headers.get('x-monitor-timestamp');
const signature = request.headers.get('x-monitor-signature');
// Validate HMAC with crypto.createHmac
```

#### Additional security

| Measure | Detail |
|---|---|
| **Replay protection** | Timestamp with 5-minute window |
| **Timing-safe comparison** | `crypto.timingSafeEqual` to avoid timing attacks |
| **Encrypted secret** | AES-256-GCM in DB, key from env var |
| **Key rotation** | "Regenerate credentials" button in dashboard |
| **IP whitelist (optional)** | Optional field on Service to restrict source IPs |
| **Rate limiting** | On external service, max 60 req/min per API key |
| **Mandatory HTTPS** | UI warning if service URL is not HTTPS |
| **GET only** | The /health and /logs endpoints only accept GET |

---

## Monorepo Structure

```
healthpanel/
├── apps/
│   ├── panel/                  # Next.js 15 - Dashboard UI
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/     # UI components
│   │   │   ├── lib/            # Utils, API client, hooks
│   │   │   └── types/          # Shared types
│   │   ├── Dockerfile          # Multi-stage (prod)
│   │   ├── Dockerfile.dev      # Dev with hot reload
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                    # NestJS - Backend API
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/       # JWT Authentication
│       │   │   ├── services/   # Monitored services CRUD
│       │   │   ├── health-checker/  # Health check engine + cron
│       │   │   ├── incidents/  # Incident management
│       │   │   ├── alerts/     # SendGrid + Screenshots
│       │   │   ├── logs/       # Logs proxy
│       │   │   └── settings/   # Global configuration
│       │   ├── database/
│       │   │   ├── entities/       # TypeORM entities
│       │   │   ├── migrations/     # TypeORM migrations
│       │   │   └── seeders/        # Seeders (test user, sample data)
│       │   ├── common/
│       │   │   ├── guards/
│       │   │   ├── decorators/
│       │   │   └── interceptors/
│       │   ├── gateway/        # WebSocket Gateway (Socket.IO)
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── Dockerfile          # Multi-stage (prod)
│       ├── Dockerfile.dev      # Dev with hot reload
│       ├── tsconfig.json
│       ├── ormconfig.ts        # TypeORM config
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types and interfaces
│       ├── src/
│       │   ├── types/
│       │   └── constants/
│       ├── tsconfig.json
│       └── package.json
│
├── external-integrations/      # Code to integrate into external projects
│   ├── nestjs/                 # Health+logs module for NestJS
│   ├── laravel/                # Health+logs controller for Laravel
│   └── nextjs/                 # Health+logs API routes for Next.js
│
├── docker-compose.yml          # Local development (hot reload)
├── docker-compose.prod.yml     # Production
├── .env.example
├── .env                        # (gitignored)
├── package.json                # Root package.json (workspaces)
├── tsconfig.base.json          # TypeScript base config
├── README.md
└── .gitignore
```

---

## General Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Docker Compose                                │
│                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │   Next.js Panel  │  │   NestJS API      │  │  PostgreSQL   │  │
│  │   :PORT_PANEL    │  │   :PORT_API       │  │  :PORT_DB     │  │
│  │                  │  │                   │  │  (volume)     │  │
│  │  - Dashboard UI  │  │  - REST API       │  │               │  │
│  │  - SSR/CSR       │──┤  - Health Checker │──┤               │  │
│  │  - WebSocket     │  │  - Cron Jobs      │  │               │  │
│  │    client        │  │  - Screenshots    │  │               │  │
│  │                  │  │  - Alerts         │  │               │  │
│  │                  │  │  - WS Gateway     │  │               │  │
│  └──────────────────┘  └───────────────────┘  └───────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
         │                        │
         │                        ├── HTTP GET /health → External APIs/Sites
         │                        ├── HTTP GET /logs → External APIs/Sites
         │                        ├── Puppeteer → Screenshots
         │                        └── SendGrid API → Emails
         │
         └── Browser (user)
```

### Components:

1. **Panel (Next.js)**: Web dashboard, consumes backend API, WebSocket client for real-time updates
2. **API (NestJS)**: Full REST API, health checker with cron, WebSocket Gateway, alerts, screenshots
3. **PostgreSQL**: Stores everything. Persistent volume. Configurable port.

---

## Data Model (TypeORM Entities)

```typescript
// User entity (for login)
@Entity('users')
class User {
  id: number;              // PK autoincrement
  username: string;        // unique
  email: string;           // nullable, for password recovery
  password: string;        // bcrypt hash
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Password recovery tokens
@Entity('password_reset_tokens')
class PasswordResetToken {
  id: number;
  user_id: number;         // FK → users
  token: string;           // unique, UUID
  expires_at: Date;
  used_at: Date;           // nullable
}

// Services to monitor
@Entity('services')
class Service {
  id: number;
  name: string;
  url: string;
  type: 'api_nestjs' | 'api_laravel' | 'web_nextjs';
  health_endpoint: string;   // default: /health or /api/health
  logs_endpoint: string;     // default: /logs or /api/logs
  monitor_api_key: string;   // Public key (monitor identification)
  monitor_secret: string;    // HMAC secret (AES-256 encrypted in DB)
  check_interval_seconds: number;
  is_active: boolean;
  alerts_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// Health check history
@Entity('health_checks')
class HealthCheck {
  id: number;
  service_id: number;       // FK → services
  status: 'up' | 'down' | 'degraded';
  response_time_ms: number;
  status_code: number;
  error_message: string;     // nullable
  checked_at: Date;
}

// Incidents
@Entity('incidents')
class Incident {
  id: number;
  service_id: number;        // FK → services
  started_at: Date;
  resolved_at: Date;         // nullable
  screenshot_path: string;   // nullable
  last_logs_snapshot: text;   // nullable, last 100 lines
  email_sent: boolean;
  email_sent_at: Date;       // nullable
}

// Global configuration
@Entity('settings')
class Setting {
  id: number;
  key: string;               // unique
  value: string;
}
```

---

## Environment Variables (.env)

```env
# ─── Ports ───
PORT_PANEL=3044
PORT_API=3045
PORT_DB=5433

# ─── App ───
NODE_ENV=development
PANEL_URL=http://localhost:3044
API_URL=http://localhost:3045

# ─── Database ───
DB_HOST=postgres
DB_PORT=5433
DB_USERNAME=healthpanel
DB_PASSWORD=healthpanel_secret
DB_DATABASE=healthpanel

# ─── Auth ───
JWT_SECRET=your-jwt-secret-change-in-production
ENCRYPTION_KEY=your-aes-256-key-for-secrets-in-db

# ─── SendGrid ───
SENDGRID_API_KEY=SG.xxxxx
ALERT_EMAIL_FROM=monitor@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com

# ─── Monitor ───
DEFAULT_CHECK_INTERVAL=60
SCREENSHOT_TIMEOUT=15000

# ─── Test User (seeder) ───
SEED_USER=admin
SEED_PASSWORD=admin123
```

---

## Docker Compose - Development (Hot Reload)

```yaml
# docker-compose.yml (development)
services:
  panel:
    build:
      context: .
      dockerfile: apps/panel/Dockerfile.dev
    ports:
      - "${PORT_PANEL}:3000"
    volumes:
      - ./apps/panel/src:/app/apps/panel/src        # Hot reload
      - ./packages/shared/src:/app/packages/shared/src
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:${PORT_API}
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.dev
    ports:
      - "${PORT_API}:3000"
    volumes:
      - ./apps/api/src:/app/apps/api/src            # Hot reload
      - ./packages/shared/src:/app/packages/shared/src
      - screenshots:/app/screenshots
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432                                 # internal container port
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    ports:
      - "${PORT_DB}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data              # Persistent volume
    environment:
      - POSTGRES_USER=${DB_USERNAME}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_DATABASE}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:           # PostgreSQL persistence
  screenshots:      # Captured screenshots
```

**Note**: Development Dockerfiles use `node --watch` (NestJS) and `next dev` (Next.js) for hot reload. Volumes mount the local `src/` directly into the container.

---

## /health and /logs Endpoints for External Projects

### NestJS
```typescript
// GET /health
{ status: 'ok', uptime: 12345, timestamp: '...', db: 'connected', memory: {...} }

// GET /logs?lines=100 (protected by X-Monitor-Key header)
{ logs: ['line1', 'line2', ...], total: 100 }
```

### Laravel
```php
// GET /health
{ "status": "ok", "uptime": 12345, "timestamp": "...", "db": "connected" }

// GET /logs?lines=100 (protected by X-Monitor-Key header)
{ "logs": ["line1", "line2", ...], "total": 100 }
```

### Next.js
```typescript
// GET /api/health
{ status: 'ok', uptime: 12345, timestamp: '...' }

// GET /api/logs?lines=100 (protected by X-Monitor-Key header)
{ logs: ['line1', 'line2', ...], total: 100 }
```

---

## DEVELOPMENT PHASES

---

## PHASE 1: Base Infrastructure and Monorepo Setup

**Goal**: Initialized monorepo, dockerized with hot reload, database with migrations and test user seeder.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 1.1: Monorepo initialization
- Root `package.json` with npm workspaces: `apps/*`, `packages/*`
- `tsconfig.base.json` with shared configuration
- Complete `.gitignore`
- `.env.example` with all variables documented
- Initial README.md with project description

### Subtask 1.2: Next.js Panel setup
- `apps/panel`: Next.js 15 LTS with App Router
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
- `Dockerfile.dev` with hot reload (`next dev`)
- `Dockerfile` multi-stage for production
- `tsconfig.json` extending base

### Subtask 1.3: NestJS API setup
- `apps/api`: NestJS (latest LTS version)
- TypeScript strict mode
- `Dockerfile.dev` with hot reload (`nest start --watch` or `node --watch`)
- `Dockerfile` multi-stage for production
- `tsconfig.json` extending base
- Base module with API's own healthcheck

### Subtask 1.4: Shared package setup
- `packages/shared`: Shared types and interfaces
- Types: `ServiceType`, `HealthStatus`, `IncidentStatus`, etc.
- Shared constants
- Build with tsc

### Subtask 1.5: Docker Compose development
- `docker-compose.yml` with services: panel, api, postgres
- Hot reload via volume mounts of `src/`
- Ports configurable from `.env` (`PORT_PANEL`, `PORT_API`, `PORT_DB`)
- PostgreSQL with `pgdata` volume for persistence
- PostgreSQL with healthcheck
- Shared network

### Subtask 1.6: TypeORM configuration and initial migration
- Configure TypeORM in NestJS (NO synchronize, migrations only)
- `ormconfig.ts` / `data-source.ts` with config from env vars
- Entities: User, Service, HealthCheck, Incident, Setting
- Initial migration: `CreateInitialTables`
- Scripts in package.json:
  - `migration:generate` - Generate migration
  - `migration:run` - Run migrations
  - `migration:revert` - Revert last migration
  - `seed:run` - Run seeders

### Subtask 1.7: Seeders
- Test user seeder: `UserSeeder`
  - username: value of `SEED_USER` env var (default: `admin`)
  - password: bcrypt hash of `SEED_PASSWORD` env var (default: `admin123`)
- Initial settings seeder (default configuration)
- Sample services seeder (2-3 demo services)

### Subtask 1.8: Authentication
- `AuthModule` in NestJS:
  - `POST /api/auth/login` → validates credentials, returns JWT
  - `GET /api/auth/profile` → returns current user
  - `JwtAuthGuard` to protect routes
- Login page in Next.js panel
- Middleware in panel to verify token
- httpOnly cookie for session

### Subtask 1.8b: Password change and email recovery
- **Password change** (authenticated user):
  - Backend: `PUT /api/auth/change-password` (protected with JwtAuthGuard)
    - Body: { currentPassword, newPassword, confirmPassword }
    - Validates current password with bcrypt
    - Validates that newPassword !== currentPassword
    - Hashes and updates in DB
  - Frontend: `/settings/password` page or modal in profile
    - Form: current password, new password, confirm
    - Client-side validation (min 8 chars, match confirmation)
- **Password recovery** (unauthenticated user):
  - Add `email` field to User entity (nullable, for recovery)
  - Migration: `AddEmailToUsers`
  - Backend:
    - `POST /api/auth/forgot-password` → receives { email }, generates temporary token (UUID, expires 1h), saves to DB, sends email via SendGrid with reset link
    - `POST /api/auth/reset-password` → receives { token, newPassword }, validates non-expired token, updates password
  - Auxiliary entity/table `password_reset_tokens`: id, user_id, token (unique), expires_at, used_at
  - Frontend:
    - `/forgot-password` page: email form, sends request
    - `/reset-password?token=xxx` page: new password form
  - Email template: HTML with link to panel + token
  - Update middleware to allow public routes: /forgot-password, /reset-password

### Subtask 1.9: Tests and security Phase 1
- Unit tests: AuthService, login endpoint, change-password, forgot-password, reset-password
- Verify passwords are hashed with bcrypt
- Verify JWT has expiration
- Verify reset tokens expire correctly
- Verify no hardcoded secrets
- Verify synchronize is false in TypeORM
- Verify Docker compose starts correctly

**Phase 1 acceptance criteria:**
- [ ] `docker compose up` starts panel + api + postgres without errors
- [ ] Hot reload works in panel and api
- [ ] Migrations run correctly
- [ ] Seeder creates the test user
- [ ] Login works with seeder credentials
- [ ] Password change works when authenticated
- [ ] Password recovery sends email and allows reset
- [ ] Ports are configurable from .env
- [ ] PostgreSQL persists data between restarts (volume)
- [ ] Tests pass
- [ ] No obvious security vulnerabilities

---

## PHASE 2: Services CRUD and Base Dashboard

**Goal**: Functional panel to manage monitored services and main dashboard view.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 2.1: Services API CRUD (NestJS)
- `ServicesModule` with controller and service:
  - `POST /api/services` - Create service (auto-generates `monitor_api_key` + `monitor_secret`)
  - `GET /api/services` - List services (with pagination, secret hidden)
  - `GET /api/services/:id` - Service detail (secret hidden)
  - `PUT /api/services/:id` - Update service
  - `DELETE /api/services/:id` - Delete service (soft delete)
  - `POST /api/services/:id/regenerate-keys` - Regenerate api_key + secret (shows secret ONCE)
- When creating service: generate `api_key` (uuid) + `secret` (random 64 hex chars) pair
- `monitor_secret` is saved encrypted (AES-256-GCM) in DB
- Secret is only returned in CREATE and REGENERATE responses (never in GET/LIST)
- Validation with `class-validator` and DTOs
- All endpoints protected with JwtAuthGuard
- `HmacSigner` utility for signing outgoing requests to external services

### Subtask 2.2: UI - Services management (Next.js)
- `/services` page with table of registered services
- Apply complete Design System (Enterprise Security Theme)
- Modal/form for adding/editing service:
  - Name, URL, type (NestJS API / Laravel API / Next.js Web)
  - Health endpoint (default by type)
  - Logs endpoint (default by type)
  - Check interval (30s, 1m, 5m, 10m)
  - Active/inactive toggle
  - Alerts enabled toggle
- On create: show modal with generated `api_key` + `secret` (copyable, "shown only once" notice)
- "Regenerate credentials" button in service detail (with confirmation)
- Actions: edit, delete, toggle active, regenerate keys
- Visual warning if URL doesn't use HTTPS

### Subtask 2.3: Main dashboard (Next.js)
- Layout with sidebar navigation (Dashboard, Services, Settings)
- Main view with service cards grid:
  - Name and type (badge)
  - Current status (green/red/yellow indicator)
  - Response time
  - Uptime last 24h
  - Last check (relative timestamp)
- Responsive design

### Subtask 2.4: Service detail view
- `/services/[id]` page
- Tabs: Overview, Health Checks, Incidents, Logs
- Overview tab: response time chart (last 24h), general stats
- Health Checks tab: paginated table with history
- Incidents tab: incident history
- "Check Now" button (manual check)

### Subtask 2.5: Tests and security Phase 2
- Unit tests: ServicesService CRUD
- Integration tests: CRUD endpoints
- Verify validations reject malicious input
- Verify endpoints are protected (401 without token)
- Verify input sanitization (prevent XSS/injection)

**Phase 2 acceptance criteria:**
- [ ] Services CRUD works correctly
- [ ] Dashboard shows service cards
- [ ] Detail view shows service information
- [ ] UI is responsive
- [ ] All endpoints are protected
- [ ] Tests pass
- [ ] No security vulnerabilities

---

## PHASE 3: Health Check Engine

**Goal**: Automated health check system with real-time results and incident detection.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 3.1: Health Checker Service (NestJS)
- `HealthCheckerModule` with cron jobs via `@nestjs/schedule`
- Check logic per service:
  1. Sign request with HMAC-SHA256 (using `HmacSigner` + service secret)
  2. HTTP GET to health endpoint with headers `X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`
  3. Evaluate: status code, response time, body
  4. Classify: `up` (200 + ok), `down` (error/timeout/!200), `degraded` (200 but >3s)
  5. Save to `health_checks` table
- Configurable timeout (default 10s)
- Retry: 1 retry before marking as down
- Dynamic cron: respect each service's interval

### Subtask 3.2: Incident detection and management
- On detecting `down`:
  1. Check if there is an open incident for the service
  2. If not, create new incident
  3. Fire event for alerts (Phase 4)
- On detecting `up` after `down`:
  1. Close incident (set `resolved_at`)
  2. Emit recovery event

### Subtask 3.3: WebSocket Gateway (NestJS → Next.js)
- `MonitorGateway` using `@nestjs/websockets` + Socket.IO
- Emitted events:
  - `health:update` → new check result
  - `incident:new` → new incident
  - `incident:resolved` → incident resolved
  - `service:update` → service change
- Client in Next.js panel listens and updates UI in real time

### Subtask 3.4: Manual check endpoint
- `POST /api/services/:id/check` → execute immediate check
- Returns result
- Emits WebSocket event

### Subtask 3.5: Tests and security Phase 3
- Unit tests: HealthCheckerService, classification logic
- Unit tests: incident detection
- Integration test: manual check endpoint
- Verify timeout handling (doesn't hang)
- Verify requests are not made to private IPs/localhost (SSRF prevention)

**Phase 3 acceptance criteria:**
- [ ] Health checks run automatically per interval
- [ ] Results are saved to DB
- [ ] Incidents are created/resolved automatically
- [ ] Dashboard updates in real time via WebSocket
- [ ] Manual check works
- [ ] Tests pass
- [ ] No SSRF vulnerabilities

---

## PHASE 4: Alert System (SendGrid + Screenshots + Logs)

**Goal**: Email alerts with screenshot and last 100 log lines from the failed service.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 4.1: SendGrid integration
- `AlertsModule` with `AlertsService`
- Email sending via `@sendgrid/mail`
- HTML template for alert:
  - Service name and URL
  - Failure timestamp
  - Error code
  - Attached screenshot (if available)
  - Last 100 log lines
  - Link to dashboard
- Config from env/settings: `SENDGRID_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`

### Subtask 4.2: Screenshot capture
- Puppeteer service in NestJS
- Headless Chrome in Docker (via `puppeteer` with bundled chromium or separate container)
- Flow: incident detected → if web type → capture screenshot
- Save to `/screenshots/{service_id}_{timestamp}.png`
- 15s timeout, graceful fallback

### Subtask 4.3: Log collection on failure
- On incident detection:
  1. Sign request with HMAC-SHA256 (same logic as health checks)
  2. GET to logs endpoint with signed headers (`X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`)
  3. Save to `incidents.last_logs_snapshot`
  4. If no response: "logs not available"
- 10s timeout

### Subtask 4.4: Complete alert flow
- Orchestrate: incident → (screenshot + logs in parallel) → email
- Rate limiting: max 1 email per service every 5 min
- Mark `email_sent` and `email_sent_at` on incident
- Recovery email when resolved (optional, configurable)

### Subtask 4.5: Settings page in dashboard
- `/settings` page in panel:
  - Alert recipient email
  - Enable/disable alerts globally
  - Minimum interval between alerts
- API endpoints for settings in NestJS

### Subtask 4.6: Tests and security Phase 4
- Unit tests: AlertsService (mock SendGrid)
- Unit tests: ScreenshotService (mock Puppeteer)
- Tests: complete flow with mocks
- Verify SendGrid API keys are not exposed in responses
- Verify rate limiting works
- Verify screenshots are not served publicly

**Phase 4 acceptance criteria:**
- [ ] Email is sent when a service goes down
- [ ] Email includes screenshot (for websites)
- [ ] Email includes last 100 log lines
- [ ] Rate limiting works (no spam)
- [ ] Settings configurable from dashboard
- [ ] Tests pass
- [ ] No secrets are exposed

---

## PHASE 5: Log Visualization in the Dashboard

**Goal**: Display logs from any monitored service from the dashboard.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 5.1: Logs proxy API (NestJS)
- `LogsModule`:
  - `GET /api/services/:id/logs?lines=100` → proxy to service endpoint
  - Adds `X-Monitor-Key` header
  - Error handling if service doesn't respond
  - 30s cache to avoid overload

### Subtask 5.2: LogViewer component (Next.js)
- Terminal-style LogViewer component:
  - Dark background, monospace font
  - Auto-scroll to bottom
  - Lines selector (50, 100, 200, 500)
  - Refresh button
  - Text search/filter
  - Syntax highlighting: ERROR (red), WARN (yellow), INFO (blue)
- Integrate in `/services/[id]` tab "Logs"

### Subtask 5.3: Auto-refresh logs
- Auto-refresh toggle with intervals (5s, 10s, 30s)
- Visual "updating..." indicator
- No refresh if tab is not active (performance)

### Subtask 5.4: Tests and security Phase 5
- Tests: LogsService proxy
- Verify logs cannot be accessed without authentication
- Verify proxy is not open (only registered services)
- Verify no log injection in UI (XSS)

**Phase 5 acceptance criteria:**
- [ ] Logs visible from the dashboard
- [ ] LogViewer has terminal appearance
- [ ] Text filter works
- [ ] Auto-refresh works without memory leaks
- [ ] Tests pass
- [ ] No XSS or open proxy

---

## PHASE 6: Health and Logs Endpoints for External Projects

**Goal**: Ready-to-copy/integrate code for existing NestJS, Laravel and Next.js projects.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 6.1: Module for NestJS
- `external-integrations/nestjs/`
- `HealthModule` with controller:
  - `GET /health` → status, uptime, DB, memory
  - `GET /logs?lines=100` → last N log lines
- `MonitorGuard`: validates HMAC-SHA256 signature
  - Extracts `X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`
  - Looks up secret by api_key in config/env
  - Validates timestamp (5 min window)
  - Recalculates HMAC and compares with `timingSafeEqual`
- Config via env vars: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README with step-by-step integration instructions

### Subtask 6.2: Package for Laravel
- `external-integrations/laravel/`
- `HealthController` + routes + middleware
  - `GET /health` → status, uptime, DB
  - `GET /logs?lines=100` → last N lines of `storage/logs/laravel.log`
- `MonitorAuthMiddleware`: validates HMAC-SHA256
  - Uses `hash_hmac('sha256', ...)` + `hash_equals()` (timing-safe)
  - Validates timestamp (5 min window)
- Config via `.env`: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README with instructions

### Subtask 6.3: API Routes for Next.js
- `external-integrations/nextjs/`
- `app/api/health/route.ts` and `app/api/logs/route.ts`
- `validateMonitorRequest()` helper: validates HMAC-SHA256
  - Uses `crypto.createHmac` + `crypto.timingSafeEqual`
  - Validates timestamp (5 min window)
- Config via env vars: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README with instructions

### Subtask 6.4: Tests Phase 6
- Unit tests for each integration
- HMAC validation tests: correct signature, invalid signature, expired timestamp, replay
- Verify consistent response format across frameworks
- Verify requests without headers or invalid headers return 401

**Phase 6 acceptance criteria:**
- [ ] Code ready for each framework
- [ ] Consistent response format
- [ ] HMAC-SHA256 auth works correctly
- [ ] Replay attacks are rejected (timestamp > 5 min)
- [ ] Clear documentation with step-by-step instructions
- [ ] Tests pass

---

## PHASE 7: Polish, Production and Final Documentation

**Goal**: Stable, optimized and documented project.

**Development agent**: Sonnet 4.6
**Phase review**: Opus 4.6

### Subtask 7.1: Production Docker
- Optimize multi-stage Dockerfiles (cache layers)
- `docker-compose.prod.yml`:
  - No code volume mounts
  - Restart policies: `unless-stopped`
  - Internal health checks for each container
  - Resource limits
- PostgreSQL backup script

### Subtask 7.2: Edge case handling
- Worker restarts → recover check state
- PostgreSQL unavailable → retry with backoff
- SendGrid fails → log and retry
- Automatic cleanup: health_checks > 30 days, screenshots > 30 days
- Migration for performance indexes (service_id + checked_at)

### Subtask 7.3: E2E tests and final security
- E2E test: complete flow check → incident → alert
- Security audit:
  - OWASP top 10 review
  - Verify security headers (CORS, CSP, etc.)
  - Verify no endpoints exposed without auth
  - Rate limiting on login (brute force prevention)
  - Verify sensitive env vars are not leaked
- Performance test: 30 simultaneous services

### Subtask 7.4: Complete README.md
- Project description
- Architecture
- Requirements (Docker, Node LTS)
- Quick start (dev and prod)
- Environment variables configuration
- How to add monitored services
- How to integrate endpoints into existing projects
- Useful commands (migrations, seeders, etc.)
- Troubleshooting

**Phase 7 acceptance criteria:**
- [ ] Production docker compose works
- [ ] All tests pass
- [ ] Security audit with no critical findings
- [ ] Complete and clear README
- [ ] Project ready to deploy
- [ ] pnpm audit fix

---

## Per-Phase Workflow

```
For each PHASE:
  1. Sonnet 4.6 develops all subtasks sequentially
  2. When ALL subtasks are completed (including tests/security):
     → Opus 4.6 performs full review:
       - Verifies acceptance criteria
       - Looks for hallucinations (fake imports, invented APIs)
       - Validates code compiles and is functional
       - Reviews consistency with monorepo architecture
       - Checks for no security vulnerabilities
       - Certifies advancement to next phase
  3. If issues found → Sonnet fixes → Opus re-verifies
  4. Phase certified → next phase
```

---

## Main Dependencies

### Panel (Next.js)
- next (LTS), react, react-dom
- tailwindcss, shadcn/ui
- socket.io-client
- recharts (charts)
- date-fns

### API (NestJS)
- @nestjs/core, @nestjs/common (LTS)
- @nestjs/typeorm, typeorm, pg
- @nestjs/schedule (cron)
- @nestjs/websockets, @nestjs/platform-socket.io
- @nestjs/jwt, @nestjs/passport, passport-jwt
- @sendgrid/mail
- puppeteer
- bcrypt
- class-validator, class-transformer
- node-cron

### Shared
- TypeScript types/interfaces

---

## Complexity Estimation by Phase

| Phase | Complexity | Subtasks |
|------|-------------|-----------|
| 1. Base Infrastructure | High | 9 |
| 2. CRUD and Dashboard | Medium | 5 |
| 3. Health Checks | High | 5 |
| 4. Alerts | High | 6 |
| 5. Logs UI | Medium | 4 |
| 6. External Endpoints | Low | 4 |
| 7. Polish and Docs | Medium | 4 |
| **Total** | | **37 subtasks** |
