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
  BeforeUpdate
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
import { SubscriptionTier, SubscriptionStatus } from '../../common/enums/subscription.enum';

export const AuthProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  GITHUB: 'github',
} as const;

export type AuthProvider = typeof AuthProvider[keyof typeof AuthProvider];

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ nullable: true, length: 255 })
  @Exclude({ toPlainOnly: true })
  password: string;

  @Column({ nullable: true, length: 100 })
  username: string;

  @Column({ nullable: true, length: 100 }) //payment 에 사용 예정
  name: string;

  @Column({ nullable: true, length: 500 })
  profileImage: string;

  @Column({ nullable: true, length: 1000 })
  bio: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ nullable: true, length: 255 })
  providerId: string;

  @Column({ default: false, name: 'isEmailVerified' })
  isEmailVerified: boolean;

  @Column({ default: true, name: 'isActive' })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  // Refresh Token 관련 필드 추가
  @Column({ nullable: true, length: 500, name: 'refreshToken' })
  @Exclude({ toPlainOnly: true })
  refreshToken: string;

  @Column({ nullable: true, name: 'refreshTokenExpiresAt' })
  @Exclude({ toPlainOnly: true })
  refreshTokenExpiresAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // 관계 설정 - UUID 참조로 변경 필요
  @OneToOne(() => Blog, blog => blog.owner, { eager: true })
  blog: Blog;

  // lazy loading 제거 - 성능 문제 해결
  @OneToMany(() => Post, post => post.author)
  posts: Post[];

  @OneToMany(() => Comment, comment => comment.author)
  comments: Comment[];

  @OneToMany(() => CommentLike, commentLike => commentLike.user)
  commentLikes: CommentLike[];

  // Follow relationships
  @OneToMany(() => Follow, follow => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, follow => follow.following)
  followers: Follow[];

  // Notification relationships
  @OneToMany(() => Notification, notification => notification.recipient)
  receivedNotifications: Notification[];

  @OneToMany(() => Notification, notification => notification.issuer)
  issuedNotifications: Notification[];

  // Identity relationships for Multi-Identity Architecture
  @OneToMany(() => UserIdentity, identity => identity.user, { cascade: true })
  identities: UserIdentity[];

  @Column({ nullable: true })
  primaryIdentityId: string;

  @Column({ nullable: true, length: 50 })
  lastLoginProvider: string;

  @Column({ nullable: true })
  accountVerifiedAt: Date;

  @Column({ nullable: true, length: 20, default: 'basic' })
  accountSecurityLevel: string;

  // 구독 관련 필드 추가
  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE
  })
  subscriptionTier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    nullable: true
  })
  subscriptionStatus: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionStartDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate: Date;

  // 결제 관련 필드
  @Column({ nullable: true })
  paymentCustomerId: string; // Stripe/Toss 등의 Customer ID

  @Column({ nullable: true })
  stripeCustomerId: string; // Stripe Customer ID (호환성을 위해 추가)

  @Column({ nullable: true })
  paymentSubscriptionId: string; // 결제 시스템의 구독 ID

  @Column({ nullable: true })
  paymentMethodId: string; // 저장된 결제 수단 ID

  // 소프트 삭제 관련 필드
  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date; // 계정 삭제 요청 시점

  @Column({ default: false })
  isDeleted: boolean; // 삭제 플래그 (로그인 차단용)

  @Column({ type: 'timestamp', nullable: true })
  scheduledDeletionAt: Date; // 완전 삭제 예정일 (법적 보관 기간 후)

  // 개인정보 보유기간 관리
  @Column({ type: 'timestamp', nullable: true })
  dataRetentionNotifiedAt: Date; // 보유기간 만료 알림 발송일

  @Column({ type: 'int', default: 3 })
  dataRetentionYears: number; // 개인정보 보유기간 (기본 3년)

  // 약관 동의 관련 필드 추가
  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt: Date; // 이용약관 동의 시각

  @Column({ type: 'timestamp', nullable: true })
  privacyAcceptedAt: Date; // 개인정보처리방침 동의 시각

  // 마케팅 동의 관련 (선택)
  @Column({ default: false })
  marketingOptIn: boolean; // 마케팅 수신 동의

  @Column({ type: 'timestamp', nullable: true })
  marketingOptInAt: Date; // 마케팅 동의 시각

  @Column({ default: false })
  newsletterOptIn: boolean; // 뉴스레터 수신 동의

  // 보안 관련
  @Column({ type: 'int', default: 0 })
  loginAttempts: number; // 로그인 실패 횟수

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date; // 계정 잠금 해제 시간 (5회 실패 시)

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && this.authProvider === AuthProvider.LOCAL) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  // 공개할 사용자 정보만 반환 (보안 강화)
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,                           // 이메일 추가 (ProfileDropdown에서 사용)
      username: this.username,
      profileImage: this.profileImage,
      bio: this.bio,
      role: this.role,
      authProvider: this.authProvider,             // 최초 가입 방법 (계정 관리용)
      lastLoginProvider: this.lastLoginProvider,   // 현재 로그인 방법 (계정 삭제 UX용)
      isEmailVerified: this.isEmailVerified,
      subscriptionTier: this.subscriptionTier,     // 구독 티어는 공개
      subscriptionStatus: this.subscriptionStatus, // 구독 상태 추가
      blogSlug: this.blog?.slug || null,           // 블로그 슬러그 추가 (헤더 "내 블로그" 버튼용)
      termsAcceptedAt: this.termsAcceptedAt,       // 약관 동의 시각 (ConsentGuard에서 사용)
      privacyAcceptedAt: this.privacyAcceptedAt,   // 개인정보 동의 시각 (ConsentGuard에서 사용)
      marketingOptIn: this.marketingOptIn,         // 마케팅 정보 수신 동의 (Settings 페이지에서 사용)
      newsletterOptIn: this.newsletterOptIn,       // 뉴스레터 수신 동의 (Settings 페이지에서 사용)
      createdAt: this.createdAt,
    };
  }

  // 구독 관련 헬퍼 메서드
  isSubscriptionActive(): boolean {
    return this.subscriptionStatus === SubscriptionStatus.ACTIVE &&
           (!this.subscriptionEndDate || this.subscriptionEndDate > new Date());
  }

  isInTrial(): boolean {
    return this.subscriptionStatus === SubscriptionStatus.TRIAL &&
           this.trialEndDate &&
           this.trialEndDate > new Date();
  }

  canUpgrade(): boolean {
    return this.subscriptionTier !== SubscriptionTier.PRO;
  }

  isPaidUser(): boolean {
    return this.subscriptionTier !== SubscriptionTier.FREE && this.isSubscriptionActive();
  }

  toJSON() {
    const { password, refreshToken, refreshTokenExpiresAt, ...result } = this;
    return result;
  }
} 