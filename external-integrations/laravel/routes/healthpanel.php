<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\LogsController;
use App\Http\Middleware\MonitorAuthMiddleware;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| HealthPanel Monitor Routes
|--------------------------------------------------------------------------
|
| These routes expose /health and /logs endpoints for HealthPanel monitoring.
| Both are protected by HMAC-SHA256 authentication via MonitorAuthMiddleware.
|
| Add this file to your routes/ directory, or include these routes in your
| existing routes/api.php or routes/web.php file.
|
*/

Route::middleware(MonitorAuthMiddleware::class)->group(function () {
    Route::get('/health', HealthController::class);
    Route::get('/logs', LogsController::class);
});
