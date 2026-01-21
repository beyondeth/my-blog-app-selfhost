/**
 * 평판 시스템 - 집계(Aggregator) 서비스
 *
 * Ledger 데이터를 기반으로 기간별 총점을 계산하고
 * ReputationTotal 테이블을 갱신하는 서비스입니다.
 *
 * 주요 기능:
 * - 기간별 점수 집계 (L7, L30, L90, ALL_TIME)
 * - 감쇠(Decay) 계산
 * - Cron job에서 호출
 *
 * 감쇠 공식:
 * decayedScore = Σ(delta × decayFactor)
 * decayFactor = exp(-λ × daysSinceAction)
 * λ (감쇠율) = 0.1 (약 7일 후 50% 감쇠)
 *
 * @see DailyAggregateJob
 * @see ReputationTotal
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReputationTotal } from "../entities/reputation-total.entity";
import { ReputationLedger } from "../entities/reputation-ledger.entity";
import { ReputationPeriod, PERIOD_DAYS } from "../enums/reputation-period.enum";

/**
 * 감쇠율 상수
 * λ = 0.1 → 약 7일 후 50% 감쇠
 */
const DECAY_LAMBDA = 0.1;

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);

  constructor(
    @InjectRepository(ReputationTotal)
    private readonly totalRepository: Repository<ReputationTotal>,
    @InjectRepository(ReputationLedger)
    private readonly ledgerRepository: Repository<ReputationLedger>,
  ) {}

  /**
   * 모든 기간에 대해 전체 사용자 집계 실행
   *
   * Cron job에서 호출됩니다.
   */
  async aggregateAll(): Promise<void> {
    this.logger.log("전체 집계 시작");
    const startTime = Date.now();

    // 모든 기간에 대해 순차적으로 집계
    for (const period of Object.values(ReputationPeriod)) {
      await this.aggregateByPeriod(period);
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(`전체 집계 완료: ${elapsed}ms`);
  }

  /**
   * 특정 사용자에 대해 즉시 집계 실행
   *
   * Editor's Pick 등 즉시 점수 반영이 필요한 상황에서 사용합니다.
   *
   * @param userId 사용자 ID
   * @returns 기간별 집계 결과
   */
  async aggregateUser(
    userId: string,
  ): Promise<
    Array<{ period: ReputationPeriod; score: number; decayedScore: number }>
  > {
    const now = new Date();
    const results: Array<{
      period: ReputationPeriod;
      score: number;
      decayedScore: number;
    }> = [];

    for (const period of Object.values(ReputationPeriod)) {
      const days = PERIOD_DAYS[period];
      const startDate = days === null ? new Date("2020-01-01") : new Date(now);
      if (days !== null) {
        startDate.setDate(startDate.getDate() - days);
      }

      const ledgers = await this.ledgerRepository
        .createQueryBuilder("ledger")
        .select(["ledger.delta", "ledger.recordedAt"])
        .where("ledger.userId = :userId", { userId })
        .andWhere("ledger.recordedAt >= :startDate", { startDate })
        .andWhere("ledger.recordedAt <= :endDate", { endDate: now })
        .getMany();

      let score = 0;
      let decayedScore = 0;
      const nowMs = now.getTime();

      for (const ledger of ledgers) {
        score += ledger.delta;
        const daysSinceAction =
          (nowMs - ledger.recordedAt.getTime()) / (1000 * 60 * 60 * 24);
        const decayFactor = this.calculateDecayFactor(daysSinceAction);
        decayedScore += ledger.delta * decayFactor;
      }

      const roundedScore = Math.round(score * 100) / 100;
      const roundedDecayed = Math.round(decayedScore * 100) / 100;
      await this.upsertTotal(userId, period, roundedScore, roundedDecayed);

      results.push({
        period,
        score: roundedScore,
        decayedScore: roundedDecayed,
      });
    }

    return results;
  }

  /**
   * 특정 기간에 대한 집계 실행
   *
   * @param period 집계할 기간
   */
  async aggregateByPeriod(period: ReputationPeriod): Promise<void> {
    this.logger.log(`기간별 집계 시작: ${period}`);

    const now = new Date();
    const days = PERIOD_DAYS[period];

    // 기간 범위 계산
    let startDate: Date;
    if (days === null) {
      // ALL_TIME: 매우 오래된 날짜부터
      startDate = new Date("2020-01-01");
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
    }

    // 해당 기간의 모든 사용자별 점수 조회 (감쇠 적용)
    const userScores = await this.calculateUserScoresWithDecay(
      startDate,
      now,
      days,
    );

    // Bulk upsert로 ReputationTotal 테이블 업데이트 (N+1 문제 해결)
    if (userScores.length > 0) {
      await this.bulkUpsertTotals(userScores, period);
    }

    this.logger.log(
      `기간별 집계 완료: ${period}, 처리된 사용자 수: ${userScores.length}`,
    );
  }

  /**
   * 감쇠 적용된 사용자별 점수 계산
   *
   * @param startDate 시작 일시
   * @param endDate 종료 일시
   * @param periodDays 기간 일수 (감쇠 계산용)
   * @returns 사용자별 점수 배열
   */
  private async calculateUserScoresWithDecay(
    startDate: Date,
    endDate: Date,
    periodDays: number | null,
  ): Promise<Array<{ userId: string; score: number; decayedScore: number }>> {
    // 해당 기간의 모든 ledger 조회
    const ledgers = await this.ledgerRepository
      .createQueryBuilder("ledger")
      .select(["ledger.userId", "ledger.delta", "ledger.recordedAt"])
      .where("ledger.recordedAt >= :startDate", { startDate })
      .andWhere("ledger.recordedAt <= :endDate", { endDate })
      .getMany();

    // 사용자별로 그룹핑하여 점수 계산
    const userScoreMap = new Map<
      string,
      { score: number; decayedScore: number }
    >();

    const now = endDate.getTime();

    for (const ledger of ledgers) {
      const current = userScoreMap.get(ledger.userId) || {
        score: 0,
        decayedScore: 0,
      };

      // 원본 점수 합산
      current.score += ledger.delta;

      // 감쇠 계산
      const daysSinceAction =
        (now - ledger.recordedAt.getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = this.calculateDecayFactor(daysSinceAction);
      current.decayedScore += ledger.delta * decayFactor;

      userScoreMap.set(ledger.userId, current);
    }

    // Map을 배열로 변환
    return Array.from(userScoreMap.entries()).map(([userId, scores]) => ({
      userId,
      score: Math.round(scores.score * 100) / 100,
      decayedScore: Math.round(scores.decayedScore * 100) / 100,
    }));
  }

  /**
   * 감쇠 팩터 계산
   *
   * 지수 감쇠 함수: e^(-λ × days)
   *
   * @param daysSinceAction 액션 이후 경과 일수
   * @returns 0~1 사이의 감쇠 팩터
   */
  private calculateDecayFactor(daysSinceAction: number): number {
    // 최소값 0.1 (90% 이상 감쇠 방지)
    const factor = Math.exp(-DECAY_LAMBDA * daysSinceAction);
    return Math.max(factor, 0.1);
  }

  /**
   * Bulk upsert로 여러 사용자의 점수를 한 번에 업데이트
   *
   * PostgreSQL의 ON CONFLICT DO UPDATE를 사용하여
   * N+1 쿼리 문제를 해결합니다.
   *
   * @param userScores 사용자별 점수 배열
   * @param period 집계 기간
   */
  private async bulkUpsertTotals(
    userScores: Array<{ userId: string; score: number; decayedScore: number }>,
    period: ReputationPeriod,
  ): Promise<void> {
    if (userScores.length === 0) {
      return;
    }

    // 청크 단위로 처리 (PostgreSQL 파라미터 제한 고려, 1000개씩)
    const chunkSize = 1000;
    for (let i = 0; i < userScores.length; i += chunkSize) {
      const chunk = userScores.slice(i, i + chunkSize);
      await this.executeUpsertChunk(chunk, period);
    }
  }

  /**
   * 청크 단위 upsert 실행
   */
  private async executeUpsertChunk(
    chunk: Array<{ userId: string; score: number; decayedScore: number }>,
    period: ReputationPeriod,
  ): Promise<void> {
    // Raw SQL로 ON CONFLICT DO UPDATE 실행
    // reputation_total 테이블의 UNIQUE 제약조건: (user_id, period)
    const values = chunk.map((item) => ({
      userId: item.userId,
      period,
      score: item.score,
      decayedScore: item.decayedScore,
    }));

    await this.totalRepository
      .createQueryBuilder()
      .insert()
      .into("reputation_total")
      .values(values)
      .orUpdate(
        ["score", "decayed_score", "last_computed_at"],
        ["user_id", "period"],
      )
      .execute();
  }

  /**
   * ReputationTotal upsert (단일 레코드용, 레거시 호환)
   *
   * 해당 userId + period 조합이 있으면 업데이트, 없으면 생성
   *
   * @param userId 사용자 ID
   * @param period 기간
   * @param score 원본 점수
   * @param decayedScore 감쇠 적용 점수
   */
  private async upsertTotal(
    userId: string,
    period: ReputationPeriod,
    score: number,
    decayedScore: number,
  ): Promise<void> {
    const existing = await this.totalRepository.findOne({
      where: { userId, period },
    });

    if (existing) {
      existing.score = score;
      existing.decayedScore = decayedScore;
      await this.totalRepository.save(existing);
    } else {
      const newTotal = this.totalRepository.create({
        userId,
        period,
        score,
        decayedScore,
      });
      await this.totalRepository.save(newTotal);
    }
  }

  /**
   * 특정 사용자의 기간별 점수 조회
   *
   * @param userId 사용자 ID
   * @param period 기간
   * @returns ReputationTotal 또는 null
   */
  async getUserScore(
    userId: string,
    period: ReputationPeriod,
  ): Promise<ReputationTotal | null> {
    return this.totalRepository.findOne({
      where: { userId, period },
    });
  }

  /**
   * 특정 기간의 전체 사용자 점수 순위 조회
   *
   * @param period 기간
   * @param limit 조회할 상위 N명
   * @returns 점수 순으로 정렬된 ReputationTotal 배열
   */
  async getTopUsersByPeriod(
    period: ReputationPeriod,
    limit: number = 100,
  ): Promise<ReputationTotal[]> {
    return this.totalRepository.find({
      where: { period },
      order: { decayedScore: "DESC" },
      take: limit,
    });
  }
}
