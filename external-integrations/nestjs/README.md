# HealthPanel — NestJS Integration Module

Ready-to-use NestJS module that exposes `/health` and `/logs` endpoints for [HealthPanel](../../README.md) monitoring. Requests are authenticated via HMAC-SHA256 signed headers.

## Quick Start

### 1. Copy the files

Copy the `src/` folder into your NestJS project (e.g., `src/health-panel/`):

```
src/
  health-panel/
    health-panel.module.ts
    health.controller.ts
    logs.controller.ts
    monitor.guard.ts
    index.ts
```

### 2. Import the module

```typescript
// app.module.ts
import { HealthPanelModule } from './health-panel';

@Module({
  imports: [
    HealthPanelModule,
    // ... your other modules
  ],
})
export class AppModule {}
```

### 3. Configure environment variables

Add these to your `.env` file. You get these values when registering the service in HealthPanel:

```env
# Required — from HealthPanel service registration
MONITOR_API_KEY=your-api-key-from-healthpanel
MONITOR_SECRET=your-secret-from-healthpanel

# Optional — path to your log file (default: logs/app.log)
MONITOR_LOG_FILE=logs/app.log
```

### 4. Done!

Your service now exposes:

| Endpoint | Description |
|---|---|
| `GET /health` | System status, uptime, disk, memory, DB |
| `GET /logs?lines=100` | Last N lines from log file (max 500) |

Both endpoints are protected by HMAC-SHA256 authentication — only HealthPanel can access them.

---

## How Authentication Works

Every request from HealthPanel includes three headers:

| Header | Description |
|---|---|
| `x-monitor-key` | Your service's API key |
| `x-monitor-timestamp` | Unix timestamp in milliseconds |
| `x-monitor-signature` | HMAC-SHA256 of `{timestamp}:{METHOD}:{path}` |

The `MonitorGuard` validates:
1. API key matches `MONITOR_API_KEY`
2. Timestamp is within 5 minutes (prevents replay attacks)
3. Signature matches recalculated HMAC (timing-safe comparison)

---

## Customizing the Health Endpoint

The default health endpoint returns system memory (via `os` module), disk usage, and a placeholder `db: { connected: false }`. To add a real database check, inject your DB connection:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import { MonitorGuard } from './monitor.guard';

@Controller()
@UseGuards(MonitorGuard)
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('health')
  async getHealth() {
    let dbConnected = false;
    let dbType: string | undefined;
    try {
      await this.dataSource.query('SELECT 1');
      dbConnected = this.dataSource.isInitialized;
      dbType = this.dataSource.options.type as string;
    } catch {}

    return {
      status: dbConnected ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: { /* ... uses os.totalmem()/os.freemem() */ },
      disk: { /* ... uses df -k / */ },
      db: { connected: dbConnected, type: dbType },
      nodeVersion: process.version,
    };
  }
}
```

### Expected response structure

HealthPanel expects the `/health` endpoint to return JSON with these fields:

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "disk": {
    "total_gb": 50.0,
    "used_gb": 30.0,
    "free_gb": 20.0,
    "used_percent": 60.0
  },
  "memory": {
    "total_mb": 8192,
    "used_mb": 4096,
    "free_mb": 4096,
    "used_percent": 50.0
  },
  "db": {
    "connected": true,
    "type": "postgres"
  }
}
```

> **Note:** `disk` and `memory` use **snake_case** field names. `db` must be an object with `connected: boolean`.

## Log File Configuration

### Default behavior

By default, HealthPanel reads from `logs/app.log`. If this file doesn't exist, it automatically searches for daily rotated logs.

### Log rotation support

HealthPanel can auto-detect rotated log files:

#### Option 1: Auto-detect daily rotation

If your logs use daily rotation (creates files like `app-2026-03-05.log`):

```env
# Auto-detect the most recent daily log file
MONITOR_LOG_ROTATION=daily
```

#### Option 2: Glob pattern

Specify a pattern to match multiple files (selects the most recently modified):

```env
# Pattern with wildcard — finds latest by modification time
MONITOR_LOG_FILE=logs/app-*.log
```

#### Option 3: Absolute path

Specify an exact file path:

```env
# Absolute path to a specific log file
MONITOR_LOG_FILE=/var/www/myapp/logs/production-2026-03-05.log
```

### Configuring a single log file

If you prefer a single log file, configure your logger (e.g., Winston, Pino):

```typescript
// Using Winston
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

WinstonModule.forRoot({
  transports: [
    new winston.transports.File({
      filename: 'logs/app.log',
      // No daily rotation — single file
    }),
  ],
});
```

```typescript
// Using Pino
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    transport: {
      target: 'pino/file',
      options: { destination: './logs/app.log' },
    },
  },
});
```

### Dependencies for glob patterns

If using glob patterns (`*`), ensure `glob` is installed:

```bash
npm install glob
# or
pnpm add glob
```

---

## Adapting to Your NestJS Version

### NestJS 10+ / 11+

No changes needed — the provided code is compatible.

### NestJS 9.x

The code is compatible. If using TypeORM, ensure you have `@nestjs/typeorm@9.x`.

### NestJS 8.x

For NestJS 8.x, update the guard to use the older `ExecutionContext` pattern:

```typescript
// monitor.guard.ts - NestJS 8.x compatible
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class MonitorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // ... rest of validation logic
  }
}
```

### Environment variable loading

**NestJS 10+** (with @nestjs/config):
```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthPanelModule,
  ],
})
export class AppModule {}
```

**NestJS 8-9** (with dotenv):
```typescript
// main.ts
import 'dotenv/config';
```

---

## Requirements

- NestJS 8+ (tested with NestJS 8, 9, 10, 11)
- Node.js 16+ (18+ recommended for `crypto.timingSafeEqual`)
- Express adapter (default NestJS setup)
- Optional: `glob` package for pattern matching
