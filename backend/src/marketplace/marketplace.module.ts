import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { Post } from "../posts/entities/post.entity";
import { ProductDetail } from "./entities/product-detail.entity";
import { Order } from "./entities/order.entity";
import { User } from "../users/entities/user.entity";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import { MarketplaceController } from "./controllers/marketplace.controller";
import { MarketplacePurchaseController } from "./controllers/marketplace-purchase.controller";
import { MarketplaceService } from "./services/marketplace.service";
import { MarketplacePurchaseService } from "./services/marketplace-purchase.service";
import { MarketplaceDownloadService } from "./services/marketplace-download.service";
import { MarketplaceRefundService } from "./services/marketplace-refund.service";
import { MarketplaceRefundController } from "./controllers/marketplace-refund.controller";
import { MarketplaceSellerService } from "./services/marketplace-seller.service";
import { MarketplaceSellerController } from "./controllers/marketplace-seller.controller";
import { RefundRequest } from "./entities/refund-request.entity";
import { DeliveryItem } from "./entities/delivery-item.entity";
import { DownloadLog } from "./entities/download-log.entity";
import { FileQuarantine } from "./entities/file-quarantine.entity";
import { MarketplaceDeliveryService } from "./services/marketplace-delivery.service";
import { MarketplaceDeliveryController } from "./controllers/marketplace-delivery.controller";
import { FileSafetyService } from "./services/file-safety.service";
import { DownloadTrackingService } from "./services/download-tracking.service";
import { TransactionChatService } from "./services/transaction-chat.service";
import { ProductReviewService } from "./services/product-review.service";
import { SellerProfileService } from "./services/seller-profile.service";
import { ProductReview } from "./entities/product-review.entity";
import { SellerProfile } from "./entities/seller-profile.entity";
import { TossApiClient } from "../payment/providers/toss-api.client";
import { FilesModule } from "../files/files.module";
import { Conversation } from "../chat/entities/conversation.entity";
import { Message } from "../chat/entities/message.entity";

/**
 * 마켓플레이스 모듈
 *
 * Phase 1: 상품 브라우징 (목록, 카테고리, 상세)
 * Phase 2: 구매 플로우 (prepare/confirm)
 * Phase 3: 판매자 대시보드 — 별도 추가 예정
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      ProductDetail,
      DeliveryItem,
      DownloadLog,
      FileQuarantine,
      Order,
      User,
      PaymentHistory,
      RefundRequest,
      Conversation,
      Message,
      ProductReview,
      SellerProfile,
    ]),
    HttpModule,
    FilesModule,
  ],
  controllers: [
    MarketplaceController,
    MarketplacePurchaseController,
    MarketplaceRefundController,
    MarketplaceSellerController,
    MarketplaceDeliveryController,
  ],
  providers: [
    MarketplaceService,
    MarketplacePurchaseService,
    MarketplaceDownloadService,
    MarketplaceRefundService,
    MarketplaceSellerService,
    MarketplaceDeliveryService,
    FileSafetyService,
    DownloadTrackingService,
    TransactionChatService,
    ProductReviewService,
    SellerProfileService,
    TossApiClient,
  ],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
