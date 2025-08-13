import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: string; // user id (UUID)
  email: string;
  role: Role;
  tokenType?: 'access' | 'refresh' | 'session'; // 토큰 타입 구분 (session 추가)
  iat?: number; // issued at
  exp?: number; // expires at
} 