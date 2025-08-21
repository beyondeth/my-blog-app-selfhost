import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config();

/**
 * Migration 전용 DataSource 생성 함수
 * NestJS 애플리케이션은 TypeORM 모듈을 통해 연결 관리
 */
export const createDataSourceOptions = (): DataSourceOptions => {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;
  
  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    entities: [join(__dirname, '**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  if (dbUrl) {
    return {
      ...baseConfig,
      url: dbUrl,
      ssl: { rejectUnauthorized: false },
      extra: {
        // Connection Pool 설정 (migrations에서도 동일하게 적용)
        max: parseInt(process.env.DB_POOL_SIZE || '5', 10), // migration은 적은 연결로 충분
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '3000', 10),
        ssl: { rejectUnauthorized: false },
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