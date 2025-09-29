import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * 결제 이벤트 모듈
 * Event-Driven Architecture를 위한 글로벌 이벤트 모듈
 * 순환 참조를 해결하기 위한 중앙 이벤트 허브
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // 이벤트 설정
      wildcard: true,  // 와일드카드 지원 (payment.* 같은 패턴 사용 가능)
      delimiter: '.',  // 네임스페이스 구분자
      newListener: false, // 새 리스너 추가 시 이벤트 발생 비활성화
      removeListener: false, // 리스너 제거 시 이벤트 발생 비활성화
      maxListeners: 10, // 리스너 최대 개수 (메모리 누수 방지)
      verboseMemoryLeak: true, // 메모리 누수 경고 상세 표시
      ignoreErrors: false, // 에러 무시 비활성화
    }),
  ],
  exports: [EventEmitterModule],
})
export class PaymentEventsModule {}