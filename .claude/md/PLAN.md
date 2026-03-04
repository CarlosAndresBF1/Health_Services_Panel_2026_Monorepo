# HealthPanel - Plan de Proyecto

## Resumen Ejecutivo

Dashboard de monitoreo en tiempo real para APIs (NestJS, Laravel) y sitios web (Next.js). Incluye health checks automatizados, visualización de logs, alertas por email con screenshots y contexto enriquecido. Monorepo con Next.js (panel) y NestJS (API). Dockerizado con hot reload para desarrollo local.

---

## Decisiones Arquitectónicas

| Aspecto | Decisión |
|---|---|
| Estructura | Monorepo (`apps/panel` + `apps/api`) |
| Frontend | Next.js 15 LTS (App Router) |
| Backend/API | NestJS (última versión LTS) |
| Node.js | Última versión LTS (v22.x) |
| ORM | TypeORM con migraciones y seeders (NO synchronize) |
| Base de datos | PostgreSQL (puerto configurable, volumen persistente) |
| Monitoreo de logs | Endpoints `/logs` en cada proyecto externo |
| Autenticación | Login simple (usuario/password) con seeder de usuario test |
| Screenshots | Puppeteer (headless Chrome) |
| Alertas | SendGrid API |
| Contenedores | Docker + Docker Compose (hot reload en dev) |
| Escala objetivo | 10-30 servicios |
| Tiempo real | WebSockets (Socket.IO vía NestJS Gateway) |
| Testing | Jest + verificaciones de seguridad por fase |
| Lenguaje | TypeScript strict en ambas apps (panel + api) |
| UI Theme | Enterprise Security Dark Theme (ver sección Design System) |
| Seguridad endpoints externos | HMAC-SHA256 signed requests (ver sección Seguridad) |

---

## Design System - Enterprise Security Theme

### Paleta de Colores

| Token | Hex | Uso |
|---|---|---|
| `--primary` | `#111827` | Fondos de componentes, cards, sidebar |
| `--primary-hover` | `#0B1220` | Hover states de componentes primary |
| `--accent` | `#C8A951` | Botones principales, badges premium, indicadores activos, links |
| `--accent-tech` | `#60A5FA` | Gráficas, datos en tiempo real, badges info, links secundarios |
| `--background` | `#0A0F1A` | Fondo principal de la app |
| `--surface` | `#111827` | Cards, modals, dropdowns, table rows |
| `--text-primary` | `#F3F4F6` | Texto principal, títulos, valores |
| `--text-muted` | `#9CA3AF` | Texto secundario, labels, timestamps |

### Colores de Estado (Health Checks)

| Estado | Color | Uso |
|---|---|---|
| UP / Online | `#22C55E` (green-500) | Indicador verde, badge "Online" |
| DOWN / Offline | `#EF4444` (red-500) | Indicador rojo, badge "Offline", alertas |
| DEGRADED / Slow | `#F59E0B` (amber-500) | Indicador amarillo, badge "Degraded" |
| UNKNOWN / Pending | `#6B7280` (gray-500) | Sin datos aún |

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

### Lineamientos de UI

- **Estilo general**: Dark enterprise, minimalista, bordes sutiles (`border-white/10`)
- **Cards**: `bg-surface border border-white/10 rounded-lg` con hover `hover:border-accent/30`
- **Sidebar**: `bg-primary` fijo a la izquierda, iconos + labels, accent gold para item activo
- **Botones primarios**: `bg-accent text-background hover:bg-accent/90` (gold sobre oscuro)
- **Botones secundarios**: `bg-white/5 text-text-primary border border-white/10`
- **Tablas**: Rows alternados con `bg-surface` y `bg-background`, hover `bg-white/5`
- **LogViewer**: Fondo `#0A0F1A`, font `font-mono`, texto `text-text-muted`, errors en `text-status-down`
- **Gráficas**: Línea principal en `accent-tech` (#60A5FA), fill con opacity 10%
- **Badges de tipo**: NestJS (red-500), Laravel (orange-500), Next.js (white)
- **Transiciones**: `transition-all duration-200`
- **Shadows**: Mínimas, usar bordes semi-transparentes en su lugar
- **Glassmorphism sutil**: En modals `bg-surface/95 backdrop-blur-sm`

---

## Modelo de Seguridad para Endpoints Externos

### Problema

HealthPanel necesita consultar endpoints `/health` y `/logs` en proyectos externos (NestJS, Laravel, Next.js). Estos endpoints exponen información sensible (logs, estado del sistema). Se necesita un mecanismo de autenticación robusto que:

1. No dependa de un servicio centralizado de auth
2. Sea fácil de implementar en cada framework
3. Proteja contra replay attacks
4. Permita revocar acceso individualmente por servicio

### Solución: HMAC-SHA256 Signed Requests

Cada servicio monitoreado tiene un **secret key** compartido entre HealthPanel y el servicio. Las requests se firman con HMAC-SHA256.

#### Flujo de autenticación

```
HealthPanel (API)                          Servicio Externo
      │                                          │
      │  1. Genera signature:                     │
      │     timestamp = Date.now()                │
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
      │                  3. Servicio valida:      │
      │                     - API key existe      │
      │                     - Timestamp < 5 min   │
      │                     - Recalcula HMAC      │
      │                     - Compara signatures  │
      │                                          │
      │  ◄─────────────────────────────────────  │
      │  4. 200 OK { status: 'ok', ... }         │
      │     o 401 Unauthorized                   │
```

#### Headers de la request

| Header | Valor | Propósito |
|---|---|---|
| `X-Monitor-Key` | API key del servicio | Identificar qué monitor está haciendo la request |
| `X-Monitor-Timestamp` | Unix timestamp (ms) | Prevenir replay attacks (ventana de 5 min) |
| `X-Monitor-Signature` | HMAC-SHA256 hex | Verificar integridad y autenticidad |

#### Generación de signature (HealthPanel - lado del emisor)

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

#### Validación de signature (Servicio externo - lado del receptor)

```typescript
// Ejemplo genérico de validación
function validateMonitorRequest(
  apiKey: string,
  timestamp: string,
  signature: string,
  method: string,
  path: string,
  secretKey: string,
): boolean {
  // 1. Verificar que el timestamp no tiene más de 5 minutos
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false; // Replay attack o reloj desincronizado
  }

  // 2. Recalcular la signature
  const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
  const expectedSignature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  // 3. Comparación timing-safe
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}
```

#### Datos almacenados por servicio

```typescript
// En la entity Service
@Entity('services')
class Service {
  // ...
  monitor_api_key: string;    // Key pública para identificar al monitor
  monitor_secret: string;     // Secret para HMAC (encriptado en BD)
  // ...
}
```

- Al registrar un servicio en HealthPanel, se genera un par `api_key` + `secret`
- El `secret` se guarda encriptado en la BD (AES-256)
- Ambos valores se muestran UNA VEZ al usuario para que los configure en el servicio externo
- El `api_key` se puede ver siempre, el `secret` solo al generarlo o regenerarlo

#### Implementación por framework

**NestJS (Guard)**:
```typescript
@Injectable()
export class MonitorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-monitor-key'];
    const timestamp = request.headers['x-monitor-timestamp'];
    const signature = request.headers['x-monitor-signature'];
    // Buscar secret por apiKey → validar HMAC
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
    // Buscar secret por apiKey → validar HMAC con hash_hmac('sha256', ...)
  }
}
```

**Next.js (Middleware)**:
```typescript
// middleware.ts o dentro del route handler
const apiKey = request.headers.get('x-monitor-key');
const timestamp = request.headers.get('x-monitor-timestamp');
const signature = request.headers.get('x-monitor-signature');
// Validar HMAC con crypto.createHmac
```

#### Seguridad adicional

| Medida | Detalle |
|---|---|
| **Replay protection** | Timestamp con ventana de 5 minutos |
| **Timing-safe comparison** | `crypto.timingSafeEqual` para evitar timing attacks |
| **Secret encriptado** | AES-256-GCM en BD, key desde env var |
| **Rotación de keys** | Botón "Regenerar credenciales" en el dashboard |
| **IP whitelist (opcional)** | Campo opcional en Service para limitar IPs origen |
| **Rate limiting** | En el servicio externo, max 60 req/min por API key |
| **HTTPS obligatorio** | Advertencia en UI si la URL del servicio no es HTTPS |
| **Solo GET** | Los endpoints /health y /logs solo aceptan GET |

---

## Estructura del Monorepo

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
│   │   ├── Dockerfile.dev      # Dev con hot reload
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                    # NestJS - Backend API
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/       # Autenticación JWT
│       │   │   ├── services/   # CRUD servicios monitoreados
│       │   │   ├── health-checker/  # Motor de health checks + cron
│       │   │   ├── incidents/  # Gestión de incidentes
│       │   │   ├── alerts/     # SendGrid + Screenshots
│       │   │   ├── logs/       # Proxy de logs
│       │   │   └── settings/   # Configuración global
│       │   ├── database/
│       │   │   ├── entities/       # TypeORM entities
│       │   │   ├── migrations/     # TypeORM migrations
│       │   │   └── seeders/        # Seeders (usuario test, datos ejemplo)
│       │   ├── common/
│       │   │   ├── guards/
│       │   │   ├── decorators/
│       │   │   └── interceptors/
│       │   ├── gateway/        # WebSocket Gateway (Socket.IO)
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── Dockerfile          # Multi-stage (prod)
│       ├── Dockerfile.dev      # Dev con hot reload
│       ├── tsconfig.json
│       ├── ormconfig.ts        # TypeORM config
│       └── package.json
│
├── packages/
│   └── shared/                 # Tipos e interfaces compartidas
│       ├── src/
│       │   ├── types/
│       │   └── constants/
│       ├── tsconfig.json
│       └── package.json
│
├── external-integrations/      # Código para integrar en proyectos externos
│   ├── nestjs/                 # Módulo health+logs para NestJS
│   ├── laravel/                # Controller health+logs para Laravel
│   └── nextjs/                 # API routes health+logs para Next.js
│
├── docker-compose.yml          # Desarrollo local (hot reload)
├── docker-compose.prod.yml     # Producción
├── .env.example
├── .env                        # (gitignored)
├── package.json                # Root package.json (workspaces)
├── tsconfig.base.json          # TypeScript config base
├── README.md
└── .gitignore
```

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────────────┐
│                     Docker Compose                                │
│                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │   Next.js Panel  │  │   NestJS API      │  │  PostgreSQL   │  │
│  │   :PORT_PANEL    │  │   :PORT_API       │  │  :PORT_DB     │  │
│  │                  │  │                   │  │  (volumen)    │  │
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
         │                        ├── HTTP GET /health → APIs/Sitios externos
         │                        ├── HTTP GET /logs → APIs/Sitios externos
         │                        ├── Puppeteer → Screenshots
         │                        └── SendGrid API → Emails
         │
         └── Browser (usuario)
```

### Componentes:

1. **Panel (Next.js)**: Dashboard web, consume API del backend, WebSocket client para tiempo real
2. **API (NestJS)**: REST API completa, health checker con cron, WebSocket Gateway, alertas, screenshots
3. **PostgreSQL**: Almacena todo. Volumen persistente. Puerto configurable.

---

## Modelo de Datos (TypeORM Entities)

```typescript
// User entity (para login)
@Entity('users')
class User {
  id: number;              // PK autoincrement
  username: string;        // unique
  password: string;        // bcrypt hash
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Servicios a monitorear
@Entity('services')
class Service {
  id: number;
  name: string;
  url: string;
  type: 'api_nestjs' | 'api_laravel' | 'web_nextjs';
  health_endpoint: string;   // default: /health o /api/health
  logs_endpoint: string;     // default: /logs o /api/logs
  monitor_api_key: string;   // Key pública (identificación del monitor)
  monitor_secret: string;    // Secret HMAC (encriptado AES-256 en BD)
  check_interval_seconds: number;
  is_active: boolean;
  alerts_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// Historial de health checks
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

// Incidentes
@Entity('incidents')
class Incident {
  id: number;
  service_id: number;        // FK → services
  started_at: Date;
  resolved_at: Date;         // nullable
  screenshot_path: string;   // nullable
  last_logs_snapshot: text;   // nullable, últimas 100 líneas
  email_sent: boolean;
  email_sent_at: Date;       // nullable
}

// Configuración global
@Entity('settings')
class Setting {
  id: number;
  key: string;               // unique
  value: string;
}
```

---

## Variables de Entorno (.env)

```env
# ─── Puertos ───
PORT_PANEL=3044
PORT_API=3045
PORT_DB=5433

# ─── App ───
NODE_ENV=development
PANEL_URL=http://localhost:3044
API_URL=http://localhost:3045

# ─── Base de datos ───
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

## Docker Compose - Desarrollo (Hot Reload)

```yaml
# docker-compose.yml (desarrollo)
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
      - DB_PORT=5432                                 # interno al container
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    ports:
      - "${PORT_DB}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data              # Volumen persistente
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
  pgdata:           # Persistencia de PostgreSQL
  screenshots:      # Screenshots capturados
```

**Nota**: En los Dockerfiles de desarrollo se usa `node --watch` (NestJS) y `next dev` (Next.js) para hot reload. Los volúmenes montan el `src/` local directamente en el contenedor.

---

## Endpoints /health y /logs para proyectos externos

### NestJS
```typescript
// GET /health
{ status: 'ok', uptime: 12345, timestamp: '...', db: 'connected', memory: {...} }

// GET /logs?lines=100 (protegido por X-Monitor-Key header)
{ logs: ['line1', 'line2', ...], total: 100 }
```

### Laravel
```php
// GET /health
{ "status": "ok", "uptime": 12345, "timestamp": "...", "db": "connected" }

// GET /logs?lines=100 (protegido por X-Monitor-Key header)
{ "logs": ["line1", "line2", ...], "total": 100 }
```

### Next.js
```typescript
// GET /api/health
{ status: 'ok', uptime: 12345, timestamp: '...' }

// GET /api/logs?lines=100 (protegido por X-Monitor-Key header)
{ logs: ['line1', 'line2', ...], total: 100 }
```

---

## FASES DE DESARROLLO

---

## FASE 1: Infraestructura Base y Setup del Monorepo

**Objetivo**: Monorepo inicializado, dockerizado con hot reload, base de datos con migraciones y seeder de usuario test.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 1.1: Inicialización del monorepo
- Root `package.json` con npm workspaces: `apps/*`, `packages/*`
- `tsconfig.base.json` con configuración compartida
- `.gitignore` completo
- `.env.example` con todas las variables documentadas
- README.md inicial con descripción del proyecto

### Subtarea 1.2: Setup Next.js Panel
- `apps/panel`: Next.js 15 LTS con App Router
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
- `Dockerfile.dev` con hot reload (`next dev`)
- `Dockerfile` multi-stage para producción
- `tsconfig.json` extendiendo base

### Subtarea 1.3: Setup NestJS API
- `apps/api`: NestJS (última versión LTS)
- TypeScript strict mode
- `Dockerfile.dev` con hot reload (`nest start --watch` o `node --watch`)
- `Dockerfile` multi-stage para producción
- `tsconfig.json` extendiendo base
- Módulo base con healthcheck propio del API

### Subtarea 1.4: Setup shared package
- `packages/shared`: Tipos e interfaces compartidas
- Types: `ServiceType`, `HealthStatus`, `IncidentStatus`, etc.
- Constants compartidas
- Build con tsc

### Subtarea 1.5: Docker Compose desarrollo
- `docker-compose.yml` con servicios: panel, api, postgres
- Hot reload via volume mounts de `src/`
- Puertos configurables desde `.env` (`PORT_PANEL`, `PORT_API`, `PORT_DB`)
- PostgreSQL con volumen `pgdata` para persistencia
- PostgreSQL con healthcheck
- Network compartida

### Subtarea 1.6: TypeORM configuración y migración inicial
- Configurar TypeORM en NestJS (NO synchronize, solo migraciones)
- `ormconfig.ts` / `data-source.ts` con config desde env vars
- Entities: User, Service, HealthCheck, Incident, Setting
- Migración inicial: `CreateInitialTables`
- Scripts en package.json:
  - `migration:generate` - Generar migración
  - `migration:run` - Ejecutar migraciones
  - `migration:revert` - Revertir última migración
  - `seed:run` - Ejecutar seeders

### Subtarea 1.7: Seeders
- Seeder de usuario test: `UserSeeder`
  - username: valor de `SEED_USER` env var (default: `admin`)
  - password: hash bcrypt de `SEED_PASSWORD` env var (default: `admin123`)
- Seeder de settings iniciales (configuración por defecto)
- Seeder de servicios de ejemplo (2-3 servicios demo)

### Subtarea 1.8: Autenticación
- Módulo `AuthModule` en NestJS:
  - `POST /api/auth/login` → valida credentials, retorna JWT
  - `GET /api/auth/profile` → retorna usuario actual
  - `JwtAuthGuard` para proteger rutas
- Login page en Next.js panel
- Middleware en panel para verificar token
- Cookie httpOnly para sesión

### Subtarea 1.9: Tests y seguridad Fase 1
- Tests unitarios: AuthService, login endpoint
- Verificar que passwords se hashean con bcrypt
- Verificar que JWT tiene expiración
- Verificar que no hay secrets hardcodeados
- Verificar que synchronize está en false en TypeORM
- Verificar que Docker compose levanta correctamente

**Criterios de aceptación Fase 1:**
- [ ] `docker compose up` levanta panel + api + postgres sin errores
- [ ] Hot reload funciona en panel y api
- [ ] Las migraciones se ejecutan correctamente
- [ ] El seeder crea el usuario test
- [ ] Login funciona con las credenciales del seeder
- [ ] Los puertos son configurables desde .env
- [ ] PostgreSQL persiste datos entre reinicios (volumen)
- [ ] Tests pasan
- [ ] No hay vulnerabilidades de seguridad obvias

---

## FASE 2: CRUD de Servicios y Dashboard Base

**Objetivo**: Panel funcional para gestionar servicios a monitorear y vista principal del dashboard.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 2.1: API CRUD de servicios (NestJS)
- `ServicesModule` con controller y service:
  - `POST /api/services` - Crear servicio (auto-genera `monitor_api_key` + `monitor_secret`)
  - `GET /api/services` - Listar servicios (con paginación, secret oculto)
  - `GET /api/services/:id` - Detalle de servicio (secret oculto)
  - `PUT /api/services/:id` - Actualizar servicio
  - `DELETE /api/services/:id` - Eliminar servicio (soft delete)
  - `POST /api/services/:id/regenerate-keys` - Regenerar api_key + secret (muestra secret UNA vez)
- Al crear servicio: generar par `api_key` (uuid) + `secret` (random 64 hex chars)
- `monitor_secret` se guarda encriptado (AES-256-GCM) en BD
- El secret solo se retorna en la response de CREATE y REGENERATE (nunca en GET/LIST)
- Validación con `class-validator` y DTOs
- Todos los endpoints protegidos con JwtAuthGuard
- Utilidad `HmacSigner` para firmar requests salientes a servicios externos

### Subtarea 2.2: UI - Gestión de servicios (Next.js)
- Página `/services` con tabla de servicios registrados
- Aplicar Design System completo (Enterprise Security Theme)
- Modal/formulario para agregar/editar servicio:
  - Nombre, URL, tipo (NestJS API / Laravel API / Next.js Web)
  - Health endpoint (default según tipo)
  - Logs endpoint (default según tipo)
  - Intervalo de check (30s, 1m, 5m, 10m)
  - Toggle activo/inactivo
  - Toggle alertas habilitadas
- Al crear: mostrar modal con `api_key` + `secret` generados (copiable, aviso de "solo se muestra una vez")
- Botón "Regenerar credenciales" en detalle del servicio (con confirmación)
- Acciones: editar, eliminar, toggle activo, regenerar keys
- Advertencia visual si la URL no usa HTTPS

### Subtarea 2.3: Dashboard principal (Next.js)
- Layout con sidebar navigation (Dashboard, Services, Settings)
- Vista principal con grid de cards de servicios:
  - Nombre y tipo (badge)
  - Estado actual (indicador verde/rojo/amarillo)
  - Tiempo de respuesta
  - Uptime últimas 24h
  - Último check (timestamp relativo)
- Responsive design

### Subtarea 2.4: Vista detalle de servicio
- Página `/services/[id]`
- Tabs: Overview, Health Checks, Incidents, Logs
- Tab Overview: gráfica de response time (últimas 24h), stats generales
- Tab Health Checks: tabla paginada con historial
- Tab Incidents: historial de incidentes
- Botón "Check Now" (check manual)

### Subtarea 2.5: Tests y seguridad Fase 2
- Tests unitarios: ServicesService CRUD
- Tests de integración: endpoints CRUD
- Verificar que validaciones rechazan input malicioso
- Verificar que endpoints están protegidos (401 sin token)
- Verificar sanitización de inputs (prevenir XSS/injection)

**Criterios de aceptación Fase 2:**
- [ ] CRUD de servicios funciona correctamente
- [ ] Dashboard muestra cards de servicios
- [ ] Vista detalle muestra información del servicio
- [ ] UI es responsiva
- [ ] Todos los endpoints están protegidos
- [ ] Tests pasan
- [ ] No hay vulnerabilidades de seguridad

---

## FASE 3: Motor de Health Checks

**Objetivo**: Sistema automatizado de health checks con resultados en tiempo real y detección de incidentes.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 3.1: Health Checker Service (NestJS)
- `HealthCheckerModule` con cron jobs via `@nestjs/schedule`
- Lógica de check por servicio:
  1. Firmar request con HMAC-SHA256 (usando `HmacSigner` + secret del servicio)
  2. HTTP GET al health endpoint con headers `X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`
  3. Evaluar: status code, response time, body
  4. Clasificar: `up` (200 + ok), `down` (error/timeout/!200), `degraded` (200 pero >3s)
  5. Guardar en `health_checks` table
- Timeout configurable (default 10s)
- Retry: 1 retry antes de marcar como down
- Cron dinámico: respetar intervalo de cada servicio

### Subtarea 3.2: Detección y gestión de incidentes
- Al detectar `down`:
  1. Verificar si hay incidente abierto para el servicio
  2. Si no, crear nuevo incidente
  3. Disparar evento para alertas (Fase 4)
- Al detectar `up` después de `down`:
  1. Cerrar incidente (set `resolved_at`)
  2. Emitir evento de recuperación

### Subtarea 3.3: WebSocket Gateway (NestJS → Next.js)
- `MonitorGateway` usando `@nestjs/websockets` + Socket.IO
- Eventos emitidos:
  - `health:update` → nuevo resultado de check
  - `incident:new` → nuevo incidente
  - `incident:resolved` → incidente resuelto
  - `service:update` → cambio en servicio
- Client en Next.js panel escucha y actualiza UI en tiempo real

### Subtarea 3.4: Check manual endpoint
- `POST /api/services/:id/check` → ejecutar check inmediato
- Retorna resultado
- Emite evento WebSocket

### Subtarea 3.5: Tests y seguridad Fase 3
- Tests unitarios: HealthCheckerService, lógica de clasificación
- Tests unitarios: detección de incidentes
- Test de integración: check manual endpoint
- Verificar timeout handling (no queda colgado)
- Verificar que no se hacen requests a IPs privadas/localhost (SSRF prevention)

**Criterios de aceptación Fase 3:**
- [ ] Health checks se ejecutan automáticamente según intervalo
- [ ] Resultados se guardan en BD
- [ ] Incidentes se crean/resuelven automáticamente
- [ ] Dashboard se actualiza en tiempo real via WebSocket
- [ ] Check manual funciona
- [ ] Tests pasan
- [ ] No hay vulnerabilidades SSRF

---

## FASE 4: Sistema de Alertas (SendGrid + Screenshots + Logs)

**Objetivo**: Alertas por email con screenshot y últimas 100 líneas de log del servicio fallido.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 4.1: Integración SendGrid
- `AlertsModule` con `AlertsService`
- Envío de emails via `@sendgrid/mail`
- Template HTML para alerta:
  - Nombre y URL del servicio
  - Timestamp del fallo
  - Código de error
  - Screenshot adjunto (si disponible)
  - Últimas 100 líneas de log
  - Link al dashboard
- Config desde env/settings: `SENDGRID_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`

### Subtarea 4.2: Captura de Screenshots
- Puppeteer service en NestJS
- Chrome headless en Docker (via `puppeteer` con chromium bundled o container separado)
- Flujo: incidente detectado → si es tipo web → capturar screenshot
- Guardar en `/screenshots/{service_id}_{timestamp}.png`
- Timeout 15s, fallback graceful

### Subtarea 4.3: Recolección de Logs al fallar
- Al detectar incidente:
  1. Firmar request con HMAC-SHA256 (misma lógica que health checks)
  2. GET al logs endpoint con headers firmados (`X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`)
  3. Guardar en `incidents.last_logs_snapshot`
  4. Si no responde: "logs no disponibles"
- Timeout 10s

### Subtarea 4.4: Flujo completo de alerta
- Orquestar: incidente → (screenshot + logs en paralelo) → email
- Rate limiting: max 1 email por servicio cada 5 min
- Marcar `email_sent` y `email_sent_at` en incidente
- Email de recuperación cuando se resuelve (opcional, configurable)

### Subtarea 4.5: Settings page en dashboard
- Página `/settings` en panel:
  - Email destinatario de alertas
  - Habilitar/deshabilitar alertas globalmente
  - Intervalo mínimo entre alertas
- API endpoints para settings en NestJS

### Subtarea 4.6: Tests y seguridad Fase 4
- Tests unitarios: AlertsService (mock SendGrid)
- Tests unitarios: ScreenshotService (mock Puppeteer)
- Tests: flujo completo con mocks
- Verificar que API keys de SendGrid no se exponen en responses
- Verificar rate limiting funciona
- Verificar que screenshots no se sirven públicamente

**Criterios de aceptación Fase 4:**
- [ ] Email se envía al caer un servicio
- [ ] Email incluye screenshot (para sitios web)
- [ ] Email incluye últimas 100 líneas de log
- [ ] Rate limiting funciona (no spam)
- [ ] Settings configurables desde dashboard
- [ ] Tests pasan
- [ ] No se exponen secrets

---

## FASE 5: Visualización de Logs en el Dashboard

**Objetivo**: Visualizar logs de cualquier servicio monitoreado desde el dashboard.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 5.1: API proxy de logs (NestJS)
- `LogsModule`:
  - `GET /api/services/:id/logs?lines=100` → proxy al endpoint del servicio
  - Agrega header `X-Monitor-Key`
  - Manejo de errores si servicio no responde
  - Cache 30s para evitar sobrecarga

### Subtarea 5.2: LogViewer component (Next.js)
- Componente LogViewer estilo terminal:
  - Fondo oscuro, monospace font
  - Scroll automático al final
  - Selector de líneas (50, 100, 200, 500)
  - Botón refresh
  - Búsqueda/filtro de texto
  - Syntax highlighting: ERROR (rojo), WARN (amarillo), INFO (azul)
- Integrar en `/services/[id]` tab "Logs"

### Subtarea 5.3: Auto-refresh de logs
- Toggle auto-refresh con intervalos (5s, 10s, 30s)
- Indicador visual "actualizando..."
- No refresh si el tab no está activo (performance)

### Subtarea 5.4: Tests y seguridad Fase 5
- Tests: LogsService proxy
- Verificar que no se puede acceder a logs sin autenticación
- Verificar que el proxy no es abierto (solo servicios registrados)
- Verificar que no hay log injection en la UI (XSS)

**Criterios de aceptación Fase 5:**
- [ ] Logs visibles desde el dashboard
- [ ] LogViewer tiene aspecto terminal
- [ ] Filtro de texto funciona
- [ ] Auto-refresh funciona sin memory leaks
- [ ] Tests pasan
- [ ] No hay XSS ni proxy abierto

---

## FASE 6: Endpoints Health y Logs para Proyectos Externos

**Objetivo**: Código listo para copiar/integrar en proyectos NestJS, Laravel y Next.js existentes.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 6.1: Módulo para NestJS
- `external-integrations/nestjs/`
- `HealthModule` con controller:
  - `GET /health` → status, uptime, DB, memory
  - `GET /logs?lines=100` → últimas N líneas del log
- `MonitorGuard`: valida HMAC-SHA256 signature
  - Extrae `X-Monitor-Key`, `X-Monitor-Timestamp`, `X-Monitor-Signature`
  - Busca secret por api_key en config/env
  - Valida timestamp (ventana 5 min)
  - Recalcula HMAC y compara con `timingSafeEqual`
- Config via env vars: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README con instrucciones de integración paso a paso

### Subtarea 6.2: Package para Laravel
- `external-integrations/laravel/`
- `HealthController` + routes + middleware
  - `GET /health` → status, uptime, DB
  - `GET /logs?lines=100` → últimas N líneas de `storage/logs/laravel.log`
- `MonitorAuthMiddleware`: valida HMAC-SHA256
  - Usa `hash_hmac('sha256', ...)` + `hash_equals()` (timing-safe)
  - Valida timestamp (ventana 5 min)
- Config via `.env`: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README con instrucciones

### Subtarea 6.3: API Routes para Next.js
- `external-integrations/nextjs/`
- `app/api/health/route.ts` y `app/api/logs/route.ts`
- Helper `validateMonitorRequest()`: valida HMAC-SHA256
  - Usa `crypto.createHmac` + `crypto.timingSafeEqual`
  - Valida timestamp (ventana 5 min)
- Config via env vars: `MONITOR_API_KEY`, `MONITOR_SECRET`
- README con instrucciones

### Subtarea 6.4: Tests Fase 6
- Tests unitarios para cada integración
- Tests de HMAC validation: signature correcta, signature inválida, timestamp expirado, replay
- Verificar formato de respuesta consistente entre frameworks
- Verificar que requests sin headers o con headers inválidos retornan 401

**Criterios de aceptación Fase 6:**
- [ ] Código listo para cada framework
- [ ] Formato de respuesta consistente
- [ ] HMAC-SHA256 auth funciona correctamente
- [ ] Replay attacks son rechazados (timestamp > 5 min)
- [ ] Documentación clara con instrucciones paso a paso
- [ ] Tests pasan

---

## FASE 7: Pulido, Producción y Documentación Final

**Objetivo**: Proyecto estable, optimizado y documentado.

**Agente de desarrollo**: Sonnet 4.6
**Revisión de fase**: Opus 4.6

### Subtarea 7.1: Docker producción
- Optimizar Dockerfiles multi-stage (cache layers)
- `docker-compose.prod.yml`:
  - Sin volume mounts de código
  - Restart policies: `unless-stopped`
  - Health checks internos de cada container
  - Resource limits
- Script de backup de PostgreSQL

### Subtarea 7.2: Manejo de edge cases
- Worker se reinicia → recuperar estado de checks
- PostgreSQL no disponible → retry con backoff
- SendGrid falla → log y retry
- Limpieza automática: health_checks > 30 días, screenshots > 30 días
- Migración para índices de performance (service_id + checked_at)

### Subtarea 7.3: Tests e2e y seguridad final
- Test e2e: flujo completo check → incidente → alerta
- Security audit:
  - OWASP top 10 review
  - Verificar headers de seguridad (CORS, CSP, etc.)
  - Verificar que no hay endpoints expuestos sin auth
  - Rate limiting en login (brute force prevention)
  - Verificar que env vars sensibles no se filtran
- Performance test: 30 servicios simultáneos

### Subtarea 7.4: README.md completo
- Descripción del proyecto
- Arquitectura
- Requisitos (Docker, Node LTS)
- Quick start (dev y prod)
- Configuración de variables de entorno
- Cómo agregar servicios a monitorear
- Cómo integrar endpoints en proyectos existentes
- Comandos útiles (migraciones, seeders, etc.)
- Troubleshooting

**Criterios de aceptación Fase 7:**
- [ ] Docker compose producción funciona
- [ ] Todos los tests pasan
- [ ] Security audit sin hallazgos críticos
- [ ] README completo y claro
- [ ] Proyecto listo para deploy

---

## Flujo de Trabajo por Fase

```
Para cada FASE:
  1. Sonnet 4.6 desarrolla todas las subtareas secuencialmente
  2. Al completar TODAS las subtareas (incluyendo tests/seguridad):
     → Opus 4.6 realiza revisión completa:
       - Verifica criterios de aceptación
       - Busca alucinaciones (imports falsos, APIs inventadas)
       - Valida que el código compila y es funcional
       - Revisa coherencia con la arquitectura del monorepo
       - Verifica que no hay vulnerabilidades de seguridad
       - Certifica paso a la siguiente fase
  3. Si hay problemas → Sonnet corrige → Opus re-verifica
  4. Fase certificada → siguiente fase
```

---

## Dependencias Principales

### Panel (Next.js)
- next (LTS), react, react-dom
- tailwindcss, shadcn/ui
- socket.io-client
- recharts (gráficas)
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

## Estimación de Complejidad por Fase

| Fase | Complejidad | Subtareas |
|------|-------------|-----------|
| 1. Infraestructura Base | Alta | 9 |
| 2. CRUD y Dashboard | Media | 5 |
| 3. Health Checks | Alta | 5 |
| 4. Alertas | Alta | 6 |
| 5. Logs UI | Media | 4 |
| 6. Endpoints Externos | Baja | 4 |
| 7. Pulido y Docs | Media | 4 |
| **Total** | | **37 subtareas** |
