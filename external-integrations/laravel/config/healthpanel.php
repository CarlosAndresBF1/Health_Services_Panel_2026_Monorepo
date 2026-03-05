<?php

return [
    /*
    |--------------------------------------------------------------------------
    | HealthPanel Monitor Configuration
    |--------------------------------------------------------------------------
    |
    | These values are used by the MonitorAuthMiddleware to validate
    | incoming requests from HealthPanel. Get these credentials from
    | the HealthPanel dashboard when registering this service.
    |
    */

    'api_key' => env('MONITOR_API_KEY'),
    'secret' => env('MONITOR_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Log File Path
    |--------------------------------------------------------------------------
    |
    | Path to the log file that HealthPanel will read. Can be absolute
    | or relative to the project root. Defaults to storage/logs/laravel.log.
    |
    | Supports three modes:
    | 1. Static path:    "storage/logs/laravel.log"
    | 2. Glob pattern:   "storage/logs/laravel-*.log" (finds latest by mtime)
    | 3. Absolute path:  "/var/www/myapp/storage/logs/laravel-2026-03-05.log"
    |
    | For daily rotation, use log_rotation instead (see below).
    |
    */

    'log_file' => env('MONITOR_LOG_FILE', null),

    /*
    |--------------------------------------------------------------------------
    | Log Rotation Mode
    |--------------------------------------------------------------------------
    |
    | If your Laravel project uses daily log rotation (LOG_CHANNEL=daily),
    | set this to 'daily' to auto-detect the current day's log file.
    |
    | This will look for files matching: storage/logs/laravel-YYYY-MM-DD.log
    | and select the most recent one.
    |
    | Options: null, 'daily'
    |
    */

    'log_rotation' => env('MONITOR_LOG_ROTATION', null),
];
