import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DateUtils } from '../common/utils/date.utils';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { Subscription } from './entities/subscription.entity';
import { AccountSettings } from './entities/account-settings.entity';
import { Role } from '../common/enums/role.enum';
import { SubscriptionTier, SubscriptionStatus } from '../common/enums/subscription.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UnifiedRedisService } from '../redis/unified-redis.service';
import { CdnService } from '../files/services/cdn.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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
    private readonly redisService: UnifiedRedisService,
    private readonly cdnService: CdnService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 사용자의 블로그 개수 조회
   */
  async getUserBlogCount(userId: string): Promise<number> {
    // 현재 사용자는 블로그를 1개만 가질 수 있음
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['blog'],
    });

    return user?.blog ? 1 : 0;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Phase 1 리팩토링: 필드를 분리된 테이블로 나누기
      const {
        // Profile 테이블 필드
        profileImage,
        bio,
        accountVerifiedAt,

        // AccountSettings 테이블 필드
        termsAcceptedAt,
        privacyAcceptedAt,
        marketingOptIn,
        marketingOptInAt,
        newsletterOptIn,

        // Users 테이블 필드 (나머지)
        ...userData
      } = createUserDto;

      // User 엔티티 생성 (cascade: true로 관련 엔티티도 함께 저장됨)
      const user = this.usersRepository.create({
        ...userData,

        // Profile 생성 (cascade)
        profile: this.profileRepository.create({
          profileImage,
          bio,
          accountVerifiedAt,
          lastLoginProvider: null, // 회원가입 시에는 null
          accountSecurityLevel: 'basic',
        }),

        // Subscription 생성 (cascade) - 기본값으로 FREE 티어
        subscription: this.subscriptionRepository.create({
          subscriptionTier: SubscriptionTier.FREE,
          subscriptionStatus: null, // 무료 사용자는 null
          isTrialUsed: false,
        }),

        // AccountSettings 생성 (cascade)
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

      this.logger.log(`User created with separated entities: ${savedUser.email}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      select: ['id', 'email', 'username', 'role', 'createdAt', 'lastLoginAt', 'isActive'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['profile', 'subscription', 'accountSettings'], // Phase 1: 분리된 테이블 조인
      select: [
        'id',
        'email',
        'username',
        'role',
        'isEmailVerified',
        'createdAt',
        'lastLoginAt',
        'isActive',
        'authProvider',               // 최초 가입 방법
        'providerId',
      ]
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Phase 1 리팩토링: 분리된 필드들을 User 객체에 flatten (Frontend 호환성)
    // profiles 테이블 필드
    if (user.profile) {
      user.profileImage = user.profile.profileImage;
      user.bio = user.profile.bio;
      user.lastLoginProvider = user.profile.lastLoginProvider;
    }

    // subscriptions 테이블 필드
    if (user.subscription) {
      user.subscriptionTier = user.subscription.subscriptionTier;
      user.subscriptionStatus = user.subscription.subscriptionStatus;
    }

    // account_settings 테이블 필드
    if (user.accountSettings) {
      user.marketingOptIn = user.accountSettings.marketingOptIn;
      user.newsletterOptIn = user.accountSettings.newsletterOptIn;
      user.termsAcceptedAt = user.accountSettings.termsAcceptedAt;
      user.privacyAcceptedAt = user.accountSettings.privacyAcceptedAt;
    }

    // 프로필 이미지를 CDN URL로 변환
    if (user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL: ${user.profileImage}`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Phase 1 리팩토링: 분리된 테이블 조인
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: ['blog', 'profile', 'subscription', 'accountSettings'],
      select: [
        'id',
        'email',
        'password',
        'username',
        'role',
        'authProvider',         // 최초 가입 방법
        'isActive',
        'isEmailVerified',
        'isDeleted',
        'deletedAt',
      ]
    });

    if (!user) {
      return null;
    }

    // Phase 1 리팩토링: 분리된 필드들을 User 객체에 flatten (Frontend 호환성)
    // profiles 테이블 필드
    if (user.profile) {
      user.profileImage = user.profile.profileImage;
      user.bio = user.profile.bio;
      user.lastLoginProvider = user.profile.lastLoginProvider;
    }

    // subscriptions 테이블 필드
    if (user.subscription) {
      user.subscriptionTier = user.subscription.subscriptionTier;
      user.subscriptionStatus = user.subscription.subscriptionStatus;
    }

    // account_settings 테이블 필드
    if (user.accountSettings) {
      user.refreshToken = user.accountSettings.refreshToken;
      user.refreshTokenExpiresAt = user.accountSettings.refreshTokenExpiresAt;
      user.marketingOptIn = user.accountSettings.marketingOptIn;
      user.newsletterOptIn = user.accountSettings.newsletterOptIn;
      user.termsAcceptedAt = user.accountSettings.termsAcceptedAt;
      user.privacyAcceptedAt = user.accountSettings.privacyAcceptedAt;
    }

    // 프로필 이미지를 CDN URL로 변환
    if (user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findByEmail): ${user.profileImage}`);
    }

    return user;
  }

  /**
   * 이메일로 사용자 조회 (삭제된 계정 포함)
   *
   * 재가입 정책 체크를 위해 삭제된 계정도 포함하여 조회합니다.
   * - 활성 계정: email 필드로 직접 검색
   * - 삭제된 계정: audit_logs의 previousData에서 원본 이메일 추적
   *
   * @param email 검색할 이메일 주소
   * @returns User 엔티티 (삭제 정보 포함) 또는 null
   */
  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    // 1. 먼저 활성 계정 검색 (일반적인 케이스)
    const activeUser = await this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.isDeleted',
        'user.deletedAt',
        'user.scheduledDeletionAt',
      ])
      .where('user.email = :email', { email })
      .getOne();

    if (activeUser) {
      return activeUser;
    }

    // 2. 활성 계정이 없으면 audit_logs에서 삭제된 계정 검색
    // 삭제된 계정은 email이 마스킹되어 있으므로 audit_logs에서 원본 이메일 추적
    const auditLog = await this.dataSource
      .createQueryBuilder()
      .select('audit_log."entityId"', 'userId')  // entityId가 삭제된 사용자의 ID
      .from('audit_logs', 'audit_log')
      .where('audit_log.action = :action', { action: 'user_deleted' })  // snake_case
      .andWhere(`audit_log."previousData"->>'email' = :email`, { email })  // PostgreSQL 대소문자 유지
      .orderBy('audit_log."createdAt"', 'DESC') // 최신 삭제 기록
      .limit(1)
      .getRawOne();

    if (!auditLog) {
      return null; // 해당 이메일로 가입/삭제된 기록 없음
    }

    // 3. audit_logs에서 찾은 userId로 삭제된 사용자 조회
    const deletedUser = await this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.isDeleted',
        'user.deletedAt',
        'user.scheduledDeletionAt',
      ])
      .where('user.id = :userId', { userId: auditLog.userId })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: true })
      .getOne();

    return deletedUser;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'bio', 'profileImage', 'createdAt', 'isActive']
    });

    // Transform profile image to CDN URL for public access
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findByUsername): ${user.profileImage}`);
    }

    return user;
  }

  async findByProviderId(providerId: string, provider: AuthProvider): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { providerId, authProvider: provider },
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'authProvider', 'providerId', 'bio']
    });

    // 프로필 이미지를 CDN URL로 변환
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findByProviderId): ${user.profileImage}`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Cache Busting: 프로필 이미지 변경 시 타임스탬프 쿼리 파라미터 추가
    // CDN 캐시 즉시 회피 (Cloudflare 최적화)
    if (updateUserDto.profileImage && updateUserDto.profileImage !== user.profileImage) {
      const timestamp = Date.now();

      // 기존 쿼리 파라미터 제거
      let cleanUrl = updateUserDto.profileImage.split('?')[0];

      // 새 타임스탬프 추가
      updateUserDto.profileImage = `${cleanUrl}?v=${timestamp}`;

      this.logger.log(`🔄 Profile image cache busting applied: ?v=${timestamp}`);
    }

    // 패스워드는 엔티티에서 자동으로 해시됨
    Object.assign(user, updateUserDto);

    const updatedUser = await this.usersRepository.save(user);
    this.logger.log(`User updated: ${updatedUser.email}`);

    // Redis 캐시 무효화 (JWT 검증 캐시)
    try {
      const cacheKey = `user_validate_${id}`;
      await this.redisService.deleteCache('sessions', cacheKey);
      this.logger.debug(`User cache invalidated: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate user cache: ${error.message}`);
      // 캐시 무효화 실패해도 업데이트는 성공으로 처리
    }

    return updatedUser;
  }

  /**
   * 마지막 로그인 시간 및 로그인 방법 업데이트
   * @param id 사용자 ID
   * @param provider 로그인 제공자 (local, google, kakao, github)
   *
   * UX 개선: 현재 세션의 로그인 방법을 기록하여
   * 계정 삭제 시 적절한 인증 방법을 요구할 수 있도록 함
   *
   * Phase 1 리팩토링:
   * - lastLoginAt: users 테이블 (코어 필드)
   * - lastLoginProvider: profiles 테이블 (프로필 필드)
   */
  async updateLastLogin(id: string, provider?: string): Promise<void> {
    // 1. lastLoginAt은 users 테이블에 저장
    await this.usersRepository.update(id, {
      lastLoginAt: new Date()
    });

    // 2. lastLoginProvider는 profiles 테이블에 저장
    if (provider) {
      await this.profileRepository.update(
        { userId: id },
        { lastLoginProvider: provider }
      );
    }
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
    
    this.logger.log(`User deactivated: ${user.email}`);
  }

  async activate(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = true;
    await this.usersRepository.save(user);
    
    this.logger.log(`User activated: ${user.email}`);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    
    this.logger.log(`User removed: ${user.email}`);
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['role']
    });
    
    return user?.role === Role.ADMIN;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({ where: { isActive: true } });
    const adminUsers = await this.usersRepository.count({ where: { role: Role.ADMIN } });
    
    // 최근 30일 가입자 - DateUtils를 사용한 일수 기반 계산
    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);
    
    const recentUsers = await this.usersRepository.count({
      where: { createdAt: { $gte: thirtyDaysAgo } as any }
    });

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      recentUsers,
    };
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      where: [
        { username: { $ilike: `%${query}%` } as any },
        { email: { $ilike: `%${query}%` } as any },
      ],
      select: ['id', 'email', 'username', 'role', 'createdAt', 'isActive'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  // UUID 지원을 위한 새로운 findById 메서드
  async findById(id: string): Promise<User | null> {
    // Phase 1 리팩토링: 분리된 테이블 조인
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['blog', 'profile', 'subscription', 'accountSettings'],
      select: [
        'id',
        'email',
        'username',
        'role',
        'authProvider',            // 최초 가입 방법 (계정 관리용)
        'isEmailVerified',
        'createdAt',
        'lastLoginAt',
        'isActive',
        'isDeleted',               // 삭제 플래그 (JwtStrategy 로그인 차단용)
        'deletedAt',
      ]
    });

    if (!user) {
      return null;
    }

    // Phase 1 리팩토링: 분리된 필드들을 User 객체에 flatten (Frontend 호환성)
    // profiles 테이블 필드
    if (user.profile) {
      user.profileImage = user.profile.profileImage;
      user.bio = user.profile.bio;
      user.lastLoginProvider = user.profile.lastLoginProvider;
    }

    // subscriptions 테이블 필드
    if (user.subscription) {
      user.subscriptionTier = user.subscription.subscriptionTier;
      user.subscriptionStatus = user.subscription.subscriptionStatus;
    }

    // account_settings 테이블 필드
    if (user.accountSettings) {
      user.refreshToken = user.accountSettings.refreshToken;
      user.refreshTokenExpiresAt = user.accountSettings.refreshTokenExpiresAt;
      user.marketingOptIn = user.accountSettings.marketingOptIn;
      user.newsletterOptIn = user.accountSettings.newsletterOptIn;
      user.termsAcceptedAt = user.accountSettings.termsAcceptedAt;
      user.privacyAcceptedAt = user.accountSettings.privacyAcceptedAt;
    }

    // 프로필 이미지를 CDN URL로 변환
    if (user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findById): ${user.profileImage}`);
    }

    return user;
  }

  // Refresh Token 업데이트
  // Phase 1 리팩토링: refreshToken은 account_settings 테이블에 저장
  async updateRefreshToken(id: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.accountSettingsRepository.update(
      { userId: id },
      {
        refreshToken,
        refreshTokenExpiresAt: expiresAt
      }
    );
  }

  // Refresh Token 삭제 (로그아웃시)
  // Phase 1 리팩토링: refreshToken은 account_settings 테이블에 저장
  async clearRefreshToken(id: string): Promise<void> {
    await this.accountSettingsRepository.update(
      { userId: id },
      {
        refreshToken: null,
        refreshTokenExpiresAt: null
      }
    );
  }

  // 비밀번호 업데이트 (비밀번호 재설정)
  async updatePassword(userId: number | string, newPassword: string): Promise<void> {
    const user = await this.findById(String(userId));
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Phase 1 리팩토링: 비밀번호는 users 테이블, refreshToken은 account_settings 테이블
    await this.usersRepository.update(userId, {
      password: hashedPassword,
    });

    // 보안: 비밀번호 변경 시 모든 refresh token 무효화
    await this.accountSettingsRepository.update(
      { userId: String(userId) },
      {
        refreshToken: null,
        refreshTokenExpiresAt: null
      }
    );
  }

  /**
   * 소프트 삭제: 즉시 개인정보 마스킹 + 180일 보관 정책
   * - 즉시: isDeleted=true, 개인정보 마스킹, 로그인 차단
   * - 보관 기간: 180일 (문제 발생 시 확인용)
   * - 180일 후: Cron 작업으로 자동 완전 삭제
   */
  async softDelete(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 이미 삭제된 사용자인지 확인
    if (user.isDeleted) {
      this.logger.warn(`User ${userId} already deleted`);
      return;
    }

    const now = new Date();

    // 보관 기간 계산: 180일 (약 6개월)
    const retentionDays = 180;
    const scheduledDeletionAt = new Date(now);
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + retentionDays);

    /**
     * 🔒 법적 요구사항 대응: 감사 로그에 원본 데이터 보관
     *
     * 목적: 형사 수사, 민사 소송, 금융감독 등 법적 요구 시 원본 데이터 제공
     * 근거:
     * - 형사소송법 제106조 (법원 영장 시 데이터 제공 의무)
     * - 전자금융거래법 (5년간 거래 기록 보관)
     * - 개인정보보호법 제63조 (조사 협조 의무)
     *
     * 보관 데이터:
     * - 개인정보: email, username, profileImage, bio
     * - 계정 정보: authProvider, lastLoginProvider, role
     * - 시간 정보: createdAt, lastLoginAt
     * - 구독 정보: subscriptionTier, subscriptionStatus
     *
     * 주의: password는 보안상 저장하지 않음 (해시된 값도 미저장)
     */
    await this.auditService.log(
      {
        action: AuditAction.USER_DELETED,
        entityType: 'user',
        entityId: userId,
        previousData: {
          // 개인정보 (법적 조회용)
          email: user.email,
          username: user.username,
          profileImage: user.profileImage,
          bio: user.bio,

          // 계정 정보
          authProvider: user.authProvider,
          lastLoginProvider: user.lastLoginProvider,
          role: user.role,
          isEmailVerified: user.isEmailVerified,

          // 시간 정보
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,

          // 구독 정보
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
        },
        newData: {
          isDeleted: true,
          deletedAt: now,
          scheduledDeletionAt,
        },
        metadata: {
          retentionDays,
          reason: '사용자 계정 삭제 요청',
          legalNote: '법적 요구 시 audit_logs.previousData에서 원본 조회 가능',
        },
      },
      {
        userId, // 본인이 삭제 요청
      },
    );

    /**
     * 📝 관련 콘텐츠 Soft Delete (법적 조회용 보존)
     *
     * 사용자가 삭제될 때 해당 사용자의 모든 포스트와 댓글도 soft delete
     * - Posts: isDeleted = true 설정
     * - Comments: isDeleted = true 설정
     *
     * 이유:
     * - 법적 요구 시 포스트/댓글 내용 제공 필요
     * - 180일 보관 정책 준수
     * - 나중에 permanentDelete 시 CASCADE로 완전 삭제
     */
    const [postsUpdated, commentsUpdated] = await Promise.all([
      // 해당 사용자의 모든 포스트 soft delete
      this.postRepository.update(
        { authorId: userId, isDeleted: false },
        { isDeleted: true }
      ),
      // 해당 사용자의 모든 댓글 soft delete
      this.commentRepository.update(
        { authorId: userId, isDeleted: false },
        { isDeleted: true }
      ),
    ]);

    this.logger.log(
      `Soft deleted ${postsUpdated.affected} posts and ${commentsUpdated.affected} comments for user ${userId}`
    );

    // 즉시 개인정보 마스킹 및 삭제 플래그 설정
    await this.usersRepository.update(userId, {
      // 소프트 삭제 플래그
      isDeleted: true,
      deletedAt: now,
      scheduledDeletionAt,

      // 개인정보 즉시 마스킹 (프론트엔드 비공개 처리)
      email: `deleted_${userId}@deleted.local`,
      username: `deleted_${userId}`,
      profileImage: null,
      bio: null,

      // 인증 정보 무효화
      password: null,
      refreshToken: null,
      refreshTokenExpiresAt: null,

      // 활성화 상태 false로 변경 (로그인 차단)
      isActive: false,
    });

    this.logger.log(
      `User ${userId} soft deleted. Original data saved to audit_logs. ` +
      `Soft deleted ${postsUpdated.affected} posts and ${commentsUpdated.affected} comments. ` +
      `Scheduled for permanent deletion at ${scheduledDeletionAt.toISOString()} (180 days from now)`
    );

    // TODO: BullMQ 큐에 백그라운드 삭제 작업 추가
    // await this.userDeletionQueue.add('soft-delete', { userId });
  }

  /**
   * 영구 삭제: DB에서 완전히 제거
   * - 관리자 전용 기능
   * - CASCADE로 관련 데이터 모두 삭제
   * - 복구 불가능
   */
  async permanentDelete(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // DB에서 완전히 삭제 (CASCADE로 관련 데이터 자동 삭제)
    await this.usersRepository.delete(userId);

    this.logger.log(`User ${userId} permanently deleted from database`);
  }

  /**
   * 마케팅 정보 수신 설정 업데이트
   * 사용자가 설정 페이지에서 마케팅 및 뉴스레터 수신 여부를 변경할 때 사용
   */
  async updateMarketingPreferences(
    userId: string,
    preferences: { marketingOptIn?: boolean; newsletterOptIn?: boolean },
  ): Promise<User> {
    const user = await this.findOne(userId);

    const updateData: any = {};

    // 마케팅 정보 수신 동의 업데이트
    if (preferences.marketingOptIn !== undefined) {
      updateData.marketingOptIn = preferences.marketingOptIn;
      updateData.marketingOptInAt = preferences.marketingOptIn ? new Date() : null;
    }

    // 뉴스레터 수신 동의 업데이트
    if (preferences.newsletterOptIn !== undefined) {
      updateData.newsletterOptIn = preferences.newsletterOptIn;
    }

    Object.assign(user, updateData);
    const updatedUser = await this.usersRepository.save(user);

    this.logger.log(`Marketing preferences updated for user: ${userId}`);

    return updatedUser;
  }

} 