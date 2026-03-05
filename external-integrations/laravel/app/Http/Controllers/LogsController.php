<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * HealthPanel Logs Controller
 *
 * GET /logs?lines=100 — Returns the last N lines from the Laravel log file.
 * Protected by MonitorAuthMiddleware (HMAC-SHA256 authentication).
 *
 * Configure the log file path via the MONITOR_LOG_FILE env var.
 * Defaults to storage/logs/laravel.log.
 *
 * Supports daily log rotation (e.g., laravel-2026-03-05.log):
 * - Set MONITOR_LOG_FILE to a pattern like "storage/logs/laravel-*.log"
 * - Or set MONITOR_LOG_ROTATION=daily to auto-detect Laravel's daily format
 */
class LogsController extends Controller
{
    private const DEFAULT_LINES = 100;
    private const MAX_LINES = 500;

    /**
     * Return the last N lines from the application log file.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $lines = self::DEFAULT_LINES;

        if ($request->has('lines')) {
            $parsed = (int) $request->query('lines');
            if ($parsed > 0) {
                $lines = min($parsed, self::MAX_LINES);
            }
        }

        $logPath = $this->resolveLogPath();
        $logLines = $this->readLastLines($logPath, $lines);

        return response()->json([
            'logs' => $logLines,
            'total' => count($logLines),
        ]);
    }

    /**
     * Resolve the log file path.
     * Supports:
     * - Static file: storage/logs/laravel.log
     * - Pattern with wildcard: storage/logs/laravel-*.log (finds latest)
     * - Auto-detection with MONITOR_LOG_ROTATION=daily
     */
    private function resolveLogPath(): string
    {
        $envPath = config('healthpanel.log_file', env('MONITOR_LOG_FILE'));
        $rotation = config('healthpanel.log_rotation', env('MONITOR_LOG_ROTATION'));

        // Auto-detect daily rotation (Laravel's daily channel)
        if ($rotation === 'daily') {
            return $this->findLatestDailyLog();
        }

        if ($envPath) {
            // Check if it's a glob pattern
            if (str_contains($envPath, '*')) {
                return $this->findLatestLogByPattern($envPath);
            }

            return str_starts_with($envPath, '/')
                ? $envPath
                : base_path($envPath);
        }

        // Check if default laravel.log exists, otherwise try daily rotation
        $defaultPath = storage_path('logs/laravel.log');
        if (file_exists($defaultPath)) {
            return $defaultPath;
        }

        // Fallback: try to find daily rotated log
        return $this->findLatestDailyLog();
    }

    /**
     * Find the latest daily rotated log file (laravel-YYYY-MM-DD.log format).
     */
    private function findLatestDailyLog(): string
    {
        $logsDir = storage_path('logs');
        $pattern = $logsDir . '/laravel-*.log';

        return $this->findLatestLogByPattern($pattern);
    }

    /**
     * Find the latest log file matching a glob pattern.
     * Returns the most recently modified file.
     */
    private function findLatestLogByPattern(string $pattern): string
    {
        // Resolve relative patterns
        if (!str_starts_with($pattern, '/')) {
            $pattern = base_path($pattern);
        }

        $files = glob($pattern);

        if (empty($files)) {
            // Return pattern for error message if no files found
            return $pattern;
        }

        // Sort by modification time (newest first)
        usort($files, function ($a, $b) {
            return filemtime($b) - filemtime($a);
        });

        return $files[0];
    }

    /**
     * Read the last N non-empty lines from a file.
     */
    private function readLastLines(string $filePath, int $count): array
    {
        if (!file_exists($filePath)) {
            return ["[HealthPanel] Log file not found: {$filePath}"];
        }

        try {
            $content = file_get_contents($filePath);

            if ($content === false) {
                return ["[HealthPanel] Could not read log file: {$filePath}"];
            }

            $allLines = array_values(
                array_filter(
                    explode("\n", $content),
                    fn(string $line) => strlen(trim($line)) > 0,
                )
            );

            return array_values(array_slice($allLines, -$count));
        } catch (\Exception $e) {
            return ["[HealthPanel] Error reading logs: {$e->getMessage()}"];
        }
    }
}
