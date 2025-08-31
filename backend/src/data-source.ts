import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Migration 전용 DataSource 생성 함수
 * NestJS 애플리케이션은 TypeORM 모듈을 통해 연결 관리
 */
export const createDataSourceOptions = (): any => {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;
  
  const baseConfig = {
    type: 'postgres',
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  if (dbUrl) {
    // 로컬 데이터베이스인 경우 SSL 비활성화
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    
    return {
      ...baseConfig,
      url: dbUrl,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
      extra: {
        // Connection Pool 설정 (migrations에서도 동일하게 적용)
        max: parseInt(process.env.DB_POOL_SIZE || '5', 10), // migration은 적은 연결로 충분
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '3000', 10),
        ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
      },
    };
  }

  // 개별 환경 변수 사용
  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'blog_platform',
  };
};

/**
 * Migration CLI 전용 DataSource 인스턴스
 * TypeORM CLI가 직접 사용
 */
export const AppDataSource = new DataSource(createDataSourceOptions());