// 이벤트 추적 유틸리티
import { AnalyticsConfig } from '../types';

export class EventTracker {
  private config: AnalyticsConfig;
  private scrollDepth: number = 0;
  private isTracking: boolean = false;
  private eventListeners: Array<{ element: any; event: string; handler: any }> = [];

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  public updateConfig(config: AnalyticsConfig): void {
    this.config = config;
  }

  public setupEventListeners(): void {
    if (!this.config.enableTracking || this.isTracking) return;

    this.isTracking = true;

    // 스크롤 추적
    this.addEventListner(window, 'scroll', this.throttle(this.handleScroll.bind(this), this.config.trackingInterval || 1000));

    // 가시성 변경 추적
    this.addEventListner(document, 'visibilitychange', this.handleVisibilityChange.bind(this));

    // 클릭 추적 (선택적)
    if (!this.config.privacyMode) {
      this.addEventListner(document, 'click', this.handleClick.bind(this));
    }
  }

  public removeEventListeners(): void {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    this.isTracking = false;
  }

  public getCurrentScrollDepth(): number {
    return this.scrollDepth;
  }

  public resetScrollDepth(): void {
    this.scrollDepth = 0;
  }

  private addEventListner(element: any, event: string, handler: any): void {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  private handleScroll(): void {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    const scrollPercentage = Math.round((scrollTop + windowHeight) / documentHeight * 100);
    this.scrollDepth = Math.max(this.scrollDepth, Math.min(scrollPercentage, 100));

    // 스크롤 이벤트 발생 (필요시)
    this.dispatchCustomEvent('analytics:scroll', {
      scrollDepth: this.scrollDepth,
      scrollTop,
      windowHeight,
      documentHeight,
    });
  }

  private handleVisibilityChange(): void {
    const isHidden = document.hidden;
    
    this.dispatchCustomEvent('analytics:visibility', {
      isHidden,
      timestamp: Date.now(),
    });
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // 특정 요소들만 추적
    if (target.matches('a, button, [data-analytics]')) {
      this.dispatchCustomEvent('analytics:click', {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        text: target.textContent?.slice(0, 100),
        href: target.getAttribute('href'),
        timestamp: Date.now(),
      });
    }
  }

  private dispatchCustomEvent(eventName: string, detail: any): void {
    const customEvent = new CustomEvent(eventName, { detail });
    window.dispatchEvent(customEvent);
  }

  private throttle(func: Function, limit: number): (...args: any[]) => void {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
} 