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
    */

    'log_file' => env('MONITOR_LOG_FILE', null),
];
