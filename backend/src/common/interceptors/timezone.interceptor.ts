import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * Timezone Interceptor
 *
 * ⚠️ DEPRECATED - 이 인터셉터는 사용하지 않습니다!
 *
 * 문제:
 * - DB에 저장된 시간은 이미 로컬 시간 (KST)
 * - 9시간을 더하면 미래 시간이 됨 (예: 14시간 전 → 미래로 표시)
 *
 * 해결책:
 * - DB 시간을 그대로 반환
 * - 프론트엔드에서 브라우저 타임존으로 표시
 */
@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ⚠️ 변환하지 않고 그대로 반환
    // DB 시간은 이미 로컬 시간이므로 추가 변환 불필요
    return next.handle();
  }
}
