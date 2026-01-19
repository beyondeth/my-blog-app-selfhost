/**
 * Cloudflare Workers: CDN Proxy for Oracle OCI Object Storage (Private Bucket)
 *
 * 이 Worker는 cdn.codebase.blog로 들어오는 요청을
 * Private Oracle OCI Bucket으로 프록시합니다.
 *
 * 보안:
 * - Bucket은 Private 상태 유지
 * - Pre-Authenticated Request (PAR) URL 사용
 * - 원본 URL 외부 노출 차단
 * - codebase.blog 도메인에서만 접근 허용 (핫링킹 차단)
 *
 * 주요 기능:
 * - Private Bucket 안전 접근
 * - 캐싱 최적화 (Cloudflare Edge)
 * - CORS 헤더 (모든 도메인 허용 for Public Images)
 * - 이미지/문서 파일별 차등 TTL
 * - 보안 헤더 강화
 * - Health Check 엔드포인트
 */

/**
 * 허용된 Origin 목록 (핫링킹 방지용 Referer 체크에 사용)
 */
const ALLOWED_ORIGINS = [
  'https://codebase.blog',
  'https://www.codebase.blog',
  'http://localhost:3001',  // 개발 환경
  'http://localhost:3000',  // 백엔드 개발
];

/**
 * 메인 요청 핸들러
 * @param {Request} request - 들어오는 요청
 * @param {Object} env - 환경 변수 (ORIGIN_BASE_URL)
 * @returns {Promise<Response>} - 프록시된 응답
 */
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const origin = request.headers.get('Origin'); 
      const referer = request.headers.get('Referer');

      // Health check 엔드포인트
      if (pathname === '/' || pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'CDN Proxy Worker',
          version: '2.3.0', // Updated version: Reverted strict check
          timestamp: new Date().toISOString(),
          allowed_origins: ALLOWED_ORIGINS,
          security: {
            cors: 'public (*)',
            hotlinking: 'flexible (allows missing referer for tools/bots)',
            referrer_policy: 'strict-origin-when-cross-origin',
          },
        }, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      }

      // OPTIONS 요청 처리 (CORS Preflight)
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // ----------------------------------------------------------------
      // 🛡️ Hotlinking & Access Control (Flexible Mode)
      // ----------------------------------------------------------------
      
      // 1. Origin 검증 (CORS 요청인 경우 가장 신뢰할 수 있음)
      if (origin) {
        if (!isAllowedOrigin(origin)) {
          // console.warn(`[CDN Proxy] Blocked origin: ${origin}`);
          return new Response('Access denied: Invalid origin', { status: 403 });
        }
        // Origin이 허용되었으면 통과
      } 
      // 2. Referer 검증 (Origin이 없는 경우)
      else if (referer) {
        // Referer가 '있는데' 허용되지 않은 도메인이면 차단 (핫링킹 방지)
        if (!isAllowedReferer(referer)) {
          // console.warn(`[CDN Proxy] Blocked referer: ${referer}`);
          return new Response('Access denied: Hotlinking not allowed', { status: 403 });
        }
        // Referer가 허용된 도메인이면 통과
      }
      // 3. 둘 다 없는 경우 (Direct Access / Server-side Fetch / Next.js Image Optimization)
      else {
        // Next.js Image 서버 등이 요청할 때 Header가 없을 수 있으므로 허용해야 함
        // P2 Badge 요구사항("Missing referer 차단")은 우리 서버까지 차단해버리므로 적용 불가 판단
        // console.log(`[CDN Proxy] Allowed missing referer (Direct Access/Tools)`);
      }

      // ----------------------------------------------------------------

      // Oracle OCI PAR URL 구성
      // env.ORIGIN_BASE_URL은 Cloudflare Workers 환경 변수에서 설정
      // 예: https://...objectstorage.../p/{token}/n/{namespace}/b/{bucket}/o
      const originUrl = `${env.ORIGIN_BASE_URL}${pathname}`;

      // console.log(`[CDN Proxy] Request: ${pathname}`);

      // Oracle OCI로 요청 전달
      const ociResponse = await fetch(originUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Cloudflare-Worker-Proxy/2.3',
        },
      });

      // 404 처리
      if (!ociResponse.ok) {
        // console.error(`[CDN Proxy] OCI error: ${ociResponse.status} for ${pathname}`);
        return new Response(`File not found: ${pathname}`, {
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
          },
        });
      }

      // 응답 재구성 (보안 헤더 + 캐싱 + CORS)
      const contentType = ociResponse.headers.get('content-type') || 'application/octet-stream';
      const cacheControl = getCacheControl(pathname, contentType);

      const newResponse = new Response(ociResponse.body, {
        status: ociResponse.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          // CORS: Public Images이므로 모든 Origin 허용
          'Access-Control-Allow-Origin': '*', 
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          
          // 보안 헤더
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Frame-Options': 'SAMEORIGIN',
        },
      });

      // Oracle OCI 내부 헤더 제거 (보안)
      newResponse.headers.delete('x-amz-id-2');
      newResponse.headers.delete('x-amz-request-id');
      newResponse.headers.delete('opc-request-id');

      return newResponse;

    } catch (error) {
      console.error(`[CDN Proxy] Error:`, error.message);

      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }, null, 2), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }
  },
};

/**
 * Origin이 허용 목록에 있는지 확인
 * @param {string} origin - 요청 Origin 헤더
 * @returns {boolean} - 허용 여부
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Referer가 허용된 도메인인지 확인 (핫링킹 차단)
 * @param {string} referer - 요청 Referer 헤더
 * @returns {boolean} - 허용 여부
 */
function isAllowedReferer(referer) {
  if (!referer) return false;

  try {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;

    // 허용된 Origin 목록에 있는지 확인
    return ALLOWED_ORIGINS.includes(refererOrigin);
  } catch (e) {
    // Referer 파싱 실패 시 차단
    return false;
  }
}

/**
 * CORS Preflight 요청 처리
 * @returns {Response} - CORS 헤더가 포함된 응답
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 파일 경로와 타입에 따라 적절한 Cache-Control 헤더 생성
 * @param {string} path - 파일 경로
 * @param {string} contentType - Content-Type 헤더
 * @returns {string} - Cache-Control 헤더 값
 */
function getCacheControl(path, contentType) {
  // 이미지 파일: 24시간 캐시 (자주 변경되지 않음)
  if (contentType.startsWith('image/') || path.match(/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i)) {
    return 'public, max-age=86400, s-maxage=86400, immutable';
  }

  // 문서 파일: 1시간 캐시
  if (contentType.includes('pdf') || path.match(/\.(pdf|doc|docx)$/i)) {
    return 'public, max-age=3600, s-maxage=3600';
  }

  // 폰트 파일: 1년 캐시 (거의 변경 안 됨)
  if (contentType.includes('font') || path.match(/\.(woff|woff2|ttf|eot)$/i)) {
    return 'public, max-age=31536000, s-maxage=31536000, immutable';
  }

  // CSS/JS 파일: 1시간 캐시
  if (contentType.includes('javascript') || contentType.includes('css') || path.match(/\.(js|css)$/i)) {
    return 'public, max-age=3600, s-maxage=3600';
  }

  // 기타 파일: 기본 1시간
  return 'public, max-age=3600, s-maxage=3600';
}
