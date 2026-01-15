import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { RATE_LIMIT_METADATA_KEY } from "./rate-limit.constants";
import { RateLimitService } from "./rate-limit.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();
    const group =
      this.reflector.get<string>(RATE_LIMIT_METADATA_KEY, handler) ??
      this.reflector.get<string>(RATE_LIMIT_METADATA_KEY, classRef);

    if (!group) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const identifier = this.resolveIdentifier(request);
    if (!identifier) {
      // 식별 불가 시 기본적으로 허용
      return true;
    }

    const decision = await this.rateLimitService.consume(group, identifier);

    if (response?.setHeader) {
      response.setHeader("X-RateLimit-Limit", decision.limit);
      if (decision.remaining !== undefined) {
        response.setHeader(
          "X-RateLimit-Remaining",
          Math.max(decision.remaining, 0),
        );
      }
      if (decision.resetAfter !== undefined) {
        response.setHeader("X-RateLimit-Reset", decision.resetAfter);
      }
    }

    if (!decision.allowed) {
      if (response?.setHeader && decision.retryAfter !== undefined) {
        response.setHeader("Retry-After", decision.retryAfter);
      }
      throw new HttpException(
        {
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
          retryAfter: decision.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveIdentifier(request: Request): string | null {
    const userId = (request as any)?.user?.id;
    if (userId) {
      return `user:${userId}`;
    }

    const forwarded = Array.isArray(request.headers["x-forwarded-for"])
      ? request.headers["x-forwarded-for"][0]
      : request.headers["x-forwarded-for"];

    const ip =
      (forwarded && forwarded.split(",")[0].trim()) ||
      request.ip ||
      (request as any).connection?.remoteAddress ||
      (request as any).socket?.remoteAddress;

    if (ip) {
      return `ip:${ip}`;
    }

    return null;
  }
}
