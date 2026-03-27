import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { User, AuthProvider } from "../entities/user.entity";
import { Profile } from "../entities/profile.entity";
import { Subscription } from "../../subscription/entities/subscription.entity";
import { AccountSettings } from "../entities/account-settings.entity";
import { Role } from "../../common/enums/role.enum";
import {
  SubscriptionTier,
  SubscriptionStatus,
} from "../../common/enums/subscription.enum";
import { CdnService } from "../../files/services/cdn.service";
import { DateUtils } from "../../common/utils/date.utils";
import {
  AuthContextResponse,
  AuthContextRawRow,
  MobileSettingsSnapshot,
  SocialLink,
} from "../users.service";
import { ThemePreference } from "../dto/update-mobile-theme-preference.dto";

@Injectable()
export class UsersQueryService {
  private readonly logger = new Logger(UsersQueryService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(AccountSettings)
    private readonly accountSettingsRepository: Repository<AccountSettings>,
    private readonly cdnService: CdnService,
    private readonly dataSource: DataSource,
  ) {}

  async getUserBlogCount(userId: string): Promise<number> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ["blog"],
    });
    return user?.blog ? 1 : 0;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      select: [
        "id",
        "email",
        "username",
        "role",
        "createdAt",
        "lastLoginAt",
        "isActive",
        "suspensionUntil",
        "suspensionReason",
        "isBanned",
        "banReason",
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });
    return { users, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ["profile", "subscription", "accountSettings", "blog"],
      select: [
        "id",
        "email",
        "username",
        "role",
        "isEmailVerified",
        "createdAt",
        "lastLoginAt",
        "isActive",
        "authProvider",
        "providerId",
        "suspensionUntil",
        "suspensionReason",
        "isBanned",
        "banReason",
        "bannedAt",
      ],
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.flattenUserRelations(user);
    this.normalizeProfileImageInObject(user);

    return user;
  }

  async getAuthContextRaw(id: string): Promise<AuthContextResponse | null> {
    const raw = await this.usersRepository
      .createQueryBuilder("u")
      .leftJoin(Profile, "profile", 'profile."userId" = u.id')
      .leftJoin(Subscription, "subscription", 'subscription."userId" = u.id')
      .leftJoin(AccountSettings, "settings", 'settings."userId" = u.id')
      .leftJoin("blogs", "blog", 'blog."userId" = u.id')
      .select([
        'u.id AS "id"',
        'u.email AS "email"',
        'u.username AS "username"',
        'u.role AS "role"',
        'u."isEmailVerified" AS "isEmailVerified"',
        'u."authProvider" AS "authProvider"',
        'u."createdAt" AS "createdAt"',
        'profile."profileImage" AS "profileImage"',
        'profile.bio AS "bio"',
        'profile."jobTitle" AS "jobTitle"',
        'profile."socialLinks" AS "socialLinks"',
        'profile."lastLoginProvider" AS "lastLoginProvider"',
        'subscription."tier" AS "subscriptionTier"',
        'subscription."status" AS "subscriptionStatus"',
        'settings."marketingOptIn" AS "marketingOptIn"',
        'settings."newsletterOptIn" AS "newsletterOptIn"',
        'settings."termsAcceptedAt" AS "termsAcceptedAt"',
        'settings."privacyAcceptedAt" AS "privacyAcceptedAt"',
        'blog.slug AS "blogSlug"',
      ])
      .where("u.id = :id", { id })
      .getRawOne<AuthContextRawRow>();

    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      email: raw.email,
      username: raw.username ?? null,
      role: raw.role,
      profileImage: this.normalizeProfileImage(raw.profileImage),
      isEmailVerified: !!raw.isEmailVerified,
      authProvider: raw.authProvider,
      lastLoginProvider: raw.lastLoginProvider ?? null,
      subscriptionTier: raw.subscriptionTier ?? null,
      subscriptionStatus: raw.subscriptionStatus ?? null,
      bio: raw.bio ?? null,
      jobTitle: raw.jobTitle ?? null,
      socialLinks: this.normalizeRawSocialLinks(raw.socialLinks),
      blogSlug: raw.blogSlug ?? null,
      termsAcceptedAt: raw.termsAcceptedAt ?? null,
      privacyAcceptedAt: raw.privacyAcceptedAt ?? null,
      marketingOptIn: !!raw.marketingOptIn,
      newsletterOptIn: !!raw.newsletterOptIn,
      createdAt: raw.createdAt,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: ["blog", "profile", "subscription", "accountSettings"],
      select: [
        "id",
        "email",
        "password",
        "username",
        "role",
        "authProvider",
        "isActive",
        "isEmailVerified",
        "isDeleted",
        "deletedAt",
        "suspensionUntil",
        "suspensionReason",
        "isBanned",
        "banReason",
        "bannedAt",
      ],
    });

    if (!user) {
      return null;
    }

    this.flattenUserRelations(user);
    this.normalizeProfileImageInObject(user);

    return user;
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    const activeUser = await this.usersRepository
      .createQueryBuilder("user")
      .select(["user.id", "user.email", "user.isDeleted", "user.deletedAt"])
      .leftJoin("user.accountSettings", "accountSettings")
      .addSelect(["accountSettings.scheduledDeletionAt"])
      .where("user.email = :email", { email })
      .getOne();

    if (activeUser) {
      return activeUser;
    }

    const auditLog = await this.dataSource
      .createQueryBuilder()
      .select('audit_log."entityId"', "userId")
      .from("audit_logs", "audit_log")
      .where("audit_log.action = :action", { action: "user_deleted" })
      .andWhere(`audit_log."previousData"->>'email' = :email`, { email })
      .orderBy('audit_log."createdAt"', "DESC")
      .limit(1)
      .getRawOne();

    if (!auditLog) {
      return null;
    }

    const deletedUser = await this.usersRepository
      .createQueryBuilder("user")
      .select(["user.id", "user.email", "user.isDeleted", "user.deletedAt"])
      .leftJoin("user.accountSettings", "accountSettings")
      .addSelect(["accountSettings.scheduledDeletionAt"])
      .where("user.id = :userId", { userId: auditLog.userId })
      .andWhere("user.isDeleted = :isDeleted", { isDeleted: true })
      .getOne();

    return deletedUser;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.usersRepository
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.username",
        "user.email",
        "user.createdAt",
        "user.isActive",
      ])
      .leftJoin("user.profile", "profile")
      .addSelect([
        "profile.bio",
        "profile.profileImage",
        "profile.jobTitle",
        "profile.socialLinks",
      ])
      .where("user.username = :username", { username })
      .getOne();

    if (user?.profile) {
      this.normalizeProfileImageInObjectProfile(user.profile);
    }

    return user;
  }

  async findByProviderId(
    providerId: string,
    provider: AuthProvider,
  ): Promise<User | null> {
    const user = await this.usersRepository
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.email",
        "user.username",
        "user.role",
        "user.isEmailVerified",
        "user.authProvider",
        "user.providerId",
      ])
      .leftJoin("user.profile", "profile")
      .addSelect([
        "profile.profileImage",
        "profile.bio",
        "profile.jobTitle",
        "profile.socialLinks",
      ])
      .where("user.providerId = :providerId", { providerId })
      .andWhere("user.authProvider = :provider", { provider })
      .getOne();

    if (user?.profile) {
      this.normalizeProfileImageInObjectProfile(user.profile);
    }

    return user;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ["role"],
    });
    return user?.role === Role.ADMIN;
  }

  async findByIdForAuth(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: [
        "id",
        "email",
        "username",
        "role",
        "isActive",
        "isDeleted",
        "authProvider",
        "isEmailVerified",
        "createdAt",
        "suspensionUntil",
        "suspensionReason",
        "isBanned",
        "banReason",
        "bannedAt",
      ],
    });
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({
      where: { isActive: true },
    });
    const adminUsers = await this.usersRepository.count({
      where: { role: Role.ADMIN },
    });

    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);

    const recentUsers = await this.usersRepository.count({
      where: { createdAt: { $gte: thirtyDaysAgo } as any },
    });

    return { totalUsers, activeUsers, adminUsers, recentUsers };
  }

  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      where: [
        { username: { $ilike: `%${query}%` } as any },
        { email: { $ilike: `%${query}%` } as any },
      ],
      select: ["id", "email", "username", "role", "createdAt", "isActive"],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    return { users, total };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ["blog", "profile", "subscription", "accountSettings"],
      select: [
        "id",
        "email",
        "username",
        "role",
        "authProvider",
        "isEmailVerified",
        "createdAt",
        "lastLoginAt",
        "isActive",
        "isDeleted",
        "deletedAt",
        "suspensionUntil",
        "suspensionReason",
        "isBanned",
        "banReason",
        "bannedAt",
      ],
    });

    if (!user) {
      return null;
    }

    this.flattenUserRelations(user);
    this.normalizeProfileImageInObject(user);

    return user;
  }

  async getMobileSettings(userId: string): Promise<MobileSettingsSnapshot> {
    const settings = await this.ensureAccountSettings(userId);
    return this.buildMobileSettingsSnapshot(settings);
  }

  async getAdultVerificationStatus(
    userId: string,
  ): Promise<{ isAdultVerified: boolean; verifiedAt?: Date }> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
      select: ["isAdultVerified", "adultVerifiedAt"],
    });

    if (!profile) {
      return { isAdultVerified: false };
    }

    return {
      isAdultVerified: profile.isAdultVerified || false,
      verifiedAt: profile.adultVerifiedAt,
    };
  }

  // --- Helper Methods ---

  private flattenUserRelations(user: User): void {
    if (user.profile) {
      user.name = user.profile.name;
      user.profileImage = user.profile.profileImage;
      user.bio = user.profile.bio;
      user.jobTitle = user.profile.jobTitle;
      user.socialLinks = user.profile.socialLinks;
      user.lastLoginProvider = user.profile.lastLoginProvider;
    }

    if (user.subscription) {
      user.subscriptionTier = user.subscription.tier;
      user.subscriptionStatus = user.subscription.status;
      user.subscriptionStartDate = user.subscription.startDate;
      user.subscriptionEndDate = user.subscription.endDate;
      user.paymentCustomerId = user.subscription.paymentCustomerId;
      user.paymentSubscriptionId = user.subscription.paymentSubscriptionId;
    }

    if (user.accountSettings) {
      user.refreshToken = user.accountSettings.refreshToken;
      user.refreshTokenExpiresAt = user.accountSettings.refreshTokenExpiresAt;
      user.marketingOptIn = user.accountSettings.marketingOptIn;
      user.newsletterOptIn = user.accountSettings.newsletterOptIn;
      user.termsAcceptedAt = user.accountSettings.termsAcceptedAt;
      user.privacyAcceptedAt = user.accountSettings.privacyAcceptedAt;
      user.primaryIdentityId = user.accountSettings.primaryIdentityId;
    }
  }

  private normalizeProfileImage(profileImage: string | null): string | null {
    if (!profileImage) return null;
    if (profileImage.startsWith("v2/") || profileImage.startsWith("uploads/")) {
      return this.cdnService.generateCdnUrlFromKey(profileImage);
    }
    return profileImage;
  }

  private normalizeProfileImageInObject(user: User): void {
    if (user.profileImage) {
      if (
        user.profileImage.startsWith("v2/") ||
        user.profileImage.startsWith("uploads/")
      ) {
        user.profileImage = this.cdnService.generateCdnUrlFromKey(
          user.profileImage,
        );
      }
    }
  }

  private normalizeProfileImageInObjectProfile(profile: Profile): void {
    if (profile.profileImage) {
      if (
        profile.profileImage.startsWith("v2/") ||
        profile.profileImage.startsWith("uploads/")
      ) {
        profile.profileImage = this.cdnService.generateCdnUrlFromKey(
          profile.profileImage,
        );
      }
    }
  }

  private normalizeRawSocialLinks(socialLinks: unknown): SocialLink[] {
    const parsed = (() => {
      if (Array.isArray(socialLinks)) return socialLinks;
      if (typeof socialLinks === "string") {
        try {
          const value = JSON.parse(socialLinks);
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      }
      return [];
    })();

    // To prevent dependency cycles from command side, we just return parsed if simple since this is query
    // Command layer handles the deep sanitization, here we just array-cast.
    return parsed as SocialLink[];
  }

  private async ensureAccountSettings(
    userId: string,
  ): Promise<AccountSettings> {
    const settings = await this.accountSettingsRepository.findOne({
      where: { userId },
    });

    if (settings) {
      return settings;
    }

    // Creating settings on the fly inside query service is technically a side-effect,
    // but preserving original behavior of `ensureAccountSettings`.
    const newSettings = this.accountSettingsRepository.create({
      userId,
      marketingOptIn: false,
      newsletterOptIn: false,
      themePreference: ThemePreference.SYSTEM,
      pushEnabled: true,
      communityReplyEnabled: true,
      profileVisible: true,
      activityVisible: true,
    });
    return this.accountSettingsRepository.save(newSettings);
  }

  private buildMobileSettingsSnapshot(
    settings: AccountSettings,
  ): MobileSettingsSnapshot {
    const normalizedTheme =
      settings.themePreference === ThemePreference.LIGHT ||
      settings.themePreference === ThemePreference.DARK
        ? settings.themePreference
        : ThemePreference.SYSTEM;

    return {
      themePreference: normalizedTheme,
      notifications: {
        pushEnabled: settings.pushEnabled ?? true,
        marketingEnabled: settings.marketingOptIn ?? false,
        communityReplyEnabled: settings.communityReplyEnabled ?? true,
      },
      privacy: {
        profileVisible: settings.profileVisible ?? true,
        activityVisible: settings.activityVisible ?? true,
      },
    };
  }
}
