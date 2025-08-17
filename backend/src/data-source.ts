import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config();

// AWS RDS 연결 설정
const dbUrl = process.env.DB_URL;
let dbConfig: any = {};

if (dbUrl) {
  // DB_URL이 있으면 URL 파싱
  const url = new URL(dbUrl);
  dbConfig = {
    type: 'postgres',
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    username: url.username,
    password: url.password,
    database: url.pathname.substring(1), // '/' 제거
  };
} else {
  // 개별 환경 변수 사용
  dbConfig = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'blog_platform',
  };
}

export const AppDataSource = new DataSource({
  ...dbConfig,
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false, // 스키마 동기화 완료
  logging: process.env.NODE_ENV === 'development',
  // AWS RDS는 SSL 연결 필요
  ssl: dbUrl ? {
    rejectUnauthorized: false
  } : false,
  extra: dbUrl ? {
    ssl: {
      rejectUnauthorized: false
    }
  } : {}
});