import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";

/**
 * CSRF 공격 방지를 위한 Guard
 *
 * OAuth2 승인 요청 등 중요한 POST 요청에서 CSRF 토큰을 검증합니다.
 * 세션 기반 토큰 검증을 사용합니다.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly TOKEN_HEADER = "x-csrf-token";

  /**
   * CSRF 토큰 생성 (세션 기반)
   */
  static generateToken(req: any): string {
    // 32바이트 랜덤 토큰 생성
    const token = crypto.randomBytes(32).toString("hex");

    // 세션에 토큰 저장
    if (req.session) {
      req.session.csrfToken = token;
    }

    return token;
  }

  /**
   * 요청 검증
   */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();

    // GET, HEAD, OPTIONS 요청은 검증하지 않음
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return true;
    }

    // Bearer/API-key/internal service requests do not rely on browser cookies.
    // CSRF protection is for cookie-authenticated browser requests only.
    if (
      req.headers.authorization ||
      req.headers["x-api-key"] ||
      req.headers["x-internal-secret"] ||
      req.headers["x-oauth-user-id"]
    ) {
      return true;
    }

    // Mobile clients may submit a refresh token in the body and do not have
    // browser cookies to protect. Cookie-authenticated requests continue
    // through the session-backed token check below.
    if (!req.cookies?.access_token && !req.cookies?.refresh_token) {
      return true;
    }

    // 세션에서 토큰 가져오기
    const sessionToken = req.session?.csrfToken;
    if (!sessionToken) {
      throw new UnauthorizedException("CSRF 토큰이 세션에 없습니다");
    }

    // 요청에서 토큰 추출 (헤더 또는 바디에서 확인)
    let requestToken: string | undefined;

    // 1. 헤더에서 확인
    requestToken = req.headers[this.TOKEN_HEADER] as string;

    // 2. 바디에서 확인 (폼 데이터)
    if (!requestToken && req.body) {
      requestToken =
        req.body.csrf_token || req.body.csrfToken || req.body._csrf;
    }

    if (!requestToken) {
      throw new UnauthorizedException("CSRF 토큰이 요청에 포함되지 않았습니다");
    }

    // 토큰 비교 (타이밍 공격 방지를 위해 crypto.timingSafeEqual 사용)
    const sessionBuffer = Buffer.from(sessionToken);
    const requestBuffer = Buffer.from(requestToken);

    if (sessionBuffer.length !== requestBuffer.length) {
      throw new UnauthorizedException("CSRF 토큰이 일치하지 않습니다");
    }

    try {
      const isValid = crypto.timingSafeEqual(sessionBuffer, requestBuffer);
      if (!isValid) {
        throw new UnauthorizedException("CSRF 토큰이 일치하지 않습니다");
      }
    } catch (error) {
      throw new UnauthorizedException("CSRF 토큰 검증 실패");
    }

    // Referer 헤더 추가 검증 (옵션)
    const referer = req.headers.referer || req.headers.origin;
    if (referer) {
      const expectedHost = req.get("host");
      let refererUrl: URL;

      try {
        refererUrl = new URL(referer);
      } catch {
        throw new UnauthorizedException("CSRF origin이 유효하지 않습니다");
      }

      // Referer가 같은 호스트에서 온 것인지 확인
      if (refererUrl.host !== expectedHost) {
        throw new UnauthorizedException("CSRF origin이 일치하지 않습니다");
      }
    }

    return true;
  }
}
