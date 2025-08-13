export interface UserActivity {
  timestamp: number;
  action: string;
  target: string;
  metadata?: Record<string, any>;
}

export interface UserStats {
  totalVisits: number;
  totalReadTime: number;
  favoriteCategories: Record<string, number>;
  readingSpeed: number;
  engagementScore: number;
  lastVisit: number;
}

export interface TrackingEvent {
  type: string;
  target: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsConfig {
  enableLocalStorage: boolean;
  privacyMode?: boolean;
  enableTracking?: boolean;
  maxActivities?: number;
  trackingInterval?: number;
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  duration: number;
  pageViews: number;
  scrollDepth: number;
}

export interface ReadingSession {
  postId: string;
  startTime: number;
  wordCount: number;
  currentScrollDepth: number;
  isActive: boolean;
} 