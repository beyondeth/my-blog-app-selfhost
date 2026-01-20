/**
 * 평판 시스템 - 타이틀 서비스
 *
 * 사용자에게 타이틀(칭호)을 부여하고 관리하는 서비스입니다.
 * ReputationTotal 데이터를 기반으로 조건을 평가하여 타이틀을 부여/회수합니다.
 *
 * 주요 기능:
 * - 타이틀 조건 평가 및 부여
 * - 만료된 타이틀 회수
 * - 사용자 활성 타이틀 조회
 *
 * @see TitleGrant
 * @see TitleCode
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull, Or } from 'typeorm';
import { TitleGrant } from '../entities/title-grant.entity';
import { ReputationTotal } from '../entities/reputation-total.entity';
import { TitleCode, TITLE_METADATA } from '../enums/title-code.enum';
import { ReputationPeriod } from '../enums/reputation-period.enum';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { repKeys, repTTL } from '../reputation.keys';
import { TitleInfoDto } from '../dto/reputation-summary.dto';

/**
 * 타이틀 부여 조건 정의
 */
interface TitleCondition {
  /** 타이틀 코드 */
  code: TitleCode;
  /** 조건 평가 함수 */
  evaluate: (
    total: ReputationTotal | null,
    context: TitleEvaluationContext,
  ) => boolean;
  /** 타이틀 유효 기간 (일) - null이면 영구 */
  validityDays: number | null;
}

/**
 * 타이틀 평가 컨텍스트
 */
interface TitleEvaluationContext {
  /** 사용자 가입일로부터 경과 일수 */
  memberDays: number;
  /** 기간별 순위 백분율 (상위 N%) */
  percentileL7?: number;
  /** 총 게시글 수 */
  totalPosts?: number;
}

@Injectable()
export class TitleService {
  private readonly logger = new Logger(TitleService.name);

  /**
   * 타이틀 조건 정의
   * 각 타이틀별로 부여 조건과 유효 기간을 설정
   */
  private readonly titleConditions: TitleCondition[] = [
    {
      code: TitleCode.TOP_CONTRIBUTOR,
      evaluate: (total, ctx) => {
        // 조건: L7 기간 상위 10%
        return (ctx.percentileL7 ?? 100) <= 10;
      },
      validityDays: 7, // 1주일 유효
    },
    {
      code: TitleCode.RISING_STAR,
      evaluate: (total, ctx) => {
        // 조건: 가입 30일 이내 + L7 상위 20%
        return ctx.memberDays <= 30 && (ctx.percentileL7 ?? 100) <= 20;
      },
      validityDays: 14, // 2주일 유효
    },
    {
      code: TitleCode.VERIFIED_WRITER,
      evaluate: (total, ctx) => {
        // 조건: 총점 100점 이상 + 게시글 10개 이상
        const score = total?.score ?? 0;
        return score >= 100 && (ctx.totalPosts ?? 0) >= 10;
      },
      validityDays: null, // 영구 타이틀
    },
  ];

  constructor(
    @InjectRepository(TitleGrant)
    private readonly titleGrantRepository: Repository<TitleGrant>,
    @InjectRepository(ReputationTotal)
    private readonly totalRepository: Repository<ReputationTotal>,
    private readonly redisService: UnifiedRedisService,
  ) {}

  /**
   * 사용자 타이틀 평가 및 부여
   *
   * 모든 타이틀 조건을 평가하고, 조건을 충족하면 타이틀을 부여합니다.
   *
   * @param userId 사용자 ID
   * @param context 평가 컨텍스트
   * @returns 새로 부여된 타이틀 목록
   */
  async evaluateAndGrant(
    userId: string,
    context: TitleEvaluationContext,
  ): Promise<TitleGrant[]> {
    // L7 점수 조회
    const totalL7 = await this.totalRepository.findOne({
      where: { userId, period: ReputationPeriod.L7 },
    });

    // ALL_TIME 점수 조회
    const totalAllTime = await this.totalRepository.findOne({
      where: { userId, period: ReputationPeriod.ALL_TIME },
    });

    const grantedTitles: TitleGrant[] = [];

    for (const condition of this.titleConditions) {
      // 해당 타이틀의 활성 grants 확인
      const existingGrant = await this.getActiveGrant(userId, condition.code);

      // 조건 평가에 사용할 total 선택 (타이틀별로 다를 수 있음)
      const totalForEval =
        condition.code === TitleCode.VERIFIED_WRITER ? totalAllTime : totalL7;

      // 조건 평가
      const shouldHaveTitle = condition.evaluate(totalForEval, context);

      if (shouldHaveTitle && !existingGrant) {
        // 조건 충족 + 기존 타이틀 없음 → 부여
        const grant = await this.grantTitle(userId, condition);
        grantedTitles.push(grant);
        this.logger.log(
          `타이틀 부여: userId=${userId}, title=${condition.code}`,
        );
      }
    }

    // 캐시 무효화
    if (grantedTitles.length > 0) {
      await this.invalidateTitleCache(userId);
    }

    return grantedTitles;
  }

  /**
   * 타이틀 부여
   *
   * @param userId 사용자 ID
   * @param condition 타이틀 조건
   * @returns 생성된 TitleGrant
   */
  private async grantTitle(
    userId: string,
    condition: TitleCondition,
  ): Promise<TitleGrant> {
    const expiresAt = condition.validityDays
      ? new Date(Date.now() + condition.validityDays * 24 * 60 * 60 * 1000)
      : null;

    const grant = this.titleGrantRepository.create({
      userId,
      titleCode: condition.code,
      expiresAt,
      context: {
        grantedBy: 'system',
        version: 1,
      },
    });

    return this.titleGrantRepository.save(grant);
  }

  /**
   * 만료된 타이틀 회수 (정리)
   *
   * expiresAt이 현재 시각보다 이전인 grants를 삭제합니다.
   * Cron job에서 주기적으로 호출됩니다.
   *
   * @returns 삭제된 타이틀 수
   */
  async revokeExpired(): Promise<number> {
    const now = new Date();
    const result = await this.titleGrantRepository.delete({
      expiresAt: LessThan(now),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`만료 타이틀 회수: ${result.affected}개`);
    }

    return result.affected || 0;
  }

  /**
   * 사용자의 활성 타이틀 조회
   *
   * @param userId 사용자 ID
   * @returns 활성 타이틀 목록
   */
  async getUserActiveTitles(userId: string): Promise<TitleInfoDto[]> {
    // 캐시 확인
    const cacheKey = repKeys.titleCache(userId);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // DB 조회
    const now = new Date();
    const grants = await this.titleGrantRepository.find({
      where: [
        { userId, expiresAt: IsNull() },
        { userId, expiresAt: MoreThan(now) },
      ],
    });

    // DTO 변환
    const titles: TitleInfoDto[] = grants.map(grant => {
      const meta = TITLE_METADATA[grant.titleCode];
      return {
        code: grant.titleCode,
        displayName: meta.displayName,
        description: meta.description,
        icon: meta.icon,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        isActive: grant.isActive(),
      };
    });

    // 캐시 저장
    await this.redisService.setWithExpiry(
      cacheKey,
      JSON.stringify(titles),
      repTTL.titleCache,
    );

    return titles;
  }

  /**
   * 배치 쿼리로 여러 사용자의 활성 타이틀을 한 번에 조회 (N+1 문제 해결)
   *
   * @param userIds 사용자 ID 배열
   * @returns userId → TitleInfoDto[] Map
   */
  async getBatchUserTitles(
    userIds: string[],
  ): Promise<Map<string, TitleInfoDto[]>> {
    const titlesMap = new Map<string, TitleInfoDto[]>();

    if (userIds.length === 0) {
      return titlesMap;
    }

    // 모든 사용자의 활성 타이틀을 한 번에 조회
    const now = new Date();
    const grants = await this.titleGrantRepository
      .createQueryBuilder("grant")
      .where("grant.userId IN (:...userIds)", { userIds })
      .andWhere(
        "(grant.expiresAt IS NULL OR grant.expiresAt > :now)",
        { now },
      )
      .getMany();

    // userId별로 그룹화
    for (const grant of grants) {
      const meta = TITLE_METADATA[grant.titleCode];
      const titleInfo: TitleInfoDto = {
        code: grant.titleCode,
        displayName: meta.displayName,
        description: meta.description,
        icon: meta.icon,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        isActive: grant.isActive(),
      };

      const existing = titlesMap.get(grant.userId) || [];
      existing.push(titleInfo);
      titlesMap.set(grant.userId, existing);
    }

    // 타이틀이 없는 사용자도 빈 배열로 초기화
    for (const userId of userIds) {
      if (!titlesMap.has(userId)) {
        titlesMap.set(userId, []);
      }
    }

    return titlesMap;
  }

  /**

   * 특정 타이틀의 활성 grant 조회
   *
   * @param userId 사용자 ID
   * @param titleCode 타이틀 코드
   * @returns TitleGrant 또는 null
   */
  private async getActiveGrant(
    userId: string,
    titleCode: TitleCode,
  ): Promise<TitleGrant | null> {
    const now = new Date();
    return this.titleGrantRepository.findOne({
      where: [
        { userId, titleCode, expiresAt: IsNull() },
        { userId, titleCode, expiresAt: MoreThan(now) },
      ],
    });
  }

  /**
   * 타이틀 캐시 무효화
   *
   * @param userId 사용자 ID
   */
  private async invalidateTitleCache(userId: string): Promise<void> {
    const cacheKey = repKeys.titleCache(userId);
    await this.redisService.del(cacheKey);
  }
}
