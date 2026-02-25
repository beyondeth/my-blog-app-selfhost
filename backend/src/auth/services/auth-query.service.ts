import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { UsersService } from "../../users/users.service";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { User } from "../../users/entities/user.entity";
import * as crypto from "crypto";

@Injectable()
export class AuthQueryService {
  private readonly logger = new Logger(AuthQueryService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getJwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "codebase.blog");
  }

  private getJwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "codebase.blog::api");
  }

  async validateResetToken(token: string): Promise<boolean> {
    const hashedToken = crypto
      .createHmac("sha256", this.configService.get("JWT_SECRET"))
      .update(token)
      .digest("hex");

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    return !!resetToken;
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const user = await this.usersService.findByEmail(email);
    return { exists: !!user };
  }

  /**
   * Access Token 검증 (MCP OAuth용)
   *
   * JWT 토큰을 검증하고 사용자 정보를 반환
   * MCP OAuth 로그인 시 이미 로그인된 사용자를 확인할 때 사용
   *
   * @param token JWT access token
   * @returns 사용자 정보 또는 null
   */
  async validateAccessToken(token: string): Promise<User | null> {
    try {
      // JWT 토큰 검증
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get("JWT_SECRET"),
        issuer: this.getJwtIssuer(),
        audience: this.getJwtAudience(),
      });

      if (!payload || !payload.sub) {
        return null;
      }

      // 사용자 조회
      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.debug(`Access token validation failed: ${error.message}`);
      return null;
    }
  }
}
