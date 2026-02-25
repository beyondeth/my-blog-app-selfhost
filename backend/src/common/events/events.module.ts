import { Module } from "@nestjs/common";
import { BlogEventEmitter } from "./blog-event-emitter.service";

/**
 * 이벤트 시스템 모듈
 *
 * 순환 의존성을 피하기 위한 이벤트 기반 통신 시스템 제공
 * EventEmitterModule.forRoot()는 app.module.ts에서 한 번만 등록
 */
@Module({
  providers: [BlogEventEmitter],
  exports: [BlogEventEmitter],
})
export class EventsModule {}
