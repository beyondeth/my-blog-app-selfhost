import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { McpApiKey } from "../entities/mcp-api-key.entity";
import { customAlphabet } from "nanoid";
import { UsageTracking } from "../../usage/entities/usage-tracking.entity";
import { ResourceType } from "../../common/enums/subscription.enum";
import { CacheService } from "../../cache/cache.service";
import { format } from "date-fns";
import { McpApiKeySecretService } from "./mcp-api-key-secret.service";

/**
 * MCP API Key 서비스
 *
 * Stripe 스타일 API Key 관리:
 * - 생성: blog_sk_{hint}_{secret}
 * - 검증: hint로 O(1) 조회 후 bcrypt 비교
 * - 정책: 사용자당 최대 3개, 90일 만료
 */
@Injectable()
export class McpApiKeyService {
  private readonly logger = new Logger(McpApiKeyService.name);
  private readonly maxKeysPerUser = 3;
  private encryptedApiKeyColumnExists: boolean | null = null;

  // 8자 hint 생성용 (소문자 + 숫자)
  private readonly hintGenerator = customAlphabet(
    "abcdefghijklmnopqrstuvwxyz0123456789",
    8,
  );

  // 32자 secret 생성용 (영숫자)
  private readonly secretGenerator = customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    32,
  );

  constructor(
    @InjectRepository(McpApiKey)
    private readonly mcpApiKeyRepository: Repository<McpApiKey>,
    @InjectRepository(UsageTracking)
    private readonly usageTrackingRepository: Repository<UsageTracking>,
    private readonly cacheService: CacheService,
    private readonly mcpApiKeySecretService: McpApiKeySecretService,
  ) {}

  private extractKeyHint(apiKey: string): string {
    const parts = apiKey.split("_");
    return parts.length === 4 ? parts[2] : "unknown";
  }

  /**
   * API Key 생성
   *
   * @param userId 사용자 ID
   * @param blogId 블로그 ID
   * @param name 키 이름 (예: "My MCP Key")
   * @returns { apiKey: 전체 키 (1회만 표시), keyHint: 식별자 }
   *
   * 정책:
   * - 사용자당 최대 3개 제한
   * - 90일 자동 만료
   */
  async create(
    userId: string,
    blogId: string,
    name: string,
  ): Promise<{ apiKey: string; keyHint: string; expiresAt: Date }> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new ConflictException("API key name is required");
    }

    // 1. 사용자별 활성 키 개수 제한 (최대 3개)
    const activeKeyCount = await this.mcpApiKeyRepository.count({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (activeKeyCount >= this.maxKeysPerUser) {
      throw new ConflictException(
        `API key limit reached. You can create up to ${this.maxKeysPerUser} keys.`,
      );
    }

    // 2. 고유한 hint 생성 (최대 3번 재시도)
    let keyHint = "";
    let attempts = 0;

    while (attempts < 3) {
      keyHint = this.hintGenerator();
      const existing = await this.mcpApiKeyRepository.findOne({
        where: { keyHint },
      });

      if (!existing) break;

      attempts++;
      if (attempts === 3) {
        throw new ConflictException("Failed to generate unique API key hint");
      }
    }

    // 3. Secret 생성
    const secret = this.secretGenerator();

    // 4. 전체 키 조합: blog_sk_{hint}_{secret}
    const apiKey = `blog_sk_${keyHint}_${secret}`;

    // 5. bcrypt 해시 (전체 키)
    // Cost factor 8: 검증 시간 30-60ms (기존 10: 80-150ms)
    // 보안성: 2^8 = 256 iterations (여전히 안전)
    const keyHash = await bcrypt.hash(apiKey, 8);
    const supportsEncryptedColumn = await this.hasEncryptedApiKeyColumn();
    const encryptedApiKey = supportsEncryptedColumn
      ? this.mcpApiKeySecretService.encrypt(apiKey)
      : null;

    // 6. 만료 시간 설정 (90일 후)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // 7. DB 저장
    const insertPayload: Record<string, any> = {
      keyHint,
      keyHash,
      name: normalizedName,
      userId,
      blogId,
      expiresAt,
      isActive: true,
      requestCount: 0,
      postsCreated: 0,
    };

    if (supportsEncryptedColumn) {
      insertPayload.encryptedApiKey = encryptedApiKey;
    }

    try {
      await this.mcpApiKeyRepository
        .createQueryBuilder()
        .insert()
        .into(McpApiKey)
        .values(insertPayload)
        .execute();
    } catch (error: any) {
      if (
        supportsEncryptedColumn &&
        this.isMissingEncryptedColumnError(error)
      ) {
        this.logger.warn(
          "encryptedApiKey column not found at insert time. Falling back to legacy insert without encrypted payload.",
        );
        this.encryptedApiKeyColumnExists = false;
        const legacyPayload = { ...insertPayload };
        delete legacyPayload.encryptedApiKey;

        await this.mcpApiKeyRepository
          .createQueryBuilder()
          .insert()
          .into(McpApiKey)
          .values(legacyPayload)
          .execute();
      } else {
        throw error;
      }
    }

    // 8. 생성 직후 원문 반환
    return {
      apiKey,
      keyHint,
      expiresAt,
    };
  }

  /**
   * API Key 원문 조회 (본인 소유 키만)
   */
  async revealSecret(
    keyId: string,
    userId: string,
  ): Promise<{ apiKey: string; keyHint: string; name: string }> {
    const supportsEncryptedColumn = await this.hasEncryptedApiKeyColumn();
    if (!supportsEncryptedColumn) {
      throw new ConflictException(
        "Encrypted API key storage is not ready yet. Run DB migration first.",
      );
    }

    const mcpApiKey = await this.mcpApiKeyRepository
      .createQueryBuilder("mcpApiKey")
      .addSelect("mcpApiKey.encryptedApiKey")
      .where("mcpApiKey.id = :id", { id: keyId })
      .getOne();

    if (!mcpApiKey) {
      throw new NotFoundException("API key not found");
    }

    if (mcpApiKey.userId !== userId) {
      throw new UnauthorizedException("Not authorized to access this API key");
    }

    if (!mcpApiKey.encryptedApiKey) {
      throw new ConflictException(
        "This key cannot be revealed. Please generate a new API key.",
      );
    }

    try {
      const apiKey = this.mcpApiKeySecretService.decrypt(
        mcpApiKey.encryptedApiKey,
      );
      return {
        apiKey,
        keyHint: mcpApiKey.keyHint,
        name: mcpApiKey.name,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to decrypt API key: ${error?.message || "unknown error"}`,
      );
      throw new ConflictException(
        "This key cannot be revealed. Please generate a new API key.",
      );
    }
  }

  /**
   * API Key 검증
   *
   * @param apiKey 요청 헤더의 API Key (blog_sk_{hint}_{secret})
   * @returns 검증된 McpApiKey 엔티티
   * @throws UnauthorizedException 검증 실패 시
   *
   * 흐름:
   * 1. hint 추출 (blog_sk_a1b2c3d4_xyz... → a1b2c3d4)
   * 2. hint로 O(1) 조회
   * 3. bcrypt 비교
   * 4. 만료/활성 상태 확인
   */
  async validateKey(apiKey: string): Promise<McpApiKey> {
    const keyHint = this.extractKeyHint(apiKey);

    // 1. 키 형식 검증 (blog_sk_{hint}_{secret})
    if (!apiKey.startsWith("blog_sk_")) {
      this.logger.warn(`❌ API key format mismatch: hint=${keyHint}`);
      throw new UnauthorizedException("Invalid API key format");
    }

    // 2. hint 추출
    const parts = apiKey.split("_");
    if (parts.length !== 4) {
      // ['blog', 'sk', hint, secret]
      this.logger.warn(`❌ API key format mismatch: hint=${keyHint}`);
      throw new UnauthorizedException("Invalid API key format");
    }

    // 3. hint로 O(1) 조회
    const mcpApiKey = await this.mcpApiKeyRepository.findOne({
      where: { keyHint },
      relations: ["user", "blog"],
    });

    if (!mcpApiKey) {
      this.logger.warn(`❌ API key hint not found: hint=${keyHint}`);
      throw new UnauthorizedException("Invalid API key");
    }

    // 4. bcrypt 비교 (전체 키)
    const isValid = await bcrypt.compare(apiKey, mcpApiKey.keyHash);
    if (!isValid) {
      this.logger.warn(`❌ API key hash mismatch: hint=${keyHint}`);
      throw new UnauthorizedException("Invalid API key");
    }

    // 5. 활성 상태 확인
    if (!mcpApiKey.isActive) {
      this.logger.warn(`❌ API key inactive: hint=${keyHint}`);
      throw new UnauthorizedException("API key is inactive");
    }

    // 6. 만료 확인
    if (mcpApiKey.expiresAt < new Date()) {
      this.logger.warn(`❌ API key expired: hint=${keyHint}`);
      throw new UnauthorizedException("API key has expired");
    }

    this.logger.log(`✅ API key validated: hint=${keyHint}, user=${mcpApiKey.userId.substring(0, 8)}`);

    // 7. 마지막 사용 시간 업데이트 (비동기, 응답 블로킹 안 함)
    this.updateLastUsed(mcpApiKey.id).catch((err) => {
      this.logger.error("Failed to update lastUsedAt:", err);
    });

    return mcpApiKey;
  }

  /**
   * 마지막 사용 시간 업데이트 (비동기)
   */
  private async updateLastUsed(keyId: string): Promise<void> {
    await this.mcpApiKeyRepository.update(
      { id: keyId },
      {
        lastUsedAt: new Date(),
        requestCount: () => '"requestCount" + 1',
      },
    );
  }

  /**
   * 사용자의 API Key 목록 조회
   *
   * @param userId 사용자 ID
   * @returns API Key 목록 (secret 제외)
   */
  async findByUser(userId: string): Promise<McpApiKey[]> {
    return this.mcpApiKeyRepository.find({
      where: { userId },
      relations: ["blog"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * API Key 삭제
   *
   * @param keyId API Key ID
   * @param userId 요청 사용자 ID (소유권 확인)
   */
  async delete(keyId: string, userId: string): Promise<void> {
    const mcpApiKey = await this.mcpApiKeyRepository.findOne({
      where: { id: keyId },
    });

    if (!mcpApiKey) {
      throw new NotFoundException("API key not found");
    }

    // 소유권 확인
    if (mcpApiKey.userId !== userId) {
      throw new UnauthorizedException("Not authorized to delete this API key");
    }

    // MCP Proxy 캐시 무효화 (mcp:apikey:valid:{keyHint})
    const cacheKey = `mcp:apikey:valid:${mcpApiKey.keyHint}`;
    await this.cacheService.del(cacheKey);

    // DB에서 삭제
    await this.mcpApiKeyRepository.delete({ id: keyId });
  }

  /**
   * 포스트 생성 카운트 증가
   * MCP create_post 도구에서 호출
   */
  async incrementPostsCreated(keyId: string): Promise<void> {
    await this.mcpApiKeyRepository.update(
      { id: keyId },
      { postsCreated: () => '"postsCreated" + 1' },
    );
  }

  // ============================================================
  // 관리자 통계 메서드
  // ============================================================

  /**
   * 총 MCP 사용량 통계
   */
  async getTotalStats() {
    // 1. 활성 API Key 수
    const activeKeys = await this.mcpApiKeyRepository.count({
      where: { isActive: true },
    });

    // 2. 총 요청 수 (모든 키의 requestCount 합계)
    const totalRequestsResult = await this.mcpApiKeyRepository
      .createQueryBuilder("key")
      .select("SUM(key.requestCount)", "total")
      .getRawOne();

    // 3. 총 포스트 수 (usage_tracking에서 MCP_POST 합계)
    const totalPostsResult = await this.usageTrackingRepository
      .createQueryBuilder("usage")
      .select("SUM(usage.count)", "total")
      .where("usage.resourceType = :type", { type: ResourceType.MCP_POST })
      .getRawOne();

    // 4. 활성 사용자 수 (MCP_POST usage가 있는 사용자)
    const activeUsers = await this.usageTrackingRepository
      .createQueryBuilder("usage")
      .select("COUNT(DISTINCT usage.userId)", "count")
      .where("usage.resourceType = :type", { type: ResourceType.MCP_POST })
      .getRawOne();

    // 5. 평균 사용량
    const avgPostsPerUser =
      activeUsers.count > 0
        ? Math.round(totalPostsResult.total / activeUsers.count)
        : 0;

    return {
      activeKeys,
      totalRequests: parseInt(totalRequestsResult.total) || 0,
      totalPosts: parseInt(totalPostsResult.total) || 0,
      activeUsers: parseInt(activeUsers.count) || 0,
      avgPostsPerUser,
    };
  }

  /**
   * 월별 MCP 사용량 통계
   */
  async getMonthlyStats(year: number, month: number) {
    const period = new Date(year, month - 1, 1);

    // 해당 월의 usage_tracking 조회
    const usages = await this.usageTrackingRepository.find({
      where: {
        resourceType: ResourceType.MCP_POST,
        period,
      },
      relations: ["user"],
    });

    const totalPosts = usages.reduce((sum, u) => sum + u.count, 0);
    const totalUsers = usages.length;
    const avgPerUser = totalUsers > 0 ? Math.round(totalPosts / totalUsers) : 0;

    // 플랜별 사용량 (usages의 user.tier 기반)
    const usagesByPlan = usages.reduce(
      (acc, usage) => {
        const tier = (usage.user as any)?.tier || "FREE";
        acc[tier] = (acc[tier] || 0) + usage.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 일별 사용량 (lastUsedAt 기반 그룹핑)
    const dailyUsage = usages.reduce((acc, usage) => {
      if (usage.lastUsedAt) {
        const day = format(usage.lastUsedAt, "yyyy-MM-dd");
        acc[day] = (acc[day] || 0) + usage.count;
      }
      return acc;
    }, {});

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      totalPosts,
      totalUsers,
      avgPerUser,
      usagesByPlan,
      dailyUsage,
    };
  }

  /**
   * 사용자별 MCP 통계 (Top N)
   */
  async getUserStats(limit: number = 20) {
    // 현재 월의 사용량 기준으로 정렬
    const currentPeriod = new Date();
    currentPeriod.setDate(1);

    const topUsers = await this.usageTrackingRepository
      .createQueryBuilder("usage")
      .leftJoinAndSelect("usage.user", "user")
      .where("usage.resourceType = :type", { type: ResourceType.MCP_POST })
      .andWhere("usage.period = :period", { period: currentPeriod })
      .orderBy("usage.count", "DESC")
      .limit(limit)
      .getMany();

    return topUsers.map((usage) => ({
      userId: usage.userId,
      username: usage.user?.username || "Unknown",
      email: usage.user?.email || "N/A",
      tier: (usage.user as any)?.tier || "FREE",
      postsCreated: usage.count,
      limit: usage.limit,
      percentage: usage.getUsagePercentage(),
      lastUsedAt: usage.lastUsedAt,
    }));
  }

  /**
   * 시간별 MCP 사용량 (Redis 캐시 기반)
   */
  async getHourlyStats(hours: number = 24) {
    const stats = [];

    for (let i = 0; i < hours; i++) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      const hourKey = `mcp:hourly:${format(date, "yyyy-MM-dd-HH")}`;

      const count = await this.cacheService.get(hourKey);

      stats.push({
        hour: format(date, "yyyy-MM-dd HH:00"),
        count: count ? parseInt(String(count)) : 0,
      });
    }

    return stats.reverse();
  }

  /**
   * 시간별 카운터 증가 (MCP 요청마다 호출)
   */
  async incrementHourlyCounter() {
    const hourKey = `mcp:hourly:${format(new Date(), "yyyy-MM-dd-HH")}`;

    // Redis에 시간별 카운터 증가
    await this.cacheService.increment(hourKey);

    // 7일 후 자동 삭제
    const ttl = await this.cacheService.ttl(hourKey);
    if (ttl === -1) {
      // TTL이 설정되지 않았으면 설정
      await this.cacheService.expire(hourKey, 86400 * 7); // 7일
    }
  }

  private async hasEncryptedApiKeyColumn(): Promise<boolean> {
    if (this.encryptedApiKeyColumnExists !== null) {
      return this.encryptedApiKeyColumnExists;
    }

    try {
      const result = await this.mcpApiKeyRepository.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'mcp_api_keys'
            AND column_name = 'encryptedApiKey'
        ) AS "exists"
      `);

      this.encryptedApiKeyColumnExists =
        result?.[0]?.exists === true ||
        result?.[0]?.exists === "t" ||
        result?.[0]?.exists === "true";
    } catch (error: any) {
      this.logger.warn(
        `Failed to detect encryptedApiKey column: ${error?.message || "unknown error"}`,
      );
      this.encryptedApiKeyColumnExists = false;
    }

    return this.encryptedApiKeyColumnExists;
  }

  private isMissingEncryptedColumnError(error: any): boolean {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("encryptedapikey") &&
      (message.includes("does not exist") ||
        message.includes("undefined column") ||
        message.includes("column"))
    );
  }
}
