import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 게시글 비공개 상태 예외
 * - 발행되지 않은 게시글에 접근할 때 사용
 */
export class PostUnpublishedException extends HttpException {
  constructor(message: string = '이 게시글은 아직 발행되지 않았습니다.') {
    super(message, HttpStatus.FORBIDDEN);
  }
}