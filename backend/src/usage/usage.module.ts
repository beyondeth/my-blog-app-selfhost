import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsageService } from "./usage.service";
import { UsageTracking } from "./entities/usage-tracking.entity";
import { User } from "../users/entities/user.entity";
import { Subscription } from "../subscription/entities/subscription.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { UsersModule } from "../users/users.module";
import { RedisModule } from "../redis/redis.module";

/**
 * 사용량 추적 모듈
 * 사용자별 리소스 사용량을 추적하고 제한을 관리
 * 이벤트 기반 설계로 순환 의존성 방지
 * Subscription 엔티티 직접 조회로 항상 최신 tier 반영
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UsageTracking, User, Subscription, Blog]),
    UsersModule, // UsersService 사용을 위해 import
    RedisModule,
    // SubscriptionModule 제거 - 순환 의존성 방지
  ],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
