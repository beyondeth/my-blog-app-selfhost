import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, Min, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MarketplaceSellerService } from "../services/marketplace-seller.service";
import { FileSafetyService } from "../services/file-safety.service";

/** 격리 업로드 요청 DTO */
class QuarantineUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  originalName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @IsNumber()
  @Min(1)
  fileSize: number;
}

/** 격리 업로드 확인 DTO */
class QuarantineConfirmDto {
  @IsString()
  @IsNotEmpty()
  quarantineId: string;
}

/**
 * 판매자 대시보드 컨트롤러
 */
@ApiTags("Marketplace Seller")
@Controller("marketplace/seller")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceSellerController {
  constructor(
    private readonly sellerService: MarketplaceSellerService,
    private readonly fileSafetyService: FileSafetyService,
  ) {}

  /** 판매자 대시보드 요약 */
  @Get("dashboard")
  @ApiOperation({ summary: "판매자 대시보드" })
  async getDashboard(@Request() req: any) {
    const data = await this.sellerService.getDashboard(req.user.id);
    return { success: true, data };
  }

  /** 판매자 주문 목록 */
  @Get("orders")
  @ApiOperation({ summary: "판매자 주문 목록" })
  async getOrders(
    @Request() req: any,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
  ) {
    const data = await this.sellerService.getSellerOrders(
      req.user.id,
      limit || 20,
      cursor,
    );
    return { success: true, data };
  }

  /** 판매자 상품 목록 */
  @Get("products")
  @ApiOperation({ summary: "판매자 상품 목록" })
  async getProducts(@Request() req: any) {
    const data = await this.sellerService.getSellerProducts(req.user.id);
    return { success: true, data };
  }

  /** 상품 판매 중지/재개 */
  @Patch("products/:postId/toggle")
  @ApiOperation({ summary: "상품 판매 중지/재개" })
  async toggleProduct(
    @Request() req: any,
    @Param("postId") postId: string,
  ) {
    const data = await this.sellerService.toggleProductActive(
      req.user.id,
      postId,
    );
    return { success: true, data };
  }

  /** 격리 업로드 URL 발급 (판매 파일 업로드 1단계) */
  @Post("upload/quarantine")
  @ApiOperation({ summary: "격리 업로드 presigned URL 발급" })
  async createQuarantineUpload(
    @Request() req: any,
    @Body() dto: QuarantineUploadDto,
  ) {
    const data = await this.fileSafetyService.createQuarantineUpload(
      req.user.id,
      {
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
      },
    );
    return { success: true, data };
  }

  /** 격리 업로드 확인 (판매 파일 업로드 2단계: magic bytes 검증) */
  @Post("upload/confirm")
  @ApiOperation({ summary: "격리 업로드 확인 + 검증" })
  async confirmQuarantineUpload(
    @Request() req: any,
    @Body() dto: QuarantineConfirmDto,
  ) {
    const data = await this.fileSafetyService.confirmUpload(
      req.user.id,
      dto.quarantineId,
    );
    return { success: true, data };
  }
}
