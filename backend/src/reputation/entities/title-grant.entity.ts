/**
 * 평판 시스템 - 타이틀 부여 엔티티
 *
 * 사용자에게 부여된 타이틀(칭호)을 추적합니다.
 * TitleService에 의해 관리되며, 조건 충족 시 부여/만료됩니다.
 *
 * 설계 원칙:
 * - 이력 관리: 부여/만료 이력을 모두 보존
 * - 만료 지원: expiresAt으로 자동 만료 처리
 * - 컨텍스트: 부여 사유 및 관련 정보 저장
 *
 * @see TitleService.evaluateAndGrant()
 * @see TitleService.revokeExpired()
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { TitleCode } from "../enums/title-code.enum";
import { User } from "../../users/entities/user.entity";

@Entity("title_grant")
@Index("idx_title_grant_code_expires", ["titleCode", "expiresAt"])
@Index("idx_title_grant_user_code_expires", [
  "userId",
  "titleCode",
  "expiresAt",
])
export class TitleGrant {
  /**
   * 기본 키 (UUID)
   */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * 타이틀을 받는 사용자 ID
   */
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  /**
   * 사용자 관계
   */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /**
   * 타이틀 코드
   * 부여된 타이틀의 종류
   */
  @Column({
    type: "varchar",
    length: 50,
    name: "title_code",
  })
  titleCode: TitleCode;

  /**
   * 부여 시각
   * 타이틀이 처음 부여된 시점
   */
  @CreateDateColumn({ name: "granted_at" })
  grantedAt: Date;

  /**
   * 만료 시각
   * null이면 영구 타이틀
   * 이 시각 이후에는 타이틀이 비활성화됨
   */
  @Column({ type: "timestamp", name: "expires_at", nullable: true })
  expiresAt: Date | null;

  /**
   * 부여 컨텍스트 (JSONB)
   * 타이틀 부여 시점의 관련 정보
   * 예: { score: 1500, rank: 5, percentile: 95 }
   */
  @Column({ type: "jsonb", nullable: true })
  context: Record<string, any> | null;

  /**
   * 타이틀 활성 여부 확인 헬퍼 메서드
   * @returns 현재 시점에서 타이틀이 유효한지 여부
   */
  isActive(): boolean {
    if (this.expiresAt === null) {
      return true; // 영구 타이틀
    }
    return new Date() < this.expiresAt;
  }
}
