<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * HEALTHPANEL RESPONSE CONTRACT — DO NOT CHANGE FIELD NAMES OR TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The HealthPanel dashboard expects EXACTLY this JSON structure from /health:
 *
 * {
 *   "status": "ok" | "error",
 *   "uptime": <number>,
 *   "timestamp": "<ISO 8601>",
 *   "disk": {
 *     "total_gb":     <number>,   ← MUST be snake_case
 *     "used_gb":      <number>,
 *     "free_gb":      <number>,
 *     "used_percent": <number>    ← 0-100, one decimal (e.g. 85.3)
 *   },
 *   "memory": {
 *     "total_mb":     <number>,   ← System RAM from /proc/meminfo
 *     "used_mb":      <number>,   ← NOT just PHP memory_get_usage()
 *     "free_mb":      <number>,
 *     "used_percent": <number>    ← 0-100, one decimal
 *   },
 *   "db": {                       ← MUST be an object, NOT a string
 *     "connected": <boolean>,     ← true/false, NOT "connected"/"disconnected"
 *     "type":      <string>       ← Optional: "pgsql", "mysql", etc.
 *   }
 * }
 *
 * COMMON MISTAKES TO AVOID:
 * - Returning db as a string "connected" instead of ["connected" => true]
 * - Using only memory_get_usage() (PHP process ~50MB) instead of system RAM
 * - Omitting total_mb/free_mb/used_percent from memory
 * - Omitting the db field entirely — always include it
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * HealthPanel Health Controller
 *
 * GET /health — Returns system status, uptime, database connectivity, and memory info.
 * Protected by MonitorAuthMiddleware (HMAC-SHA256 authentication).
 *
 * IMPORTANT: See response contract comment above.
 * All field names MUST use snake_case. db MUST be an object with 'connected' => boolean.
 * Memory MUST report system RAM (via /proc/meminfo on Linux), NOT just PHP process memory.
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

        [$memTotal, $memFree] = $this->getSystemMemory();
        $memUsed = $memTotal > 0 ? $memTotal - $memFree : 0;

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
     * Get system RAM total and free in bytes.
     * Reads from /proc/meminfo on Linux; returns [0, 0] on unsupported OS.
     *
     * IMPORTANT: Do NOT use memory_get_usage() — that returns PHP process
     * heap only (~50-100MB), not actual system RAM.
     *
     * @return array{0: int, 1: int} [totalBytes, freeBytes]
     */
    private function getSystemMemory(): array
    {
        if (PHP_OS_FAMILY === 'Linux' && is_readable('/proc/meminfo')) {
            $meminfo = file_get_contents('/proc/meminfo');
            $total = 0;
            $free = 0;

            if (preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $m)) {
                $total = (int) $m[1] * 1024;
            }
            // MemAvailable is more accurate than MemFree (includes reclaimable cache)
            if (preg_match('/MemAvailable:\s+(\d+)\s+kB/', $meminfo, $m)) {
                $free = (int) $m[1] * 1024;
            } elseif (preg_match('/MemFree:\s+(\d+)\s+kB/', $meminfo, $m)) {
                $free = (int) $m[1] * 1024;
            }

            return [$total, $free];
        }

        return [0, 0];
    }
}
