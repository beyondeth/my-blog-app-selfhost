import { Exclude, Expose } from 'class-transformer';
import { Role } from '../../common/enums/role.enum';

/**
 * User 응답 DTO
 *
 * @description
 * 민감한 정보(password, refreshToken 등)를 제외한 공개 가능한 사용자 정보만 노출
 * OneToMany 관계는 lazy loading 방지를 위해 제외
 *
 * @보안
 * - 비밀번호, 토큰 등 민감 정보 완전 제거
 * - 이메일 인증 정보 등 내부 상태 숨김
 * - 공개 프로필에 필요한 정보만 선택적 노출
 */
@Exclude() // 기본적으로 모든 필드 제외
export class UserResponseDto {
  // id 필드 공개 (프론트엔드 호환성: React key prop, 권한 체크 등)
  // UUID는 예측 불가능하므로 보안상 큰 위험 없음
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  profileImage?: string;

  @Expose()
  bio?: string;

  // 민감한 정보는 명시적으로 제외
  @Exclude()
  email: string;

  @Exclude()
  role: Role;

  @Exclude()
  password: string;

  @Exclude()
  refreshToken: string;

  @Exclude()
  refreshTokenExpiresAt: Date;

  @Exclude()
  isEmailVerified: boolean;

  @Exclude()
  isActive: boolean;

  @Exclude()
  lastLoginAt: Date;

  @Exclude()
  authProvider: string;

  @Exclude()
  providerId: string;

  @Exclude()
  primaryIdentityId: string;

  @Exclude()
  lastLoginProvider: string;

  @Exclude()
  accountVerifiedAt: Date;

  @Exclude()
  accountSecurityLevel: number;

  // OneToMany 관계 제외 (lazy loading 방지)
  @Exclude()
  posts: any;

  @Exclude()
  comments: any;

  @Exclude()
  following: any;

  @Exclude()
  followers: any;

  @Exclude()
  notifications: any;

  @Exclude()
  blog: any;

  @Exclude()
  identities: any;

  @Exclude()
  commentLikes: any;

  @Exclude()
  likedPosts: any;
}