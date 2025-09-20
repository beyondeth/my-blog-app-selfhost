import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, FindOptionsWhere, In, Not, IsNull } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

export interface PostFilters {
  isPublished?: boolean;
  authorId?: string;
  category?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  hasReports?: boolean;
}

export interface UpdatePostStatusDto {
  isPublished?: boolean;
}

export interface BulkActionDto {
  postIds: string[];
  action: 'publish' | 'unpublish' | 'delete';
}

@Injectable()
export class AdminPostsService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private auditService: AuditService,
  ) {}

  /**
   * Get all posts with filters and pagination
   */
  async findAll(
    filters: PostFilters,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const where: FindOptionsWhere<Post> = {};

    if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    if (filters.authorId) where.authorId = filters.authorId;
    if (filters.category) where.category = filters.category;
    
    if (filters.search) {
      // Search in title and content
      where.title = Like(`%${filters.search}%`);
      // Note: For OR conditions in content, we'd need QueryBuilder
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    }

    const [posts, total] = await this.postRepository.findAndCount({
      where,
      relations: ['author', 'blog'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get additional stats for each post
    const postsWithStats = await Promise.all(
      posts.map(async (post) => {
        const commentCount = await this.commentRepository.count({
          where: { postId: post.id },
        });

        return {
          ...post,
          stats: {
            viewCount: post.viewCount,
            likeCount: post.likeCount,
            commentCount,
          },
        };
      }),
    );

    return {
      data: postsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get post details
   */
  async findOne(postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['author', 'blog', 'comments'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const recentComments = await this.commentRepository.find({
      where: { postId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      ...post,
      recentComments,
      stats: {
        totalComments: post.comments?.length || 0,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
      },
    };
  }

  /**
   * Update post status
   */
  async updateStatus(
    postId: string,
    updateDto: UpdatePostStatusDto,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const previousData = {
      isPublished: post.isPublished,
    };

    // Update post
    Object.assign(post, updateDto);
    
    if (updateDto.isPublished !== undefined) {
      post.publishedAt = updateDto.isPublished ? new Date() : null;
    }

    const updatedPost = await this.postRepository.save(post);

    // Log the action
    await this.auditService.logPostAction(
      updateDto.isPublished ? AuditAction.POST_PUBLISHED : AuditAction.POST_UNPUBLISHED,
      postId,
      { previous: previousData, new: updateDto },
      { userId: adminId, ...context },
    );

    return updatedPost;
  }

  /**
   * Delete post (soft delete by unpublishing)
   */
  async delete(
    postId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Soft delete by unpublishing
    post.isPublished = false;
    await this.postRepository.save(post);

    await this.auditService.logPostAction(
      AuditAction.POST_DELETED,
      postId,
      { previous: { isPublished: true }, new: { isPublished: false } },
      { userId: adminId, ...context },
    );

    return { message: 'Post deleted successfully' };
  }

  /**
   * Bulk action on posts
   * 대량 작업 최적화 - IN 절 쿼리 성능 개선
   */
  async bulkAction(
    bulkActionDto: BulkActionDto,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const { postIds, action } = bulkActionDto;

    // findByIds 대신 단순 카운트 쿼리로 존재 여부만 확인
    // 관계(relations)를 로드하지 않아 성능 대폭 향상
    const postCount = await this.postRepository.count({
      where: { id: In(postIds) }
    });

    if (postCount !== postIds.length) {
      throw new NotFoundException('Some posts not found');
    }

    let updateData: Partial<Post> = {};
    let auditAction: AuditAction;

    switch (action) {
      case 'publish':
        updateData = { isPublished: true, publishedAt: new Date() };
        auditAction = AuditAction.POST_PUBLISHED;
        break;
      case 'unpublish':
        updateData = { isPublished: false, publishedAt: null };
        auditAction = AuditAction.POST_UNPUBLISHED;
        break;
      case 'delete':
        updateData = { isPublished: false };
        auditAction = AuditAction.POST_DELETED;
        break;
    }

    await this.postRepository.update(
      { id: In(postIds) },
      updateData,
    );

    // Log bulk action
    await this.auditService.log(
      {
        action: AuditAction.BULK_ACTION_PERFORMED,
        entityType: 'post',
        metadata: {
          action,
          postIds,
          count: postIds.length,
        },
      },
      { userId: adminId, ...context },
    );

    return {
      message: `Bulk ${action} completed for ${postIds.length} posts`,
      affected: postIds.length,
    };
  }

  /**
   * Get popular posts
   */
  async getPopularPosts(limit = 10) {
    const posts = await this.postRepository.find({
      where: { isPublished: true },
      relations: ['author'],
      order: {
        viewCount: 'DESC',
        likeCount: 'DESC',
        commentCount: 'DESC',
      },
      take: limit,
    });

    return posts;
  }

  /**
   * Get posts by category
   */
  async getPostsByCategory() {
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return result.map(item => ({
      category: item.category,
      count: parseInt(item.count),
    }));
  }

  /**
   * Get posts by tag
   */
  async getPostsByTag() {
    const posts = await this.postRepository.find({
      select: ['tagList'],
      where: { tagList: Not(IsNull()) },
    });

    const tagCount = new Map<string, number>();

    posts.forEach(post => {
      if (post.tagList && Array.isArray(post.tagList)) {
        post.tagList.forEach(tag => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        });
      }
    });

    return Array.from(tagCount.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get content statistics
   */
  async getContentStatistics() {
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      totalComments,
      avgCommentsPerPost,
      avgViewsPerPost,
      categoriesCount,
      tagsCount,
    ] = await Promise.all([
      this.postRepository.count(),
      this.postRepository.count({ where: { isPublished: true } }),
      this.postRepository.count({ where: { isPublished: false } }),
      this.commentRepository.count(),
      this.getAverageCommentsPerPost(),
      this.getAverageViewsPerPost(),
      this.getUniqueCategories(),
      this.getUniqueTags(),
    ]);

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalComments,
      avgCommentsPerPost,
      avgViewsPerPost,
      categoriesCount,
      tagsCount,
    };
  }

  /**
   * Get posts needing moderation
   */
  async getPostsNeedingModeration() {
    // Posts with multiple reports or flagged content
    // This would integrate with the reports system
    
    const flaggedPosts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoin('reports', 'report', 'report.targetId = post.id AND report.type = :type', {
        type: 'post',
      })
      .where('report.status = :status', { status: 'pending' })
      .groupBy('post.id')
      .having('COUNT(report.id) >= :threshold', { threshold: 3 })
      .getMany();

    return flaggedPosts;
  }

  // Private helper methods

  private async getAverageCommentsPerPost(): Promise<number> {
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('AVG(post.commentCount)', 'avg')
      .getRawOne();

    return parseFloat(result?.avg || '0');
  }

  private async getAverageViewsPerPost(): Promise<number> {
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('AVG(post.viewCount)', 'avg')
      .getRawOne();

    return parseFloat(result?.avg || '0');
  }

  private async getUniqueCategories(): Promise<number> {
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('COUNT(DISTINCT post.category)', 'count')
      .where('post.category IS NOT NULL')
      .getRawOne();

    return parseInt(result?.count || '0');
  }

  private async getUniqueTags(): Promise<number> {
    const posts = await this.postRepository.find({
      select: ['tagList'],
      where: { tagList: Not(IsNull()) },
    });

    const uniqueTags = new Set<string>();

    posts.forEach(post => {
      if (post.tagList && Array.isArray(post.tagList)) {
        post.tagList.forEach(tag => uniqueTags.add(tag));
      }
    });

    return uniqueTags.size;
  }

  private Not(value: any) {
    return Not(value);
  }
}