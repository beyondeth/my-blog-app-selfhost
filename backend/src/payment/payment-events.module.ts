import { Module, Global } from "@nestjs/common";

/**
 * 결제 이벤트 모듈
 * Event-Driven Architecture를 위한 글로벌 이벤트 모듈
 * EventEmitterModule.forRoot()는 app.module.ts에서 한 번만 등록
 */
@Global()
@Module({
  // EventEmitterModule은 app.module.ts에서 forRoot()로 등록됨
})
export class PaymentEventsModule {}
