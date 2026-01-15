import { Module } from "@nestjs/common";
import { OpenGraphController } from "./opengraph.controller";
import { OpenGraphService } from "./opengraph.service";
import { CacheModule } from "../cache/cache.module";
import { UrlSafetyService } from "../common/services/url-safety.service";

/**
 * Open Graph 모듈
 *
 * @description
 * URL에서 Open Graph 메타데이터를 추출하는 기능을 제공합니다.
 * 링크 카드 미리보기에 사용됩니다.
 *
 * **기능:**
 * - URL에서 og:* 메타 태그 추출
 * - 폴백: title, meta description 사용
 * - Redis 캐싱 (24시간)
 *
 * **의존성:**
 * - CacheModule: Redis 캐싱
 */
@Module({
  imports: [CacheModule],
  controllers: [OpenGraphController],
  providers: [OpenGraphService, UrlSafetyService],
  exports: [OpenGraphService],
})
export class OpenGraphModule {}
