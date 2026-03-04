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
| `GET /health` | System status, uptime, memory |
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

To add database connectivity checks, inject your DB connection:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MonitorGuard } from './monitor.guard';

@Controller()
@UseGuards(MonitorGuard)
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('health')
  async getHealth() {
    let dbStatus = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    const mem = process.memoryUsage();
    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      db: dbStatus,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
    };
  }
}
```

## Customizing the Log File Path

By default, logs are read from `logs/app.log`. You can change this:

- **Environment variable**: Set `MONITOR_LOG_FILE=path/to/your.log`
- **Absolute path**: `MONITOR_LOG_FILE=/var/log/myapp/production.log`
- **Relative path**: `MONITOR_LOG_FILE=storage/logs/app.log` (relative to project root)

---

## Requirements

- NestJS 9+ (works with NestJS 10/11)
- Node.js 18+ (for `crypto.timingSafeEqual`)
- Express adapter (default NestJS setup)
