import { 
  Injectable, 
  ConflictException, 
  NotFoundException,
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIdentity, IdentityProvider } from '../entities/user-identity.entity';
import { User } from '../entities/user.entity';
import { EmailService } from '../../email/email.service';

export interface LinkIdentityDto {
  provider: IdentityProvider;
  providerId: string;
  email?: string;
  providerData?: any;
}

export interface IdentityInfo {
  id: string;
  provider: IdentityProvider;
  providerEmail: string;
  linkedAt: Date;
  lastUsedAt: Date;
  providerDisplayName: string;
  providerIcon: string;
  isTrusted: boolean;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(UserIdentity)
    private identityRepository: Repository<UserIdentity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  /**
   * Find identity by provider and providerId
   */
  async findByProviderId(providerId: string, provider: IdentityProvider): Promise<UserIdentity | null> {
    return this.identityRepository.findOne({
      where: { providerId, provider },
      relations: ['user'],
    });
  }

  /**
   * Find all identities for a user
   */
  async findByUserId(userId: string): Promise<UserIdentity[]> {
    return this.identityRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });
  }

  /**
   * Get formatted identity information for UI
   */
  async getUserIdentitiesInfo(userId: string): Promise<IdentityInfo[]> {
    const identities = await this.findByUserId(userId);
    
    return identities.map(identity => ({
      id: identity.id,
      provider: identity.provider,
      providerEmail: identity.providerEmail,
      linkedAt: identity.linkedAt,
      lastUsedAt: identity.lastUsedAt,
      providerDisplayName: identity.getProviderDisplayName(),
      providerIcon: identity.getProviderIcon(),
      isTrusted: identity.isTrustedProvider(),
    }));
  }

  /**
   * Link a new identity to a user
   */
  async linkIdentity(userId: string, data: LinkIdentityDto): Promise<UserIdentity> {
    this.logger.log(`Linking ${data.provider} identity to user ${userId}`);

    // Check if this identity is already linked to another user
    const existingIdentity = await this.findByProviderId(data.providerId, data.provider);
    
    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException(
        `This ${data.provider} account is already linked to another user. ` +
        `Please use a different ${data.provider} account.`
      );
    }

    if (existingIdentity && existingIdentity.userId === userId) {
      // Already linked to this user, just update lastUsedAt
      existingIdentity.updateLastUsed();
      return this.identityRepository.save(existingIdentity);
    }

    // Check if user already has this provider linked
    const userIdentities = await this.findByUserId(userId);
    const hasProvider = userIdentities.some(i => i.provider === data.provider);
    
    if (hasProvider && data.provider !== IdentityProvider.LOCAL) {
      throw new ConflictException(
        `You already have a ${data.provider} account linked. ` +
        `Please unlink the existing one first.`
      );
    }

    // Create new identity
    const identity = this.identityRepository.create({
      userId,
      provider: data.provider,
      providerId: data.providerId,
      providerEmail: data.email,
      providerData: data.providerData,
      lastUsedAt: new Date(),
    });

    const savedIdentity = await this.identityRepository.save(identity);

    // If this is the first identity, set it as primary
    if (userIdentities.length === 0) {
      await this.setPrimaryIdentity(userId, savedIdentity.id);
    }

    // Send security notification
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user?.email) {
        await this.emailService.sendAccountLinkNotification(
          user.email,
          `${data.provider} account has been successfully linked to your account.`
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to send account link notification: ${error.message}`);
    }

    this.logger.log(`Successfully linked ${data.provider} identity to user ${userId}`);
    return savedIdentity;
  }

  /**
   * Unlink an identity from a user
   */
  async unlinkIdentity(userId: string, identityId: string): Promise<void> {
    const identities = await this.findByUserId(userId);
    
    // Ensure user has at least one identity left
    if (identities.length <= 1) {
      throw new ConflictException(
        'You must have at least one login method. ' +
        'Add another login method before removing this one.'
      );
    }

    const identityToRemove = identities.find(i => i.id === identityId);
    if (!identityToRemove) {
      throw new NotFoundException('Identity not found');
    }

    // Don't allow removing local identity if it's the only verified one
    if (identityToRemove.provider === IdentityProvider.LOCAL) {
      const hasOtherVerifiedIdentity = identities.some(
        i => i.id !== identityId && i.isTrustedProvider()
      );
      
      if (!hasOtherVerifiedIdentity) {
        throw new ConflictException(
          'Cannot remove email/password login when no other verified login method exists. ' +
          'Please add a verified OAuth provider first.'
        );
      }
    }

    // Check if this is the primary identity
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.primaryIdentityId === identityId) {
      // Set a new primary identity
      const newPrimaryIdentity = identities.find(i => i.id !== identityId);
      if (newPrimaryIdentity) {
        await this.setPrimaryIdentity(userId, newPrimaryIdentity.id);
      }
    }

    await this.identityRepository.delete({ id: identityId, userId });

    // Send security notification
    try {
      if (user?.email) {
        await this.emailService.sendAccountLinkNotification(
          user.email,
          `${identityToRemove.provider} account has been unlinked from your account.`
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to send account unlink notification: ${error.message}`);
    }

    this.logger.log(`Unlinked ${identityToRemove.provider} identity from user ${userId}`);
  }

  /**
   * Set the primary identity for a user
   */
  async setPrimaryIdentity(userId: string, identityId: string): Promise<void> {
    const identity = await this.identityRepository.findOne({
      where: { id: identityId, userId }
    });

    if (!identity) {
      throw new NotFoundException('Identity not found');
    }

    await this.userRepository.update(userId, {
      primaryIdentityId: identityId,
      lastLoginProvider: identity.provider,
    });

    this.logger.log(`Set primary identity to ${identity.provider} for user ${userId}`);
  }

  /**
   * Update last used timestamp for an identity
   */
  async updateLastUsed(identityId: string): Promise<void> {
    await this.identityRepository.update(identityId, {
      lastUsedAt: new Date(),
    });
  }

  /**
   * Check if a provider is trusted (verifies email)
   */
  isTrustedProvider(provider: IdentityProvider): boolean {
    return [IdentityProvider.GOOGLE, IdentityProvider.GITHUB].includes(provider);
  }

  /**
   * Check if auto-linking is allowed for a provider and email combination
   */
  canAutoLink(provider: IdentityProvider, email: string, user: User): boolean {
    // High trust providers can always auto-link
    if (this.isTrustedProvider(provider)) {
      return true;
    }

    // Domain-specific trust
    const domainTrust = {
      '@gmail.com': IdentityProvider.GOOGLE,
      '@github.com': IdentityProvider.GITHUB,
      '@kakao.com': IdentityProvider.KAKAO,
      '@naver.com': IdentityProvider.NAVER,
    };

    for (const [domain, trustedProvider] of Object.entries(domainTrust)) {
      if (email.endsWith(domain) && provider === trustedProvider) {
        return true;
      }
    }

    // Medium trust providers can auto-link if user email is verified
    if (user.isEmailVerified) {
      return [IdentityProvider.KAKAO, IdentityProvider.NAVER].includes(provider);
    }

    return false;
  }

  /**
   * Merge identities when same email is detected
   */
  async handleIdentityMerge(
    existingUser: User,
    provider: IdentityProvider,
    providerId: string,
    email: string,
    providerData?: any
  ): Promise<UserIdentity> {
    this.logger.log(`Handling identity merge for ${email} with ${provider}`);

    // Check if auto-linking is allowed
    if (!this.canAutoLink(provider, email, existingUser)) {
      throw new ConflictException({
        code: 'MANUAL_LINK_REQUIRED',
        message: `This email is already registered. Please sign in with your existing account and link ${provider} manually.`,
        existingProvider: existingUser.authProvider || 'email',
      });
    }

    // Auto-link the identity
    const identity = await this.linkIdentity(existingUser.id, {
      provider,
      providerId,
      email,
      providerData,
    });

    // Update user verification status if needed
    if (!existingUser.isEmailVerified && this.isTrustedProvider(provider)) {
      await this.userRepository.update(existingUser.id, {
        isEmailVerified: true,
        accountVerifiedAt: new Date(),
      });
      this.logger.log(`Email automatically verified through ${provider} OAuth for ${email}`);
    }

    // Update last login provider
    await this.userRepository.update(existingUser.id, {
      lastLoginProvider: provider,
      lastLoginAt: new Date(),
    });

    return identity;
  }

  /**
   * Reclaim account when OAuth user logs in to unverified local account
   */
  async reclaimAccount(
    user: User,
    provider: IdentityProvider,
    providerId: string,
    email: string,
    providerData?: any
  ): Promise<UserIdentity> {
    this.logger.log(`Reclaiming unverified account ${email} through ${provider} OAuth`);

    if (user.isEmailVerified) {
      throw new BadRequestException('Cannot reclaim verified account');
    }

    // 중요: 미인증 계정이라도 password는 유지해야 함
    // 사용자가 나중에 이메일 인증을 완료하면 로컬 로그인도 가능해야 함
    await this.userRepository.update(user.id, {
      // password: null, // 제거 - 비밀번호는 절대 삭제하지 않음
      isEmailVerified: true,
      accountVerifiedAt: new Date(),
      // authProvider는 최초 가입 방법 유지
      lastLoginProvider: provider,  // 마지막 로그인 방법만 업데이트
      providerId: providerId,
    });

    // Link the OAuth identity
    const identity = await this.linkIdentity(user.id, {
      provider,
      providerId,
      email,
      providerData,
    });

    this.logger.log(`Successfully reclaimed account ${email} through ${provider}`);
    return identity;
  }
}