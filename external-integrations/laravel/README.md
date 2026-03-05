# HealthPanel — Laravel Integration

Ready-to-use Laravel controllers and middleware that expose `/health` and `/logs` endpoints for [HealthPanel](../../README.md) monitoring. Requests are authenticated via HMAC-SHA256 signed headers.

## Quick Start

### 1. Copy the files

Copy these files into your Laravel project:

```
app/Http/Middleware/MonitorAuthMiddleware.php
app/Http/Controllers/HealthController.php
app/Http/Controllers/LogsController.php
config/healthpanel.php
routes/healthpanel.php
```

### 2. Register the routes

**Option A**: Include the routes file in your `routes/web.php` or `routes/api.php`:

```php
// routes/web.php
require __DIR__ . '/healthpanel.php';
```

**Option B**: Register in `bootstrap/app.php` (Laravel 11+):

```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    health: __DIR__.'/../routes/healthpanel.php',
)
```

**Option C**: Register in `RouteServiceProvider` (Laravel 10):

```php
Route::middleware('web')
    ->group(base_path('routes/healthpanel.php'));
```

### 3. Publish the config (optional)

If you copied `config/healthpanel.php`, the config is already available. Otherwise, add the values directly to `.env`:

```env
# Required — from HealthPanel service registration
MONITOR_API_KEY=your-api-key-from-healthpanel
MONITOR_SECRET=your-secret-from-healthpanel

# Optional — path to log file (default: storage/logs/laravel.log)
MONITOR_LOG_FILE=storage/logs/laravel.log

# Optional — log rotation mode (see Log Rotation section below)
MONITOR_LOG_ROTATION=daily
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

The `MonitorAuthMiddleware` validates:
1. API key matches `MONITOR_API_KEY`
2. Timestamp is within 5 minutes (prevents replay attacks)
3. Signature matches recalculated HMAC (uses `hash_equals` for timing-safe comparison)

---

## Customizing the Health Endpoint

Edit `HealthController.php` to add custom checks:

```php
public function __invoke(): JsonResponse
{
    // Add Redis check
    $redisConnected = false;
    try {
        \Illuminate\Support\Facades\Redis::ping();
        $redisConnected = true;
    } catch (\Exception $e) {}

    return response()->json([
        'status' => 'ok',
        'uptime' => time() - (int) LARAVEL_START,
        'timestamp' => now()->toISOString(),
        'db' => [
            'connected' => true,
            'type' => DB::connection()->getDriverName(),
        ],
        'redis' => ['connected' => $redisConnected],
        // ...
    ]);
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
    "type": "mysql"
  }
}
```

> **Note:** `disk` and `memory` use **snake_case** field names. `db` must be an object with `connected: boolean`.

---

## Log File Configuration

### Default behavior

By default, HealthPanel reads from `storage/logs/laravel.log`. If this file doesn't exist, it automatically searches for daily rotated logs.

### Log rotation support

Laravel supports multiple log channels. HealthPanel can auto-detect rotated log files:

#### Option 1: Auto-detect daily rotation

If your Laravel uses `LOG_CHANNEL=daily` (creates files like `laravel-2026-03-05.log`):

```env
# Auto-detect the most recent daily log file
MONITOR_LOG_ROTATION=daily
```

#### Option 2: Glob pattern

Specify a pattern to match multiple files (selects the most recently modified):

```env
# Pattern with wildcard — finds latest by modification time
MONITOR_LOG_FILE=storage/logs/laravel-*.log
```

#### Option 3: Absolute path

Specify an exact file path:

```env
# Absolute path to a specific log file
MONITOR_LOG_FILE=/var/www/api-ejecucion-sin-limites.sinlimite2022.com/storage/logs/laravel-2026-03-05.log
```

### Configuring Laravel to use a single log file

If you prefer a single log file instead of daily rotation, update your `config/logging.php`:

```php
// config/logging.php
'channels' => [
    'single' => [
        'driver' => 'single',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
    ],
],
```

Then set in `.env`:

```env
LOG_CHANNEL=single
```

---

## Adapting to Your Laravel Version

### Laravel 11+

```php
// bootstrap/app.php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    health: __DIR__.'/../routes/healthpanel.php',
)
```

### Laravel 10.x

```php
// app/Providers/RouteServiceProvider.php
public function boot(): void
{
    $this->routes(function () {
        Route::middleware('api')
            ->group(base_path('routes/healthpanel.php'));
    });
}
```

### Laravel 9.x

```php
// app/Providers/RouteServiceProvider.php
public function boot()
{
    $this->routes(function () {
        Route::prefix('api')
            ->middleware('api')
            ->namespace($this->namespace)
            ->group(base_path('routes/healthpanel.php'));
    });
}
```

### Laravel 8.x

In Laravel 8, controllers don't use automatic namespace resolution:

```php
// routes/healthpanel.php
use App\Http\Controllers\HealthController;
use App\Http\Controllers\LogsController;

Route::get('/health', HealthController::class);
Route::get('/logs', LogsController::class);
```

### Middleware registration by version

**Laravel 11+** (bootstrap/app.php):
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'monitor.auth' => \App\Http\Middleware\MonitorAuthMiddleware::class,
    ]);
})
```

**Laravel 10 and below** (app/Http/Kernel.php):
```php
protected $middlewareAliases = [
    'monitor.auth' => \App\Http\Middleware\MonitorAuthMiddleware::class,
    // ...
];
```

---

## Troubleshooting

### Getting 404 on `/health` or `/logs`

**1. Check if auth middleware is blocking the routes** (most common cause)

If your project uses Sanctum, Jetstream, Breeze, or custom auth middleware, the HealthPanel routes may be intercepted before reaching the controller.

Verify the routes are registered without conflicting middleware:

```bash
php artisan route:list --path=health
php artisan route:list --path=logs
```

Both should appear with only the `monitor.auth` middleware (from HealthPanel).

Quick test — visit the endpoint in your browser:
- `https://your-domain.com/health` → Should return `401` (JSON: "Missing monitor authentication headers")
- If you see your login page or a 404, some middleware is intercepting.

**2. Ensure routes are registered correctly**

Check that `routes/healthpanel.php` is included. In `routes/web.php` or `routes/api.php`:

```php
require __DIR__ . '/healthpanel.php';
```

**3. Clear all Laravel caches**

```bash
php artisan route:clear
php artisan config:clear
php artisan cache:clear
php artisan optimize
```

**4. Check the URL configured in HealthPanel**

- ✅ `https://your-domain.com` (HealthPanel appends `/health` automatically)
- ❌ `https://your-domain.com/api` (would result in `/api/health` — wrong unless routes are under api prefix)

**5. Verify environment variables in production**

```bash
php artisan tinker
>>> env('MONITOR_API_KEY')
>>> env('MONITOR_SECRET')
```

Both should return non-null values.

### Getting 401

The route works but HMAC authentication failed:
- `MONITOR_API_KEY` or `MONITOR_SECRET` don't match what's in HealthPanel
- Server clock is out of sync (5-minute window for timestamps)

### Logs show "Log file not found"

- Check `MONITOR_LOG_FILE` path exists on the server
- For daily rotation (`laravel-2026-03-05.log`), set `MONITOR_LOG_ROTATION=daily`
- Verify file permissions allow the web server user to read the log

---

## Requirements

- Laravel 8+ (tested with Laravel 8, 9, 10, 11)
- PHP 8.0+ (PHP 8.1+ recommended)

## Quick Checklist

- [ ] Files copied: controller, middleware, config, routes
- [ ] Routes registered in `web.php` or `api.php`
- [ ] `MONITOR_API_KEY` and `MONITOR_SECRET` set in `.env`
- [ ] Auth middleware not blocking `/health` and `/logs`
- [ ] Caches cleared (`php artisan optimize:clear`)
- [ ] Service URL in HealthPanel is the base domain
