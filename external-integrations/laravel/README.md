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
```

### 4. Done!

Your service now exposes:

| Endpoint | Description |
|---|---|
| `GET /health` | System status, uptime, DB connectivity, memory |
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
    $redisStatus = 'disconnected';
    try {
        \Illuminate\Support\Facades\Redis::ping();
        $redisStatus = 'connected';
    } catch (\Exception $e) {
        $redisStatus = 'error';
    }

    return response()->json([
        'status' => 'ok',
        'uptime' => time() - (int) LARAVEL_START,
        'timestamp' => now()->toISOString(),
        'db' => $dbStatus,
        'redis' => $redisStatus,
        // ...
    ]);
}
```

---

## Requirements

- Laravel 10+ (tested with Laravel 10, 11)
- PHP 8.1+
