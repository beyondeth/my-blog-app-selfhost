/**
 * OAuth 콜백 라우트
 *
 * OAuth Provider가 리디렉션하는 엔드포인트
 * 정적 HTML 파일을 제공하여 안전하게 콜백 처리
 */

import { Router } from 'express';
import path from 'path';

export function createOAuthRoutes(): Router {
  const router = Router();

  /**
   * OAuth 콜백 웹페이지
   * GET /oauth/callback
   *
   * OAuth Provider (Google, GitHub, Kakao 등)가 인증 완료 후 리디렉션하는 엔드포인트
   * 정적 HTML 파일을 제공하여 클라이언트 측에서 안전하게 토큰 교환 요청 수행
   *
   * 프로덕션 환경에서 여러 사용자가 동시에 인증할 수 있도록 설계됨
   */
  router.get('/oauth/callback', (req, res) => {
    // 정적 HTML 파일 제공 (XSS/템플릿 주입 방지)
    const htmlPath = path.join(__dirname, '../../public/oauth-callback.html');
    res.sendFile(htmlPath);
  });

  return router;
}
