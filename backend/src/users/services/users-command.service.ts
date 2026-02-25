import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as bcrypt from "bcrypt";
import { User } from "../entities/user.entity";
import { Profile } from "../entities/profile.entity";
import { Subscription } from "../entities/subscription.entity";
import { AccountSettings } from "../entities/account-settings.entity";
import { Post } from "../../posts/entities/post.entity";
import { Comment } from "../../comments/entities/comment.entity";
import { Role } from "../../common/enums/role.enum";
import {
  SubscriptionTier,
  SubscriptionStatus,
} from "../../common/enums/subscription.enum";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { CacheInvalidationEvents } from "../../common/events/cache.events";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";
import { UsersQueryService } from "./users-query.service";
import { ThemePreference } from "../dto/update-mobile-theme-preference.dto";
import { UpdateMobileNotificationPreferencesDto } from "../dto/update-mobile-notification-preferences.dto";
import { UpdateMobilePrivacyPreferencesDto } from "../dto/update-mobile-privacy-preferences.dto";
import { MobileSettingsSnapshot } from "../users.service";

@Injectable()
export class UsersCommandService {
  private readonly logger = new Logger(UsersCommandService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(AccountSettings)
    private readonly accountSettingsRepository: Repository<AccountSettings>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly usersQueryService: UsersQueryService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const {
        profileImage,
        bio,
        accountVerifiedAt,
        termsAcceptedAt,
        privacyAcceptedAt,
        marketingOptIn,
        marketingOptInAt,
        newsletterOptIn,
        ...userData
      } = createUserDto;

      const user = this.usersRepository.create({
        ...userData,
        profile: this.profileRepository.create({
          profileImage,
          bio,
          accountVerifiedAt,
          lastLoginProvider: null,
          accountSecurityLevel: "basic",
        }),
        subscription: this.subscriptionRepository.create({
          subscriptionTier: SubscriptionTier.FREE,
          isTrialUsed: false,
        }),
        accountSettings: this.accountSettingsRepository.create({
          termsAcceptedAt,
          privacyAcceptedAt,
          marketingOptIn: marketingOptIn || false,
          marketingOptInAt,
          newsletterOptIn: newsletterOptIn || false,
          loginAttempts: 0,
          dataRetentionYears: 3,
        }),
      });

      const savedUser = await this.usersRepository.save(user);
      this.logger.log(
        `User created with separated entities: ${savedUser.email}`,
      );
      return savedUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersQueryService.findOne(id);
    const {
      profileImage,
      bio,
      jobTitle,
      socialLinks,
      accountVerifiedAt,
      termsAcceptedAt,
      privacyAcceptedAt,
      marketingOptIn,
      marketingOptInAt,
      newsletterOptIn,
      ...userData
    } = updateUserDto;

    let processedProfileImage = profileImage;
    if (profileImage && profileImage !== user.profileImage) {
      if (!profileImage.startsWith("/character/")) {
        const timestamp = Date.now();
        processedProfileImage = `${profileImage.split("?")[0]}?v=${timestamp}`;
        this.logger.log(
          `🔄 Profile image cache busting applied: ?v=${timestamp}`,
        );
      }
    }

    if (Object.keys(userData).length > 0) {
      await this.usersRepository.update(id, userData);
    }

    const normalizedSocialLinks =
      socialLinks !== undefined
        ? this.normalizeSocialLinks(socialLinks)
        : undefined;
    const profileData: any = {};
    if (processedProfileImage !== undefined)
      profileData.profileImage = processedProfileImage;
    if (bio !== undefined) profileData.bio = bio;
    if (jobTitle !== undefined) profileData.jobTitle = jobTitle;
    if (normalizedSocialLinks !== undefined)
      profileData.socialLinks = normalizedSocialLinks;
    if (accountVerifiedAt !== undefined)
      profileData.accountVerifiedAt = accountVerifiedAt;

    if (Object.keys(profileData).length > 0) {
      await this.profileRepository.update({ userId: id }, profileData);
    }

    const settingsData: any = {};
    if (termsAcceptedAt !== undefined)
      settingsData.termsAcceptedAt = termsAcceptedAt;
    if (privacyAcceptedAt !== undefined)
      settingsData.privacyAcceptedAt = privacyAcceptedAt;
    if (marketingOptIn !== undefined)
      settingsData.marketingOptIn = marketingOptIn;
    if (marketingOptInAt !== undefined)
      settingsData.marketingOptInAt = marketingOptInAt;
    if (newsletterOptIn !== undefined)
      settingsData.newsletterOptIn = newsletterOptIn;

    if (Object.keys(settingsData).length > 0) {
      await this.accountSettingsRepository.update({ userId: id }, settingsData);
    }

    this.logger.log(`User updated: ${user.email}`);

    const changes: any = {};
    if (processedProfileImage && processedProfileImage !== user.profileImage) {
      changes.profileImage = true;
    }
    if (bio !== undefined && bio !== user.bio) {
      changes.bio = true;
    }
    if (
      normalizedSocialLinks !== undefined &&
      JSON.stringify(normalizedSocialLinks ?? []) !==
        JSON.stringify(user.socialLinks ?? [])
    ) {
      changes.socialLinks = true;
    }

    if (Object.keys(changes).length > 0) {
      if (changes.profileImage) {
        this.eventEmitter.emit("user.avatar.updated", {
          userId: id,
          username: user.username,
          oldProfileImage: user.profileImage,
          newProfileImage: processedProfileImage,
        });
      }
      this.eventEmitter.emit(CacheInvalidationEvents.USER_PROFILE_UPDATED, {
        userId: id,
        username: user.username,
        changes,
      });
    }

    return this.usersQueryService.findOne(id);
  }

  async updateLastLogin(id: string, provider?: string): Promise<void> {
    await this.usersRepository.update(id, { lastLoginAt: new Date() });
    if (provider) {
      await this.profileRepository.update(
        { userId: id },
        { lastLoginProvider: provider },
      );
    }
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.usersQueryService.findOne(id);
    user.isActive = false;
    user.suspensionUntil = null;
    user.suspensionReason = null;
    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = null;
    await this.usersRepository.save(user);
    this.logger.log(`User deactivated: ${user.email}`);
  }

  async activate(id: string): Promise<void> {
    const user = await this.usersQueryService.findOne(id);
    user.isActive = true;
    user.suspensionUntil = null;
    user.suspensionReason = null;
    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = null;
    await this.usersRepository.save(user);
    this.logger.log(`User activated: ${user.email}`);
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersQueryService.findOne(id);
    await this.usersRepository.remove(user);
    this.logger.log(`User removed: ${user.email}`);
  }

  async banUser(id: string): Promise<void> {
    const user = await this.usersQueryService.findOne(id);
    user.isBanned = true;
    user.bannedAt = new Date();
    user.isActive = false;
    await this.usersRepository.save(user);
    this.logger.log(`User banned: ${user.email}`);
  }

  async refreshUserStatus(user: User | null): Promise<User | null> {
    if (!user) return user;
    if (user.suspensionUntil) {
      const suspensionEnd = new Date(user.suspensionUntil);
      if (suspensionEnd.getTime() <= Date.now()) {
        await this.usersRepository.update(user.id, {
          suspensionUntil: null,
          suspensionReason: null,
          isActive: !user.isDeleted && !user.isBanned ? true : user.isActive,
        });
        user.suspensionUntil = null;
        user.suspensionReason = null;
        if (!user.isDeleted && !user.isBanned) {
          user.isActive = true;
        }
      }
    }
    return user;
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.accountSettingsRepository.update(
      { userId: id },
      { refreshToken, refreshTokenExpiresAt: expiresAt },
    );
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.accountSettingsRepository.update(
      { userId: id },
      { refreshToken: null, refreshTokenExpiresAt: null },
    );
  }

  async updatePassword(
    userId: number | string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersQueryService.findById(String(userId));
    if (!user) throw new NotFoundException("User not found");
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(userId, { password: hashedPassword });
    await this.accountSettingsRepository.update(
      { userId: String(userId) },
      { refreshToken: null, refreshTokenExpiresAt: null },
    );
  }

  async softDelete(userId: string): Promise<void> {
    const user = await this.usersQueryService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.isDeleted) {
      this.logger.warn(`User ${userId} already deleted`);
      return;
    }

    const now = new Date();
    const retentionDays = 180;
    const scheduledDeletionAt = new Date(now);
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + retentionDays);

    await this.auditService.log(
      {
        action: AuditAction.USER_DELETED,
        entityType: "user",
        entityId: userId,
        previousData: {
          email: user.email,
          username: user.username,
          profileImage: user.profileImage,
          bio: user.bio,
          authProvider: user.authProvider,
          lastLoginProvider: user.lastLoginProvider,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
        },
        newData: { isDeleted: true, deletedAt: now, scheduledDeletionAt },
        metadata: { retentionDays, reason: "사용자 계정 삭제 요청" },
      },
      { userId },
    );

    const [postsUpdated, commentsUpdated] = await Promise.all([
      this.postRepository.update(
        { authorId: userId, isDeleted: false },
        { isDeleted: true },
      ),
      this.commentRepository.update(
        { authorId: userId, isDeleted: false },
        { isDeleted: true },
      ),
    ]);

    await this.usersRepository.update(userId, {
      isDeleted: true,
      deletedAt: now,
      email: `deleted_${userId}@deleted.local`,
      username: `deleted_${userId}`,
      password: null,
      isActive: false,
    });

    await this.profileRepository.update(
      { userId },
      { profileImage: null, bio: null },
    );
    await this.accountSettingsRepository.update(
      { userId },
      { scheduledDeletionAt, refreshToken: null, refreshTokenExpiresAt: null },
    );

    this.logger.log(
      `User ${userId} soft deleted. Soft deleted ${postsUpdated.affected} posts and ${commentsUpdated.affected} comments.`,
    );
  }

  async permanentDelete(userId: string): Promise<void> {
    const user = await this.usersQueryService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    await this.usersRepository.delete(userId);
    this.logger.log(`User ${userId} permanently deleted from database`);
  }

  async updateMarketingPreferences(
    userId: string,
    preferences: { marketingOptIn?: boolean; newsletterOptIn?: boolean },
  ): Promise<User> {
    const user = await this.usersQueryService.findOne(userId);
    const updateData: Partial<AccountSettings> = {};

    if (preferences.marketingOptIn !== undefined) {
      updateData.marketingOptIn = preferences.marketingOptIn;
      updateData.marketingOptInAt = preferences.marketingOptIn
        ? new Date()
        : null;
    }

    if (preferences.newsletterOptIn !== undefined) {
      updateData.newsletterOptIn = preferences.newsletterOptIn;
    }

    let settings = await this.accountSettingsRepository.findOne({
      where: { userId },
    });
    if (!settings) {
      const newSettings = this.accountSettingsRepository.create({
        userId,
        marketingOptIn: updateData.marketingOptIn ?? false,
        marketingOptInAt: updateData.marketingOptInAt ?? null,
        newsletterOptIn: updateData.newsletterOptIn ?? false,
      });
      settings = await this.accountSettingsRepository.save(newSettings);
    } else if (Object.keys(updateData).length > 0) {
      await this.accountSettingsRepository.update({ userId }, updateData);
      Object.assign(settings, updateData);
    }

    user.marketingOptIn = settings.marketingOptIn;
    user.newsletterOptIn = settings.newsletterOptIn;

    this.logger.log(`Marketing preferences updated for user: ${userId}`);
    return user;
  }

  async updateMobileThemePreference(
    userId: string,
    themePreference: ThemePreference,
  ): Promise<MobileSettingsSnapshot> {
    return this.updateMobileSettings(userId, { themePreference });
  }

  async updateMobileNotificationPreferences(
    userId: string,
    preferences: UpdateMobileNotificationPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    return this.updateMobileSettings(userId, {
      pushEnabled: preferences.pushEnabled,
      marketingOptIn: preferences.marketingEnabled,
      marketingOptInAt: preferences.marketingEnabled ? new Date() : null,
      communityReplyEnabled: preferences.communityReplyEnabled,
    });
  }

  async updateMobilePrivacyPreferences(
    userId: string,
    preferences: UpdateMobilePrivacyPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    return this.updateMobileSettings(userId, {
      profileVisible: preferences.profileVisible,
      activityVisible: preferences.activityVisible,
    });
  }

  private async updateMobileSettings(
    userId: string,
    data: Partial<AccountSettings>,
  ): Promise<MobileSettingsSnapshot> {
    let settings = await this.accountSettingsRepository.findOne({
      where: { userId },
    });
    if (!settings) {
      settings = this.accountSettingsRepository.create({
        userId,
        marketingOptIn: false,
        newsletterOptIn: false,
        themePreference: ThemePreference.SYSTEM,
        pushEnabled: true,
        communityReplyEnabled: true,
        profileVisible: true,
        activityVisible: true,
      });
      await this.accountSettingsRepository.save(settings);
    }
    await this.accountSettingsRepository.update({ userId }, data);
    Object.assign(settings, data);
    return this.buildMobileSettingsSnapshot(settings);
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

  async verifyAdult(
    userId: string,
    birthdate: string,
  ): Promise<{ verified: boolean; verifiedAt?: Date; message: string }> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필을 찾을 수 없습니다.");

    const birthdateDate = new Date(birthdate);
    const today = new Date();
    if (birthdateDate > today)
      throw new BadRequestException("생년월일은 미래 날짜일 수 없습니다.");

    let age = today.getFullYear() - birthdateDate.getFullYear();
    const monthDiff = today.getMonth() - birthdateDate.getMonth();
    const dayDiff = today.getDate() - birthdateDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    const isAdult = age >= 18;
    const now = new Date();

    await this.profileRepository.update(
      { userId },
      {
        birthdate: birthdateDate,
        isAdultVerified: isAdult,
        adultVerifiedAt: isAdult ? now : null,
      },
    );

    this.logger.log(
      `Adult verification for user ${userId}: age=${age}, verified=${isAdult}`,
    );

    if (isAdult) {
      return {
        verified: true,
        verifiedAt: now,
        message: "성인 인증이 완료되었습니다.",
      };
    } else {
      return {
        verified: false,
        message: `만 18세 미만은 성인 콘텐츠에 접근할 수 없습니다. (현재 나이: ${age}세)`,
      };
    }
  }

  private normalizeSocialLinks(
    links: Array<{ platform: string; url: string }>,
  ): Array<{ platform: string; url: string }> {
    if (!Array.isArray(links)) return [];
    const normalized: Array<{ platform: string; url: string }> = [];
    const seenPlatforms = new Set<string>();

    for (const link of links) {
      if (!link) continue;
      const rawPlatform =
        typeof link.platform === "string" ? link.platform.trim() : "";
      const rawUrl = typeof link.url === "string" ? link.url.trim() : "";

      if (!rawPlatform || !rawUrl) continue;

      const sanitizedPlatform = UrlSanitizerUtil.sanitizeUserInput(
        rawPlatform.toLowerCase(),
      );
      const platform = sanitizedPlatform.replace(/[^a-z0-9._-]/g, "");
      if (!platform || seenPlatforms.has(platform)) continue;

      let normalizedUrl = rawUrl;
      if (!/^https?:\/\//i.test(normalizedUrl))
        normalizedUrl = `https://${normalizedUrl}`;

      try {
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol !== "https:") continue;
        normalizedUrl = parsedUrl.toString();
      } catch {
        continue;
      }

      normalized.push({ platform, url: normalizedUrl });
      seenPlatforms.add(platform);
      if (normalized.length >= 10) break;
    }
    return normalized;
  }
}
