// MCP AI Tracking Types

export type AIClientType = 'claude' | 'chatgpt' | 'gemini' | 'qwen' | 'unknown';
export type ActionType = 'write';  // MCP는 오직 쓰기만 지원

export interface McpActivity {
  id: string;
  actionType: ActionType;
  actionCategory?: string;
  clientType: AIClientType;
  resourceType?: string;
  resourceSlug?: string;
  requestEndpoint?: string;
  requestMethod?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  responseTimeMs?: number;
  timestamp: string;
  user: {
    id: string;
    email: string;
    username?: string;
  };
  apiKey: {
    id: string;
    keyId: string;
    name?: string;
  };
}

export interface McpStats {
  totalActivities: number;
  byClient: {
    claude: number;
    chatgpt: number;
    gemini: number;
    qwen: number;
    unknown: number;
  };
  byAction: {
    write: number;  // MCP는 쓰기만 지원
  };
  recentTrend: 'up' | 'down' | 'stable';
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

export interface McpClientStats {
  clientType: AIClientType;
  totalActivities: number;
  recentActivities: number;
  postsCreated: number;  // 쓰기 활동만 추적
  avgResponseTime: number;
  lastActivityAt: string;
}

export interface McpPopularPost {
  postId: string;
  postSlug: string;
  postTitle: string;
  blogSlug: string;
  createdCount: number;  // 읽기 대신 생성 횟수
  uniqueClients: number;
  aiClients: AIClientType[];
  lastCreatedAt: string;  // 마지막 생성 시간
}

export interface McpHourlyActivity {
  hour: string;
  activities: number;
  byClient: Record<AIClientType, number>;
  byAction: Record<ActionType, number>;
}

export interface McpUserActivity {
  userId: string;
  userEmail: string;
  totalActivities: number;
  apiKeys: Array<{
    keyId: string;
    name: string;
    activities: number;
  }>;
  byClient: Record<AIClientType, number>;
  byAction: Record<ActionType, number>;
  recentActivities: McpActivity[];
}

// Chart Data Types
export interface McpChartData {
  name: string;
  value: number;
  fill?: string;
}

export interface McpTimeSeriesData {
  time: string;
  claude: number;
  chatgpt: number;
  gemini: number;
  qwen: number;
  unknown: number;
  total: number;
}

// Filter Types
export interface McpFilters {
  clientType?: AIClientType | 'all';
  actionType?: ActionType | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  apiKeyId?: string;
  search?: string;
}

// API Response Types
export interface McpStatsResponse {
  success: boolean;
  data: McpStats;
  period: {
    start: string;
    end: string;
  };
}

export interface McpActivitiesResponse {
  success: boolean;
  data: McpActivity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Color Theme for AI Clients
export const AI_CLIENT_COLORS: Record<AIClientType, string> = {
  claude: '#D97757',    // Claude Orange (클로드 주황색)
  chatgpt: '#000000',   // Black (검정색)
  gemini: '#3B82F6',    // Blue (파란색)
  qwen: '#8B5CF6',      // Purple (보라색)
  unknown: '#6B7280',   // Gray (회색)
};

export const AI_CLIENT_LABELS: Record<AIClientType, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  qwen: 'Qwen',
  unknown: 'Unknown',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  write: '쓰기',  // MCP는 쓰기만 지원
};