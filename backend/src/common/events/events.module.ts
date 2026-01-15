import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BlogEventEmitter } from "./blog-event-emitter.service";

/**
 * 이벤트 시스템 모듈
 *
 * 순환 의존성을 피하기 위한 이벤트 기반 통신 시스템 제공
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false, // 와일드카드 이벤트 비활성화 (성능 최적화)
      maxListeners: 50, // 최대 리스너 수 제한
    }),
  ],
  providers: [
    BlogEventEmitter,
    // 이벤트 핸들러들은 해당 서비스가 있는 모듈에서 관리
    // BlogStatsHandler는 PostsModule에서 관리
  ],
  exports: [BlogEventEmitter],
})
export class EventsModule {}
