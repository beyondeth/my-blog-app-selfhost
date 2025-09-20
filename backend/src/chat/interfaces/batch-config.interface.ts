export interface BatchConfig {
  batchSize: number;
  batchInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  dlqEnabled: boolean;
  enableMonitoring: boolean;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  batchInterval: 5000, // 5 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  dlqEnabled: true,
  enableMonitoring: true,
};