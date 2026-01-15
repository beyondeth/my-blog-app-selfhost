/**
 * Prometheus 메트릭 컨트롤러
 * @description Prometheus가 스크래핑하는 공개 메트릭 엔드포인트
 * Docker 내부 네트워크에서만 접근 가능
 */

import {
  Controller,
  Get,
  Req,
  ForbiddenException,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { register } from "prom-client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { ApiBearerAuth } from "@nestjs/swagger";

@Controller("metrics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class MetricsController {
  /**
   * Prometheus 메트릭 엔드포인트
   * @description 오직 관리자만 접근 가능 (보안 강화)
   * @returns Prometheus 형식의 메트릭 텍스트
   */
  @Get()
  async getMetrics(@Req() req: Request): Promise<string> {
    const clientIP = req.ip || req.connection.remoteAddress || "";
    console.log(`[MetricsController] Admin access granted for IP: ${clientIP}`);
    
    return register.metrics();
  }
}
