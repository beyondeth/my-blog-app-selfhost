import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SellerProfile } from "../entities/seller-profile.entity";

/**
 * 판매자 프로필 서비스
 *
 * 판매자 신뢰 지표 관리 + 뱃지 계산.
 * 역정규화 통계는 일별 Cron으로 재계산.
 */
@Injectable()
export class SellerProfileService {
  private readonly logger = new Logger(SellerProfileService.name);

  constructor(
    @InjectRepository(SellerProfile)
    private readonly sellerProfileRepository: Repository<SellerProfile>,
  ) {}

  /**
   * 판매자 프로필 조회 (없으면 자동 생성)
   */
  async getOrCreateProfile(userId: string): Promise<SellerProfile> {
    let profile = await this.sellerProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.sellerProfileRepository.create({ userId });
      profile = await this.sellerProfileRepository.save(profile);
    }

    return profile;
  }

  /**
   * 공개 신뢰 지표 조회 (상품 카드/상세에 표시)
   */
  async getTrustSignals(userId: string): Promise<{
    isVerified: boolean;
    totalSales: number;
    averageRating: number;
    totalReviews: number;
    badges: string[];
    responseRate: number | null;
  }> {
    const profile = await this.getOrCreateProfile(userId);

    return {
      isVerified: profile.isVerified,
      totalSales: profile.totalSales,
      averageRating: Number(profile.averageRating),
      totalReviews: profile.totalReviews,
      badges: profile.displayBadges,
      responseRate: profile.responseRate ? Number(profile.responseRate) : null,
    };
  }

  /**
   * 뱃지 재계산
   * 규칙: top_seller(50+ 판매), fast_responder(평균 응답 60분 이내), verified(본인인증)
   */
  async calculateBadges(userId: string): Promise<string[]> {
    const profile = await this.getOrCreateProfile(userId);
    const badges: string[] = [];

    if (profile.isVerified) badges.push("verified");
    if (profile.totalSales >= 50) badges.push("top_seller");
    if (
      profile.averageResponseTimeMinutes !== null &&
      profile.averageResponseTimeMinutes <= 60
    ) {
      badges.push("fast_responder");
    }

    // 뱃지 변경 시에만 업데이트
    if (JSON.stringify(badges) !== JSON.stringify(profile.displayBadges)) {
      await this.sellerProfileRepository.update(profile.id, {
        displayBadges: badges,
      });
    }

    return badges;
  }

  /**
   * 판매 완료 시 판매자 프로필 업데이트 (원자적 증가)
   */
  async onSaleCompleted(sellerId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(sellerId);
    await this.sellerProfileRepository.increment(
      { id: profile.id },
      "totalSales",
      1,
    );
  }

  /**
   * 리뷰 수신 시 판매자 평균 평점 재계산
   */
  async recalculateSellerRating(sellerId: string): Promise<void> {
    // 판매자의 모든 상품 평균 평점 집계
    const result = await this.sellerProfileRepository.manager
      .createQueryBuilder()
      .select("AVG(pd.\"averageRating\")", "avg")
      .addSelect("SUM(pd.\"reviewCount\")", "total")
      .from("product_details", "pd")
      .innerJoin("posts", "p", "p.id = pd.\"postId\"")
      .where("p.\"authorId\" = :sellerId", { sellerId })
      .andWhere("pd.\"reviewCount\" > 0")
      .getRawOne<{ avg: string | null; total: string }>();

    const avgRating = result?.avg ? parseFloat(result.avg) : 0;
    const totalReviews = result?.total ? parseInt(result.total, 10) : 0;

    await this.sellerProfileRepository.update(
      { userId: sellerId },
      {
        averageRating: Math.round(avgRating * 100) / 100,
        totalReviews,
      },
    );
  }
}
