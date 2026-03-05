# HealthPanel — Next.js Integration

Ready-to-use Next.js App Router API routes that expose `/api/health` and `/api/logs` endpoints for [HealthPanel](../../README.md) monitoring. Requests are authenticated via HMAC-SHA256 signed headers.

## Quick Start

### 1. Copy the files

Copy these files into your Next.js project:

```
lib/
  validate-monitor-request.ts      → your-project/lib/ or src/lib/

app/api/health/
  route.ts                         → your-project/app/api/health/route.ts

app/api/logs/
  route.ts                         → your-project/app/api/logs/route.ts
```

### 2. Adjust import paths

If your project uses `src/` directory, update the imports in the route files:

```typescript
// In app/api/health/route.ts and app/api/logs/route.ts
import { validateMonitorRequest } from '@/lib/validate-monitor-request';
```

### 3. Configure environment variables

Add these to your `.env.local`:

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
| `GET /api/health` | System status, uptime, disk, memory, DB |
| `GET /api/logs?lines=100` | Last N lines from log file (max 500) |

Both endpoints are protected by HMAC-SHA256 authentication — only HealthPanel can access them.

---

## How Authentication Works

Every request from HealthPanel includes three headers:

| Header | Description |
|---|---|
| `x-monitor-key` | Your service's API key |
| `x-monitor-timestamp` | Unix timestamp in milliseconds |
| `x-monitor-signature` | HMAC-SHA256 of `{timestamp}:{METHOD}:{path}` |

The `validateMonitorRequest()` helper validates:
1. API key matches `MONITOR_API_KEY`
2. Timestamp is within 5 minutes (prevents replay attacks)
3. Signature matches recalculated HMAC (timing-safe comparison)

---

## Customizing the Health Endpoint

Edit `app/api/health/route.ts` to add custom checks (e.g., database):

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  // ... auth validation ...

  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {}

  return NextResponse.json({
    status: dbConnected ? 'ok' : 'error',
    // disk and memory are already included by default
    db: { connected: dbConnected, type: 'postgresql' },
    // ...
  });
}
```

### Expected response structure

HealthPanel expects the `/api/health` endpoint to return JSON with these fields:

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

---

## Using with Middleware (Optional)

If you prefer using Next.js middleware to protect the routes globally:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to /api/health and /api/logs
  if (
    request.nextUrl.pathname.startsWith('/api/health') ||
    request.nextUrl.pathname.startsWith('/api/logs')
  ) {
    // Note: crypto.createHmac is not available in Edge Runtime.
    // Use the route handler approach (default) instead,
    // or use Node.js runtime for the middleware.
  }

  return NextResponse.next();
}
```

> **Note**: The route handler approach (included by default) is recommended because `crypto.createHmac` requires the Node.js runtime, not Edge.

---

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
MONITOR_LOG_FILE=/var/www/myapp/.next/logs/production-2026-03-05.log
```

### Setting up logging in Next.js

Next.js doesn't have built-in file logging. Here's how to add it:

#### Using Pino (recommended)

```bash
npm install pino pino-pretty
```

```typescript
// lib/logger.ts
import pino from 'pino';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Single file (no rotation)
export const logger = pino(
  {},
  createWriteStream(join(logsDir, 'app.log'), { flags: 'a' })
);

// With daily rotation
import { createStream } from 'rotating-file-stream';

const rotatingStream = createStream('app.log', {
  size: '10M',
  interval: '1d',
  path: logsDir,
  compress: 'gzip',
});

export const loggerWithRotation = pino({}, rotatingStream);
```

#### Using Winston

```bash
npm install winston winston-daily-rotate-file
```

```typescript
// lib/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

// Single file
export const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'logs/app.log' }),
  ],
});

// With daily rotation
export const loggerWithRotation = winston.createLogger({
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
  ],
});
```

---

## Adapting to Your Next.js Version

### Next.js 14+ / 15+

No changes needed — the provided code uses the latest App Router conventions.

### Next.js 13.4+

Compatible with the provided code. Ensure you're using the App Router (`app/` directory).

### Next.js 13.0 - 13.3

Early App Router versions may need slight adjustments:

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

// Export config for Node.js runtime (required for crypto)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ...
}
```

### Next.js 12.x (Pages Router)

For Pages Router, use API routes in `pages/api/`:

```typescript
// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHmac, timingSafeEqual } from 'crypto';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate HMAC
  const apiKey = req.headers['x-monitor-key'] as string;
  const timestamp = req.headers['x-monitor-timestamp'] as string;
  const signature = req.headers['x-monitor-signature'] as string;

  // ... validation logic (same as validateMonitorRequest)

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    // ...
  });
}
```

### Directory structure by version

**Next.js 13.4+ (App Router):**
```
app/
  api/
    health/
      route.ts
    logs/
      route.ts
lib/
  validate-monitor-request.ts
```

**Next.js 12.x (Pages Router):**
```
pages/
  api/
    health.ts
    logs.ts
lib/
  validate-monitor-request.ts
```

### Import paths

**With `src/` directory:**
```typescript
import { validateMonitorRequest } from '@/lib/validate-monitor-request';
```

**Without `src/` directory:**
```typescript
import { validateMonitorRequest } from '../../lib/validate-monitor-request';
```

---

## Requirements

- Next.js 12+ (App Router: 13.4+, Pages Router: 12+)
- Node.js 16+ (18+ recommended)
- Optional: `pino` or `winston` for file logging
