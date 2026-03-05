export const DEFAULT_CHECK_INTERVAL = 60; // seconds
export const DEFAULT_HEALTH_ENDPOINTS: Record<string, string> = {
  api_nestjs: "/health",
  api_laravel: "/health",
  web_nextjs: "/api/health",
};
export const DEFAULT_LOGS_ENDPOINTS: Record<string, string> = {
  api_nestjs: "/logs",
  api_laravel: "/logs",
  web_nextjs: "/api/logs",
};
export const MONITOR_HEADER_KEY = "x-monitor-key";
export const MONITOR_HEADER_TIMESTAMP = "x-monitor-timestamp";
export const MONITOR_HEADER_SIGNATURE = "x-monitor-signature";
export const HMAC_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const ALERT_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes between alerts

// Resource alert thresholds (defaults)
export const DEFAULT_DISK_THRESHOLD_PERCENT = 90; // alert when disk usage >= 90%
export const DEFAULT_MEMORY_THRESHOLD_PERCENT = 90; // alert when memory usage >= 90%
export const RESOURCE_ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown between resource alerts per service
