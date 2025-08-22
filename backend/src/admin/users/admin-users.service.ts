import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, FindOptionsWhere, Not } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

export interface UserFilters {
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  accountAge: number; // in days
  lastActivity: Date | null;
}

export interface UpdateUserDto {
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private auditService: AuditService,
  ) {}

  /**
   * Get all users with filters and pagination
   */
  async findAll(
    filters: UserFilters,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const where: FindOptionsWhere<User> = {};

    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isEmailVerified !== undefined) where.isEmailVerified = filters.isEmailVerified;
    
    if (filters.search) {
      // Search in email and username
      where.email = Like(`%${filters.search}%`);
      // Note: For OR conditions, we'd need QueryBuilder
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    }

    const [users, total] = await this.userRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: [
        'id',
        'email',
        'username',
        'role',
        'isActive',
        'isEmailVerified',
        'authProvider',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return { ...user, stats };
      }),
    );

    return {
      data: usersWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get detailed user information
   */
  async findOne(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(userId);
    const recentActivity = await this.getUserRecentActivity(userId);

    return {
      ...user,
      stats,
      recentActivity,
    };
  }

  /**
   * Update user details
   */
  async update(
    userId: string,
    updateDto: UpdateUserDto,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent self-demotion for admins
    if (userId === adminId && updateDto.role && updateDto.role !== Role.ADMIN) {
      throw new ForbiddenException('Cannot change your own admin role');
    }

    // Prevent disabling the last admin
    if (updateDto.isActive === false && user.role === Role.ADMIN) {
      const activeAdminCount = await this.userRepository.count({
        where: { role: Role.ADMIN, isActive: true, id: Not(userId) },
      });
      
      if (activeAdminCount === 0) {
        throw new BadRequestException('Cannot disable the last active admin');
      }
    }

    const previousData = {
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };

    // Update user
    Object.assign(user, updateDto);
    const updatedUser = await this.userRepository.save(user);

    // Log the action
    await this.auditService.logUserAction(
      this.getAuditAction(updateDto),
      userId,
      { previous: previousData, new: updateDto },
      { userId: adminId, ...context },
    );

    return updatedUser;
  }

  /**
   * Suspend a user
   */
  async suspend(
    userId: string,
    duration: number, // in days
    reason: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot suspend an admin');
    }

    user.isActive = false;
    // TODO: Add suspension end date field
    
    await this.userRepository.save(user);

    await this.auditService.logUserAction(
      AuditAction.USER_SUSPENDED,
      userId,
      { 
        previous: { isActive: true },
        new: { isActive: false, suspensionDuration: duration, reason },
      },
      { userId: adminId, ...context },
    );

    return {
      message: `User suspended for ${duration} days`,
      user,
    };
  }

  /**
   * Ban a user permanently
   */
  async ban(
    userId: string,
    reason: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot ban an admin');
    }

    user.isActive = false;
    // TODO: Add permanent ban flag
    
    await this.userRepository.save(user);

    // Also unpublish all their content
    await this.postRepository.update(
      { authorId: userId },
      { isPublished: false },
    );

    await this.auditService.logUserAction(
      AuditAction.USER_BANNED,
      userId,
      { 
        previous: { isActive: true },
        new: { isActive: false, banned: true, reason },
      },
      { userId: adminId, ...context },
    );

    return {
      message: 'User permanently banned',
      user,
    };
  }

  /**
   * Activate a user
   */
  async activate(
    userId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = true;
    await this.userRepository.save(user);

    await this.auditService.logUserAction(
      AuditAction.USER_ACTIVATED,
      userId,
      { 
        previous: { isActive: false },
        new: { isActive: true },
      },
      { userId: adminId, ...context },
    );

    return user;
  }

  /**
   * Delete a user (soft delete)
   */
  async delete(
    userId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });
      
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last admin');
      }
    }

    // Soft delete by marking as inactive and anonymizing data
    user.isActive = false;
    user.email = `deleted_${userId}@deleted.com`;
    user.username = `deleted_${userId}`;
    user.password = null;
    user.profileImage = null;
    user.bio = null;
    
    await this.userRepository.save(user);

    await this.auditService.logUserAction(
      AuditAction.USER_DELETED,
      userId,
      { 
        previous: { email: user.email },
        new: { deleted: true },
      },
      { userId: adminId, ...context },
    );

    return { message: 'User deleted successfully' };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole,
      usersByProvider,
      recentSignups,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isEmailVerified: true } }),
      this.getUsersByRole(),
      this.getUsersByProvider(),
      this.getRecentSignups(),
    ]);

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole,
      usersByProvider,
      recentSignups,
    };
  }

  /**
   * Export users data (for compliance)
   */
  async exportUsers(format: 'json' | 'csv' = 'json') {
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'username',
        'role',
        'isActive',
        'isEmailVerified',
        'authProvider',
        'createdAt',
      ],
    });

    if (format === 'json') {
      return users;
    }

    // CSV export
    const headers = ['ID', 'Email', 'Username', 'Role', 'Active', 'Verified', 'Provider', 'Created'];
    const rows = users.map(u => [
      u.id,
      u.email,
      u.username || '',
      u.role,
      u.isActive ? 'Yes' : 'No',
      u.isEmailVerified ? 'Yes' : 'No',
      u.authProvider,
      u.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    return csv;
  }

  // Private helper methods

  private async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const [totalPosts, totalComments, totalLikes] = await Promise.all([
      this.postRepository.count({ where: { authorId: userId } }),
      this.commentRepository.count({ where: { authorId: userId } }),
      this.postRepository
        .createQueryBuilder('post')
        .select('SUM(post.likeCount)', 'total')
        .where('post.authorId = :userId', { userId })
        .getRawOne()
        .then(r => parseInt(r?.total || '0')),
    ]);

    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      totalPosts,
      totalComments,
      totalLikes,
      accountAge,
      lastActivity: user.lastLoginAt,
    };
  }

  private async getUserRecentActivity(userId: string, limit = 10) {
    const [recentPosts, recentComments] = await Promise.all([
      this.postRepository.find({
        where: { authorId: userId },
        order: { createdAt: 'DESC' },
        take: limit / 2,
        select: ['id', 'title', 'createdAt'],
      }),
      this.commentRepository.find({
        where: { authorId: userId },
        order: { createdAt: 'DESC' },
        take: limit / 2,
        select: ['id', 'content', 'createdAt'],
      }),
    ]);

    const activities = [
      ...recentPosts.map(p => ({
        type: 'post' as const,
        id: p.id,
        title: p.title,
        timestamp: p.createdAt,
      })),
      ...recentComments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        content: c.content.substring(0, 100),
        timestamp: c.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private async getUsersByRole() {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.role] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getUsersByProvider() {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('user.authProvider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.authProvider')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.provider] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getRecentSignups(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await this.userRepository.count({
      where: {
        createdAt: Between(since, new Date()),
      },
    });
  }

  private getAuditAction(updateDto: UpdateUserDto): AuditAction {
    if (updateDto.role) return AuditAction.USER_ROLE_CHANGED;
    if (updateDto.isActive === false) return AuditAction.USER_SUSPENDED;
    if (updateDto.isActive === true) return AuditAction.USER_ACTIVATED;
    return AuditAction.USER_UPDATED;
  }
}