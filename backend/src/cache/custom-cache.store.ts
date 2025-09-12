import { Store } from 'cache-manager';
import { LRUCache } from 'lru-cache';

/**
 * Custom cache store wrapper for cache-manager v5 compatibility with NestJS
 * This solves the "store.get is not a function" error
 */
export class CustomMemoryStore implements Store {
  private cache: LRUCache<string, any>;
  private defaultTtl: number;

  constructor(options: { max?: number; ttl?: number } = {}) {
    this.defaultTtl = options.ttl || 600; // Default 10 minutes
    this.cache = new LRUCache<string, any>({
      max: options.max || 5000,
      ttl: this.defaultTtl * 1000, // Convert seconds to milliseconds
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const actualTtl = ttl !== undefined ? ttl * 1000 : this.defaultTtl * 1000;
    this.cache.set(key, value, { ttl: actualTtl });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async reset(): Promise<void> {
    this.cache.clear();
  }

  async mget(...keys: string[]): Promise<any[]> {
    return keys.map(key => this.cache.get(key));
  }

  async mset(args: [string, any, number?][]): Promise<void> {
    for (const [key, value, ttl] of args) {
      await this.set(key, value, ttl);
    }
  }

  async mdel(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys()) as string[];
    if (!pattern) return allKeys;
    
    // Convert pattern to regex (* -> .*)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async getTtl(key: string): Promise<number> {
    const remaining = this.cache.getRemainingTTL(key);
    return remaining ? Math.floor(remaining / 1000) : -1;
  }

  // Store interface ttl method
  async ttl(key: string): Promise<number> {
    return this.getTtl(key);
  }

  // Additional methods for compatibility
  get size(): number {
    return this.cache.size;
  }

  get stats(): any {
    return {
      hits: (this.cache as any).hits || 0,
      misses: (this.cache as any).misses || 0,
      keys: this.cache.size,
      maxSize: this.cache.max,
    };
  }

  forEach(callback: (value: any, key: string) => void): void {
    this.cache.forEach(callback);
  }

  dump(): Array<[string, { value: any; size?: number }]> {
    const entries: Array<[string, { value: any; size?: number }]> = [];
    this.cache.forEach((value, key) => {
      entries.push([key, { value, size: JSON.stringify(value).length }]);
    });
    return entries;
  }
}

/**
 * Factory function to create custom memory store
 */
export function createCustomMemoryStore(options?: { max?: number; ttl?: number }): CustomMemoryStore {
  return new CustomMemoryStore(options);
}