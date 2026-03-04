<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * HealthPanel Monitor Authentication Middleware
 *
 * Validates incoming requests from HealthPanel using HMAC-SHA256 signed headers.
 *
 * Expected headers:
 *   x-monitor-key        — API key identifying the monitor
 *   x-monitor-timestamp   — Unix timestamp in milliseconds
 *   x-monitor-signature   — HMAC-SHA256 hex of "{timestamp}:{METHOD}:{path}"
 *
 * Required env vars:
 *   MONITOR_API_KEY — The expected API key
 *   MONITOR_SECRET  — The shared HMAC secret
 */
class MonitorAuthMiddleware
{
    /**
     * Maximum allowed time difference in milliseconds (5 minutes).
     */
    private const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('x-monitor-key');
        $timestamp = $request->header('x-monitor-timestamp');
        $signature = $request->header('x-monitor-signature');

        // 1. Check all required headers are present
        if (!$apiKey || !$timestamp || !$signature) {
            return response()->json(
                ['error' => 'Missing monitor authentication headers'],
                401
            );
        }

        $expectedApiKey = config('healthpanel.api_key', env('MONITOR_API_KEY'));
        $secret = config('healthpanel.secret', env('MONITOR_SECRET'));

        if (!$expectedApiKey || !$secret) {
            return response()->json(
                ['error' => 'Monitor credentials not configured on this service'],
                401
            );
        }

        // 2. Verify API key
        if ($apiKey !== $expectedApiKey) {
            return response()->json(
                ['error' => 'Invalid monitor API key'],
                401
            );
        }

        // 3. Verify timestamp is within the allowed window
        $ts = (int) $timestamp;
        $now = (int) (microtime(true) * 1000);

        if (abs($now - $ts) > self::TIMESTAMP_WINDOW_MS) {
            return response()->json(
                ['error' => 'Request timestamp expired or invalid (5 min window)'],
                401
            );
        }

        // 4. Recalculate the HMAC signature
        $method = strtoupper($request->method());
        $path = '/' . ltrim($request->path(), '/');
        $payload = "{$timestamp}:{$method}:{$path}";

        $expected = hash_hmac('sha256', $payload, $secret);

        // 5. Timing-safe comparison
        if (!hash_equals($expected, $signature)) {
            return response()->json(
                ['error' => 'Invalid monitor signature'],
                401
            );
        }

        return $next($request);
    }
}
