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

## ⚠️ Middleware & Authentication — IMPORTANT

If your project uses **next-auth**, **Clerk**, **Auth.js**, or any authentication middleware, it will likely **block** the `/api/health` and `/api/logs` endpoints, causing HealthPanel to receive **404** or **redirect responses** instead of the health data.

### Fix: Exclude HealthPanel routes from your middleware

**If using `next-auth/middleware`** (most common):

```typescript
// middleware.ts
export { default } from 'next-auth/middleware';

export const config = {
  // ❌ WRONG — blocks all routes including /api/health and /api/logs:
  // matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],

  // ✅ CORRECT — explicitly exclude HealthPanel endpoints:
  matcher: [
    '/((?!api/health|api/logs|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**If using a custom middleware function:**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Skip authentication for HealthPanel endpoints
  if (
    request.nextUrl.pathname.startsWith('/api/health') ||
    request.nextUrl.pathname.startsWith('/api/logs')
  ) {
    return NextResponse.next();
  }

  // Your normal auth logic...
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**If using Clerk:**

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/api/health(.*)',  // ← Add this
  '/api/logs(.*)',    // ← Add this
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});
```

> **Why this matters:** HealthPanel sends requests with HMAC headers but **not** with session cookies or JWT tokens from your app's auth system. The middleware sees an unauthenticated request and returns 404/302 instead of letting the route handler validate the HMAC signature.

---

## Troubleshooting

### Getting 404 on `/api/health` or `/api/logs`

**1. Check if auth middleware is blocking the routes** (most common cause)

Open your `middleware.ts` and verify the HealthPanel routes are excluded (see section above).

Quick test — visit the endpoint directly in your browser:
- `https://your-domain.com/api/health` → Should return `401` ("Missing monitor authentication headers") — this means the route works!
- If you see your login page or a 404, it means middleware is intercepting the request.

**2. Rebuild after adding the route files**

Next.js caches route manifests. If you added the files after a build, you MUST rebuild:

```bash
# Clean build cache and rebuild
rm -rf .next
npm run build    # or: yarn build / pnpm build

# Then restart the app
pm2 restart your-app   # or however you manage your process
```

**3. Verify the routes are in the build output**

After building, check that the routes compiled:

```bash
# Both should show route.js files:
ls .next/server/app/api/health/
ls .next/server/app/api/logs/
```

In the build output, look for:
```
λ /api/health    0 B    0 B
λ /api/logs      0 B    0 B
```

If they don't appear, the files weren't found during build.

**4. Ensure `dynamic = "force-dynamic"` is exported**

Both route files must export `dynamic` to prevent Next.js from treating them as static:

```typescript
// app/api/health/route.ts AND app/api/logs/route.ts
export const dynamic = 'force-dynamic';
```

**5. Check the URL configured in HealthPanel**

Make sure the service URL in HealthPanel includes the full base:
- ✅ `https://your-domain.com` (HealthPanel appends `/api/health` automatically)
- ❌ `https://your-domain.com/api` (would result in `/api/api/health`)

**6. Verify process.env loads correctly**

In production, ensure `MONITOR_API_KEY` and `MONITOR_SECRET` are set in the **server environment**, not just in `.env.local` (which is only for local development). For Docker/PM2:

```bash
# Check if vars are available in the running process
curl -s https://your-domain.com/api/health
# Should return: {"error":"Missing monitor authentication headers"}
# If it returns: {"error":"Monitor credentials not configured on this service"}
# → the env vars are not loaded in the production environment.
```

### Getting 401 on `/api/health` or `/api/logs`

This means the route works but authentication failed. Possible causes:
- `MONITOR_API_KEY` or `MONITOR_SECRET` in the project don't match what's in HealthPanel
- Server clock is out of sync (HMAC uses a 5-minute timestamp window)
- The URL path used to sign the request doesn't match the actual path

### Logs show "Log file not found"

The `/api/logs` endpoint can't find the log file. Check:
- The `MONITOR_LOG_FILE` path exists on the server
- File permissions allow the Node.js process to read it
- For daily rotation, set `MONITOR_LOG_ROTATION=daily`

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

## Quick Checklist

- [ ] Files copied: `app/api/health/route.ts`, `app/api/logs/route.ts`, `lib/validate-monitor-request.ts`
- [ ] Import paths adjusted for your project (`@/lib/...` or relative)
- [ ] `MONITOR_API_KEY` and `MONITOR_SECRET` set in production environment
- [ ] Auth middleware excludes `/api/health` and `/api/logs`
- [ ] Project rebuilt (`rm -rf .next && npm run build`) after adding files
- [ ] Both routes export `dynamic = 'force-dynamic'`
- [ ] Service URL in HealthPanel is the base domain (no `/api` suffix)
