import {
  Injectable,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DownloadLog } from "../entities/download-log.entity";

/** 배송 항목당 최대 다운로드 횟수 */
const MAX_DOWNLOADS_PER_ITEM = 5;

/**
 * 다운로드 추적 서비스
 *
 * per-item 다운로드 카운트 + 제한(5회/항목/주문).
 * 기존 order.metadata.downloadCount 방식 대체.
 */
@Injectable()
export class DownloadTrackingService {
  private readonly logger = new Logger(DownloadTrackingService.name);

  constructor(
    @InjectRepository(DownloadLog)
    private readonly downloadLogRepository: Repository<DownloadLog>,
  ) {}

  /**
   * 다운로드 가능 여부 확인
   */
  async canDownload(
    orderId: string,
    deliveryItemId: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const count = await this.downloadLogRepository.count({
      where: { orderId, deliveryItemId },
    });

    return {
      allowed: count < MAX_DOWNLOADS_PER_ITEM,
      remaining: Math.max(MAX_DOWNLOADS_PER_ITEM - count, 0),
    };
  }

  /**
   * 다운로드 기록 + 제한 확인
   * 제한 초과 시 ForbiddenException
   */
  async recordDownload(
    orderId: string,
    deliveryItemId: string,
    buyerId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<DownloadLog> {
    const { allowed, remaining } = await this.canDownload(
      orderId,
      deliveryItemId,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `다운로드 횟수 제한을 초과했습니다 (최대 ${MAX_DOWNLOADS_PER_ITEM}회)`,
      );
    }

    const log = this.downloadLogRepository.create({
      orderId,
      deliveryItemId,
      buyerId,
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    const saved = await this.downloadLogRepository.save(log);

    this.logger.log(
      `다운로드 기록: orderId=${orderId}, itemId=${deliveryItemId}, remaining=${remaining - 1}`,
    );

    return saved;
  }

  /**
   * 판매자용: 배송 항목별 다운로드 통계
   */
  async getItemDownloadStats(
    deliveryItemIds: string[],
  ): Promise<Record<string, number>> {
    if (deliveryItemIds.length === 0) return {};

    const results = await this.downloadLogRepository
      .createQueryBuilder("dl")
      .select("dl.deliveryItemId", "itemId")
      .addSelect("COUNT(*)", "count")
      .where("dl.deliveryItemId IN (:...ids)", { ids: deliveryItemIds })
      .groupBy("dl.deliveryItemId")
      .getRawMany<{ itemId: string; count: string }>();

    const stats: Record<string, number> = {};
    for (const r of results) {
      stats[r.itemId] = parseInt(r.count, 10);
    }
    return stats;
  }
}
