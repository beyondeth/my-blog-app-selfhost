/**
 * 메트릭 서비스
 * @description 전체 시스템 메트릭 관리 서비스
 */

import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  constructor() {
    // 커스텀 레지스트리 생성
    this.registry = new Registry();

    // 기본 메트릭 수집 (CPU, 메모리, GC 등)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'nodejs_app_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
  }

  /**
   * 레지스트리 반환
   * @description 다른 서비스에서 메트릭 등록시 사용
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * 모든 메트릭을 Prometheus 포맷으로 반환
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * 메트릭을 JSON 포맷으로 반환
   */
  async getMetricsAsJSON() {
    return await this.registry.getMetricsAsJSON();
  }
}