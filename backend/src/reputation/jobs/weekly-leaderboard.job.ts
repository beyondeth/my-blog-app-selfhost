/**
 * 평판 시스템 - 주간 리더보드 Cron Job
 *
 * 매주 월요일 새벽 4시에 실행되어 Redis 리더보드를 갱신합니다.
 *
 * 수행 작업:
 * 1. LeaderboardService.refreshLeaderboard('l7') 호출
 * 2. LeaderboardService.refreshLeaderboard('l30') 호출
 * 3. Redis Sorted Set 업데이트
 *
 * @see LeaderboardService
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { LeaderboardService } from "../services/leaderboard.service";

@Injectable()
export class WeeklyLeaderboardJob {
  private readonly logger = new Logger(WeeklyLeaderboardJob.name);

  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * 주간 리더보드 갱신 작업
   *
   * 매주 월요일 새벽 4시에 실행됩니다.
   * - L7 (7일) 리더보드 갱신
   * - L30 (30일) 리더보드 갱신
   */
  @Cron("0 4 * * 1", {
    name: "weekly-reputation-leaderboard",
    timeZone: "Asia/Seoul",
  })
  async handleCron(): Promise<void> {
    this.logger.log("===== 주간 리더보드 갱신 시작 =====");
    const startTime = Date.now();

    try {
      // L7 리더보드 갱신
      await this.leaderboardService.refreshLeaderboard("l7");

      // L30 리더보드 갱신
      await this.leaderboardService.refreshLeaderboard("l30");

      const elapsed = Date.now() - startTime;
      this.logger.log(`===== 주간 리더보드 갱신 완료 (${elapsed}ms) =====`);
    } catch (error) {
      this.logger.error(`리더보드 갱신 실패: ${error.message}`, error.stack);
    }
  }

  /**
   * 일일 리더보드 갱신 (추가 옵션)
   *
   * 더 자주 갱신이 필요한 경우 이 Cron을 활성화합니다.
   * 매일 새벽 5시에 실행됩니다.
   */
  @Cron("0 5 * * *", {
    name: "daily-reputation-leaderboard",
    timeZone: "Asia/Seoul",
  })
  async handleDailyCron(): Promise<void> {
    this.logger.log("===== 일일 리더보드 갱신 시작 =====");
    const startTime = Date.now();

    try {
      await this.leaderboardService.refreshLeaderboard("l7");
      await this.leaderboardService.refreshLeaderboard("l30");

      const elapsed = Date.now() - startTime;
      this.logger.log(`===== 일일 리더보드 갱신 완료 (${elapsed}ms) =====`);
    } catch (error) {
      this.logger.error(
        `일일 리더보드 갱신 실패: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 수동 실행용 메서드
   *
   * 관리자가 Admin API를 통해 수동으로 리더보드를 갱신할 때 사용합니다.
   */
  async runManually(): Promise<{ success: boolean; elapsed: number }> {
    this.logger.log("수동 리더보드 갱신 시작");
    const startTime = Date.now();

    try {
      await this.leaderboardService.refreshLeaderboard("l7");
      await this.leaderboardService.refreshLeaderboard("l30");
      const elapsed = Date.now() - startTime;
      return { success: true, elapsed };
    } catch (error) {
      this.logger.error(`수동 리더보드 갱신 실패: ${error.message}`);
      throw error;
    }
  }
}
