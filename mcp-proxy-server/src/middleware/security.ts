/**
 * Security Headers 미들웨어
 *
 * 보안 헤더 설정으로 다양한 공격 방어
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Content type confusion
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.validation.js';

/**
 * 보안 헤더 미들웨어
 *
 * OWASP 권장 보안 헤더 설정
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // X-Content-Type-Options: MIME sniffing 방지
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options: Clickjacking 방어
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection: XSS 필터 활성화 (구형 브라우저 지원)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: 레퍼러 정보 제어
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content-Security-Policy: XSS 및 데이터 인젝션 방어
  // OAuth 콜백 페이지는 외부 파일만 허용 (인라인 금지)
  if (req.path === '/oauth/callback') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' http://localhost:* https:*; frame-ancestors 'none'"
    );
  } else if (req.path.startsWith('/mcp') || req.path.startsWith('/.well-known/')) {
    // MCP 엔드포인트 및 OAuth Discovery 엔드포인트: CSP 완화
    // Claude Code MCP SDK가 OAuth Discovery를 위해 fetch/XHR 사용 가능
    // - connect-src *: OAuth metadata 및 Authorization Server 호출 허용
    // - default-src 'self': 기본적으로 같은 오리진만 허용
    // - frame-ancestors 'none': Clickjacking 방어 유지
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src *; frame-ancestors 'none'"
    );
  } else {
    // 기타 엔드포인트: 엄격한 CSP
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'"
    );
  }

  // Permissions-Policy: 브라우저 기능 제한
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  // X-Permitted-Cross-Domain-Policies: Flash/PDF 크로스도메인 정책 제한
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Strict-Transport-Security: HTTPS 강제 (프로덕션에서만)
  if (config.NODE_ENV === 'production') {
    // 1년간 HTTPS 강제, 서브도메인 포함
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
}

/**
 * API 응답용 보안 헤더
 *
 * JSON API 응답에 추가 보안 헤더 설정
 */
export function apiSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // 캐시 방지 (민감한 데이터가 포함될 수 있음)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
}
