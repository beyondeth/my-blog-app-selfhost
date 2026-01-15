import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { Exclude } from "class-transformer";
import { v7 as uuidv7 } from "uuid";
import { User } from "./user.entity";

/**
 * AccountSettings 엔티티
 *
 * **설계 원칙 (체크포인트 1):**
 * - User 테이블에서 계정 설정, 보안, 약관 동의 관련 정보만 분리
 * - Single Responsibility: 계정 보안 및 설정 관리
 * - 1:1 관계로 User와 연결
 * - UUID v7 사용으로 시간순 정렬 및 감사 추적 용이
 *
 * **보안 요구사항:**
 * - Refresh Token 안전 관리 (@Exclude)
 * - Brute Force 공격 방어 (로그인 시도 제한)
 * - 계정 잠금 메커니즘
 * - 패스워드 재설정 토큰 관리 (TODO: 향후 추가)
 *
 * **법적 요구사항:**
 * - GDPR/개인정보보호법 준수
 * - 약관 동의 이력 관리
 * - 개인정보 보유기간 관리
 * - 마케팅 동의 관리
 */
@Entity("account_settings")
@Index(["userId"], { unique: true }) // 1:1 관계 보장
@Index(["lockedUntil"]) // 잠긴 계정 조회 최적화
@Index(["scheduledDeletionAt"]) // 삭제 예정 계정 배치 작업용
export class AccountSettings {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬로 계정 설정 변경 이력 추적 용이
   */
  @PrimaryColumn("uuid")
  id: string;

  /**
   * User 관계 (1:1)
   * - onDelete: 'CASCADE' → User 삭제 시 AccountSettings도 자동 삭제
   * - nullable: false → User 없이 AccountSettings 존재 불가
   */
  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid", nullable: false })
  userId: string;

  /**
   * Refresh Token (JWT)
   * - Access Token 재발급용
   * - 보안: @Exclude()로 API 응답에서 제외
   * - 길이: 500자 (JWT 토큰)
   * - 주의: bcrypt 해싱 없이 원본 저장 (서버에서 비교)
   */
  @Column({ length: 500, nullable: true })
  @Exclude({ toPlainOnly: true })
  refreshToken: string;

  /**
   * Refresh Token 만료 시각
   * - 기본 7일 후 만료
   * - 만료된 토큰은 자동 재로그인 불가
   */
  @Column({ type: "timestamp", nullable: true })
  @Exclude({ toPlainOnly: true })
  refreshTokenExpiresAt: Date;

  /**
   * Primary Identity ID
   * - Multi-Identity Architecture 지원
   * - user_identities 테이블의 기본 인증 수단 ID
   * - 사용자가 여러 소셜 로그인 연결 시 메인 계정 식별
   */
  @Column({ type: "uuid", nullable: true })
  primaryIdentityId: string;

  /**
   * 완전 삭제 예정일
   * - 소프트 삭제 후 법적 보관 기간(30일) 경과 시 완전 삭제
   * - 배치 작업에서 이 날짜가 지난 계정 물리적 삭제
   * - GDPR "잊혀질 권리" 준수
   */
  @Column({ type: "timestamp", nullable: true })
  scheduledDeletionAt: Date;

  /**
   * 개인정보 보유기간 만료 알림 발송일
   * - 3년 미사용 시 개인정보 파기 안내 발송
   * - 발송 후 30일 내 로그인 없으면 자동 파기
   */
  @Column({ type: "timestamp", nullable: true })
  dataRetentionNotifiedAt: Date;

  /**
   * 개인정보 보유기간 (년)
   * - 기본값: 3년
   * - 법적 근거: 개인정보보호법 제21조
   * - 사용자가 설정 변경 가능 (1년 ~ 10년)
   */
  @Column({ type: "int", default: 3 })
  dataRetentionYears: number;

  /**
   * 이용약관 동의 시각
   * - 회원가입 시 필수 동의
   * - ConsentGuard에서 검증
   * - null: 미동의 상태 (서비스 이용 불가)
   */
  @Column({ type: "timestamp", nullable: true })
  termsAcceptedAt: Date;

  /**
   * 개인정보 처리방침 동의 시각
   * - 회원가입 시 필수 동의
   * - ConsentGuard에서 검증
   * - null: 미동의 상태 (서비스 이용 불가)
   */
  @Column({ type: "timestamp", nullable: true })
  privacyAcceptedAt: Date;

  /**
   * 마케팅 정보 수신 동의 여부
   * - 선택 동의 항목
   * - 이메일, SMS 마케팅 발송 시 확인
   * - 사용자가 Settings에서 변경 가능
   */
  @Column({ default: false })
  marketingOptIn: boolean;

  /**
   * 마케팅 동의 시각
   * - 동의 철회 이력 추적용
   * - null: 미동의
   */
  @Column({ type: "timestamp", nullable: true })
  marketingOptInAt: Date;

  /**
   * 뉴스레터 수신 동의 여부
   * - 선택 동의 항목
   * - 주간 뉴스레터 발송 시 확인
   * - 사용자가 Settings에서 변경 가능
   */
  @Column({ default: false })
  newsletterOptIn: boolean;

  /**
   * 로그인 실패 횟수
   * - Brute Force 공격 방어
   * - 5회 실패 시 계정 잠금 (15분)
   * - 성공 로그인 시 0으로 리셋
   */
  @Column({ type: "int", default: 0 })
  loginAttempts: number;

  /**
   * 계정 잠금 해제 시간
   * - 로그인 5회 실패 시 15분간 잠금
   * - 이 시간 이후 자동 해제
   * - null: 잠금 해제 상태
   */
  @Column({ type: "timestamp", nullable: true })
  lockedUntil: Date;

  @CreateDateColumn({ name: "createdAt" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt" })
  updatedAt: Date;

  /**
   * UUID v7 자동 생성
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 계정 잠금 여부 확인
   * - lockedUntil이 미래 시간인 경우
   * - 로그인 시도 시 체크
   */
  isLocked(): boolean {
    return this.lockedUntil && this.lockedUntil > new Date();
  }

  /**
   * Refresh Token 유효성 확인
   * - 토큰이 존재하고 만료 시간이 미래인 경우
   */
  isRefreshTokenValid(): boolean {
    return (
      !!this.refreshToken &&
      this.refreshTokenExpiresAt &&
      this.refreshTokenExpiresAt > new Date()
    );
  }

  /**
   * 약관 동의 완료 여부
   * - 이용약관과 개인정보 처리방침 모두 동의했는지 확인
   * - ConsentGuard에서 사용
   */
  hasAcceptedTerms(): boolean {
    return !!this.termsAcceptedAt && !!this.privacyAcceptedAt;
  }

  /**
   * 개인정보 파기 예정 여부
   * - 보유기간 초과 및 알림 발송 후 30일 경과
   */
  shouldBeDeleted(): boolean {
    if (!this.dataRetentionNotifiedAt) return false;
    const daysSinceNotified = Math.ceil(
      (Date.now() - this.dataRetentionNotifiedAt.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return daysSinceNotified > 30;
  }

  /**
   * 로그인 실패 횟수 증가
   * - 5회 도달 시 계정 잠금 (15분)
   */
  incrementLoginAttempts(): void {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15분 후
    }
  }

  /**
   * 로그인 성공 시 실패 횟수 리셋
   */
  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockedUntil = null;
  }

  /**
   * Refresh Token 설정
   * - 새 토큰 발급 시 사용
   * - 기본 만료 시간: 7일
   */
  setRefreshToken(token: string, expiresInDays: number = 7): void {
    this.refreshToken = token;
    this.refreshTokenExpiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );
  }

  /**
   * Refresh Token 무효화
   * - 로그아웃 시 사용
   */
  revokeRefreshToken(): void {
    this.refreshToken = null;
    this.refreshTokenExpiresAt = null;
  }

  /**
   * 공개 JSON 변환
   * - 민감정보 제외 (refreshToken 등)
   */
  toPublicJSON() {
    return {
      id: this.id,
      termsAcceptedAt: this.termsAcceptedAt,
      privacyAcceptedAt: this.privacyAcceptedAt,
      marketingOptIn: this.marketingOptIn,
      newsletterOptIn: this.newsletterOptIn,
      dataRetentionYears: this.dataRetentionYears,
      isLocked: this.isLocked(),
      hasAcceptedTerms: this.hasAcceptedTerms(),
    };
  }
}
