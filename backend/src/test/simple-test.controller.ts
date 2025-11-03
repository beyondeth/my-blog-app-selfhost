import { Controller, Get, Param } from '@nestjs/common';

/**
 * 간단한 테스트용 컨트롤러
 *
 * 의존성 주입 없이 기본 기능 테스트
 */
@Controller('test/simple')
export class SimpleTestController {
  @Get('ping')
  getPing() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  }

  @Get('hello/:name')
  getHello(@Param('name') name: string) {
    return {
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
    };
  }
}