import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', (): TypeOrmModuleOptions => {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;
  
  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: false,
    // 추가 TypeORM 옵션
    maxQueryExecutionTime: 1000, // 1초 이상 걸리는 쿼리 로깅
    dropSchema: false, // 절대 스키마를 드롭하지 않음
    cache: {
      type: 'database',
      duration: 30000, // 30초 캐시
    },
  };

  // DB_URL이 있는 경우 (AWS RDS 등)
  if (dbUrl) {
    return {
      ...baseConfig,
      url: dbUrl,
      ssl: { rejectUnauthorized: false },
      extra: {
        // Connection Pool 설정
        max: parseInt(process.env.DB_POOL_SIZE || '100', 10), // 동시 요청 처리를 위해 증가
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10), // 10초로 증가
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        allowExitOnIdle: true,
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
        ssl: { rejectUnauthorized: false },
      },
    };
  }

  // 개별 환경 변수 사용 (로컬 개발)
  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'blog-db',
    extra: {
      // Connection Pool 설정
      max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '3000', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      allowExitOnIdle: true,
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    },
  };
});