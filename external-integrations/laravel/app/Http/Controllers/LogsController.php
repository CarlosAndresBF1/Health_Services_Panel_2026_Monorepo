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
     */
    private function resolveLogPath(): string
    {
        $envPath = config('healthpanel.log_file', env('MONITOR_LOG_FILE'));

        if ($envPath) {
            return str_starts_with($envPath, '/')
                ? $envPath
                : base_path($envPath);
        }

        return storage_path('logs/laravel.log');
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
