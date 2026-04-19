import { Injectable } from "@nestjs/common";
import { AuthQueryService } from "./services/auth-query.service";
import { AuthCommandService } from "./services/auth-command.service";
import { User, AuthProvider } from "../users/entities/user.entity";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthResponse } from "./interfaces/auth-response.interface";
import { AuditContext } from "../audit/audit.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly authQueryService: AuthQueryService,
    private readonly authCommandService: AuthCommandService,
  ) {}

  // ====================================================================
  // Query Operations
  // ====================================================================

  async validateResetToken(token: string): Promise<boolean> {
    return this.authQueryService.validateResetToken(token);
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    return this.authQueryService.checkEmailExists(email);
  }

  async validateAccessToken(token: string): Promise<User | null> {
    return this.authQueryService.validateAccessToken(token);
  }

  // ====================================================================
  // Command Operations
  // ====================================================================

  async validateUser(email: string, password: string): Promise<User | null> {
    return this.authCommandService.validateUser(email, password);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    return this.authCommandService.login(loginDto);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authCommandService.register(registerDto);
  }

  async validateOAuthUser(
    profile: any,
    provider: AuthProvider,
  ): Promise<AuthResponse> {
    return this.authCommandService.validateOAuthUser(profile, provider);
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    return this.authCommandService.refreshTokens(refreshToken);
  }

  async logout(userId: string): Promise<void> {
    return this.authCommandService.logout(userId);
  }

  async createSessionToken(userId: string): Promise<string> {
    return this.authCommandService.createSessionToken(userId);
  }

  async forgotPassword(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    return this.authCommandService.forgotPassword(email, ipAddress, userAgent);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.authCommandService.resetPassword(token, newPassword);
  }

  async updateConsent(
    userId: string,
    consentDto: {
      isOver14: boolean;
      termsAccepted: boolean;
      privacyAccepted: boolean;
      marketingOptIn?: boolean;
      newsletterOptIn?: boolean;
    },
  ): Promise<void> {
    return this.authCommandService.updateConsent(userId, consentDto);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return this.authCommandService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
  }

  async recordCookieConsent(
    userId: string,
    consentDto: {
      analyticsEnabled: boolean;
      policyVersion: string;
      source?: string;
    },
    context: AuditContext,
  ): Promise<void> {
    return this.authCommandService.recordCookieConsent(userId, consentDto, context);
  }
}
