// 캐시 구조 테스트 스크립트
const { NestFactory } = require('@nestjs/core');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    require('./dist/src/app.module').AppModule
  );
  
  const cacheService = app.get(require('./dist/src/cache/cache.service').CacheService);
  
  // 테스트 데이터 추가
  await cacheService.set('test:key:1', { data: 'test1' }, 60);
  await cacheService.set('test:key:2', { data: 'test2' }, 60);
  await cacheService.set('feed:page:1', { posts: [] }, 60);
  
  // cacheManager 구조 확인
  const cacheManager = cacheService['cacheManager'];
  console.log('=== Cache Manager Structure ===');
  console.log('Type:', typeof cacheManager);
  console.log('Constructor:', cacheManager.constructor.name);
  console.log('Keys:', Object.keys(cacheManager));
  
  // store 구조 확인
  const store = cacheManager.store || cacheManager;
  console.log('\n=== Store Structure ===');
  console.log('Type:', typeof store);
  console.log('Constructor:', store.constructor?.name);
  console.log('Keys:', Object.keys(store));
  
  // 실제 캐시 데이터 찾기 - stores 배열 확인
  console.log('\n=== Finding Cache Data ===');
  if (cacheManager.stores && Array.isArray(cacheManager.stores)) {
    console.log('Found stores array, length:', cacheManager.stores.length);
    
    for (let i = 0; i < cacheManager.stores.length; i++) {
      const store = cacheManager.stores[i];
      console.log(`\n--- Store ${i} ---`);
      console.log('Store type:', typeof store);
      console.log('Store constructor:', store.constructor?.name);
      console.log('Store keys:', Object.keys(store));
      
      // Keyv의 _store 확인
      if (store._store) {
        console.log('Found _store property');
        const actualStore = store._store;
        console.log('_store type:', typeof actualStore);
        console.log('_store constructor:', actualStore.constructor?.name);
        console.log('_store keys:', Object.keys(actualStore));
        
        // cache 속성 찾기
        if (actualStore.cache) {
          console.log('Found cache in _store!');
          const cache = actualStore.cache;
          console.log('Cache type:', typeof cache);
          console.log('Cache constructor:', cache.constructor?.name);
          
          // LRUCache의 메서드들 시도
          if (typeof cache.size === 'number') {
            console.log('Cache size:', cache.size);
          } else if (typeof cache.size === 'function') {
            console.log('Cache size (method):', cache.size());
          }
          
          if (typeof cache.keys === 'function') {
            try {
              const keys = Array.from(cache.keys());
              console.log('Cache keys count:', keys.length);
              console.log('Sample keys:', keys.slice(0, 5));
            } catch (e) {
              console.log('Error getting keys:', e.message);
            }
          }
          
          // dump 메서드 시도
          if (typeof cache.dump === 'function') {
            try {
              const dump = cache.dump();
              console.log('Cache dump length:', dump.length);
              console.log('Sample dump entries:', dump.slice(0, 2));
            } catch (e) {
              console.log('Error dumping cache:', e.message);
            }
          }
        }
      }
      
      // opts.store도 확인
      if (store.opts && store.opts.store) {
        console.log('\nAlso checking opts.store');
        const internalStore = store.opts.store;
        console.log('Internal store type:', typeof internalStore);
        console.log('Internal store keys:', Object.keys(internalStore));
      }
    }
  }
  
  // getMemoryUsage 테스트
  console.log('\n=== Memory Usage ===');
  const memoryUsage = await cacheService.getMemoryUsage();
  console.log('Memory Usage:', memoryUsage);
  
  // getStats 테스트
  console.log('\n=== Cache Stats ===');
  const stats = await cacheService.getStats();
  console.log('Cache Stats:', stats);
  
  await app.close();
}

bootstrap().catch(console.error);