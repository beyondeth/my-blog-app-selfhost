/**
 * 평판 시스템 - 원장 기록 생성 DTO
 *
 * LedgerService.record()에서 사용하는 입력 DTO입니다.
 * 이벤트 리스너에서 이 DTO를 생성하여 서비스에 전달합니다.
 *
 * @see LedgerService.record()
 */
import { IsEnum, IsUUID, IsInt, IsOptional, IsObject } from 'class-validator';
import { ReputationAction } from '../enums/reputation-action.enum';

export class CreateLedgerEntryDto {
  /**
   * 점수를 받을 사용자 ID
   */
  @IsUUID()
  userId: string;

  /**
   * 액션 타입
   */
  @IsEnum(ReputationAction)
  actionType: ReputationAction;

  /**
   * 대상 타입 (선택)
   * 예: 'post', 'comment'
   */
  @IsOptional()
  targetType?: string;

  /**
   * 대상 ID (선택)
   */
  @IsOptional()
  @IsUUID()
  targetId?: string;

  /**
   * 점수 변화량
   * 양수: 증가, 음수: 감소
   */
  @IsInt()
  delta: number;

  /**
   * 반응 수 스냅샷 (선택)
   */
  @IsOptional()
  @IsInt()
  reactionCount?: number;

  /**
   * 추가 메타데이터 (선택)
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * 액션을 수행한 사용자 ID (선택)
   * 셀프 반응 차단 검증에 사용
   */
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
