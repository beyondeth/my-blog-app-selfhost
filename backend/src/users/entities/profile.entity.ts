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
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from './user.entity';

/**
 * Profile 엔티티
 *
 * **설계 원칙 (체크포인트 1):**
 * - User 테이블에서 프로필 관련 정보만 분리
 * - Single Responsibility: 사용자 공개 프로필 관리
 * - 1:1 관계로 User와 연결
 * - UUID v7 사용으로 시간순 정렬 및 B-tree 인덱스 최적화
 *
 * **컬럼 선정 기준:**
 * - 공개 프로필에 표시되는 정보
 * - 사용자가 직접 수정 가능한 정보
 * - 인증/보안과 무관한 정보
 */
@Entity('profiles')
@Index(['userId'], { unique: true }) // 1:1 관계 보장
export class Profile {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬 가능
   * - B-tree 인덱스 성능 최적화
   * - 애플리케이션 레벨에서 생성 (DB 독립성)
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * User 관계 (1:1)
   * - onDelete: 'CASCADE' → User 삭제 시 Profile도 자동 삭제
   * - nullable: false → User 없이 Profile 존재 불가 (데이터 무결성)
   */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  /**
   * 실명 (결제 시스템에서 사용)
   * - nullable: true → 선택적 정보
   * - 개인정보 보호: 최소한의 노출
   */
  @Column({ length: 100, nullable: true })
  name: string;

  /**
   * 프로필 이미지 URL
   * - S3 경로 저장
   * - nullable: true → 기본 이미지 사용 가능
   */
  @Column({ length: 500, nullable: true })
  profileImage: string;

  /**
   * 자기소개
   * - 최대 1000자
   * - 블로그 소개 페이지에 표시
   */
  @Column({ length: 1000, nullable: true })
  bio: string;

  /**
   * 마지막 로그인 Provider
   * - 'local', 'google', 'github', 'kakao'
   * - UX: 계정 삭제 시 어떤 소셜 로그인인지 표시
   */
  @Column({ length: 50, nullable: true })
  lastLoginProvider: string;

  /**
   * 계정 인증 완료 시각
   * - 이메일 인증 또는 소셜 로그인 인증
   * - null: 미인증 상태
   */
  @Column({ type: 'timestamp', nullable: true })
  accountVerifiedAt: Date;

  /**
   * 계정 보안 레벨
   * - 'basic': 기본 (이메일만)
   * - 'enhanced': 강화 (2FA 활성화)
   * - 'premium': 프리미엄 (추가 보안 기능)
   *
   * 기본값: 'basic'
   */
  @Column({ length: 20, default: 'basic' })
  accountSecurityLevel: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  /**
   * UUID v7 자동 생성
   * - @BeforeInsert() 훅으로 id가 없을 때만 생성
   * - uuid 패키지의 v7() 함수 사용
   * - 에러 핸들링: 생성 실패 시 로그 남기고 재시도 없음 (DB 제약조건이 잡아냄)
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 공개 프로필 JSON 변환
   * - 민감정보 제외
   * - API 응답용
   */
  toPublicJSON() {
    return {
      id: this.id,
      name: this.name,
      profileImage: this.profileImage,
      bio: this.bio,
      accountSecurityLevel: this.accountSecurityLevel,
      accountVerifiedAt: this.accountVerifiedAt,
    };
  }
}
