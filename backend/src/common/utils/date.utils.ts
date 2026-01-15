/**
 * 날짜 계산 유틸리티 클래스
 *
 * Date 객체의 setXXX + getXXX 패턴 대신
 * 밀리초 기반의 명확한 날짜 계산을 제공합니다.
 */
export class DateUtils {
  /**
   * 지정된 날짜에 시간을 더합니다
   */
  static addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  /**
   * 지정된 날짜에 일수를 더합니다
   */
  static addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * 지정된 날짜에 분을 더합니다
   */
  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  /**
   * 지정된 날짜에 초를 더합니다
   */
  static addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }

  /**
   * 지정된 날짜에 밀리초를 더합니다
   */
  static addMilliseconds(date: Date, milliseconds: number): Date {
    return new Date(date.getTime() + milliseconds);
  }

  /**
   * 지정된 날짜에서 시간을 뺍니다
   */
  static subtractHours(date: Date, hours: number): Date {
    return new Date(date.getTime() - hours * 60 * 60 * 1000);
  }

  /**
   * 지정된 날짜에서 일수를 뺍니다
   */
  static subtractDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  }

  /**
   * 지정된 날짜에서 분을 뺍니다
   */
  static subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60 * 1000);
  }

  /**
   * 지정된 날짜에서 초를 뺍니다
   */
  static subtractSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() - seconds * 1000);
  }

  /**
   * 현재 시간 기준으로 시간을 더합니다
   */
  static fromNowAddHours(hours: number): Date {
    return this.addHours(new Date(), hours);
  }

  /**
   * 현재 시간 기준으로 일수를 더합니다
   */
  static fromNowAddDays(days: number): Date {
    return this.addDays(new Date(), days);
  }

  /**
   * 현재 시간 기준으로 분을 더합니다
   */
  static fromNowAddMinutes(minutes: number): Date {
    return this.addMinutes(new Date(), minutes);
  }

  /**
   * 현재 시간 기준으로 초를 더합니다
   */
  static fromNowAddSeconds(seconds: number): Date {
    return this.addSeconds(new Date(), seconds);
  }

  /**
   * 현재 시간 기준으로 시간을 뺍니다
   */
  static fromNowSubtractHours(hours: number): Date {
    return this.subtractHours(new Date(), hours);
  }

  /**
   * 현재 시간 기준으로 일수를 뺍니다
   */
  static fromNowSubtractDays(days: number): Date {
    return this.subtractDays(new Date(), days);
  }

  /**
   * 현재 시간 기준으로 분을 뺍니다
   */
  static fromNowSubtractMinutes(minutes: number): Date {
    return this.subtractMinutes(new Date(), minutes);
  }

  /**
   * 초 단위 시간을 Date 객체로 변환 (현재 시간 기준)
   */
  static fromSecondsToDate(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }
}
