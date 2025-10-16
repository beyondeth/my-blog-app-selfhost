/**
 * 환경 변수 검증 시스템
 *
 * 서버 시작 전 모든 필수 환경 변수를 검증하여
 * 런타임 에러를 방지하고 설정 오류를 조기에 발견
 *
 * 보안 개선:
 * - SESSION_ENCRYPTION_KEY 필수 검증
 * - SESSION_STRICT_MODE 프로덕션 기본값 true
 * - CORS 와일드카드 프로덕션 금지
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

/**
 * 암호화 키 검증
 * 32바이트 (64 hex characters) 필수
 */
const encryptionKeySchema = z.string()
  .length(64, 'SESSION_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  .regex(/^[0-9a-f]{64}$/, 'SESSION_ENCRYPTION_KEY must be hexadecimal')
  .refine(
    () => true,  // 추가 검증 없음
    {
      message: 'Generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    }
  );

// 환경 변수 스키마 정의
const envSchema = z.object({
  // 서버 설정
  MCP_PROXY_PORT: z.string()
    .regex(/^\d+$/, 'MCP_PROXY_PORT must be a number')
    .default('3002')
    .transform(Number),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Redis 설정
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string()
    .regex(/^\d+$/, 'REDIS_PORT must be a number')
    .default('6379')
    .transform(Number),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string()
    .regex(/^\d+$/, 'REDIS_DB must be a number')
    .default('0')
    .transform(Number),

  // 세션 설정
  SESSION_TTL: z.string()
    .regex(/^\d+$/, 'SESSION_TTL must be a number')
    .default('86400')
    .transform(Number),

  // 세션 엄격 모드 (프로덕션 기본값: true)
  SESSION_STRICT_MODE: z.string()
    .default(process.env.NODE_ENV === 'production' ? 'true' : 'false')
    .transform(val => val === 'true'),

  // 세션 암호화 키 (필수)
  SESSION_ENCRYPTION_KEY: encryptionKeySchema,

  // OAuth 설정 (필수)
  OAUTH_CLIENT_ID: z.string().min(1, 'OAUTH_CLIENT_ID is required'),
  OAUTH_CLIENT_SECRET: z.string().min(1, 'OAUTH_CLIENT_SECRET is required'),
  OAUTH_REDIRECT_URI: z.string().url('OAUTH_REDIRECT_URI must be a valid URL'),

  // Backend API 설정 (필수)
  BACKEND_BASE_URL: z.string().url('BACKEND_BASE_URL must be a valid URL'),
  BACKEND_API_URL: z.string().url('BACKEND_API_URL must be a valid URL'),
  // Backend 공개 URL (브라우저가 접근할 수 있는 URL - OAuth Authorization용)
  BACKEND_PUBLIC_URL: z.string().url('BACKEND_PUBLIC_URL must be a valid URL'),

  // CORS 설정 (프로덕션에서 와일드카드 금지)
  CORS_ORIGINS: corsOriginsSchema,

  // 로깅 설정
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string()
    .default('false')
    .transform(val => val === 'true'),

  // Rate Limiting 설정
  RATE_LIMIT_WINDOW_MS: z.string()
    .regex(/^\d+$/, 'RATE_LIMIT_WINDOW_MS must be a number')
    .default('60000') // 1분
    .transform(Number),

  RATE_LIMIT_MAX_REQUESTS: z.string()
    .regex(/^\d+$/, 'RATE_LIMIT_MAX_REQUESTS must be a number')
    .default('60') // 개발: 100, 프로덕션은 60 권장
    .transform(Number),

  // MCP Session 설정
  MCP_SESSION_TIMEOUT_MS: z.string()
    .regex(/^\d+$/, 'MCP_SESSION_TIMEOUT_MS must be a number')
    .default('3600000') // 1시간
    .transform(Number),

  MCP_MAX_CONCURRENT_SESSIONS: z.string()
    .regex(/^\d+$/, 'MCP_MAX_CONCURRENT_SESSIONS must be a number')
    .default('1000')
    .transform(Number),

  // MCP 서버 공개 URL (외부에서 접근 가능한 URL)
  // 개발: http://localhost:3002
  // 프로덕션: https://www.codebase.blog
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
        ? 'https://www.codebase.blog'
        : `http://localhost:${process.env.MCP_PROXY_PORT || 3002}`
    ),
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

    console.log('✅ 환경 변수 검증 완료');
    console.log(`📍 환경: ${env.NODE_ENV}`);
    console.log(`📍 MCP Proxy 포트: ${env.MCP_PROXY_PORT}`);
    console.log(`📍 MCP Base URL: ${env.MCP_BASE_URL}`);
    console.log(`📍 Redis: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    console.log(`📍 Backend: ${env.BACKEND_BASE_URL}`);
    console.log(`🔐 세션 암호화: 활성화 (AES-256-GCM)`);
    console.log(`🛡️ 세션 엄격 모드: ${env.SESSION_STRICT_MODE ? '활성화' : '비활성화'}`);

    // 프로덕션 환경 추가 검증
    if (env.NODE_ENV === 'production') {
      console.log('\n🔍 프로덕션 환경 추가 검증:');

      // CORS 와일드카드 확인
      if (env.CORS_ORIGINS.includes('*')) {
        throw new Error('CORS wildcard is not allowed in production');
      }
      console.log('  ✅ CORS 설정 안전');

      // SESSION_STRICT_MODE 확인
      if (!env.SESSION_STRICT_MODE) {
        console.warn('  ⚠️ SESSION_STRICT_MODE가 비활성화되어 있습니다. 프로덕션에서는 활성화를 권장합니다.');
      } else {
        console.log('  ✅ 세션 엄격 모드 활성화');
      }

      // HTTPS 확인
      if (!env.BACKEND_BASE_URL.startsWith('https://')) {
        console.warn('  ⚠️ BACKEND_BASE_URL이 HTTPS를 사용하지 않습니다.');
      } else {
        console.log('  ✅ HTTPS 사용 중');
      }

      // MCP_BASE_URL HTTPS 확인
      if (!env.MCP_BASE_URL.startsWith('https://')) {
        console.warn('  ⚠️ MCP_BASE_URL이 HTTPS를 사용하지 않습니다.');
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
      console.error('   예제: .env.example 파일 참고\n');

      // 암호화 키 생성 가이드
      if (error.issues.some(issue => issue.path.includes('SESSION_ENCRYPTION_KEY'))) {
        console.error('🔐 SESSION_ENCRYPTION_KEY 생성 방법:');
        console.error('   node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"\n');
      }

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
