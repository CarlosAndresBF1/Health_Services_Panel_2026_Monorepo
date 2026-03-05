<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * HealthPanel Health Controller
 *
 * GET /health — Returns system status, uptime, database connectivity, and memory info.
 * Protected by MonitorAuthMiddleware (HMAC-SHA256 authentication).
 */
class HealthController extends Controller
{
    /**
     * Return system health status.
     */
    public function __invoke(): JsonResponse
    {
        $dbStatus = 'disconnected';

        try {
            DB::connection()->getPdo();
            $dbStatus = 'connected';
        } catch (\Exception $e) {
            $dbStatus = 'error';
        }

        $memory = memory_get_usage(true);
        $peakMemory = memory_get_peak_usage(true);

        $diskTotal = disk_total_space('/');
        $diskFree = disk_free_space('/');

        return response()->json([
            'status' => $dbStatus === 'connected' ? 'ok' : 'error',
            'uptime' => time() - (int) (defined('LARAVEL_START') ? LARAVEL_START : $_SERVER['REQUEST_TIME']),
            'timestamp' => now()->toISOString(),
            'db' => $dbStatus,
            'memory' => [
                'current_mb' => round($memory / 1024 / 1024, 2),
                'peak_mb' => round($peakMemory / 1024 / 1024, 2),
            ],
            'disk' => [
                'total_gb' => round($diskTotal / 1024 / 1024 / 1024, 2),
                'free_gb' => round($diskFree / 1024 / 1024 / 1024, 2),
                'used_gb' => round(($diskTotal - $diskFree) / 1024 / 1024 / 1024, 2),
                'used_percent' => round(($diskTotal - $diskFree) / $diskTotal * 100, 1),
            ],
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
        ]);
    }
}
