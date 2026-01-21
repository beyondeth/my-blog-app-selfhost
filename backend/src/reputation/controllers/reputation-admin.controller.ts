/**
 * 평판 시스템 - Admin REST API 컨트롤러
 *
 * 관리자 전용 평판 시스템 API를 제공합니다.
 *
 * 엔드포인트:
 * - GET /admin/reputation/leaderboard: 리더보드 조회
 * - GET /admin/reputation/search: 사용자명/이메일로 검색
 * - GET /admin/reputation/user/:userId: 특정 사용자 평판 조회
 * - GET /admin/reputation/titles: 전체 타이틀 현황 조회
 * - POST /admin/reputation/aggregate: 수동 집계 실행
 * - POST /admin/reputation/leaderboard/refresh: 수동 리더보드 갱신
 *
 * 인증:
 * - 모든 엔드포인트는 Admin 권한 필요
 *
 * @see LeaderboardService
 * @see TitleService
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { LeaderboardService } from "../services/leaderboard.service";
import { TitleService } from "../services/title.service";
import { AggregatorService } from "../services/aggregator.service";
import { LedgerService } from "../services/ledger.service";
import { DailyAggregateJob } from "../jobs/daily-aggregate.job";
import { WeeklyLeaderboardJob } from "../jobs/weekly-leaderboard.job";
import { UsersService } from "../../users/users.service";
import {
  LeaderboardResponseDto,
  LeaderboardEntryDto,
} from "../dto/leaderboard-entry.dto";
import {
  ReputationSummaryDto,
  TitleInfoDto,
} from "../dto/reputation-summary.dto";
import { LeaderboardPeriod } from "../reputation.keys";
import { ReputationPeriod } from "../enums/reputation-period.enum";

@Controller("admin/reputation")
@UseGuards(RolesGuard)
@Roles("admin")
export class ReputationAdminController {
  private readonly logger = new Logger(ReputationAdminController.name);

  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly titleService: TitleService,
    private readonly aggregatorService: AggregatorService,
    private readonly ledgerService: LedgerService,
    private readonly dailyAggregateJob: DailyAggregateJob,
    private readonly weeklyLeaderboardJob: WeeklyLeaderboardJob,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 리더보드 조회
   *
   * @param period 기간 ('l7' | 'l30' | 'l90' | 'all', 기본값: 'l7')
   * @param limit 조회할 상위 N명 (기본값: 100)
   * @returns 리더보드 응답
   */
  @Get("leaderboard")
  async getLeaderboard(
    @Query("period") period: LeaderboardPeriod = "l7",
    @Query("limit") limit: number = 100,
  ): Promise<LeaderboardResponseDto> {
    this.logger.log(`리더보드 조회: period=${period}, limit=${limit}`);

    // 유효한 기간만 허용
    const periodMap: Record<string, LeaderboardPeriod> = {
      l7: "l7",
      l30: "l30",
      l90: "l90",
      all: "all",
    };
    const validPeriod: LeaderboardPeriod = periodMap[period] || "l7";

    return this.leaderboardService.getTopUsers(validPeriod, limit);
  }

  /**
   * 리더보드 수동 갱신
   *
   * 특정 기간의 리더보드를 Redis에 다시 캐싱합니다.
   *
   * @param period 기간 ('l7' | 'l30' | 'l90' | 'all', 기본값: 모두 갱신)
   * @returns 갱신 결과
   */
  @Post("leaderboard/refresh")
  async refreshLeaderboard(
    @Query("period") period?: LeaderboardPeriod,
  ): Promise<{ success: boolean; periods: string[]; message: string }> {
    this.logger.log(`리더보드 수동 갱신 요청: period=${period || "all"}`);

    const periodsToRefresh: LeaderboardPeriod[] = period
      ? [period]
      : ["l7", "l30", "l90", "all"];

    for (const p of periodsToRefresh) {
      await this.leaderboardService.refreshLeaderboard(p);
    }

    return {
      success: true,
      periods: periodsToRefresh,
      message: `${periodsToRefresh.join(", ")} 리더보드 갱신 완료`,
    };
  }

  /**
   * 사용자 검색 (사용자명 또는 이메일)
   *
   * @param q 검색어 (사용자명 또는 이메일)
   * @returns 검색된 사용자 목록
   */
  @Get("search")
  async searchUsers(@Query("q") query: string): Promise<{
    users: {
      id: string;
      username: string;
      email: string;
      profileImage?: string;
    }[];
  }> {
    this.logger.log(`사용자 검색: query=${query}`);

    if (!query || query.length < 2) {
      return { users: [] };
    }

    // 이메일 형식인지 확인
    const isEmail = query.includes("@");

    if (isEmail) {
      // 이메일로 검색
      const user = await this.usersService.findByEmail(query);
      if (user) {
        return {
          users: [
            {
              id: user.id,
              username: user.username,
              email: user.email,
              profileImage: user.profile?.profileImage || undefined,
            },
          ],
        };
      }
      return { users: [] };
    }

    // 사용자명으로 검색 (부분 매칭)
    const { users } = await this.usersService.searchUsers(query, 1, 10);
    return {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile?.profileImage || undefined,
      })),
    };
  }

  /**
   * 특정 사용자 평판 조회
   *
   * @param userId 사용자 ID
   * @returns 사용자 평판 요약
   */
  @Get("user/:userId")
  async getUserReputation(
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<ReputationSummaryDto> {
    this.logger.log(`사용자 평판 조회: userId=${userId}`);

    // 사용자 정보 조회
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }

    // 모든 기간의 점수 조회
    const periodToKey: Record<ReputationPeriod, LeaderboardPeriod> = {
      [ReputationPeriod.L7]: "l7",
      [ReputationPeriod.L30]: "l30",
      [ReputationPeriod.L90]: "l90",
      [ReputationPeriod.ALL_TIME]: "all",
    };

    const scores = await Promise.all(
      Object.values(ReputationPeriod).map(async (period) => {
        const total = await this.aggregatorService.getUserScore(userId, period);
        const leaderboardPeriod = periodToKey[period];
        const rank = await this.leaderboardService.getUserRank(
          userId,
          leaderboardPeriod,
        );
        const percentile = await this.leaderboardService.getUserPercentile(
          userId,
          leaderboardPeriod,
        );

        return {
          period,
          score: total?.score || 0,
          decayedScore: total?.decayedScore || 0,
          rank: rank || undefined,
          percentile: percentile || undefined,
        };
      }),
    );

    // 활성 타이틀 조회
    const activeTitles = await this.titleService.getUserActiveTitles(userId);

    // 총 획득 점수 (ALL_TIME)
    const allTimeScore = scores.find(
      (s) => s.period === ReputationPeriod.ALL_TIME,
    );

    // 가입 일수 계산
    const memberDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      userId,
      username: user.username,
      scores,
      activeTitles,
      totalEarnedScore: allTimeScore?.score || 0,
      memberDays,
    };
  }

  /**
   * 특정 사용자 평판 히스토리 조회
   *
   * @param userId 사용자 ID
   * @param limit 조회 개수 (기본 50, 최대 200)
   * @returns 최근 평판 원장 기록
   */
  @Get("user/:userId/ledger")
  async getUserLedger(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query("limit") limit = 50,
  ): Promise<{ entries: Array<Record<string, unknown>> }> {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const entries = await this.ledgerService.getRecentEntriesForUser(
      userId,
      safeLimit,
    );

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        actionType: entry.actionType,
        delta: entry.delta,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        recordedAt: entry.recordedAt,
      })),
    };
  }

  /**
   * 전체 타이틀 현황 조회
   *
   * 현재 활성화된 모든 타이틀을 조회합니다.
   *
   * @returns 타이틀 목록
   */
  @Get("titles")
  async getAllTitles(): Promise<{ count: number; message: string }> {
    this.logger.log("전체 타이틀 현황 조회");
    // TODO: 실제 구현 시 TitleGrant 전체 조회 필요
    return {
      count: 0,
      message: "타이틀 현황 조회 기능 구현 예정",
    };
  }

  /**
   * 수동 집계 실행
   *
   * 관리자가 수동으로 평판 집계를 실행합니다.
   *
   * @returns 실행 결과
   */
  @Post("aggregate")
  async runAggregate(): Promise<{ success: boolean; elapsed: number }> {
    this.logger.log("수동 집계 실행 요청");
    return this.dailyAggregateJob.runManually();
  }
}
