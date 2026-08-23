import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, MoreThan } from "typeorm";
import { UsersService } from "../../users/users.service";
import { BlogsService } from "../../blogs/blogs.service";
import { EmailService } from "../../email/email.service";
import { IdentityService } from "../../users/services/identity.service";
import { User, AuthProvider } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { IdentityProvider } from "../../users/entities/user-identity.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { LoginDto } from "../dto/login.dto";
import { RegisterDto } from "../dto/register.dto";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { AuthResponse } from "../interfaces/auth-response.interface";
import { parseJwtExpiresIn } from "../../config/jwt.config";
import { AuditContext, AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  getRandomCharacter,
  isOAuthProviderImage,
} from "../../common/utils/character.util";

@Injectable()
export class AuthCommandService {
  private readonly logger = new Logger(AuthCommandService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly blogsService: BlogsService,
    private readonly emailService: EmailService,
    private readonly identityService: IdentityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private getJwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "codebase.blog");
  }

  private getJwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "codebase.blog::api");
  }

  private formatDate(value: Date): string {
    return value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  private formatDateTime(value: Date): string {
    return value.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  private getSuspensionMessage(suspensionEnd: Date): string {
    return `Your account is suspended until ${this.formatDateTime(suspensionEnd)}.`;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);

      this.logger.debug(
        `[validateUser] Retrieved user from DB - email: ${email}, role: "${user?.role}" (type: ${typeof user?.role})`,
      );

      if (!user) {
        return null;
      }

      await this.usersService.refreshUserStatus(user);

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
            `This account has been deleted. You can create a new account 30 days after deletion. ` +
            (remainingDays > 0
              ? `You can register again in ${remainingDays} day(s).`
              : `Please register again from the sign-up page.`),
          error: "Unauthorized",
          code: "ACCOUNT_DELETED",
          remainingDays,
        });
      }

      if (user.isBanned) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: "This account has been permanently banned. Contact support for assistance.",
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
          message: this.getSuspensionMessage(suspensionEnd),
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
          message: "This account is inactive. Contact support for assistance.",
          error: "Unauthorized",
          code: "ACCOUNT_INACTIVE",
        });
      }

      if (!user.password) {
        return null;
      }

      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return null;
      }

      await this.usersService.updateLastLogin(user.id, "local");

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

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException(
        "The email address or password is incorrect.",
      );
    }

    return this.generateTokenResponse(user);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
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

    if (!emailVerificationToken) {
      throw new BadRequestException(
        "Email verification is required before you can sign up.",
      );
    }

    const isVerified = await this.emailService.checkVerificationStatus(
      email,
      emailVerificationToken,
    );
    if (!isVerified) {
      throw new BadRequestException(
        "The email verification token is invalid or expired.",
      );
    }

    const existingUser =
      await this.usersService.findByEmailIncludingDeleted(email);

    if (existingUser) {
      if (!existingUser.isDeleted) {
        throw new ConflictException(
          "An account with this email already exists. Please sign in instead.",
        );
      }

      const now = new Date();
      const deletedAt = new Date(existingUser.deletedAt);
      const daysSinceDeletion = Math.floor(
        (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const WAITING_PERIOD_DAYS = 30;

      if (daysSinceDeletion < WAITING_PERIOD_DAYS) {
        const remainingDays = WAITING_PERIOD_DAYS - daysSinceDeletion;
        const availableDate = new Date(deletedAt);
        availableDate.setDate(availableDate.getDate() + WAITING_PERIOD_DAYS);

        throw new ConflictException(
          `You can only re-register ${WAITING_PERIOD_DAYS} days after account deletion. ` +
            `Try again in ${remainingDays} day(s) on ${this.formatDate(availableDate)}.`,
        );
      }

      this.logger.log(
        `User ${email} deleted ${daysSinceDeletion} days ago. ` +
          `Allowing re-registration (old account ID: ${existingUser.id})`,
      );
    }

    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException(
        `'${username}' is already taken. Choose a different username.`,
      );
    }

    try {
      const user = await this.usersService.create({
        email,
        username,
        password,
        profileImage: getRandomCharacter(),
        authProvider: AuthProvider.LOCAL,
        isEmailVerified: true,
        termsAcceptedAt: termsAccepted ? new Date() : null,
        privacyAcceptedAt: privacyAccepted ? new Date() : null,
        marketingOptIn: marketingOptIn || false,
        marketingOptInAt: marketingOptIn ? new Date() : null,
        newsletterOptIn: newsletterOptIn || false,
      });

      const blog = await this.createUserBlog(user);

      this.logger.log(`New user registered with blog: ${email}`);
      return this.generateTokenResponse(user, blog);
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
      const email = profile.email || profile.emails?.[0]?.value;

      if (!email) {
        this.logger.error(`OAuth ${provider} failed to get email from profile`);
        throw new BadRequestException(
          `We could not read an email address from your ${provider} account. ` +
            `Make sure email sharing is enabled in your ${provider} settings.`,
        );
      }

      const existingIdentity = await this.identityService.findByProviderId(
        profile.id,
        identityProvider,
      );

      if (existingIdentity) {
        this.logger.log(
          `Existing ${provider} identity found for user ${existingIdentity.userId}`,
        );

        await this.identityService.updateLastUsed(existingIdentity.id);
        const user = await this.usersService.findById(existingIdentity.userId);

        this.logger.debug(
          `[validateOAuthUser] Found user by identity - email: ${user.email}, isBanned: ${user.isBanned}, suspensionUntil: ${user.suspensionUntil}`,
        );

        if (user.isBanned) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "This account has been permanently banned. Contact support for assistance.",
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
            message: this.getSuspensionMessage(suspensionEnd),
            error: "Unauthorized",
            code: "ACCOUNT_SUSPENDED",
            reason: user.suspensionReason,
            suspensionUntil: suspensionEnd,
            remainingDays,
          });
        }

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
              `This account has been deleted. ` +
              (remainingDays > 0
                ? `You can register again ${remainingDays} day(s) from now.`
                : `If you want to use Codebase again, please sign up for a new account.`),
            error: "Unauthorized",
            code: "ACCOUNT_DELETED",
            remainingDays,
          });
        }

        const userBlogs = await this.blogsService.findByUserId(user.id);
        let blog: Blog | null = null;

        if (!userBlogs || userBlogs.length === 0) {
          blog = await this.createUserBlog(user);
          this.logger.log(
            `Blog automatically created for returning OAuth user: ${user.email}`,
          );
        } else {
          blog = userBlogs[0];
        }

        await this.usersService.updateLastLogin(user.id, provider);
        return this.generateTokenResponse(user, blog);
      }

      const existingUser =
        await this.usersService.findByEmailIncludingDeleted(email);

      if (existingUser) {
        this.logger.debug(
          `[validateOAuthUser] Found existing user - email: ${email}, isDeleted: ${existingUser.isDeleted}, isBanned: ${existingUser.isBanned}, suspensionUntil: ${existingUser.suspensionUntil}`,
        );

        if (existingUser.isBanned) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "This account has been permanently banned. Contact support for assistance.",
            error: "Unauthorized",
            code: "ACCOUNT_BANNED",
            reason: existingUser.banReason,
            bannedAt: existingUser.bannedAt,
          });
        }

        if (
          existingUser.suspensionUntil &&
          new Date(existingUser.suspensionUntil).getTime() > Date.now()
        ) {
          const suspensionEnd = new Date(existingUser.suspensionUntil);
          const remainingMs = suspensionEnd.getTime() - Date.now();
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          throw new UnauthorizedException({
            statusCode: 401,
            message: this.getSuspensionMessage(suspensionEnd),
            error: "Unauthorized",
            code: "ACCOUNT_SUSPENDED",
            reason: existingUser.suspensionReason,
            suspensionUntil: suspensionEnd,
            remainingDays,
          });
        }

        if (!existingUser.isActive && !existingUser.isDeleted) {
          throw new UnauthorizedException({
            statusCode: 401,
            message: "This account is inactive. Contact support for assistance.",
            error: "Unauthorized",
            code: "ACCOUNT_INACTIVE",
          });
        }

        if (existingUser.isDeleted) {
          const now = new Date();
          const deletedAt = new Date(existingUser.deletedAt);
          const daysSinceDeletion = Math.floor(
            (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          const WAITING_PERIOD_DAYS = 30;

          if (daysSinceDeletion < WAITING_PERIOD_DAYS) {
            const remainingDays = WAITING_PERIOD_DAYS - daysSinceDeletion;
            const availableDate = new Date(deletedAt);
            availableDate.setDate(
              availableDate.getDate() + WAITING_PERIOD_DAYS,
            );

            throw new UnauthorizedException({
              statusCode: 401,
              message:
                `You can only access this account ${WAITING_PERIOD_DAYS} days after deletion. ` +
                `Try again in ${remainingDays} day(s) on ${this.formatDate(availableDate)}.`,
              error: "Unauthorized",
              code: "ACCOUNT_DELETED",
              remainingDays,
            });
          }

          throw new UnauthorizedException({
            statusCode: 401,
            message:
              "This account has been deleted. If you want to use Codebase again, please sign up for a new account.",
            error: "Unauthorized",
            code: "ACCOUNT_DELETED",
            remainingDays: 0,
          });
        }

        if (
          existingUser.isEmailVerified ||
          this.identityService.isTrustedProvider(identityProvider)
        ) {
          await this.identityService.linkIdentity(existingUser.id, {
            provider: identityProvider,
            providerId: profile.id,
            email,
            providerData: {
              name: profile.displayName || profile.username,
              picture: profile.profileImage || profile.photos?.[0]?.value,
              bio: profile.bio,
            },
          });

          if (!existingUser.isEmailVerified) {
            await this.usersService.update(existingUser.id, {
              isEmailVerified: true,
              accountVerifiedAt: new Date(),
            });
            this.logger.log(
              `Email automatically verified through ${provider} OAuth for: ${email}`,
            );
          }

          if (!existingUser.profileImage) {
            const newCharacter = getRandomCharacter();
            await this.usersService.update(existingUser.id, {
              profileImage: newCharacter,
            });
            this.logger.log(
              `Assigned random character (${newCharacter}) to user ${existingUser.email}`,
            );
          }

          const userBlogs = await this.blogsService.findByUserId(
            existingUser.id,
          );
          let blog: Blog | null = null;

          if (!userBlogs || userBlogs.length === 0) {
            blog = await this.createUserBlog(existingUser);
            this.logger.log(
              `Blog automatically created for existing user during OAuth link: ${email}`,
            );
          } else {
            blog = userBlogs[0];
          }

          this.logger.log(
            `${provider} identity linked to existing account: ${email}`,
          );
          await this.usersService.updateLastLogin(existingUser.id, provider);
          return this.generateTokenResponse(existingUser, blog);
        } else {
          throw new ConflictException({
            code: "MANUAL_LINK_REQUIRED",
            message: `This email is already registered. Sign in with your existing method first, then connect your ${provider} account.`,
            existingProvider: existingUser.authProvider || "email",
          });
        }
      }

      const newUser = await this.usersService.create({
        email,
        username: profile.username || this.generateUsernameFromEmail(email),
        profileImage: getRandomCharacter(),
        bio: profile.bio,
        authProvider: provider,
        providerId: profile.id,
        isEmailVerified: true,
        accountVerifiedAt: new Date(),
        termsAcceptedAt: null,
        privacyAcceptedAt: null,
        marketingOptIn: false,
        newsletterOptIn: false,
      });

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

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
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

      if (user.refreshToken !== refreshToken) {
        this.logger.warn(`Refresh token mismatch for user: ${user.id}`);
        throw new UnauthorizedException("Invalid refresh token");
      }

      if (
        user.refreshTokenExpiresAt &&
        user.refreshTokenExpiresAt < new Date()
      ) {
        this.logger.warn(
          `Refresh token expired for user: ${user.id}, expired at: ${user.refreshTokenExpiresAt}`,
        );
        await this.usersService.clearRefreshToken(user.id);
        throw new UnauthorizedException("Refresh token has expired");
      }

      this.logger.log(`Token refreshed successfully for user: ${user.id}`);
      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error("Refresh token validation failed:", error.message);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
    this.logger.log(`User ${userId} logged out`);
  }

  async createSessionToken(userId: string): Promise<string> {
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

    return this.jwtService.sign(payload, {
      expiresIn: parseJwtExpiresIn(
        this.configService.get<string>("JWT_SESSION_EXPIRES_IN", "2h"),
      ),
      issuer: this.getJwtIssuer(),
      audience: this.getJwtAudience(),
    });
  }

  private async generateTokenResponse(
    user: User,
    blog?: Blog | null,
  ): Promise<AuthResponse> {
    const now = Math.floor(Date.now() / 1000);

    this.logger.debug(
      `[generateTokenResponse] Creating JWT for user - email: ${user.email}, role: "${user.role}" (type: ${typeof user.role})`,
    );

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lastLoginProvider: user.lastLoginProvider || user.authProvider || "local",
      tokenType: "access",
      iat: now,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: parseJwtExpiresIn(
        this.configService.get<string>("JWT_ACCESS_EXPIRES_IN", "1d"),
      ),
      issuer: this.getJwtIssuer(),
      audience: this.getJwtAudience(),
    });

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lastLoginProvider: user.lastLoginProvider || user.authProvider || "local",
      tokenType: "refresh",
      iat: now,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: parseJwtExpiresIn(
        this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
      ),
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

    this.logger.log(
      `Saving refresh token for user ${user.id}, expires at: ${refreshExpiresAt}`,
    );
    await this.usersService.updateRefreshToken(
      user.id,
      refreshToken,
      refreshExpiresAt,
    );

    const response: AuthResponse = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: this.getTokenExpiresIn("JWT_ACCESS_EXPIRES_IN", "1d"),
      user: user.toPublicJSON(),
    };

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
    const emailPrefix = email.split("@")[0].toLowerCase();
    let username = emailPrefix.replace(/[^a-z0-9_]/g, "_");

    if (username.length < 3) {
      const uniqueId = crypto.randomUUID().slice(0, 4);
      username = `${username}_${uniqueId}`;
    }

    if (username.length > 20) {
      username = username.slice(0, 20);
    }

    return username;
  }

  private getTokenExpiresIn(configKey: string, defaultValue: string): number {
    const expiresIn = this.configService.get<string>(configKey, defaultValue);
    return this.parseExpiresIn(expiresIn);
  }

  private parseExpiresIn(expiresIn: string): number {
    if (expiresIn.includes("d")) return parseInt(expiresIn) * 24 * 60 * 60;
    if (expiresIn.includes("h")) return parseInt(expiresIn) * 60 * 60;
    if (expiresIn.includes("m")) return parseInt(expiresIn) * 60;
    if (expiresIn.includes("s")) return parseInt(expiresIn);
    return parseInt(expiresIn) || 900;
  }

  private async createUserBlog(user: User): Promise<Blog | null> {
    try {
      const emailPrefix = user.email.split("@")[0].toLowerCase();
      let slug = emailPrefix
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!slug || slug.length < 3) {
        slug = `user-${user.id.slice(0, 8)}`;
      }

      let finalSlug = slug;
      while (!(await this.blogsService.checkSlugAvailability(finalSlug))) {
        const randomSuffix = Array.from({ length: 4 }, () =>
          String.fromCharCode(97 + Math.floor(Math.random() * 26)),
        ).join("");
        finalSlug = `${slug}-${randomSuffix}`;
      }

      const blog = await this.blogsService.create(
        {
          slug: finalSlug,
          name: user.username || emailPrefix,
          description: `Posts and resources published by ${user.username || emailPrefix}.`,
        },
        user,
      );

      this.logger.log(
        `Blog created automatically for user: ${user.email} with slug: ${finalSlug}`,
      );
      return blog;
    } catch (error) {
      this.logger.error(
        `Failed to create blog for user ${user.email}:`,
        error.message,
      );
      return null;
    }
  }

  async forgotPassword(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.log(
        `Password reset attempted for non-existent email: ${email}`,
      );
      return;
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      this.logger.log(`Password reset attempted for OAuth user: ${email}`);
      throw new BadRequestException(
        "Social sign-in accounts do not use password reset.",
      );
    }

    await this.passwordResetTokenRepository.delete({
      userId: user.id,
      expiresAt: LessThan(new Date()),
    });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await this.passwordResetTokenRepository.findOne({
      where: {
        userId: user.id,
        createdAt: MoreThan(fiveMinutesAgo),
      },
    });

    if (recentToken) {
      this.logger.warn(`Too many password reset requests for user: ${email}`);
      return;
    }

    const token = uuidv4();
    const hashedToken = crypto
      .createHmac("sha256", this.configService.get("JWT_SECRET"))
      .update(token)
      .digest("hex");

    const resetToken = this.passwordResetTokenRepository.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      ipAddress,
      userAgent,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    const resetUrl = `${this.configService.get("FRONTEND_URL")}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.username,
      resetUrl,
    );

    this.logger.log(`Password reset email sent to: ${email}`);
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

    if (resetToken.user.password) {
      const isSamePassword =
        await resetToken.user.validatePassword(newPassword);
      if (isSamePassword) {
        throw new BadRequestException(
          "Enter a new password that is different from your current password.",
        );
      }
    }

    await this.usersService.updatePassword(resetToken.userId, newPassword);

    resetToken.used = true;
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    await this.passwordResetTokenRepository.delete({
      userId: resetToken.userId,
      id: resetToken.id,
    });

    this.logger.log(
      `Password reset successful for user: ${resetToken.user.email}`,
    );
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
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (user.termsAcceptedAt && user.privacyAcceptedAt) {
      this.logger.warn(`User ${userId} already completed consent`);
      return;
    }

    await this.usersService.update(userId, {
      termsAcceptedAt: consentDto.termsAccepted ? new Date() : null,
      privacyAcceptedAt: consentDto.privacyAccepted ? new Date() : null,
      marketingOptIn: consentDto.marketingOptIn || false,
      marketingOptInAt: consentDto.marketingOptIn ? new Date() : null,
      newsletterOptIn: consentDto.newsletterOptIn || false,
    });

    this.logger.log(`Consent updated for OAuth user: ${user.email}`);
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
    await this.auditService.log(
      {
        action: AuditAction.COOKIE_CONSENT_UPDATED,
        entityType: "cookie_consent",
        entityId: userId,
        newData: {
          essential: true,
          analytics: consentDto.analyticsEnabled,
          policyVersion: consentDto.policyVersion,
        },
        metadata: {
          source: consentDto.source || "klaro",
          storage: "cookie",
        },
      },
      context,
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException("User not found.");
    }

    if (user.providerId) {
      throw new BadRequestException(
        "Social sign-in accounts cannot change a password.",
      );
    }

    const isValid = await this.validateUser(user.email, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException("Your current password is incorrect.");
    }

    await this.usersService.updatePassword(userId, newPassword);

    this.logger.log(`Password changed successfully for user: ${user.email}`);
  }
}
