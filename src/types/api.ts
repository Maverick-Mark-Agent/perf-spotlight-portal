// API-related type definitions

export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  timestamp: string;
}
