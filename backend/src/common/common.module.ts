import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { Blog } from "../blogs/entities/blog.entity";
import { OldAlias } from "../blogs/entities/old-alias.entity";
import { BlogResolverService } from "./services/blog-resolver.service";
import { MaterializedViewService } from "./services/materialized-view.service";
import { IpSecurityService } from "./services/ip-security.service";
import { IpRetentionService } from "./services/ip-retention.service";
import { IpAuditService } from "./services/ip-audit.service";
import { CacheModule } from "../cache/cache.module";
import { InternalMcpGuard } from "./guards/internal-mcp.guard";
import { CsrfGuard } from "./guards/csrf.guard";
import { OutboxEvent } from "./entities/outbox-event.entity";
import { IdempotencyRecord } from "./entities/idempotency-record.entity";
import { OutboxService } from "./services/outbox.service";
import { IdempotencyService } from "./services/idempotency.service";
import { RequestContextService } from "./services/request-context.service";
import { SecurityMetricsService } from "./services/security-metrics.service";

/**
 * 공통 서비스 모듈
 *
 * 여러 모듈에서 공유로 사용하는 서비스들을 중앙화하여
 * 순환 의존성을 피하고 재사용성을 높임
 *
 * 포함 서비스:
 * - BlogResolverService: 블로그 슬러그/별칭 리졸버
 * - MaterializedViewService: 통계 뷰 관리
 * - IpSecurityService: IP 암호화/마스킹 (보안)
 * - IpRetentionService: IP 데이터 TTL 관리 (90일)
 * - IpAuditService: IP 접근 감사 로그
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(), // Cron job을 위한 ScheduleModule
    TypeOrmModule.forFeature([Blog, OldAlias, OutboxEvent, IdempotencyRecord]),
    CacheModule,
  ],
  providers: [
    BlogResolverService,
    MaterializedViewService,
    IpSecurityService,
    IpRetentionService,
    IpAuditService,
    InternalMcpGuard,
    CsrfGuard,
    OutboxService,
    IdempotencyService,
    RequestContextService,
    SecurityMetricsService,
  ],
  exports: [
    BlogResolverService,
    MaterializedViewService,
    IpSecurityService,
    IpRetentionService,
    IpAuditService,
    InternalMcpGuard,
    CsrfGuard,
    OutboxService,
    IdempotencyService,
    RequestContextService,
    SecurityMetricsService,
  ],
})
export class CommonModule {}
