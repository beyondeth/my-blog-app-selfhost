import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PopularPostSnapshot } from "./entities/popular-post-snapshot.entity";
import { PopularCacheService } from "./services/popular-cache.service";
import { PopularSnapshotService } from "./services/popular-snapshot.service";
import { PopularScoreQueryService } from "./services/popular-score-query.service";
import { PopularPostsReadService } from "./services/popular-posts-read.service";
import { PopularPostsBatchService } from "./services/popular-posts-batch.service";

@Module({
  imports: [TypeOrmModule.forFeature([PopularPostSnapshot])],
  providers: [
    PopularCacheService,
    PopularSnapshotService,
    PopularScoreQueryService,
    PopularPostsReadService,
    PopularPostsBatchService,
  ],
  exports: [PopularPostsReadService],
})
export class PopularPostsModule {}
