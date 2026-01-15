import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisModule } from "../redis/redis.module";
import { RateLimitService } from "./rate-limit.service";

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
