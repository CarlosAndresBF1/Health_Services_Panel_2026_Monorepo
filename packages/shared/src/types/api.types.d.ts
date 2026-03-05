export interface HealthCheckResponse {
    status: 'ok' | 'error';
    uptime?: number;
    timestamp: string;
    db?: 'connected' | 'disconnected';
    memory?: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
    };
}
export interface LogsResponse {
    logs: string[];
    total: number;
}
export interface LoginRequest {
    username: string;
    password: string;
}
export interface LoginResponse {
    accessToken: string;
    user: {
        id: number;
        username: string;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
//# sourceMappingURL=api.types.d.ts.map