/**
 * 평판 시스템 - Public REST API 컨트롤러
 *
 * 인증 불필요한 공개 평판 API를 제공합니다.
 *
 * 엔드포인트:
 * - GET /reputation/user/:userId/level: 사용자 레벨 조회
 *
 * @see AggregatorService
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { AggregatorService } from '../services/aggregator.service';
import { getUserLevel, UserLevel } from '../enums/title-code.enum';
import { ReputationPeriod } from '../enums/reputation-period.enum';

/**
 * 사용자 레벨 응답 DTO
 */
interface UserLevelResponse {
  level: number;
  icon: string;
  minScore: number;
  currentScore: number;
}

@Controller('reputation')
export class ReputationPublicController {
  private readonly logger = new Logger(ReputationPublicController.name);

  constructor(
    private readonly aggregatorService: AggregatorService,
  ) {}

  /**
   * 사용자 레벨 조회
   *
   * ALL_TIME 누적 점수를 기반으로 레벨을 계산합니다.
   * 10점 미만이면 null을 반환합니다.
   *
   * @param userId 사용자 ID
   * @returns 레벨 정보 또는 null
   */
  @Get('user/:userId/level')
  async getUserLevel(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserLevelResponse | null> {
    this.logger.debug(`사용자 레벨 조회: userId=${userId}`);

    // ALL_TIME 누적 점수 조회
    const total = await this.aggregatorService.getUserScore(
      userId,
      ReputationPeriod.ALL_TIME,
    );

    const score = total?.score || 0;
    const level = getUserLevel(score);

    if (!level) {
      return null;
    }

    return {
      level: level.level,
      icon: level.icon,
      minScore: level.minScore,
      currentScore: score,
    };
  }
}
