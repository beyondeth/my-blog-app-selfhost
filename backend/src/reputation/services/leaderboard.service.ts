/**
 * 평판 시스템 - 리더보드 서비스
 *
 * Redis Sorted Set을 활용하여 실시간 리더보드를 관리하는 서비스입니다.
 * Admin API 응답 생성 및 프론트엔드 리더보드 데이터 제공을 담당합니다.
 *
 * 주요 기능:
 * - Redis Sorted Set 기반 리더보드 관리
 * - 리더보드 갱신 (Cron job에서 호출)
 * - Top N 사용자 조회
 * - 순위 변동 계산
 *
 * @see WeeklyLeaderboardJob
 * @see LeaderboardEntryDto
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReputationTotal } from "../entities/reputation-total.entity";
import { User } from "../../users/entities/user.entity";
import { UnifiedRedisService } from "../../redis/unified-redis.service";
import { repKeys, LeaderboardPeriod } from "../reputation.keys";
import {
  LeaderboardEntryDto,
  LeaderboardResponseDto,
} from "../dto/leaderboard-entry.dto";
import { ReputationPeriod } from "../enums/reputation-period.enum";
import { TitleService } from "./title.service";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(ReputationTotal)
    private readonly totalRepository: Repository<ReputationTotal>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // Cache Redis: leaderboards are rebuilt on schedule.
    @InjectRedis("cache")
    private readonly redis: Redis,
    private readonly redisService: UnifiedRedisService,
    private readonly titleService: TitleService,
  ) {}

  /**
   * 리더보드 갱신
   *
   * ReputationTotal 데이터를 기반으로 Redis Sorted Set을 업데이트합니다.
   * Cron job에서 주기적으로 호출됩니다.
   *
   * @param period 리더보드 기간 ('l7' | 'l30')
   */
  async refreshLeaderboard(period: LeaderboardPeriod): Promise<void> {
    this.logger.log(`리더보드 갱신 시작: ${period}`);
    const startTime = Date.now();

    // 기간 매핑
    const periodMap: Record<LeaderboardPeriod, ReputationPeriod> = {
      l7: ReputationPeriod.L7,
      l30: ReputationPeriod.L30,
      l90: ReputationPeriod.L90,
      all: ReputationPeriod.ALL_TIME,
    };
    const repPeriod = periodMap[period] || ReputationPeriod.L7;

    // 해당 기간의 모든 사용자 점수 조회
    const totals = await this.totalRepository.find({
      where: { period: repPeriod },
      order: { decayedScore: "DESC" },
    });

    // Redis Sorted Set 키
    const key = repKeys.leaderboard(period);

    // 기존 데이터 삭제 후 새로 추가 (트랜잭션)
    const pipeline = this.redis.pipeline();
    pipeline.del(key);

    for (const total of totals) {
      // Sorted Set에 추가 (score: 감쇠 점수, member: userId)
      pipeline.zadd(key, total.decayedScore, total.userId);
    }

    await pipeline.exec();

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `리더보드 갱신 완료: ${period}, 사용자 수: ${totals.length}, 소요 시간: ${elapsed}ms`,
    );
  }

  /**
   * 상위 N명 조회
   *
   * @param period 리더보드 기간
   * @param limit 조회할 상위 N명 (기본값: 100)
   * @returns 리더보드 응답 DTO
   */
  async getTopUsers(
    period: LeaderboardPeriod,
    limit: number = 100,
  ): Promise<LeaderboardResponseDto> {
    const key = repKeys.leaderboard(period);

    // Redis에서 상위 N명 조회 (점수와 함께)
    const results = await this.redis.zrevrange(key, 0, limit - 1, "WITHSCORES");

    // 결과 파싱: [userId1, score1, userId2, score2, ...]
    const entries: LeaderboardEntryDto[] = [];
    const userIds: string[] = [];

    for (let i = 0; i < results.length; i += 2) {
      userIds.push(results[i]);
    }

    // 사용자 정보와 타이틀을 배치 조회 (N+1 → 2 쿼리로 최적화)
    const [users, titlesMap] = await Promise.all([
      this.getUserInfoBatch(userIds),
      this.titleService.getBatchUserTitles(userIds),
    ]);

    let rank = 1;
    for (let i = 0; i < results.length; i += 2) {
      const userId = results[i];
      const score = parseFloat(results[i + 1]);
      const userInfo = users.get(userId);
      const titles = titlesMap.get(userId) || [];

      entries.push({
        rank,
        userId,
        username: userInfo?.username || "Unknown",
        avatarUrl: userInfo?.avatarUrl,
        score: Math.round(score * 100) / 100,
        titles: titles.map((t) => t.code),
      });

      rank++;
    }

    // 총 참가자 수
    const totalParticipants = await this.redis.zcard(key);

    return {
      period,
      entries,
      lastUpdatedAt: new Date(),
      totalParticipants,
    };
  }

  /**
   * 특정 사용자의 순위 조회
   *
   * @param userId 사용자 ID
   * @param period 리더보드 기간
   * @returns 순위 (1부터 시작) 또는 null
   */
  async getUserRank(
    userId: string,
    period: LeaderboardPeriod,
  ): Promise<number | null> {
    const key = repKeys.leaderboard(period);
    const rank = await this.redis.zrevrank(key, userId);

    if (rank === null) {
      return null;
    }

    return rank + 1; // 0-indexed → 1-indexed
  }

  /**
   * 특정 사용자의 상위 백분율 조회
   *
   * @param userId 사용자 ID
   * @param period 리더보드 기간
   * @returns 상위 N% (예: 5 = 상위 5%)
   */
  async getUserPercentile(
    userId: string,
    period: LeaderboardPeriod,
  ): Promise<number | null> {
    const rank = await this.getUserRank(userId, period);
    if (rank === null) {
      return null;
    }

    const key = repKeys.leaderboard(period);
    const total = await this.redis.zcard(key);

    if (total === 0) {
      return null;
    }

    return Math.round((rank / total) * 100);
  }

  /**
   * 특정 사용자의 점수를 리더보드에 즉시 반영
   *
   * @param userId 사용자 ID
   * @param totals 기간별 점수 정보
   */
  async updateUserScores(
    userId: string,
    totals: Array<{ period: ReputationPeriod; decayedScore: number }>,
  ): Promise<void> {
    const periodMap: Record<ReputationPeriod, LeaderboardPeriod> = {
      [ReputationPeriod.L7]: "l7",
      [ReputationPeriod.L30]: "l30",
      [ReputationPeriod.L90]: "l90",
      [ReputationPeriod.ALL_TIME]: "all",
    };

    const pipeline = this.redis.pipeline();
    totals.forEach((total) => {
      const leaderboardPeriod = periodMap[total.period];
      const key = repKeys.leaderboard(leaderboardPeriod);
      pipeline.zadd(key, total.decayedScore, userId);
    });

    await pipeline.exec();
  }

  /**
   * 사용자 정보 일괄 조회 (캐시 또는 DB)
   *
   * @param userIds 사용자 ID 배열
   * @returns userId → 사용자 정보 Map
   */
  private async getUserInfoBatch(
    userIds: string[],
  ): Promise<Map<string, { username: string; avatarUrl?: string }>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("user.id IN (:...userIds)", { userIds })
      .getMany();

    const map = new Map<string, { username: string; avatarUrl?: string }>();
    for (const user of users) {
      map.set(user.id, {
        username: user.username,
        avatarUrl: user.profile?.profileImage || undefined,
      });
    }

    return map;
  }
}
