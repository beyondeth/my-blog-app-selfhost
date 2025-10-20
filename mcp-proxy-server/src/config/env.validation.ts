/**
 * 환경 변수 검증 시스템 - API Key 인증 버전
 *
 * 서버 시작 전 모든 필수 환경 변수를 검증하여
 * 런타임 에러를 방지하고 설정 오류를 조기에 발견
 *
 * 변경 사항:
 * - OAuth2 세션 관련 변수 제거 (SESSION_ENCRYPTION_KEY, SESSION_TTL, SESSION_STRICT_MODE)
 * - API Key 인증 방식으로 전환 (Stateless)
 * - Rate Limiting 설정 유지 (200 req/h)
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

/**
 * CORS origins 검증
 * 프로덕션 환경에서 와일드카드(*) 금지
 */
const corsOriginsSchema = z.string()
  .refine(
    (value) => {
      // 프로덕션 환경에서 와일드카드 금지
      if (process.env.NODE_ENV === 'production') {
        return !value.includes('*');
      }
      return true;
    },
    {
      message: 'CORS wildcard (*) is not allowed in production. Use specific domain whitelist.'
    }
  )
  .default('http://localhost:*');

// 환경 변수 스키마 정의
const envSchema = z.object({
  // 서버 설정
  MCP_PROXY_PORT: z.string()
    .regex(/^\d+$/, 'MCP_PROXY_PORT must be a number')
    .default('3002')
    .transform(Number),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Backend API 설정 (필수)
  BACKEND_BASE_URL: z.string().url('BACKEND_BASE_URL must be a valid URL'),
  BACKEND_API_URL: z.string().url('BACKEND_API_URL must be a valid URL'),
  // Backend 공개 URL (브라우저가 접근할 수 있는 URL)
  BACKEND_PUBLIC_URL: z.string().url('BACKEND_PUBLIC_URL must be a valid URL'),

  // CORS 설정 (프로덕션에서 와일드카드 금지)
  CORS_ORIGINS: corsOriginsSchema,

  // 로깅 설정
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string()
    .default('false')
    .transform(val => val === 'true'),

  // Rate Limiting 설정 (API Key 기반 - 200 req/h)
  RATE_LIMIT_WINDOW_MS: z.string()
    .regex(/^\d+$/, 'RATE_LIMIT_WINDOW_MS must be a number')
    .default('3600000') // 1시간
    .transform(Number),

  RATE_LIMIT_MAX_REQUESTS: z.string()
    .regex(/^\d+$/, 'RATE_LIMIT_MAX_REQUESTS must be a number')
    .default('200') // 200 req/h
    .transform(Number),

  // Request 설정
  MAX_PAYLOAD_SIZE: z.string().default('10mb'),
  REQUEST_TIMEOUT: z.string()
    .regex(/^\d+$/, 'REQUEST_TIMEOUT must be a number')
    .default('30000')
    .transform(Number),
  BACKEND_TIMEOUT: z.string()
    .regex(/^\d+$/, 'BACKEND_TIMEOUT must be a number')
    .default('20000')
    .transform(Number),

  // MCP 서버 공개 URL (Claude Code 연결용)
  // 개발: http://localhost:3002
  // 프로덕션: https://mcp.codebase.blog
  MCP_BASE_URL: z.string()
    .url('MCP_BASE_URL must be a valid URL')
    .refine(
      (url) => {
        // 프로덕션에서는 HTTPS 필수
        if (process.env.NODE_ENV === 'production') {
          return url.startsWith('https://');
        }
        return true;
      },
      {
        message: 'MCP_BASE_URL must use HTTPS in production'
      }
    )
    .default(
      process.env.NODE_ENV === 'production'
        ? 'https://mcp.codebase.blog'
        : `http://localhost:${process.env.MCP_PROXY_PORT || 3002}`
    ),

  // Redis 설정 (API Key 캐싱용)
  REDIS_HOST: z.string().default('my-blog-app-shared-redis'),
  REDIS_PORT: z.string()
    .regex(/^\d+$/, 'REDIS_PORT must be a number')
    .default('6379')
    .transform(Number),
  REDIS_PASSWORD: z.string().optional(),
  API_KEY_CACHE_TTL: z.string()
    .regex(/^\d+$/, 'API_KEY_CACHE_TTL must be a number')
    .default('300') // 5분
    .transform(Number),
});

// 환경 변수 타입 정의
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * 환경 변수 검증 함수
 */
export function validateEnv(): EnvConfig {
  try {
    // 환경 변수 파싱 및 검증
    const env = envSchema.parse(process.env);

    console.log('✅ 환경 변수 검증 완료 (API Key 인증 모드)');
    console.log(`📍 환경: ${env.NODE_ENV}`);
    console.log(`📍 MCP Proxy 포트: ${env.MCP_PROXY_PORT}`);
    console.log(`📍 MCP Base URL: ${env.MCP_BASE_URL}`);
    console.log(`📍 Backend: ${env.BACKEND_BASE_URL}`);
    console.log(`📍 Backend Public: ${env.BACKEND_PUBLIC_URL}`);
    console.log(`🔐 인증 방식: API Key (Bearer Token)`);
    console.log(`🛡️ Rate Limit: ${env.RATE_LIMIT_MAX_REQUESTS} req/${env.RATE_LIMIT_WINDOW_MS / 3600000}h`);

    // 프로덕션 환경 추가 검증
    if (env.NODE_ENV === 'production') {
      console.log('\n🔍 프로덕션 환경 추가 검증:');

      // CORS 와일드카드 확인
      if (env.CORS_ORIGINS.includes('*')) {
        throw new Error('CORS wildcard is not allowed in production');
      }
      console.log('  ✅ CORS 설정 안전');

      // HTTPS 확인
      if (!env.BACKEND_BASE_URL.startsWith('https://') && !env.BACKEND_BASE_URL.startsWith('http://backend:')) {
        console.warn('  ⚠️ BACKEND_BASE_URL이 HTTPS를 사용하지 않습니다.');
      } else {
        console.log('  ✅ Backend URL 설정 안전');
      }

      // MCP_BASE_URL HTTPS 확인
      if (!env.MCP_BASE_URL.startsWith('https://')) {
        console.warn('  ⚠️ MCP_BASE_URL이 HTTPS를 사용하지 않습니다. (프로덕션 필수)');
      } else {
        console.log('  ✅ MCP Base URL HTTPS 사용 중');
      }
    }

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
      console.error('   참고: .env.development 또는 .env.production\n');

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
