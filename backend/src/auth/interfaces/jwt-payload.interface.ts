import { Role } from "../../common/enums/role.enum";

export interface JwtPayload {
  sub: string; // user id (UUID)
  email: string;
  role: Role;
  lastLoginProvider?: string; // 현재 세션의 로그인 방법 (local, google, kakao, github) - UX 개선용
  tokenType?: "access" | "refresh" | "session"; // 토큰 타입 구분 (session 추가)
  iat?: number; // issued at
  exp?: number; // expires at
  iss?: string;
  aud?: string | string[];
}
