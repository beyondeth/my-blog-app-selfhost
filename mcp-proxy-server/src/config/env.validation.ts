/**
 * 환경 변수 검증 시스템
 *
 * 서버 시작 전 모든 필수 환경 변수를 검증하여
 * 런타임 에러를 방지하고 설정 오류를 조기에 발견
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 환경 변수 스키마 정의
const envSchema = z.object({
  // 서버 설정
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').transform(Number).optional().default(8080),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Redis 설정
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/, 'REDIS_PORT must be a number').transform(Number).optional().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().regex(/^\d+$/, 'REDIS_DB must be a number').transform(Number).optional().default(0),

  // 세션 설정
  SESSION_TTL: z.string().regex(/^\d+$/, 'SESSION_TTL must be a number').transform(Number).optional().default(86400),
  SESSION_STRICT_MODE: z.enum(['true', 'false']).transform(val => val === 'true').optional().default(false),

  // OAuth 설정 (필수)
  OAUTH_CLIENT_ID: z.string().min(1, 'OAUTH_CLIENT_ID is required'),
  OAUTH_CLIENT_SECRET: z.string().min(1, 'OAUTH_CLIENT_SECRET is required'),
  OAUTH_REDIRECT_URI: z.string().url('OAUTH_REDIRECT_URI must be a valid URL'),

  // Backend API 설정 (필수)
  BACKEND_BASE_URL: z.string().url('BACKEND_BASE_URL must be a valid URL'),
  BACKEND_API_URL: z.string().url('BACKEND_API_URL must be a valid URL'),

  // CORS 설정
  CORS_ORIGINS: z.string().default('http://localhost:*'),

  // 로깅 설정
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).transform(val => val === 'true').optional().default(false),
});

// 환경 변수 타입 정의
export type EnvConfig = z.infer<typeof envSchema>;

// 환경 변수 검증 함수
export function validateEnv(): EnvConfig {
  try {
    // 환경 변수 파싱 및 검증
    const env = envSchema.parse(process.env);

    console.log('✅ 환경 변수 검증 완료');
    console.log(`📍 환경: ${env.NODE_ENV}`);
    console.log(`📍 포트: ${env.PORT}`);
    console.log(`📍 Redis: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    console.log(`📍 Backend: ${env.BACKEND_BASE_URL}`);

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ 환경 변수 검증 실패:');
      console.error('━'.repeat(50));

      error.issues.forEach(issue => {
        console.error(`  ❗ ${issue.path.join('.')}: ${issue.message}`);
      });

      console.error('━'.repeat(50));
      console.error('\n💡 .env 파일을 확인하고 필수 환경 변수를 설정해주세요.');
      console.error('   예제: .env.example 파일 참고\n');

      // 개발 환경에서는 자세한 오류 표시
      if (process.env.NODE_ENV === 'development') {
        console.error('🔍 전체 오류 정보:', JSON.stringify(error.issues, null, 2));
      }
    } else {
      console.error('❌ 예상치 못한 오류:', error);
    }

    // 서버 시작 중단
    process.exit(1);
  }
}

// 검증된 환경 변수 export
export const config = validateEnv();