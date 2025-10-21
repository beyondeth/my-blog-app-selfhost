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
 *
 * 주요 기능:
 * - Private Bucket 안전 접근
 * - 캐싱 최적화 (Cloudflare Edge)
 * - CORS 헤더 자동 설정
 * - 이미지/문서 파일별 차등 TTL
 */

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

      // OPTIONS 요청 처리 (CORS Preflight)
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // Oracle OCI PAR URL 구성
      // env.ORIGIN_BASE_URL은 Cloudflare Workers 환경 변수에서 설정
      // 예: https://...objectstorage.../p/{token}/n/{namespace}/b/{bucket}/o
      const originUrl = `${env.ORIGIN_BASE_URL}${pathname}`;

      console.log(`[CDN Proxy] Request: ${pathname}`);

      // Oracle OCI로 요청 전달
      const ociResponse = await fetch(originUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Cloudflare-Worker-Proxy/1.0',
        },
      });

      // 404 처리
      if (!ociResponse.ok) {
        console.error(`[CDN Proxy] OCI error: ${ociResponse.status} for ${pathname}`);
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
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Content-Type-Options': 'nosniff',
        },
      });

      // Oracle OCI 내부 헤더 제거 (보안)
      newResponse.headers.delete('x-amz-id-2');
      newResponse.headers.delete('x-amz-request-id');
      newResponse.headers.delete('opc-request-id');

      console.log(`[CDN Proxy] Success: ${pathname} (${contentType})`);

      return newResponse;

    } catch (error) {
      console.error(`[CDN Proxy] Error:`, error.message);

      return new Response(`Internal error: ${error.message}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
        },
      });
    }
  },
};

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
  if (contentType.startsWith('image/') || path.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
    return 'public, max-age=86400, s-maxage=86400, immutable';
  }

  // 문서 파일: 1시간 캐시
  if (contentType.includes('pdf') || path.match(/\.(pdf|doc|docx)$/i)) {
    return 'public, max-age=3600, s-maxage=3600';
  }

  // 기타 파일: 기본 1시간
  return 'public, max-age=3600, s-maxage=3600';
}
