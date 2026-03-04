// Health check response from external services
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

// Logs response from external services
export interface LogsResponse {
  logs: string[];
  total: number;
}

// Auth
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

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
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
