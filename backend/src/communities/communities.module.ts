import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// 엔티티
import {
  Community,
  CommunityMember,
  CommunityPost,
  CommunityComment,
  CommunityPostLike,
  CommunityCommentLike,
  CommunityRule,
  CommunityFlair,
  CommunityBan,
  CommunityModLog,
  CommunityReport,
  CommunityRemovalReason,
  CommunityInvite,
  CommunityRecoverySnapshot,
  CommunitySidebarWidget,
  CommunitySidebarWidgetEntry,
} from "./entities";
import { CommunityStats } from "./entities/community-stats.entity";
import { StatsSnapshot } from "../common/entities/stats-snapshot.entity";

// 서비스
import {
  CommunityService,
  CommunityMembershipService,
  CommunityPostService,
  CommunityCommentService,
  CommunityReportService,
  CommunityRecoveryService,
  CommunityWidgetService,
  CommunityPostViewService,
} from "./services";
import { CommunityStatsService } from "./services/community-stats.service";

// 컨트롤러
import {
  CommunityController,
  CommunityPostController,
  CommunityModerationController,
  CommunityReportController,
  CommunityWidgetController,
} from "./controllers";
import { CommunityStatsController } from "./controllers/community-stats.controller";

// 가드
import {
  CommunityRolesGuard,
  CommunityMembershipGuard,
  CommunityBanGuard,
  CommunityVisibilityGuard,
} from "./guards";

// 외부 모듈
import { UsersModule } from "../users/users.module";
import { CacheModule } from "../cache/cache.module";
import { RedisModule } from "../redis/redis.module";
import { FilesModule } from "../files/files.module";

/**
 * 커뮤니티 모듈
 *
 * @description Reddit 스타일 커뮤니티 시스템
 *
 * **기능:**
 * - 커뮤니티 생성/수정/삭제
 * - 멤버 가입/탈퇴
 * - 게시물 CRUD + 좋아요
 * - 댓글 CRUD
 * - 규칙/플레어 관리
 * - 모더레이션 (차단, 역할 관리)
 * - 통계/분석 (모더레이터 이상만 접근)
 *
 * **의존성:**
 * - UsersModule: 사용자 정보
 * - CacheModule: Redis 캐싱
 * - RedisModule: 분산 락
 */
@Module({
  imports: [
    // 13개 엔티티 등록 + 통계 엔티티
    TypeOrmModule.forFeature([
      Community,
      CommunityMember,
      CommunityPost,
      CommunityComment,
      CommunityPostLike,
      CommunityCommentLike,
      CommunityRule,
      CommunityFlair,
      CommunityBan,
      CommunityModLog,
      CommunityReport,
      CommunityRemovalReason,
      CommunityInvite,
      CommunityRecoverySnapshot,
      CommunitySidebarWidget,
      CommunitySidebarWidgetEntry,
      CommunityStats,
      StatsSnapshot,
    ]),
    UsersModule,
    CacheModule,
    RedisModule,
    FilesModule, // V2 ContextualFile 이미지 업로드
  ],
  providers: [
    // 서비스
    CommunityService,
    CommunityMembershipService,
    CommunityPostService,
    CommunityPostViewService,
    CommunityCommentService,
    CommunityReportService,
    CommunityRecoveryService,
    CommunityWidgetService,
    CommunityStatsService,
    // [Removed] CommunityFeedWarmingService - FeedModule로 통합됨
    // 가드
    CommunityRolesGuard,
    CommunityMembershipGuard,
    CommunityBanGuard,
    CommunityVisibilityGuard,
  ],
  controllers: [
    CommunityController,
    CommunityPostController,
    CommunityModerationController,
    CommunityReportController,
    CommunityWidgetController,
    CommunityStatsController,
  ],
  exports: [
    // 다른 모듈에서 사용할 수 있도록 export
    CommunityService,
    CommunityMembershipService,
    CommunityPostService,
    CommunityCommentService,
    CommunityReportService,
    CommunityRecoveryService,
    CommunityWidgetService,
    CommunityPostViewService,
    CommunityStatsService,
  ],
})
export class CommunitiesModule {}
