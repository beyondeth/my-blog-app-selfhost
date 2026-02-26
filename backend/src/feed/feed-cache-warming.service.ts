import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FeedService } from "./feed.service";
import { FeedFilterType, FeedPeriodType, FeedSortType } from "./dto";
import { Community } from "../communities/entities/community.entity";
import { CommunityPostService } from "../communities/services/community-post.service";
import {
  CommunityPostSortBy,
  GetCommunityPostsQueryDto,
} from "../communities/dto";

/**
 * 통합 피드 캐시 워밍 서비스
 *
 * @description 홈 피드 및 인기 커뮤니티 피드의 첫 페이지를 주기적으로 사전 로딩하여
 * 초기 사용자 요청 시 DB 부하를 줄이고 응답 속도를 개선합니다.
 */
@Injectable()
export class FeedCacheWarmingService {
  private readonly logger = new Logger(FeedCacheWarmingService.name);
  private warmingInProgress = false;

  // 홈 피드 워밍 대상 정렬
  private readonly feedSortsToWarm: FeedSortType[] = [
    FeedSortType.RECENT,
    FeedSortType.HOT,
    FeedSortType.TOP,
  ];
  private readonly periodHotTopSortsToWarm: FeedSortType[] = [
    FeedSortType.HOT,
    FeedSortType.TOP,
  ];
  private readonly periodsToWarm: FeedPeriodType[] = [
    FeedPeriodType.DAILY,
    FeedPeriodType.WEEKLY,
    FeedPeriodType.MONTHLY,
  ];

  // 커뮤니티 피드 워밍 대상 정렬
  private readonly communitySortsToWarm: CommunityPostSortBy[] = [
    CommunityPostSortBy.NEWEST,
    CommunityPostSortBy.HOT,
    CommunityPostSortBy.TOP,
  ];

  constructor(
    private readonly feedService: FeedService,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly communityPostService: CommunityPostService,
  ) {}

  /**
   * 커뮤니티 워밍 대상 수 제한 (환경변수 또는 기본값 3)
   */
  private get communityWarmLimit(): number {
    const value = process.env.COMMUNITY_FEED_WARM_LIMIT;
    const parsed = value ? parseInt(value, 10) : 3;
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.min(parsed, 20); // 최대 20개로 제한
  }

  /**
   * period 기반 hot/top 워밍 비활성화 플래그
   */
  private get isPeriodWarmingDisabled(): boolean {
    return process.env.DISABLE_FEED_PERIOD_WARMING === "true";
  }

  /**
   * 통합 워밍 작업 (1분 주기)
   *
   * 홈 피드와 인기 커뮤니티 피드를 워밍합니다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async warmAllFeeds(): Promise<void> {
    if (this.warmingInProgress) {
      this.logger.debug("Skip feed warming: previous cycle still running");
      return;
    }

    this.warmingInProgress = true;
    try {
      // 1. 홈 피드 워밍
      if (process.env.DISABLE_FEED_WARMING !== "true") {
        await this.warmUnifiedFeed();
      }

      // 2. 커뮤니티 피드 워밍
      if (process.env.DISABLE_COMMUNITY_FEED_WARMING !== "true") {
        await this.warmCommunityFeeds();
      }
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * 홈 피드 워밍 로직
   */
  private async warmUnifiedFeed(): Promise<void> {
    // baseline(all period) 워밍
    for (const sort of this.feedSortsToWarm) {
      try {
        await this.feedService.getUnifiedFeed(
          {
            filter: FeedFilterType.ALL,
            sort,
            limit: 20,
          },
          undefined, // No user context
        );
        this.logger.debug(`Warm unified feed cache for sort=${sort}`);
      } catch (error) {
        this.logger.warn(
          `Unified feed warmup failed for sort=${sort}: ${error.message}`,
        );
      }
    }

    if (this.isPeriodWarmingDisabled) {
      return;
    }

    // period + hot/top 조합 워밍
    for (const sort of this.periodHotTopSortsToWarm) {
      for (const period of this.periodsToWarm) {
        try {
          await this.feedService.getUnifiedFeed(
            {
              filter: FeedFilterType.ALL,
              sort,
              period,
              limit: 20,
            },
            undefined,
          );
          this.logger.debug(
            `Warm unified feed cache for sort=${sort}, period=${period}`,
          );
        } catch (error) {
          this.logger.warn(
            `Unified feed period warmup failed for sort=${sort}, period=${period}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * 커뮤니티 피드 워밍 로직
   */
  private async warmCommunityFeeds(): Promise<void> {
    const limit = this.communityWarmLimit;
    if (limit <= 0) return;

    // 인기 커뮤니티 조회 (포스트 수 기준)
    // TODO: 추후 '활성 사용자'나 '최근 활동' 기준으로 변경 고려
    const communities = await this.communityRepository.find({
      select: ["id", "slug"],
      where: { isPublic: true, deletedAt: null },
      order: { postCount: "DESC" },
      take: limit,
    });

    if (communities.length === 0) return;

    for (const community of communities) {
      await this.warmForCommunity(community.id, community.slug);
    }
  }

  /**
   * 개별 커뮤니티 워밍
   */
  private async warmForCommunity(
    communityId: string,
    slug: string,
  ): Promise<void> {
    for (const sort of this.communitySortsToWarm) {
      try {
        const query: GetCommunityPostsQueryDto = {
          limit: 20,
          sortBy: sort,
        } as GetCommunityPostsQueryDto;

        await this.communityPostService.findAll(communityId, query);
        this.logger.debug(`Warm community feed cache: ${slug}, sort=${sort}`);
      } catch (error) {
        this.logger.warn(
          `Community feed warm failed (${slug}, sort=${sort}): ${error.message}`,
        );
      }
    }
  }
}
