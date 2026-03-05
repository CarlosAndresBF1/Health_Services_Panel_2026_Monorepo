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

## Requirements

- Laravel 8+ (tested with Laravel 8, 9, 10, 11)
- PHP 8.0+ (PHP 8.1+ recommended)
