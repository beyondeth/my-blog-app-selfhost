import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { CommentLike } from '../../comments/entities/comment-like.entity';
import { Role } from '../../common/enums/role.enum';
import { Follow } from '../../follows/entities/follow.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { UserIdentity } from './user-identity.entity';
import { Profile } from './profile.entity';
import { Subscription } from './subscription.entity';
import { AccountSettings } from './account-settings.entity';

/**
 * AuthProvider 상수
 * - 지원하는 인증 제공자 목록
 */
export const AuthProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  GITHUB: 'github',
} as const;

export type AuthProvider = typeof AuthProvider[keyof typeof AuthProvider];

/**
 * User 엔티티 (슬림화 버전)
 *
 * **설계 원칙 (체크포인트 1):**
 * - 핵심 인증 정보만 보유 (55 → 14 columns)
 * - Single Responsibility: 사용자 인증 및 식별
 * - 프로필, 구독, 설정 정보는 별도 테이블로 분리 (1:1 관계)
 *
 * **분리된 테이블:**
 * - Profile: 공개 프로필 정보 (name, profileImage, bio 등)
 * - Subscription: 구독/결제 정보 (tier, status, payment 등)
 * - AccountSettings: 보안/설정 정보 (refreshToken, 약관 동의 등)
 *
 * **장점:**
 * - 테이블 락 최소화 (인증 조회 시 프로필 정보 불필요)
 * - 명확한 책임 분리 (SOLID 원칙)
 * - 확장성 향상 (각 테이블 독립적 확장)
 * - 쿼리 성능 향상 (필요한 데이터만 조회)
 */
@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['role'])
@Index(['authProvider'])
export class User {
  /**
   * 기본 키
   * - UUID v4 (기존 사용자 호환성)
   * - 신규 사용자는 애플리케이션 레벨에서 UUID v7 생성 가능 (향후 마이그레이션)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 이메일 (고유)
   * - 로그인 ID 역할
   * - 소셜 로그인도 이메일 기반 통합
   */
  @Column({ unique: true, length: 255 })
  email: string;

  /**
   * 비밀번호 (해시)
   * - bcrypt로 해싱 (salt round: 12)
   * - 소셜 로그인 사용자는 null
   * - @Exclude: API 응답에서 제외
   */
  @Column({ nullable: true, length: 255 })
  @Exclude({ toPlainOnly: true })
  password: string;

  /**
   * 사용자명 (표시명)
   * - 블로그 주소 생성 시 사용
   * - 변경 가능
   * - nullable: 소셜 로그인 시 자동 생성
   */
  @Column({ nullable: true, length: 100 })
  username: string;

  /**
   * 권한 역할
   * - USER: 일반 사용자 (기본값)
   * - ADMIN: 관리자
   * - MODERATOR: 운영자
   */
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  /**
   * 인증 제공자
   * - LOCAL: 이메일/비밀번호 가입 (기본값)
   * - GOOGLE: 구글 소셜 로그인
   * - KAKAO: 카카오 소셜 로그인
   * - GITHUB: 깃허브 소셜 로그인
   */
  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  /**
   * 소셜 로그인 Provider ID
   * - Google: sub (subject)
   * - Kakao: id
   * - GitHub: id
   * - null: 로컬 가입자
   */
  @Column({ nullable: true, length: 255 })
  providerId: string;

  /**
   * 이메일 인증 여부
   * - 로컬 가입: 이메일 인증 링크 클릭 시 true
   * - 소셜 로그인: 자동 true (OAuth 제공자가 인증 보장)
   */
  @Column({ default: false })
  isEmailVerified: boolean;

  /**
   * 계정 활성 상태
   * - false: 정지된 계정 (로그인 차단)
   * - 관리자가 수동으로 변경 가능
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * 마지막 로그인 시각
   * - 미사용 계정 감지 (3년 미접속 시 개인정보 파기 안내)
   * - 보안: 비정상적인 로그인 시간대 감지
   */
  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 소프트 삭제 시각
   * - 계정 삭제 요청 시점
   * - 30일 유예 기간 후 완전 삭제 (GDPR 준수)
   */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  /**
   * 삭제 플래그
   * - true: 로그인 차단, UI에서 "탈퇴한 사용자" 표시
   * - 법적 보관 기간 동안 데이터 유지
   */
  @Column({ default: false })
  isDeleted: boolean;

  // =====================================
  // 관계 (Relationships)
  // =====================================

  /**
   * Profile 관계 (1:1)
   * - 공개 프로필 정보 (name, profileImage, bio 등)
   * - cascade: true → User 저장 시 Profile도 함께 저장
   * - eager: false → 명시적으로 join 필요 (성능 최적화)
   */
  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true,
    eager: false,
  })
  profile?: Profile;

  /**
   * Subscription 관계 (1:1)
   * - 구독/결제 정보 (tier, status, payment 등)
   */
  @OneToOne(() => Subscription, (subscription) => subscription.user, {
    cascade: true,
    eager: false,
  })
  subscription?: Subscription;

  /**
   * AccountSettings 관계 (1:1)
   * - 보안/설정 정보 (refreshToken, 약관 동의 등)
   */
  @OneToOne(() => AccountSettings, (settings) => settings.user, {
    cascade: true,
    eager: false,
  })
  accountSettings?: AccountSettings;

  /**
   * Blog 관계 (1:1)
   * - 사용자당 1개의 블로그
   */
  @OneToOne(() => Blog, (blog) => blog.owner, { eager: true })
  blog?: Blog;

  /**
   * Post 관계 (1:N)
   * - 사용자가 작성한 포스트 목록
   */
  @OneToMany(() => Post, (post) => post.author)
  posts?: Post[];

  /**
   * Comment 관계 (1:N)
   */
  @OneToMany(() => Comment, (comment) => comment.author)
  comments?: Comment[];

  /**
   * CommentLike 관계 (1:N)
   */
  @OneToMany(() => CommentLike, (commentLike) => commentLike.user)
  commentLikes?: CommentLike[];

  /**
   * Follow 관계 (1:N)
   * - 내가 팔로우하는 사용자 목록
   */
  @OneToMany(() => Follow, (follow) => follow.follower)
  following?: Follow[];

  /**
   * Follow 관계 (1:N)
   * - 나를 팔로우하는 사용자 목록
   */
  @OneToMany(() => Follow, (follow) => follow.following)
  followers?: Follow[];

  /**
   * Notification 관계 (1:N)
   * - 내가 받은 알림
   */
  @OneToMany(() => Notification, (notification) => notification.recipient)
  receivedNotifications?: Notification[];

  /**
   * Notification 관계 (1:N)
   * - 내가 발행한 알림 (좋아요, 댓글 등)
   */
  @OneToMany(() => Notification, (notification) => notification.issuer)
  issuedNotifications?: Notification[];

  /**
   * UserIdentity 관계 (1:N)
   * - Multi-Identity Architecture
   * - 여러 소셜 로그인 계정 연결 (Google + GitHub + Kakao)
   */
  @OneToMany(() => UserIdentity, (identity) => identity.user, {
    cascade: true,
  })
  identities?: UserIdentity[];

  // =====================================
  // Flattened 필드 (Transient - DB 저장 안 됨)
  // =====================================
  /**
   * Phase 1 리팩토링: 분리된 테이블의 필드를 flattening
   * - 이 필드들은 DB에 저장되지 않음 (transient)
   * - users.service.ts에서 relations 조인 후 런타임에 할당
   * - 프론트엔드 호환성을 위해 존재
   */
  // From profiles
  name?: string;
  profileImage?: string;
  bio?: string;
  lastLoginProvider?: string;
  accountVerifiedAt?: Date;

  // From subscriptions
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;

  // From account_settings
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  marketingOptIn?: boolean;
  newsletterOptIn?: boolean;
  termsAcceptedAt?: Date;
  privacyAcceptedAt?: Date;
  scheduledDeletionAt?: Date;
  primaryIdentityId?: string;

  // Payment fields (for subscription module compatibility)
  paymentCustomerId?: string;
  paymentSubscriptionId?: string;
  stripeCustomerId?: string; // Stripe 전용 (호환성)

  // =====================================
  // 메서드 (Methods)
  // =====================================

  /**
   * 비밀번호 해싱
   * - @BeforeInsert, @BeforeUpdate 훅
   * - bcrypt salt round: 12
   * - 소셜 로그인 사용자는 스킵
   */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // 비밀번호가 있고, 로컬 가입자인 경우에만 해싱
    if (this.password && this.authProvider === AuthProvider.LOCAL) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  /**
   * 비밀번호 검증
   * - 로그인 시 사용
   * - bcrypt.compare()로 해시 비교
   */
  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  /**
   * 공개 프로필 JSON 변환
   * - 민감정보 제외 (password, refreshToken 등)
   * - API 응답용
   * - join된 profile, subscription, accountSettings 포함
   */
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      role: this.role,
      authProvider: this.authProvider,
      isEmailVerified: this.isEmailVerified,
      createdAt: this.createdAt,

      // Profile 데이터 (join 시에만 포함)
      name: this.profile?.name || null,
      profileImage: this.profile?.profileImage || null,
      bio: this.profile?.bio || null,
      lastLoginProvider: this.profile?.lastLoginProvider || null,
      accountSecurityLevel: this.profile?.accountSecurityLevel || 'basic',

      // Subscription 데이터 (join 시에만 포함)
      subscriptionTier: this.subscription?.subscriptionTier || null,
      subscriptionStatus: this.subscription?.subscriptionStatus || null,
      isPaidUser: this.subscription?.isPaidUser() || false,

      // AccountSettings 데이터 (join 시에만 포함)
      termsAcceptedAt: this.accountSettings?.termsAcceptedAt || null,
      privacyAcceptedAt: this.accountSettings?.privacyAcceptedAt || null,
      marketingOptIn: this.accountSettings?.marketingOptIn || false,
      newsletterOptIn: this.accountSettings?.newsletterOptIn || false,

      // Blog 데이터
      blogSlug: this.blog?.slug || null,
    };
  }

  /**
   * 구독 활성 여부
   * - Subscription 엔티티에 위임
   * - 호환성 유지를 위한 Helper 메서드
   */
  isSubscriptionActive(): boolean {
    return this.subscription?.isActive() || false;
  }

  /**
   * 무료 체험 중 여부
   */
  isInTrial(): boolean {
    return this.subscription?.isInTrial() || false;
  }

  /**
   * 업그레이드 가능 여부
   */
  canUpgrade(): boolean {
    return this.subscription?.canUpgrade() || true;
  }

  /**
   * 유료 사용자 여부
   */
  isPaidUser(): boolean {
    return this.subscription?.isPaidUser() || false;
  }

  /**
   * toJSON 오버라이드
   * - JSON.stringify() 시 자동 호출
   * - password, refreshToken 제외
   */
  toJSON() {
    const { password, ...result } = this;
    return result;
  }
}
