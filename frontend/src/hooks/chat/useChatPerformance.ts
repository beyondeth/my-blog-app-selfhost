/**
 * Chat Performance Monitoring Hook
 * Tracks and reports performance metrics for chat operations
 */

import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryDelta?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  slow: number;      // Warning threshold
  critical: number;  // Critical threshold
}

const DEFAULT_THRESHOLDS: Record<string, PerformanceThresholds> = {
  fetchConversations: { slow: 500, critical: 2000 },
  fetchMessages: { slow: 300, critical: 1500 },
  sendMessage: { slow: 200, critical: 1000 },
  markAsRead: { slow: 100, critical: 500 },
  default: { slow: 300, critical: 1000 }
};

export interface UseChatPerformanceReturn {
  measurePerformance: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
  getMetrics: () => PerformanceMetrics[];
  clearMetrics: () => void;
  getAverageMetrics: () => Record<string, number>;
  reportSlowOperation: (metrics: PerformanceMetrics) => void;
}

export function useChatPerformance(): UseChatPerformanceReturn {
  const metricsRef = useRef<PerformanceMetrics[]>([]);
  const maxMetricsSize = 100; // Keep last 100 metrics

  // Report slow operations (could send to analytics)
  const reportSlowOperation = useCallback((metrics: PerformanceMetrics) => {
    // In production, this would send to analytics service
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('slow_operation', {
        operation: metrics.operation,
        duration: metrics.duration,
        memoryDelta: metrics.memoryDelta,
        timestamp: metrics.timestamp
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🐌 Slow Operation Detected: ${metrics.operation}`);
      console.log('Duration:', `${metrics.duration.toFixed(2)}ms`);
      if (metrics.memoryDelta) {
        console.log('Memory Delta:', `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      }
      console.log('Timestamp:', metrics.timestamp);
      console.groupEnd();
    }
  }, []);

  // Measure performance of an async operation
  const measurePerformance = useCallback(async <T,>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;

    try {
      const result = await fn();

      const duration = performance.now() - startTime;
      const memoryDelta = (performance as any).memory?.usedJSHeapSize
        ? (performance as any).memory.usedJSHeapSize - startMemory
        : undefined;

      const metrics: PerformanceMetrics = {
        operation,
        duration,
        memoryDelta,
        timestamp: new Date()
      };

      // Store metrics
      metricsRef.current.push(metrics);

      // Keep only last N metrics
      if (metricsRef.current.length > maxMetricsSize) {
        metricsRef.current = metricsRef.current.slice(-maxMetricsSize);
      }

      // Check thresholds
      const thresholds = DEFAULT_THRESHOLDS[operation] || DEFAULT_THRESHOLDS.default;

      if (duration > thresholds.critical) {
        console.error(
          `[Performance] CRITICAL: ${operation} took ${duration.toFixed(2)}ms (threshold: ${thresholds.critical}ms)`,
          metrics
        );
        reportSlowOperation(metrics);
      } else if (duration > thresholds.slow) {
        console.warn(
          `[Performance] SLOW: ${operation} took ${duration.toFixed(2)}ms (threshold: ${thresholds.slow}ms)`,
          metrics
        );
      } else if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Performance] ${operation} completed in ${duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Log failed operations
      const metrics: PerformanceMetrics = {
        operation,
        duration,
        timestamp: new Date(),
        metadata: { error: true }
      };

      metricsRef.current.push(metrics);

      console.error(
        `[Performance] ${operation} failed after ${duration.toFixed(2)}ms`,
        error
      );

      throw error;
    }
  }, [reportSlowOperation]);

  // Get all collected metrics
  const getMetrics = useCallback((): PerformanceMetrics[] => {
    return [...metricsRef.current];
  }, []);

  // Clear all metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
  }, []);

  // Calculate average metrics per operation
  const getAverageMetrics = useCallback((): Record<string, number> => {
    const operationMetrics: Record<string, number[]> = {};

    metricsRef.current.forEach(metric => {
      if (!operationMetrics[metric.operation]) {
        operationMetrics[metric.operation] = [];
      }
      operationMetrics[metric.operation].push(metric.duration);
    });

    const averages: Record<string, number> = {};

    Object.entries(operationMetrics).forEach(([operation, durations]) => {
      const sum = durations.reduce((acc, duration) => acc + duration, 0);
      averages[operation] = sum / durations.length;
    });

    return averages;
  }, []);

  return {
    measurePerformance,
    getMetrics,
    clearMetrics,
    getAverageMetrics,
    reportSlowOperation
  };
}