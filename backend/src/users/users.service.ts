import { Injectable, Logger } from "@nestjs/common";
import { User, AuthProvider } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ThemePreference } from "./dto/update-mobile-theme-preference.dto";
import { UpdateMobileNotificationPreferencesDto } from "./dto/update-mobile-notification-preferences.dto";
import { UpdateMobilePrivacyPreferencesDto } from "./dto/update-mobile-privacy-preferences.dto";
import { UsersQueryService } from "./services/users-query.service";
import { UsersCommandService } from "./services/users-command.service";

// types exported from users.service.ts
export interface MobileSettingsSnapshot {
  themePreference: ThemePreference;
  notifications: {
    pushEnabled: boolean;
    marketingEnabled: boolean;
    communityReplyEnabled: boolean;
  };
  privacy: {
    profileVisible: boolean;
    activityVisible: boolean;
  };
}

export type SocialLink = { platform: string; url: string };

export interface AuthContextRawRow {
  id: string;
  email: string;
  username: string | null;
  role: string;
  isEmailVerified: boolean;
  authProvider: AuthProvider;
  createdAt: Date;
  profileImage: string | null;
  bio: string | null;
  jobTitle: string | null;
  socialLinks: unknown;
  lastLoginProvider: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  marketingOptIn: boolean | null;
  newsletterOptIn: boolean | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  blogSlug: string | null;
}

export interface AuthContextResponse {
  id: string;
  email: string;
  username: string | null;
  role: string;
  profileImage: string | null;
  isEmailVerified: boolean;
  authProvider: AuthProvider;
  lastLoginProvider: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  bio: string | null;
  jobTitle: string | null;
  socialLinks: SocialLink[];
  blogSlug: string | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  marketingOptIn: boolean;
  newsletterOptIn: boolean;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersQueryService: UsersQueryService,
    private readonly usersCommandService: UsersCommandService,
  ) {}

  // --- QUERY METHODS ---

  async getUserBlogCount(userId: string): Promise<number> {
    return this.usersQueryService.getUserBlogCount(userId);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    return this.usersQueryService.findAll(page, limit);
  }

  async findOne(id: string): Promise<User> {
    return this.usersQueryService.findOne(id);
  }

  async getAuthContextRaw(id: string): Promise<AuthContextResponse | null> {
    return this.usersQueryService.getAuthContextRaw(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersQueryService.findByEmail(email);
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.usersQueryService.findByEmailIncludingDeleted(email);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersQueryService.findByUsername(username);
  }

  async findByProviderId(
    providerId: string,
    provider: AuthProvider,
  ): Promise<User | null> {
    return this.usersQueryService.findByProviderId(providerId, provider);
  }

  async isAdmin(userId: string): Promise<boolean> {
    return this.usersQueryService.isAdmin(userId);
  }

  async findByIdForAuth(id: string): Promise<User | null> {
    return this.usersQueryService.findByIdForAuth(id);
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    return this.usersQueryService.getUserStats();
  }

  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    return this.usersQueryService.searchUsers(query, page, limit);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersQueryService.findById(id);
  }

  async getMobileSettings(userId: string): Promise<MobileSettingsSnapshot> {
    return this.usersQueryService.getMobileSettings(userId);
  }

  async getAdultVerificationStatus(
    userId: string,
  ): Promise<{ isAdultVerified: boolean; verifiedAt?: Date }> {
    return this.usersQueryService.getAdultVerificationStatus(userId);
  }

  // --- COMMAND METHODS ---

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.usersCommandService.create(createUserDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return this.usersCommandService.update(id, updateUserDto);
  }

  async updateLastLogin(id: string, provider?: string): Promise<void> {
    return this.usersCommandService.updateLastLogin(id, provider);
  }

  async deactivate(id: string): Promise<void> {
    return this.usersCommandService.deactivate(id);
  }

  async activate(id: string): Promise<void> {
    return this.usersCommandService.activate(id);
  }

  async remove(id: string): Promise<void> {
    return this.usersCommandService.remove(id);
  }

  async banUser(id: string): Promise<void> {
    return this.usersCommandService.banUser(id);
  }

  async refreshUserStatus(user: User | null): Promise<User | null> {
    return this.usersCommandService.refreshUserStatus(user);
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.usersCommandService.updateRefreshToken(
      id,
      refreshToken,
      expiresAt,
    );
  }

  async clearRefreshToken(id: string): Promise<void> {
    return this.usersCommandService.clearRefreshToken(id);
  }

  async updatePassword(
    userId: number | string,
    newPassword: string,
  ): Promise<void> {
    return this.usersCommandService.updatePassword(userId, newPassword);
  }

  async softDelete(userId: string): Promise<void> {
    return this.usersCommandService.softDelete(userId);
  }

  async permanentDelete(userId: string): Promise<void> {
    return this.usersCommandService.permanentDelete(userId);
  }

  async updateMarketingPreferences(
    userId: string,
    preferences: { marketingOptIn?: boolean; newsletterOptIn?: boolean },
  ): Promise<User> {
    return this.usersCommandService.updateMarketingPreferences(
      userId,
      preferences,
    );
  }

  async updateMobileThemePreference(
    userId: string,
    themePreference: ThemePreference,
  ): Promise<MobileSettingsSnapshot> {
    return this.usersCommandService.updateMobileThemePreference(
      userId,
      themePreference,
    );
  }

  async updateMobileNotificationPreferences(
    userId: string,
    preferences: UpdateMobileNotificationPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    return this.usersCommandService.updateMobileNotificationPreferences(
      userId,
      preferences,
    );
  }

  async updateMobilePrivacyPreferences(
    userId: string,
    preferences: UpdateMobilePrivacyPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    return this.usersCommandService.updateMobilePrivacyPreferences(
      userId,
      preferences,
    );
  }

  async verifyAdult(
    userId: string,
    birthdate: string,
  ): Promise<{ verified: boolean; verifiedAt?: Date; message: string }> {
    return this.usersCommandService.verifyAdult(userId, birthdate);
  }
}
