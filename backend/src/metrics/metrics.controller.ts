/**
 * Prometheus 메트릭 컨트롤러
 * @description Prometheus가 스크래핑하는 공개 메트릭 엔드포인트
 * Docker 내부 네트워크에서만 접근 가능
 */

import {
  Controller,
  Get,
  Req,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import { register } from "prom-client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Role } from "../common/enums/role.enum";
import { ApiBearerAuth } from "@nestjs/swagger";

const INTERNAL_METRICS_PATH = (
  process.env.METRICS_PATH || "/internal/health-check-2f4a8b9c"
).replace(/^\//, "");

@Controller()
export class InternalMetricsController {
  private readonly logger = new Logger(InternalMetricsController.name);

  /**
   * Docker/VictoriaMetrics 내부 스크랩 전용 메트릭 엔드포인트
   * - 글로벌 JwtAuthGuard가 metrics path + private IP 여부를 추가 검증한다.
   * - public 도메인에는 노출되지 않는 숨김 경로를 사용한다.
   */
  @Public()
  @Get(INTERNAL_METRICS_PATH)
  async getInternalMetrics(@Req() req: Request): Promise<string> {
    const clientIP = req.ip || req.connection.remoteAddress || "";
    this.logger.debug(
      `[InternalMetricsController] Internal scrape granted for IP: ${clientIP}`,
    );

    return register.metrics();
  }
}

@Controller("metrics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  /**
   * Prometheus 메트릭 엔드포인트
   * @description 오직 관리자만 접근 가능 (보안 강화)
   * @returns Prometheus 형식의 메트릭 텍스트
   */
  @Get()
  async getMetrics(@Req() req: Request): Promise<string> {
    const clientIP = req.ip || req.connection.remoteAddress || "";
    this.logger.log(
      `[MetricsController] Admin access granted for IP: ${clientIP}`,
    );

    return register.metrics();
  }
}
