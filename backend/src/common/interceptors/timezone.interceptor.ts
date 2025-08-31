import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.convertDatesToKST(data);
      }),
    );
  }

  private convertDatesToKST(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (obj instanceof Date) {
      // UTC를 KST로 변환 (9시간 추가)
      const kstDate = new Date(obj.getTime() + (9 * 60 * 60 * 1000));
      return kstDate.toISOString();
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesToKST(item));
    }

    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Date 관련 필드들을 변환
          if (key === 'createdAt' || key === 'updatedAt' || key === 'lastUsedAt' || key === 'expiresAt') {
            if (obj[key] && typeof obj[key] === 'string') {
              const date = new Date(obj[key]);
              if (!isNaN(date.getTime())) {
                // UTC를 KST로 변환 (9시간 추가)
                const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                converted[key] = kstDate.toISOString();
              } else {
                converted[key] = obj[key];
              }
            } else {
              converted[key] = this.convertDatesToKST(obj[key]);
            }
          } else {
            converted[key] = this.convertDatesToKST(obj[key]);
          }
        }
      }
      return converted;
    }

    return obj;
  }
}