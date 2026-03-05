"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_RATE_LIMIT_MS = exports.HMAC_TIMESTAMP_WINDOW_MS = exports.MONITOR_HEADER_SIGNATURE = exports.MONITOR_HEADER_TIMESTAMP = exports.MONITOR_HEADER_KEY = exports.DEFAULT_LOGS_ENDPOINTS = exports.DEFAULT_HEALTH_ENDPOINTS = exports.DEFAULT_CHECK_INTERVAL = void 0;
exports.DEFAULT_CHECK_INTERVAL = 60; // seconds
exports.DEFAULT_HEALTH_ENDPOINTS = {
    api_nestjs: '/health',
    api_laravel: '/health',
    web_nextjs: '/api/health',
};
exports.DEFAULT_LOGS_ENDPOINTS = {
    api_nestjs: '/logs',
    api_laravel: '/logs',
    web_nextjs: '/api/logs',
};
exports.MONITOR_HEADER_KEY = 'x-monitor-key';
exports.MONITOR_HEADER_TIMESTAMP = 'x-monitor-timestamp';
exports.MONITOR_HEADER_SIGNATURE = 'x-monitor-signature';
exports.HMAC_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
exports.ALERT_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes between alerts
//# sourceMappingURL=index.js.map