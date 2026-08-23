import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  DataSource,
  IsNull,
  LessThan,
  MoreThan,
  Not,
  Repository,
} from "typeorm";
import { UsersService } from "../users/users.service";
import { BlogsService } from "../blogs/blogs.service";
import { EmailService } from "../email/email.service";
import { IdentityService } from "../users/services/identity.service";
import { User, AuthProvider } from "../users/entities/user.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { IdentityProvider } from "../users/entities/user-identity.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshSession } from "./entities/refresh-session.entity";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { parseJwtExpiresIn } from "../config/jwt.config";
import { AuthResponse } from "./interfaces/auth-response.interface";
import { AuditAction } from "../audit/entities/audit-log.entity";
import { AuditService } from "../audit/audit.service";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  getRandomCharacter,
  isOAuthProviderImage,
} from "../common/utils/character.util";

export interface RefreshSessionContext {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly blogsService: BlogsService,
    private readonly emailService: EmailService,
    private readonly identityService: IdentityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshSession)
    private readonly refreshSessionRepository: Repository<RefreshSession>,
    private readonly dataSource: DataSource,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private getJwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "aigory.com");
  }

  private getJwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "aigory.com::api");
  }

  private getJwtExpiresIn(
    configKey: string,
    defaultValue: string,
  ): JwtSignOptions["expiresIn"] {
    return parseJwtExpiresIn(
      this.configService.get<string>(configKey, defaultValue),
    );
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);

      // 🔍 디버그: DB에서 가져온 유저의 role 확인
      this.logger.debug(
        `[validateUser] Retrieved user from DB - email: ${email}, role: "${user?.role}" (type: ${typeof user?.role})`,
      );

      if (!user) {
        return null;
      }

      await this.usersService.refreshUserStatus(user);

      // 삭제된 계정 로그인 차단 (30일 재가입 정책 안내)
      if (user.isDeleted) {
        const now = new Date();
        const deletedAt = new Date(user.deletedAt);
        const daysSinceDeletion = Math.floor(
          (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const WAITING_PERIOD_DAYS = 30;
        const remainingDays = Math.max(
          0,
          WAITING_PERIOD_DAYS - daysSinceDeletion,
        );

        throw new UnauthorizedException({
          statusCode: 401,
          message:
            `계정이 삭제되었습니다. 재가입은 삭제 후 30일이 지나야 가능합니다. ` +
            (remainingDays > 0
              ? `${remainingDays}일 후 재가입 가능합니다.`
              : `회원가입 페이지에서 재가입해주세요.`),
          error: "Unauthorized",
          code: "ACCOUNT_DELETED",
          remainingDays,
        });
      }

      if (user.isBanned) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: "계정이 영구 차단되었습니다. 관리자에게 문의해주세요.",
          error: "Unauthorized",
          code: "ACCOUNT_BANNED",
          reason: user.banReason,
          bannedAt: user.bannedAt,
        });
      }

      if (
        user.suspensionUntil &&
        new Date(user.suspensionUntil).getTime() > Date.now()
      ) {
        const suspensionEnd = new Date(user.suspensionUntil);
        const remainingMs = suspensionEnd.getTime() - Date.now();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        throw new UnauthorizedException({
          statusCode: 401,
          message: `계정이 정지되었습니다. ${suspensionEnd.toLocaleString("ko-KR")}까지 로그인할 수 없습니다.`,
          error: "Unauthorized",
          code: "ACCOUNT_SUSPENDED",
          reason: user.suspensionReason,
          suspensionUntil: suspensionEnd,
          remainingDays,
        });
      }

      if (!user.isActive) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: "계정이 비활성화되어 있습니다. 관리자에게 문의해주세요.",
          error: "Unauthorized",
          code: "ACCOUNT_INACTIVE",
        });
      }

      // 비밀번호가 없는 경우 또는 비밀번호가 일치하지 않는 경우 - 통일된 에러 메시지
      if (!user.password) {
        return null;
      }

      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return null;
      }

      // 마지막 로그인 시간 및 로그인 방법 업데이트
      await this.usersService.updateLastLogin(user.id, "local");

      // 🔍 디버그: validateUser가 반환하기 직전의 role 확인
      this.logger.debug(
        `[validateUser] Returning user - email: ${email}, role: "${user.role}" (type: ${typeof user.role})`,
      );

      return user;
    } catch (error) {
      this.logger.error(`Validation failed for email ${email}:`, error.message);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return null;
    }
  }

  async login(
    loginDto: LoginDto,
    context: RefreshSessionContext = {},
  ): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 일치하지 않습니다",
      );
    }

    return this.generateTokenResponse(user, undefined, context);
  }

  async register(
    registerDto: RegisterDto,
    context: RefreshSessionContext = {},
  ): Promise<AuthResponse> {
    const {
      email,
      username,
      password,
      emailVerificationToken,
      isOver14,
      termsAccepted,
      privacyAccepted,
      marketingOptIn,
      newsletterOptIn,
    } = registerDto;

    // 이메일 인증 확인 (필수)
    // curl 등 직접 API 호출을 통한 회원가입 방지
    if (!emailVerificationToken) {
      throw new BadRequestException(
        "이메일 인증이 필요합니다. 이메일 인증을 완료해주세요.",
      );
    }

    // 이메일 인증 토큰 검증
    const isVerified = await this.emailService.checkVerificationStatus(
      email,
      emailVerificationToken,
    );
    if (!isVerified) {
      throw new BadRequestException(
        "유효하지 않거나 만료된 이메일 인증 토큰입니다.",
      );
    }

    // 이메일 중복 체크 (삭제된 계정 포함)
    const existingUser =
      await this.usersService.findByEmailIncludingDeleted(email);

    if (existingUser) {
      // 활성 계정이면 중복 에러
      if (!existingUser.isDeleted) {
        throw new ConflictException(
          "이미 존재하는 회원입니다. 로그인 페이지에서 로그인해주세요.",
        );
      }

      // 삭제된 계정이면 재가입 대기 기간 확인 (30일 정책)
      const now = new Date();
      const deletedAt = new Date(existingUser.deletedAt);
      const daysSinceDeletion = Math.floor(
        (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const WAITING_PERIOD_DAYS = 30;

      if (daysSinceDeletion < WAITING_PERIOD_DAYS) {
        // 30일 미경과: 재가입 차단
        const remainingDays = WAITING_PERIOD_DAYS - daysSinceDeletion;
        const availableDate = new Date(deletedAt);
        availableDate.setDate(availableDate.getDate() + WAITING_PERIOD_DAYS);

        throw new ConflictException(
          `계정 삭제 후 ${WAITING_PERIOD_DAYS}일이 지나야 재가입이 가능합니다. ` +
            `${remainingDays}일 후 (${availableDate.toLocaleDateString("ko-KR")}) 재가입 가능합니다.`,
        );
      }

      // 30일 경과: 재가입 허용 (로그 기록)
      this.logger.log(
        `User ${email} deleted ${daysSinceDeletion} days ago. ` +
          `Allowing re-registration (old account ID: ${existingUser.id})`,
      );
    }

    // 사용자명 중복 체크
    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException(
        `이미 사용 중인 '${username}'입니다. 다른 사용자명을 선택해주세요.`,
      );
    }

    try {
      const user = await this.usersService.create({
        email,
        username,
        password,
        // 🎨 랜덤 캐릭터 프로필 이미지 할당 (OAuth와 동일)
        profileImage: getRandomCharacter(),
        authProvider: AuthProvider.LOCAL,
        isEmailVerified: true, // 이메일 인증 완료 상태 반영
        termsAcceptedAt: termsAccepted ? new Date() : null,
        privacyAcceptedAt: privacyAccepted ? new Date() : null,
        marketingOptIn: marketingOptIn || false,
        marketingOptInAt: marketingOptIn ? new Date() : null,
        newsletterOptIn: newsletterOptIn || false,
      });

      // 자동으로 블로그 생성
      const blog = await this.createUserBlog(user);

      this.logger.log(`New user registered with blog: ${email}`);
      return this.generateTokenResponse(user, blog, context);
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error.message);
      throw new BadRequestException("Registration failed");
    }
  }

  async validateOAuthUser(
    profile: any,
    provider: AuthProvider,
  ): Promise<AuthResponse> {
    try {
      const identityProvider = provider as unknown as IdentityProvider;
      const candidateEmails = [
        {
          value: profile.email,
          verified: profile.emailVerified ?? profile._json?.email_verified,
        },
        ...((profile.emails || []).map((entry) => ({
          value: entry?.value,
          verified:
            entry?.verified ??
            entry?.isVerified ??
            profile._json?.email_verified ??
            profile._json?.kakao_account?.is_email_verified,
        })) as Array<{ value?: string; verified?: boolean }>),
      ]
        .filter((entry) => typeof entry.value === "string")
        .map((entry) => ({
          value: entry.value!.trim().toLowerCase(),
          verified: entry.verified === true,
        }));
      const verifiedEmail = candidateEmails.find((entry) => entry.verified);
      const email = verifiedEmail?.value;

      // OAuth에서 이메일을 반드시 가져와야 함
      if (!email) {
        this.logger.error(
          `OAuth ${provider} did not provide a verified email address`,
        );
        throw new BadRequestException(
          `${provider} 계정의 검증된 이메일이 필요합니다. ` +
            `OAuth 제공자 설정에서 이메일 공개 및 검증 상태를 확인해주세요.`,
        );
      }

      // 1. Provider ID로 기존 identity 찾기
      const existingIdentity = await this.identityService.findByProviderId(
        profile.id,
        identityProvider,
      );

      if (existingIdentity) {
        // 기존 identity로 로그인
        this.logger.log(
          `Existing ${provider} identity found for user ${existingIdentity.userId}`,
        );

        await this.identityService.updateLastUsed(existingIdentity.id);
        const user = await this.usersService.findById(existingIdentity.userId);

        // 🔍 디버그: 기존 OAuth Identity 사용자 찾음
        this.logger.debug(
          `[validateOAuthUser] Found user by identity - email: ${user.email}, isBanned: ${user.isBanned}, suspensionUntil: ${user.suspensionUntil}`,
        );

        // 🛑 영구 차단 체크
        if (user.isBanned) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "계정이 영구 차단되었습니다. 관리자에게 문의해주세요.",
            error: "Unauthorized",
            code: "ACCOUNT_BANNED",
            reason: user.banReason,
            bannedAt: user.bannedAt,
          });
        }

        // 🛑 일시 정지 체크
        if (
          user.suspensionUntil &&
          new Date(user.suspensionUntil).getTime() > Date.now()
        ) {
          const suspensionEnd = new Date(user.suspensionUntil);
          const remainingMs = suspensionEnd.getTime() - Date.now();
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          throw new UnauthorizedException({
            statusCode: 401,
            message: `계정이 정지되었습니다. ${suspensionEnd.toLocaleString("ko-KR")}까지 로그인할 수 없습니다.`,
            error: "Unauthorized",
            code: "ACCOUNT_SUSPENDED",
            reason: user.suspensionReason,
            suspensionUntil: suspensionEnd,
            remainingDays,
          });
        }

        // 🎨 OAuth 제공자 이미지를 캐릭터로 마이그레이션 (점진적 전환)
        // 기존 사용자가 OAuth URL을 사용 중이면 랜덤 캐릭터로 교체
        if (isOAuthProviderImage(user.profileImage)) {
          const newCharacter = getRandomCharacter();
          await this.usersService.update(user.id, {
            profileImage: newCharacter,
          });
          user.profileImage = newCharacter;
          this.logger.log(
            `Migrated OAuth image to character (${newCharacter}) for user ${user.email}`,
          );
        }

        // 🔐 삭제된 계정 로그인 차단 (30일 재가입 정책)
        if (user.isDeleted || !user.isActive) {
          const now = new Date();
          const deletedAt = new Date(user.deletedAt);
          const daysSinceDeletion = Math.floor(
            (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          const WAITING_PERIOD_DAYS = 30;
          const remainingDays = Math.max(
            0,
            WAITING_PERIOD_DAYS - daysSinceDeletion,
          );

          throw new UnauthorizedException({
            statusCode: 401,
            message:
              `계정이 삭제되었습니다. ` +
              (remainingDays > 0
                ? `재가입은 삭제 후 30일이 지나야 가능합니다. ${remainingDays}일 후 재가입 가능합니다.`
                : `재가입을 원하시면 회원가입 페이지에서 진행해주세요.`),
            error: "Unauthorized",
            code: "ACCOUNT_DELETED",
            remainingDays,
          });
        }

        // 블로그 정보 가져오기
        const userBlogs = await this.blogsService.findByUserId(user.id);
        let blog: Blog | null = null;

        // 블로그가 없으면 자동 생성
        if (!userBlogs || userBlogs.length === 0) {
          blog = await this.createUserBlog(user);
          this.logger.log(
            `Blog automatically created for returning OAuth user: ${user.email}`,
          );
        } else {
          blog = userBlogs[0]; // 첫 번째 블로그 사용
        }

        await this.usersService.updateLastLogin(user.id, provider);
        return this.generateTokenResponse(user, blog);
      }

      // 2. 이메일로 기존 사용자 찾기 (삭제된 계정 포함)
      const existingUser =
        await this.usersService.findByEmailIncludingDeleted(email);

      if (existingUser) {
        // 🔍 디버그: 기존 사용자 찾음
        this.logger.debug(
          `[validateOAuthUser] Found existing user - email: ${email}, isDeleted: ${existingUser.isDeleted}, isBanned: ${existingUser.isBanned}, suspensionUntil: ${existingUser.suspensionUntil}`,
        );

        // 🛑 영구 차단 체크 (validateUser와 동일)
        if (existingUser.isBanned) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "계정이 영구 차단되었습니다. 관리자에게 문의해주세요.",
            error: "Unauthorized",
            code: "ACCOUNT_BANNED",
            reason: existingUser.banReason,
            bannedAt: existingUser.bannedAt,
          });
        }

        // 🛑 일시 정지 체크 (validateUser와 동일)
        if (
          existingUser.suspensionUntil &&
          new Date(existingUser.suspensionUntil).getTime() > Date.now()
        ) {
          const suspensionEnd = new Date(existingUser.suspensionUntil);
          const remainingMs = suspensionEnd.getTime() - Date.now();
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          throw new UnauthorizedException({
            statusCode: 401,
            message: `계정이 정지되었습니다. ${suspensionEnd.toLocaleString("ko-KR")}까지 로그인할 수 없습니다.`,
            error: "Unauthorized",
            code: "ACCOUNT_SUSPENDED",
            reason: existingUser.suspensionReason,
            suspensionUntil: suspensionEnd,
            remainingDays,
          });
        }

        // 🛑 비활성 계정 체크
        if (!existingUser.isActive && !existingUser.isDeleted) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "계정이 비활성화되어 있습니다. 관리자에게 문의해주세요.",
            error: "Unauthorized",
            code: "ACCOUNT_INACTIVE",
          });
        }

        // 삭제된 계정이면 재가입 정책 적용

        if (existingUser.isDeleted) {
          const now = new Date();
          const deletedAt = new Date(existingUser.deletedAt);
          const daysSinceDeletion = Math.floor(
            (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          const WAITING_PERIOD_DAYS = 30;

          if (daysSinceDeletion < WAITING_PERIOD_DAYS) {
            // 30일 미경과: OAuth 로그인 차단
            const remainingDays = WAITING_PERIOD_DAYS - daysSinceDeletion;
            const availableDate = new Date(deletedAt);
            availableDate.setDate(
              availableDate.getDate() + WAITING_PERIOD_DAYS,
            );

            throw new UnauthorizedException({
              statusCode: 401,
              message:
                `계정 삭제 후 ${WAITING_PERIOD_DAYS}일이 지나야 로그인이 가능합니다. ` +
                `${remainingDays}일 후 (${availableDate.toLocaleDateString("ko-KR")}) 이용 가능합니다.`,
              error: "Unauthorized",
              code: "ACCOUNT_DELETED",
              remainingDays,
            });
          }

          // 30일 경과: OAuth 로그인 허용하지 않고, 재가입 유도
          // (OAuth는 자동 회원가입이므로, 명시적 재가입 요구)
          throw new UnauthorizedException({
            statusCode: 401,
            message:
              "삭제된 계정입니다. 재가입을 원하시면 회원가입 페이지에서 진행해주세요.",
            error: "Unauthorized",
            code: "ACCOUNT_DELETED",
            remainingDays: 0,
          });
        }

        throw new ConflictException({
          code: "MANUAL_LINK_REQUIRED",
          message: `이 이메일은 이미 등록되어 있습니다. 기존 방법으로 로그인한 뒤 설정 화면에서 ${provider} 계정을 명시적으로 연결해주세요.`,
          existingProvider: existingUser.authProvider || "email",
        });
      }

      // 3. 새 사용자 생성
      const newUser = await this.usersService.create({
        email,
        username: profile.username || this.generateUsernameFromEmail(email),
        // 🎨 OAuth 제공자 이미지 대신 랜덤 캐릭터 할당 (플랫폼 일관성 유지)
        profileImage: getRandomCharacter(),
        bio: profile.bio,
        authProvider: provider,
        providerId: profile.id,
        isEmailVerified: true,
        accountVerifiedAt: new Date(),
        // OAuth 로그인은 약관 동의를 받지 않으므로 null로 초기화
        // 프론트엔드에서 /consent 페이지로 리다이렉트하여 동의 받음
        termsAcceptedAt: null,
        privacyAcceptedAt: null,
        marketingOptIn: false,
        newsletterOptIn: false,
      });

      // Identity 생성
      await this.identityService.linkIdentity(newUser.id, {
        provider: identityProvider,
        providerId: profile.id,
        email,
        providerData: {
          name: profile.displayName || profile.username,
          picture: profile.profileImage || profile.photos?.[0]?.value,
          bio: profile.bio,
        },
      });

      // 블로그 자동 생성
      const blog = await this.createUserBlog(newUser);

      this.logger.log(
        `New OAuth user created with blog: ${newUser.email} via ${provider}`,
      );
      return this.generateTokenResponse(newUser, blog);
    } catch (error) {
      this.logger.error(
        `OAuth validation failed for ${provider}:`,
        error.message,
      );
      throw error;
    }
  }

  async refreshTokens(
    refreshToken: string,
    context: RefreshSessionContext = {},
  ): Promise<AuthResponse> {
    try {
      // Refresh Token 검증
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });

      if (payload.tokenType !== "refresh") {
        this.logger.warn("Invalid token type in refresh token");
        throw new UnauthorizedException("Invalid token type");
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(`User not found or inactive: ${payload.sub}`);
        throw new UnauthorizedException("User not found or inactive");
      }

      if (payload.jti) {
        const { tokens } = await this.rotateRefreshSession(
          user,
          payload.jti,
          refreshToken,
          context,
        );

        return this.buildAuthResponse(user, undefined, tokens);
      }

      // DB에는 refresh token 원문이 아닌 digest가 저장된다. 기존 배포에서
      // 남아 있을 수 있는 원문은 한 번만 허용하고, 아래 토큰 회전에서
      // digest로 교체한다.
      const refreshTokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const storedToken = user.refreshToken || "";
      const isDigestMatch =
        storedToken.length === refreshTokenHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(storedToken),
          Buffer.from(refreshTokenHash),
        );
      const isLegacyPlaintextMatch = storedToken === refreshToken;

      if (!isDigestMatch && !isLegacyPlaintextMatch) {
        this.logger.warn(`Refresh token mismatch for user: ${user.id}`);
        throw new UnauthorizedException("Invalid refresh token");
      }

      // 만료 시간 체크 (더 관대하게 처리)
      if (
        user.refreshTokenExpiresAt &&
        user.refreshTokenExpiresAt < new Date()
      ) {
        this.logger.warn(
          `Refresh token expired for user: ${user.id}, expired at: ${user.refreshTokenExpiresAt}`,
        );
        // DB의 refresh token 정리
        await this.usersService.clearRefreshToken(user.id);
        throw new UnauthorizedException("Refresh token has expired");
      }

      this.logger.log(
        `Legacy refresh token promoted to a refresh session for user: ${user.id}`,
      );
      return this.generateTokenResponse(user, undefined, context);
    } catch (error) {
      this.logger.error("Refresh token validation failed:", error.message);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    let revokedCurrentSession = false;

    if (refreshToken) {
      try {
        const payload = this.jwtService.verify(refreshToken, {
          secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        });

        if (payload.sub === userId && payload.jti) {
          const result = await this.refreshSessionRepository.update(
            { userId, jti: payload.jti, revokedAt: IsNull() },
            { revokedAt: new Date(), lastUsedAt: new Date() },
          );
          revokedCurrentSession = (result.affected || 0) > 0;
        }
      } catch (error) {
        this.logger.warn(
          `Current refresh session could not be revoked cleanly: ${error.message}`,
        );
      }
    }

    if (!revokedCurrentSession) {
      await this.refreshSessionRepository.update(
        { userId, revokedAt: IsNull() },
        { revokedAt: new Date(), lastUsedAt: new Date() },
      );
    }

    // Keep the legacy compatibility digest empty without revoking other
    // sessions that were already handled above.
    await this.usersService.clearRefreshToken(userId, false);
    this.logger.log(`User ${userId} logged out`);
  }

  async listRefreshSessions(userId: string) {
    const sessions = await this.refreshSessionRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    return sessions.map((session) => ({
      id: session.id,
      familyId: session.familyId,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    }));
  }

  async revokeRefreshSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.refreshSessionRepository.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date(), lastUsedAt: new Date() },
    );

    if (!result.affected) {
      throw new UnauthorizedException("Refresh session not found");
    }
  }

  async revokeAllRefreshSessions(userId: string): Promise<void> {
    await this.refreshSessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), lastUsedAt: new Date() },
    );
    await this.usersService.clearRefreshToken(userId);
  }

  async createSessionToken(userId: string): Promise<string> {
    // API 키 검증 후 세션 토큰 생성
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: "session",
      iat: Math.floor(Date.now() / 1000),
    };

    // 세션 토큰은 2시간 유효 (GitHub 스타일)
    return this.jwtService.sign(payload, {
      expiresIn: this.getJwtExpiresIn("JWT_SESSION_EXPIRES_IN", "2h"),
      issuer: this.getJwtIssuer(),
      audience: this.getJwtAudience(),
    });
  }

  private async generateTokenResponse(
    user: User,
    blog?: Blog | null,
    context: RefreshSessionContext = {},
  ): Promise<AuthResponse> {
    const tokens = this.createTokenPair(user);
    await this.persistRefreshSession(user.id, tokens, uuidv4(), context);

    // Keep the old digest during the migration window. New refresh tokens are
    // validated by refresh_sessions and are never accepted through this field.
    await this.usersService.updateRefreshToken(
      user.id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
    );

    return this.buildAuthResponse(user, blog, tokens);
  }

  private createTokenPair(user: User): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4();

    // 🔍 디버그: JWT 생성 시 사용되는 user.role 확인
    this.logger.debug(
      `[generateTokenResponse] Creating JWT for user - email: ${user.email}, role: "${user.role}" (type: ${typeof user.role})`,
    );

    // Access Token 생성 (짧은 수명)
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lastLoginProvider: user.lastLoginProvider || user.authProvider || "local", // UX: 현재 로그인 방법 포함
      tokenType: "access",
      jti,
      iat: now,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.getJwtExpiresIn("JWT_ACCESS_EXPIRES_IN", "15m"),
      issuer: this.getJwtIssuer(),
      audience: this.getJwtAudience(),
    });

    // Refresh Token 생성 (긴 수명)
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lastLoginProvider: user.lastLoginProvider || user.authProvider || "local", // UX: 현재 로그인 방법 포함
      tokenType: "refresh",
      jti,
      iat: now,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.getJwtExpiresIn("JWT_REFRESH_EXPIRES_IN", "7d"),
      issuer: this.getJwtIssuer(),
      audience: this.getJwtAudience(),
    });

    const refreshExpiresIn = this.configService.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
      "7d",
    );
    const refreshExpiresAt = new Date(
      Date.now() + this.parseExpiresIn(refreshExpiresIn) * 1000,
    );

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      jti,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  private matchesRefreshTokenHash(
    storedHash: string,
    refreshToken: string,
  ): boolean {
    const candidateHash = this.hashRefreshToken(refreshToken);
    return (
      storedHash.length === candidateHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(storedHash),
        Buffer.from(candidateHash),
      )
    );
  }

  private async persistRefreshSession(
    userId: string,
    tokens: TokenPair,
    familyId: string,
    context: RefreshSessionContext,
  ): Promise<RefreshSession> {
    const session = this.refreshSessionRepository.create({
      userId,
      jti: tokens.jti,
      familyId,
      tokenHash: this.hashRefreshToken(tokens.refreshToken),
      expiresAt: tokens.refreshExpiresAt,
      revokedAt: null,
      replacedBySessionId: null,
      lastUsedAt: null,
      userAgent: context.userAgent || null,
      deviceName: context.deviceName || null,
      ipAddress: context.ipAddress || null,
    });

    return this.refreshSessionRepository.save(session);
  }

  private async rotateRefreshSession(
    user: User,
    jti: string,
    refreshToken: string,
    context: RefreshSessionContext,
  ): Promise<{ tokens: TokenPair; session: RefreshSession }> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshSession);
      const current = await repository
        .createQueryBuilder("session")
        .where("session.jti = :jti", { jti })
        .andWhere("session.userId = :userId", { userId: user.id })
        .setLock("pessimistic_write")
        .getOne();

      if (
        !current ||
        !this.matchesRefreshTokenHash(current.tokenHash, refreshToken)
      ) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const now = new Date();
      if (current.revokedAt) {
        await repository.update(
          { userId: user.id, familyId: current.familyId, revokedAt: IsNull() },
          { revokedAt: now, lastUsedAt: now },
        );
        this.logger.error(
          `Refresh token reuse detected; revoked session family for user ${user.id}`,
        );
        await this.auditService?.log(
          {
            action: AuditAction.REFRESH_TOKEN_REUSE,
            entityType: "refresh_session",
            entityId: current.id,
            metadata: {
              familyId: current.familyId,
              jti: current.jti,
            },
          },
          { userId: user.id, sessionId: current.id },
        );
        throw new UnauthorizedException("Refresh token reuse detected");
      }

      if (current.expiresAt <= now) {
        current.revokedAt = now;
        current.lastUsedAt = now;
        await repository.save(current);
        throw new UnauthorizedException("Refresh token has expired");
      }

      const tokens = this.createTokenPair(user);
      const next = repository.create({
        userId: user.id,
        jti: tokens.jti,
        familyId: current.familyId,
        tokenHash: this.hashRefreshToken(tokens.refreshToken),
        expiresAt: tokens.refreshExpiresAt,
        revokedAt: null,
        replacedBySessionId: null,
        lastUsedAt: null,
        userAgent: context.userAgent || current.userAgent || null,
        deviceName: context.deviceName || current.deviceName || null,
        ipAddress: context.ipAddress || current.ipAddress || null,
      });
      const savedNext = await repository.save(next);

      current.revokedAt = now;
      current.replacedBySessionId = savedNext.id;
      current.lastUsedAt = now;
      await repository.save(current);

      return { tokens, session: savedNext };
    });
  }

  private buildAuthResponse(
    user: User,
    blog: Blog | null | undefined,
    tokens: TokenPair,
  ): AuthResponse {
    const response: AuthResponse = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "Bearer",
      expires_in: this.getTokenExpiresIn("JWT_ACCESS_EXPIRES_IN", "15m"),
      user: user.toPublicJSON(), // 보안 강화: 공개 정보만 반환
    };

    // 블로그 정보가 있으면 응답에 포함
    if (blog) {
      response.blog = {
        id: blog.id,
        slug: blog.slug,
        name: blog.name,
        description: blog.description,
        isPublic: blog.isPublic,
        createdAt: blog.createdAt,
      };
    }

    return response;
  }

  private generateUsernameFromEmail(email: string): string {
    // 이메일에서 @ 앞 부분 추출
    const emailPrefix = email.split("@")[0].toLowerCase();

    // 영문, 숫자, 언더스코어만 허용 (사용자명 규칙)
    let username = emailPrefix.replace(/[^a-z0-9_]/g, "_");

    // 너무 짧으면 랜덤 문자 추가
    if (username.length < 3) {
      const uniqueId = crypto.randomUUID().slice(0, 4);
      username = `${username}_${uniqueId}`;
    }

    // 너무 길면 자르기
    if (username.length > 20) {
      username = username.slice(0, 20);
    }

    return username;
  }

  private generateUniqueUsername(profile: any): string {
    const baseUsername =
      profile.displayName ||
      profile.username ||
      profile.name?.givenName ||
      "user";

    // UUID 일부 사용으로 고유성 보장
    const uniqueId = crypto.randomUUID().slice(0, 8);
    return `${baseUsername}_${uniqueId}`;
  }

  private getTokenExpiresIn(configKey: string, defaultValue: string): number {
    const expiresIn = this.configService.get<string>(configKey, defaultValue);
    return this.parseExpiresIn(expiresIn);
  }

  private parseExpiresIn(expiresIn: string): number {
    // 간단한 파싱 (1d = 86400초, 15m = 900초)
    if (expiresIn.includes("d")) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    }
    if (expiresIn.includes("h")) {
      return parseInt(expiresIn) * 60 * 60;
    }
    if (expiresIn.includes("m")) {
      return parseInt(expiresIn) * 60;
    }
    if (expiresIn.includes("s")) {
      return parseInt(expiresIn);
    }
    return parseInt(expiresIn) || 900;
  }

  private async createUserBlog(user: User): Promise<Blog | null> {
    try {
      // 이메일에서 @ 앞 부분 추출
      const emailPrefix = user.email.split("@")[0].toLowerCase();

      // slug 규칙에 맞게 변환 (영문 소문자, 숫자, 하이픈만 허용)
      let slug = emailPrefix
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      // slug가 비어있거나 너무 짧으면 기본값 사용
      if (!slug || slug.length < 3) {
        slug = `user-${user.id.slice(0, 8)}`;
      }

      // slug 중복 확인 및 고유하게 만들기
      let finalSlug = slug;
      while (!(await this.blogsService.checkSlugAvailability(finalSlug))) {
        // 알파벳 랜덤 4자리 생성 (a-z)
        const randomSuffix = Array.from({ length: 4 }, () =>
          String.fromCharCode(97 + Math.floor(Math.random() * 26)),
        ).join("");
        finalSlug = `${slug}-${randomSuffix}`;
      }

      // 블로그 생성
      const blog = await this.blogsService.create(
        {
          slug: finalSlug,
          name: user.username || emailPrefix,
          description: `${user.username || emailPrefix}님의 블로그입니다.`,
        },
        user,
      );

      this.logger.log(
        `Blog created automatically for user: ${user.email} with slug: ${finalSlug}`,
      );
      return blog;
    } catch (error) {
      // 블로그 생성 실패는 회원가입을 막지 않음 (로그만 남김)
      this.logger.error(
        `Failed to create blog for user ${user.email}:`,
        error.message,
      );
      return null;
    }
  }

  // Password Reset Methods
  async forgotPassword(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Security: Don't reveal if email exists
    if (!user) {
      this.logger.log(
        `Password reset attempted for non-existent email: ${email}`,
      );
      return;
    }

    // Check if OAuth user
    if (user.authProvider !== AuthProvider.LOCAL) {
      this.logger.log(`Password reset attempted for OAuth user: ${email}`);
      throw new BadRequestException(
        "소셜 로그인 계정은 비밀번호 재설정이 필요하지 않습니다",
      );
    }

    // Clean up expired tokens
    await this.passwordResetTokenRepository.delete({
      userId: user.id,
      expiresAt: LessThan(new Date()),
    });

    // Check for recent requests (rate limiting)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await this.passwordResetTokenRepository.findOne({
      where: {
        userId: user.id,
        createdAt: MoreThan(fiveMinutesAgo), // Fixed: MoreThan to check recent tokens
      },
    });

    if (recentToken) {
      this.logger.warn(`Too many password reset requests for user: ${email}`);
      return; // Silently ignore to prevent email bombing
    }

    // Generate secure token
    const token = uuidv4();
    const hashedToken = crypto
      .createHmac("sha256", this.configService.get("JWT_SECRET"))
      .update(token)
      .digest("hex");

    // Save token with 15 minutes expiry
    const resetToken = this.passwordResetTokenRepository.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress,
      userAgent,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    // Send email (implementation in EmailService)
    const resetUrl = `${this.configService.get("FRONTEND_URL")}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.username,
      resetUrl,
    );

    this.logger.log(`Password reset email sent to: ${email}`);
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
        expiresAt: MoreThan(new Date()), // Fixed: MoreThan instead of LessThan
      },
    });

    return !!resetToken;
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const user = await this.usersService.findByEmail(email);
    return { exists: !!user };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto
      .createHmac("sha256", this.configService.get("JWT_SECRET"))
      .update(token)
      .digest("hex");

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        token: hashedToken,
        used: false,
      },
      relations: ["user"],
    });

    if (!resetToken) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException("Reset token has expired");
    }

    // Check if new password matches the current password
    if (resetToken.user.password) {
      const isSamePassword =
        await resetToken.user.validatePassword(newPassword);
      if (isSamePassword) {
        throw new BadRequestException(
          "기존 비밀번호와 다른 비밀번호를 입력해주세요",
        );
      }
    }

    // Update password
    await this.usersService.updatePassword(resetToken.userId, newPassword);

    // Mark token as used
    resetToken.used = true;
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    // Clear all other tokens for this user
    await this.passwordResetTokenRepository.delete({
      userId: resetToken.userId,
      id: resetToken.id, // Exclude current token
    });

    this.logger.log(
      `Password reset successful for user: ${resetToken.user.email}`,
    );
  }

  /**
   * OAuth 로그인 후 약관 동의 완료 처리
   * 소셜 로그인 사용자가 최초 로그인 시 필수 약관 동의를 받은 후 호출
   */
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
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException("User not found");
    }

    // 이미 약관 동의가 완료된 경우
    if (user.termsAcceptedAt && user.privacyAcceptedAt) {
      this.logger.warn(`User ${userId} already completed consent`);
      return;
    }

    if (
      consentDto.isOver14 !== true ||
      consentDto.termsAccepted !== true ||
      consentDto.privacyAccepted !== true
    ) {
      throw new BadRequestException(
        "Required consent must be explicitly accepted before continuing",
      );
    }

    // 약관 동의 정보 업데이트
    await this.usersService.update(userId, {
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      marketingOptIn: consentDto.marketingOptIn || false,
      marketingOptInAt: consentDto.marketingOptIn ? new Date() : null,
      newsletterOptIn: consentDto.newsletterOptIn || false,
    });

    this.logger.log(`Consent updated for OAuth user: ${user.email}`);
  }

  /**
   * 비밀번호 변경 (로그인한 사용자)
   * 현재 비밀번호를 확인하고 새 비밀번호로 변경
   *
   * @param userId - 사용자 ID
   * @param currentPassword - 현재 비밀번호
   * @param newPassword - 새 비밀번호
   * @throws UnauthorizedException - 현재 비밀번호가 일치하지 않을 경우
   * @throws BadRequestException - 사용자를 찾을 수 없거나 소셜 로그인 계정인 경우
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // 사용자 조회
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException("사용자를 찾을 수 없습니다");
    }

    // 소셜 로그인 계정 체크 (비밀번호가 없음)
    // providerId가 null이 아니면 소셜 로그인 계정 (Google, Kakao, GitHub 등)
    if (user.providerId) {
      throw new BadRequestException(
        "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다",
      );
    }

    // 현재 비밀번호 검증
    const isValid = await this.validateUser(user.email, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException("현재 비밀번호가 일치하지 않습니다");
    }

    // 새 비밀번호로 업데이트
    await this.usersService.updatePassword(userId, newPassword);

    this.logger.log(`Password changed successfully for user: ${user.email}`);
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
