/**
 * 평판 시스템 - 원장(Ledger) 서비스
 *
 * 모든 평판 점수 변동을 기록하는 핵심 서비스입니다.
 * 이벤트 리스너에서 호출되며, 입력을 검증하고 DB에 기록합니다.
 *
 * 주요 기능:
 * - 점수 변동 기록 (record)
 * - 셀프 반응 차단 검증
 * - 중복 기록 방지 (쿨다운)
 * - 액션별 기본 점수 매핑
 *
 * @see CreateLedgerEntryDto
 * @see ReputationLedger
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReputationLedger } from '../entities/reputation-ledger.entity';
import { CreateLedgerEntryDto } from '../dto/create-ledger-entry.dto';
import {
  ReputationAction,
  REPUTATION_ACTION_SCORES,
} from '../enums/reputation-action.enum';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { repKeys, repTTL } from '../reputation.keys';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(ReputationLedger)
    private readonly ledgerRepository: Repository<ReputationLedger>,
    private readonly redisService: UnifiedRedisService,
  ) {}

  /**
   * 평판 점수 변동 기록
   *
   * 이벤트 리스너에서 호출되는 단일 진입점입니다.
   * 입력 검증 후 DB에 기록하고, 필요시 Redis에 임시 데이터를 저장합니다.
   *
   * @param dto 기록할 점수 변동 정보
   * @returns 생성된 Ledger 엔티티
   * @throws 셀프 반응 시 에러
   */
  async record(dto: CreateLedgerEntryDto): Promise<ReputationLedger | null> {
    // 1. 셀프 반응 차단 검증
    if (this.isSelfReaction(dto)) {
      this.logger.debug(
        `셀프 반응 차단: userId=${dto.userId}, action=${dto.actionType}`,
      );
      return null;
    }

    if (dto.actionType === ReputationAction.EDITOR_PICKED && dto.targetId) {
      const existing = await this.ledgerRepository.findOne({
        where: {
          actionType: ReputationAction.EDITOR_PICKED,
          targetId: dto.targetId,
          userId: dto.userId,
        },
        select: ['id'],
      });

      if (existing) {
        this.logger.debug(
          `이미 Editor's Pick 점수가 기록됨: userId=${dto.userId}, postId=${dto.targetId}`,
        );
        return null;
      }
    }

    // 2. 쿨다운 체크 (동일 타겟에 대한 중복 반응 방지)
    if (dto.targetId) {
      const isCooldown = await this.checkCooldown(
        dto.userId,
        dto.actionType,
        dto.targetId,
      );
      if (isCooldown) {
        this.logger.debug(
          `쿨다운 중: userId=${dto.userId}, action=${dto.actionType}, target=${dto.targetId}`,
        );
        return null;
      }
    }

    // 3. 기본 점수 적용 (delta가 0이면 기본값 사용)
    const delta = dto.delta || this.getBaseScore(dto.actionType);

    // 4. Ledger 엔티티 생성 및 저장
    const ledgerEntry = this.ledgerRepository.create({
      userId: dto.userId,
      actionType: dto.actionType,
      targetType: dto.targetType || null,
      targetId: dto.targetId || null,
      delta,
      reactionCount: dto.reactionCount || 0,
      metadata: dto.metadata || null,
    });

    const saved = await this.ledgerRepository.save(ledgerEntry);

    // 5. 쿨다운 설정 (중복 반응 방지)
    if (dto.targetId) {
      await this.setCooldown(dto.userId, dto.actionType, dto.targetId);
    }

    this.logger.log(
      `평판 기록 완료: userId=${dto.userId}, action=${dto.actionType}, delta=${delta}`,
    );

    return saved;
  }

  /**
   * 셀프 반응 여부 확인
   *
   * 좋아요/북마크 등에서 자신의 콘텐츠에 반응하는 것을 차단합니다.
   *
   * @param dto 입력 DTO
   * @returns 셀프 반응이면 true
   */
  private isSelfReaction(dto: CreateLedgerEntryDto): boolean {
    // actorId가 있고, userId와 동일하면 셀프 반응
    if (dto.actorId && dto.actorId === dto.userId) {
      const selfReactionActions = [
        ReputationAction.LIKE_RECEIVED,
        ReputationAction.BOOKMARK_RECEIVED,
      ];
      return selfReactionActions.includes(dto.actionType);
    }
    return false;
  }

  /**
   * 쿨다운 체크
   *
   * 동일한 사용자가 동일한 타겟에 대해 반복적으로 점수를 얻는 것을 방지합니다.
   *
   * @param userId 사용자 ID
   * @param action 액션 타입
   * @param targetId 타겟 ID
   * @returns 쿨다운 중이면 true
   */
  private async checkCooldown(
    userId: string,
    action: ReputationAction,
    targetId: string,
  ): Promise<boolean> {
    const key = `${repKeys.userActivityCooldown(userId, action)}:${targetId}`;
    const exists = await this.redisService.get(key);
    return exists !== null;
  }

  /**
   * 쿨다운 설정
   *
   * @param userId 사용자 ID
   * @param action 액션 타입
   * @param targetId 타겟 ID
   */
  private async setCooldown(
    userId: string,
    action: ReputationAction,
    targetId: string,
  ): Promise<void> {
    const key = `${repKeys.userActivityCooldown(userId, action)}:${targetId}`;
    await this.redisService.setWithExpiry(key, '1', repTTL.cooldown);
  }

  /**
   * 액션별 기본 점수 조회
   *
   * @param action 액션 타입
   * @returns 기본 점수
   */
  private getBaseScore(action: ReputationAction): number {
    return REPUTATION_ACTION_SCORES[action] || 0;
  }

  /**
   * 특정 사용자의 기간별 원장 합계 조회
   *
   * AggregatorService에서 집계 시 사용됩니다.
   *
   * @param userId 사용자 ID
   * @param startDate 시작 일시
   * @param endDate 종료 일시
   * @returns 점수 합계
   */
  async getSumForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('COALESCE(SUM(ledger.delta), 0)', 'total')
      .where('ledger.userId = :userId', { userId })
      .andWhere('ledger.recordedAt >= :startDate', { startDate })
      .andWhere('ledger.recordedAt <= :endDate', { endDate })
      .getRawOne();

    return parseFloat(result?.total) || 0;
  }

  /**
   * 전체 사용자별 기간 합계 조회 (집계용)
   *
   * @param startDate 시작 일시
   * @param endDate 종료 일시
   * @returns 사용자별 점수 합계 배열
   */
  async getAllUserSumsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ userId: string; total: number }>> {
    const results = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('ledger.userId', 'userId')
      .addSelect('COALESCE(SUM(ledger.delta), 0)', 'total')
      .where('ledger.recordedAt >= :startDate', { startDate })
      .andWhere('ledger.recordedAt <= :endDate', { endDate })
      .groupBy('ledger.userId')
      .getRawMany();

    return results.map(r => ({
      userId: r.userId,
      total: parseFloat(r.total) || 0,
    }));
  }

  /**
   * 특정 사용자의 최근 평판 기록 조회
   *
   * @param userId 사용자 ID
   * @param limit 조회 개수 (기본 50)
   */
  async getRecentEntriesForUser(
    userId: string,
    limit: number = 50,
  ): Promise<ReputationLedger[]> {
    return this.ledgerRepository.find({
      where: { userId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }
}
