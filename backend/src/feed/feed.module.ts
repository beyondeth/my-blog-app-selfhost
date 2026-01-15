import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Post } from "../posts/entities/post.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { Community } from "../communities/entities/community.entity";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";
import { FeedCacheWarmingService } from "./feed-cache-warming.service";
import { CacheModule } from "../cache/cache.module";
import { FeedRankingService } from "./feed-ranking.service";
import { CommunitiesModule } from "../communities/communities.module";

/**
 * 피드 모듈
 *
 * @description 통합 피드 기능을 제공하는 모듈
 *
 * **주요 기능:**
 * - 블로그 포스트 + 커뮤니티 포스트 통합 피드
 * - 커서 기반 페이지네이션
 * - Redis 캐싱 (첫 페이지)
 *
 * **의존성:**
 * - TypeORM: Post, CommunityPost 엔티티
 * - CacheModule: Redis 캐싱
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Post, CommunityPost, Community]),
    CacheModule,
    CommunitiesModule, // 커뮤니티 피드 워밍 통합을 위해 추가
  ],
  controllers: [FeedController],
  providers: [FeedService, FeedCacheWarmingService, FeedRankingService],
  exports: [FeedService],
})
export class FeedModule {}
