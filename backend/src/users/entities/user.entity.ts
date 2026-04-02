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
} from "typeorm";
import { Exclude } from "class-transformer";
import * as bcrypt from "bcryptjs";
import { v7 as uuidv7 } from "uuid";
import { Post } from "../../posts/entities/post.entity";
import { Comment } from "../../comments/entities/comment.entity";
import { CommentLike } from "../../comments/entities/comment-like.entity";
import { PostLike } from "../../posts/entities/post-like.entity";
import { Role } from "../../common/enums/role.enum";
import { Follow } from "../../follows/entities/follow.entity";
import { Notification } from "../../notifications/entities/notification.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { UserIdentity } from "./user-identity.entity";
import { Profile } from "./profile.entity";
import { Subscription } from "../../subscription/entities/subscription.entity";
import { AccountSettings } from "./account-settings.entity";

/**
 * AuthProvider 상수
 * - 지원하는 인증 제공자 목록
 */
export const AuthProvider = {
  LOCAL: "local",
  GOOGLE: "google",
  KAKAO: "kakao",
  GITHUB: "github",
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

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
@Entity("users")
@Index(["email"])
@Index(["username"])
@Index(["role"])
@Index(["authProvider"])
export class User {
  /**
   * 기본 키
   * - UUID v7 (시간 순서 정렬 지원)
   * - K-정렬 가능: 시간 순서대로 정렬 시 데이터베이스 성능 향상
   * - @Exclude: API 응답에서 제외 (보안상 사용자 UUID 노출 방지)
   */
  @PrimaryGeneratedColumn("uuid")
  @Exclude({ toPlainOnly: true })
  id: string;

  /**
   * UUID v7 생성 (BeforeInsert 훅)
   * - 시간 기반 UUID 생성으로 삽입 순서 보장
   * - 인덱스 성능 향상 및 분산 환경에서의 충돌 최소화
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 이메일 (고유)
   * - 로그인 ID 역할
   * - 소셜 로그인도 이메일 기반 통합
   * - @Exclude: API 응답에서 제외 (개인정보 보호)
   */
  @Column({ unique: true, length: 255 })
  @Exclude({ toPlainOnly: true })
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
  @Column({ nullable: true, length: 30 })
  username: string;

  /**
   * 권한 역할
   * - USER: 일반 사용자 (기본값)
   * - ADMIN: 관리자
   * - MODERATOR: 운영자
   * - @Exclude: API 응답에서 제외 (권한 정보 보호)
   */
  @Column({
    type: "enum",
    enum: Role,
    default: Role.USER,
  })
  @Exclude({ toPlainOnly: true })
  role: Role;

  /**
   * 인증 제공자
   * - LOCAL: 이메일/비밀번호 가입 (기본값)
   * - GOOGLE: 구글 소셜 로그인
   * - KAKAO: 카카오 소셜 로그인
   * - GITHUB: 깃허브 소셜 로그인
   * - @Exclude: API 응답에서 제외 (인증 방법 보호)
   */
  @Column({
    type: "enum",
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  @Exclude({ toPlainOnly: true })
  authProvider: AuthProvider;

  /**
   * 소셜 로그인 Provider ID
   * - Google: sub (subject)
   * - Kakao: id
   * - GitHub: id
   * - null: 로컬 가입자
   * - @Exclude: API 응답에서 제외 (OAuth ID 보호)
   */
  @Column({ nullable: true, length: 255 })
  @Exclude({ toPlainOnly: true })
  providerId: string;

  /**
   * 이메일 인증 여부
   * - 로컬 가입: 이메일 인증 링크 클릭 시 true
   * - 소셜 로그인: 자동 true (OAuth 제공자가 인증 보장)
   * - @Exclude: API 응답에서 제외 (내부 상태 정보 보호)
   */
  @Column({ default: false })
  @Exclude({ toPlainOnly: true })
  isEmailVerified: boolean;

  /**
   * 계정 활성 상태
   * - false: 정지된 계정 (로그인 차단)
   * - 관리자가 수동으로 변경 가능
   * - @Exclude: API 응답에서 제외 (계정 상태 보호)
   */
  @Column({ default: true })
  @Exclude({ toPlainOnly: true })
  isActive: boolean;

  /**
   * 일시 정지 만료 시각
   * - null: 정지 없음
   * - 현재 시각 이전일 경우 자동 복구 대상
   */
  @Column({ name: "suspension_until", type: "timestamp", nullable: true })
  @Exclude({ toPlainOnly: true })
  suspensionUntil?: Date | null;

  /**
   * 일시 정지 사유
   * - 관리자/신고 처리 시 입력
   */
  @Column({ name: "suspension_reason", type: "text", nullable: true })
  @Exclude({ toPlainOnly: true })
  suspensionReason?: string | null;

  /**
   * 영구 차단 여부
   * - true: 로그인/토큰 발급 차단
   */
  @Column({ name: "is_banned", type: "boolean", default: false })
  @Exclude({ toPlainOnly: true })
  isBanned: boolean;

  /**
   * 영구 차단 사유
   */
  @Column({ name: "ban_reason", type: "text", nullable: true })
  @Exclude({ toPlainOnly: true })
  banReason?: string | null;

  /**
   * 영구 차단 일시
   */
  @Column({ name: "banned_at", type: "timestamp", nullable: true })
  @Exclude({ toPlainOnly: true })
  bannedAt?: Date | null;

  /**
   * 마지막 로그인 시각
   * - 미사용 계정 감지 (3년 미접속 시 개인정보 파기 안내)
   * - 보안: 비정상적인 로그인 시간대 감지
   * - @Exclude: API 응답에서 제외 (활동 정보 보호)
   */
  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
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
  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date;

  /**
   * 삭제 플래그
   * - true: 로그인 차단, UI에서 "탈퇴한 사용자" 표시
   * - 법적 보관 기간 동안 데이터 유지
   */
  @Column({ default: false })
  isDeleted: boolean;

  /**
   * 팔로워 수 (캐싱)
   * - 실시간 COUNT 쿼리 대신 캐싱된 값 사용
   * - follow/unfollow 시 트랜잭션 내에서 업데이트
   */
  @Column({ name: "follower_count", type: "int", default: 0 })
  followerCount: number;

  /**
   * 팔로잉 수 (캐싱)
   * - 실시간 COUNT 쿼리 대신 캐싱된 값 사용
   * - follow/unfollow 시 트랜잭션 내에서 업데이트
   */
  @Column({ name: "following_count", type: "int", default: 0 })
  followingCount: number;

  /**
   * 현재 일시 정지 상태인지 여부
   */
  isSuspended(): boolean {
    return !!(
      this.suspensionUntil && this.suspensionUntil.getTime() > Date.now()
    );
  }

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
   * - cascade: insert/update만 (remove 제외 — 법적 보관 의무)
   */
  @OneToOne(() => Subscription, (subscription) => subscription.user, {
    cascade: ["insert", "update"],
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
   * PostLike 관계 (1:N)
   */
  @OneToMany(() => PostLike, (postLike) => postLike.user)
  postLikes?: PostLike[];

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
  jobTitle?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
  lastLoginProvider?: string;
  accountVerifiedAt?: Date;

  // From subscriptions
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;

  // From account_settings
  @Exclude({ toPlainOnly: true })
  refreshToken?: string;
  @Exclude({ toPlainOnly: true })
  refreshTokenExpiresAt?: Date;
  marketingOptIn?: boolean;
  newsletterOptIn?: boolean;
  termsAcceptedAt?: Date;
  privacyAcceptedAt?: Date;
  scheduledDeletionAt?: Date;
  primaryIdentityId?: string;

  // Payment fields (for subscription module compatibility)
  @Exclude({ toPlainOnly: true })
  paymentCustomerId?: string;
  @Exclude({ toPlainOnly: true })
  paymentSubscriptionId?: string;
  @Exclude({ toPlainOnly: true })
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
      profileImage: this.profileImage || this.profile?.profileImage || null,
      bio: this.profile?.bio || null,
      jobTitle: this.profile?.jobTitle || null,
      socialLinks: this.profile?.socialLinks || [],
      lastLoginProvider: this.profile?.lastLoginProvider || null,
      accountSecurityLevel: this.profile?.accountSecurityLevel || "basic",

      // Subscription 데이터 (join 시에만 포함)
      subscriptionTier: this.subscription?.tier || null,
      subscriptionStatus: this.subscription?.status || null,
      isPaidUser: this.subscription?.isPaidUser() || false,

      // AccountSettings 데이터 (join 시에만 포함)
      termsAcceptedAt: this.accountSettings?.termsAcceptedAt || null,
      privacyAcceptedAt: this.accountSettings?.privacyAcceptedAt || null,
      marketingOptIn: this.accountSettings?.marketingOptIn || false,
      newsletterOptIn: this.accountSettings?.newsletterOptIn || false,

      // Blog 데이터
      blog: this.blog
        ? {
            id: this.blog.id,
            slug: this.blog.slug,
            alias: this.blog.alias,
          }
        : null,
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
   * - password, refreshToken, email 등 민감 정보 필터링
   * - NOTE: 본인 프로필 조회 시에는 컨트롤러에서 email을 명시적으로 추가
   */
  toJSON() {
    const {
      password,
      email, // 공개 프로필에서 이메일 숨김
      refreshToken,
      refreshTokenExpiresAt,
      paymentCustomerId,
      paymentSubscriptionId,
      stripeCustomerId,
      providerId,
      suspensionReason,
      banReason,
      ...result
    } = this;
    return result;
  }
}
