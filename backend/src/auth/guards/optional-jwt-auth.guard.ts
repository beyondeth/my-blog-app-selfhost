import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Optional JWT 인증 가드
 * JWT 토큰이 있으면 사용자 정보를 추가하지만, 없어도 요청을 통과시킴
 * OAuth 승인 페이지처럼 인증이 선택적인 경우 사용
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // OptionalJwtAuthGuard는 @Public() 여부와 관계없이 항상 JWT 인증을 시도
    // 인증 성공 시 req.user에 사용자 정보 설정, 실패해도 요청은 통과
    try {
      await super.canActivate(context);
    } catch {
      // 인증 실패해도 통과 (Optional이므로)
    }
    return true;
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    // 에러가 있거나 사용자가 없어도 null을 반환하여 요청 계속 진행
    // 단, user가 있으면 req.user에 설정됨
    if (err || !user) {
      // 인증 실패는 로그하지 않음 (Optional이므로 정상적인 경우임)
      return null;
    }

    // 사용자가 있으면 반환
    return user;
  }
}
