declare module 'cache-manager-redis-store' {
  import { StoreConfig } from 'cache-manager';
  
  interface RedisStoreOptions {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    ttl?: number;
    max?: number;
    isCacheableValue?: (value: any) => boolean;
    [key: string]: any;
  }

  interface RedisStore extends StoreConfig {
    name?: string;
    getClient?: () => any;
    client?: any;
    keys?: (pattern: string) => Promise<string[]>;
  }

  const redisStore: RedisStore;
  export = redisStore;
}