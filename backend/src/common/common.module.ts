import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Blog } from '../blogs/entities/blog.entity';
import { OldAlias } from '../blogs/entities/old-alias.entity';
import { BlogResolverService } from './services/blog-resolver.service';
import { MaterializedViewService } from './services/materialized-view.service';
import { CacheModule } from '../cache/cache.module';

/**
 * 공통 서비스 모듈
 *
 * 여러 모듈에서 공유로 사용하는 서비스들을 중앙화하여
 * 순환 의존성을 피하고 재사용성을 높임
 *
 * 엔티티 의존성이 없는 서비스만 포함하여 순환 의존성 방지
 */
@Module({
  imports: [
    ScheduleModule.forRoot(), // Cron job을 위한 ScheduleModule
    TypeOrmModule.forFeature([Blog, OldAlias]),
    CacheModule,
  ],
  providers: [
    BlogResolverService,
    MaterializedViewService,
  ],
  exports: [
    BlogResolverService,
    MaterializedViewService,
  ],
})
export class CommonModule {}