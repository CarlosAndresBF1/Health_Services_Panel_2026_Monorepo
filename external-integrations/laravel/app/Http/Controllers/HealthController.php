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
        $dbType = null;

        try {
            $pdo = DB::connection()->getPdo();
            $dbStatus = 'connected';
            $dbType = DB::connection()->getDriverName();
        } catch (\Exception $e) {
            $dbStatus = 'error';
        }

        $memTotal = $this->getTotalMemory();
        $memUsed = memory_get_usage(true);
        $memFree = $memTotal > 0 ? $memTotal - $memUsed : 0;

        $diskTotal = disk_total_space('/');
        $diskFree = disk_free_space('/');

        return response()->json([
            'status' => $dbStatus === 'connected' ? 'ok' : 'error',
            'uptime' => time() - (int) (defined('LARAVEL_START') ? LARAVEL_START : $_SERVER['REQUEST_TIME']),
            'timestamp' => now()->toISOString(),
            'db' => [
                'connected' => $dbStatus === 'connected',
                'type' => $dbType,
            ],
            'memory' => [
                'total_mb' => $memTotal > 0 ? round($memTotal / 1024 / 1024, 0) : null,
                'used_mb' => round($memUsed / 1024 / 1024, 0),
                'free_mb' => $memTotal > 0 ? round($memFree / 1024 / 1024, 0) : null,
                'used_percent' => $memTotal > 0 ? round(($memUsed / $memTotal) * 100, 1) : null,
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

    /**
     * Get total system memory in bytes.
     * Reads from /proc/meminfo on Linux; returns 0 on unsupported OS.
     */
    private function getTotalMemory(): int
    {
        if (PHP_OS_FAMILY === 'Linux' && is_readable('/proc/meminfo')) {
            $meminfo = file_get_contents('/proc/meminfo');
            if (preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $matches)) {
                return (int) $matches[1] * 1024;
            }
        }

        return 0;
    }
}
