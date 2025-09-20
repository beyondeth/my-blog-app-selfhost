export interface QueuedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  tempId?: string;
  createdAt: Date;
  queuedAt: Date;
  retryCount?: number;
}

export interface BatchResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  failedMessages?: QueuedMessage[];
  processingTime: number;
  error?: string;
}

export interface QueueMetrics {
  queueSize: number;
  dlqSize: number;
  processingRate: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
  failureRate: number;
}

export interface RedisMessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  tempId?: string;
}