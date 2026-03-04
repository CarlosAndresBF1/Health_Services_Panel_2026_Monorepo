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
| `GET /api/health` | System status, uptime, memory |
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

  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: dbStatus === 'connected' ? 'ok' : 'error',
    db: dbStatus,
    // ...
  });
}
```

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

## Requirements

- Next.js 13.4+ (App Router)
- Node.js 18+
