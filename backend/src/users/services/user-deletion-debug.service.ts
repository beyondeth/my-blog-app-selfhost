import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { File } from '../../files/entities/file.entity';
// import { ApiKey } from '../../auth/entities/api-key.entity'; // API Key entity가 없으면 주석처리
import { Report } from '../../reports/entities/report.entity';

export interface DeletionDebugInfo {
  timestamp: Date;
  userId: string;
  username: string;
  email: string;
  authProvider: string;
  
  // 삭제 전 데이터 카운트
  beforeDeletion: {
    blogs: { count: number; items: any[] };
    posts: { count: number; items: any[] };
    comments: { count: number; items: any[] };
    files: { count: number; items: any[] };
    apiKeys: { count: number; items: any[] };
    reports: { count: number; items: any[] };
    totalDataSize: number;
  };
  
  // 삭제 과정
  deletionSteps: Array<{
    step: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    message: string;
    timestamp: Date;
    details?: any;
  }>;
  
  // 삭제 후 확인
  afterDeletion: {
    userExists: boolean;
    orphanedData: any[];
    verificationStatus: string;
  };
}

@Injectable()
export class UserDeletionDebugService {
  private readonly logger = new Logger(UserDeletionDebugService.name);
  private debugInfo: DeletionDebugInfo | null = null;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 삭제 전 사용자 데이터 수집
   */
  async collectPreDeletionData(userIdOrEmail: string): Promise<DeletionDebugInfo> {
    this.logger.log(`🔍 [DEBUG] Collecting pre-deletion data for user: ${userIdOrEmail}`);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // 사용자 정보 - UUID 또는 이메일로 조회
      let user: User | null = null;
      let userBlogs: Blog[] = [];
      
      // UUID 형식인지 확인 (간단한 UUID 패턴 체크)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrEmail);
      
      this.logger.log(`🔍 [DEBUG] Input type detection - isUuid: ${isUuid}, value: ${userIdOrEmail}`);
      
      if (isUuid) {
        this.logger.log(`🔍 [DEBUG] Searching by UUID: ${userIdOrEmail}`);
        user = await queryRunner.manager.findOne(User, {
          where: { id: userIdOrEmail },
        });
        if (user) {
          userBlogs = await queryRunner.manager.find(Blog, {
            where: { userId: user.id },
          });
        }
      } else {
        // 이메일로 조회
        this.logger.log(`🔍 [DEBUG] Searching by email: ${userIdOrEmail}`);
        
        // 먼저 직접 쿼리로 확인
        const rawUser = await queryRunner.query(
          `SELECT * FROM users WHERE email = $1`,
          [userIdOrEmail]
        );
        this.logger.log(`🔍 [DEBUG] Raw query result: ${JSON.stringify(rawUser?.length)} users found`);
        
        if (rawUser && rawUser.length > 0) {
          // Raw 쿼리 결과가 있으면 그것을 사용
          this.logger.log(`🔍 [DEBUG] Using raw query result`);
          const userData = rawUser[0];
          this.logger.log(`🔍 [DEBUG] User data from raw query: ${JSON.stringify(userData)}`);
          
          // User 엔티티로 변환
          user = new User();
          Object.assign(user, userData);
          
          // blogs 관계 조회
          const blogs = await queryRunner.query(
            `SELECT * FROM blogs WHERE "userId" = $1`,
            [userData.id]
          );
          this.logger.log(`🔍 [DEBUG] Blogs found: ${blogs?.length || 0}`);
          userBlogs = blogs || [];
        } else {
          // TypeORM findOne 사용 (fallback)
          user = await queryRunner.manager.findOne(User, {
            where: { email: userIdOrEmail.trim() },
          });
          if (user) {
            userBlogs = await queryRunner.manager.find(Blog, {
              where: { userId: user.id },
            });
          }
        }
      }
      
      this.logger.log(`🔍 [DEBUG] User found: ${user ? `Yes (ID: ${user.id}, Email: ${user.email})` : 'No'}`);
      
      if (!user) {
        throw new Error(`User not found: ${userIdOrEmail}`);
      }
      
      const userId = user.id;

      // 블로그 정보 - 이미 위에서 조회했으므로 userBlogs 사용하고 posts 수 추가
      const blogs = userBlogs;
      // 각 블로그의 포스트 수 계산
      for (const blog of blogs) {
        const postCount = await queryRunner.manager
          .createQueryBuilder(Post, 'post')
          .where('post.blogId = :blogId', { blogId: blog.id })
          .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
          .getCount();
        blog.posts = Array(postCount).fill({}); // 포스트 수만큼 빈 배열 생성
      }

      // 포스트 정보 - QueryBuilder 사용
      const posts = await queryRunner.manager
        .createQueryBuilder(Post, 'post')
        .leftJoinAndSelect('post.stats', 'stats')
        .where('post."authorId" = :userId', { userId })
        .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
        .select(['post.id', 'post.title', 'post.createdAt', 'stats'])
        .getMany();

      // 댓글 정보 - QueryBuilder 사용
      const comments = await queryRunner.manager
        .createQueryBuilder(Comment, 'comment')
        .where('comment."authorId" = :userId', { userId })
        .select(['comment.id', 'comment.content', 'comment.createdAt', 'comment.postId'])
        .getMany();

      // 파일 정보
      const files = await queryRunner.manager.find(File, {
        where: { userId },
        select: ['id', 'originalName', 'fileSize', 'fileKey', 'createdAt'],
      });

      // API 키 정보 (현재 API Key 엔티티가 없으므로 빈 배열)
      const apiKeys: any[] = []; // API Key 기능 구현 시 수정 필요

      // 신고 정보 - reportedById(신고한 사람) 또는 targetId가 사용자일 때(신고당한 사람)
      const reports = await queryRunner.manager
        .createQueryBuilder(Report, 'report')
        .where('report."reportedById" = :userId OR (report.type = :userType AND report."targetId" = :userId)', 
          { userId, userType: 'user' })
        .select(['report.id', 'report.reason', 'report.status', 'report.createdAt'])
        .getMany();

      // 총 데이터 크기 계산
      const totalDataSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);

      this.debugInfo = {
        timestamp: new Date(),
        userId: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider || 'local',
        
        beforeDeletion: {
          blogs: { 
            count: blogs.length, 
            items: blogs.map(b => ({ 
              id: b.id, 
              name: b.name, 
              slug: b.slug,
              postCount: b.posts?.length || 0 
            }))
          },
          posts: {
            count: posts.length,
            items: posts.map(p => ({
              id: p.id,
              title: p.title,
              viewCount: p.stats?.viewCount || 0
            }))
          },
          comments: { 
            count: comments.length, 
            items: comments.map(c => ({ 
              id: c.id, 
              content: c.content.substring(0, 50) + '...',
              postId: c.postId 
            }))
          },
          files: { 
            count: files.length, 
            items: files.map(f => ({ 
              id: f.id, 
              name: f.originalName, 
              size: f.fileSize,
              s3Key: f.fileKey 
            }))
          },
          apiKeys: { 
            count: apiKeys.length, 
            items: apiKeys.map(k => ({ 
              id: k.id, 
              name: k.name, 
              lastUsed: k.lastUsedAt 
            }))
          },
          reports: { 
            count: reports.length, 
            items: reports.map(r => ({ 
              id: r.id, 
              reason: r.reason, 
              status: r.status 
            }))
          },
          totalDataSize,
        },
        
        deletionSteps: [],
        
        afterDeletion: {
          userExists: true,
          orphanedData: [],
          verificationStatus: 'pending',
        },
      };

      this.logger.log(`📊 [DEBUG] Pre-deletion data collected:`);
      this.logger.log(`  - Blogs: ${blogs.length}`);
      this.logger.log(`  - Posts: ${posts.length}`);
      this.logger.log(`  - Comments: ${comments.length}`);
      this.logger.log(`  - Files: ${files.length} (Total size: ${this.formatBytes(totalDataSize)})`);
      this.logger.log(`  - API Keys: ${apiKeys.length}`);
      this.logger.log(`  - Reports: ${reports.length}`);

      return this.debugInfo;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 삭제 단계 기록
   */
  addDeletionStep(step: string, status: 'pending' | 'in-progress' | 'completed' | 'failed', message: string, details?: any) {
    if (!this.debugInfo) {
      this.logger.warn('[DEBUG] No debug info initialized');
      return;
    }

    const stepInfo = {
      step,
      status,
      message,
      timestamp: new Date(),
      details,
    };

    this.debugInfo.deletionSteps.push(stepInfo);
    
    const statusEmoji = {
      'pending': '⏳',
      'in-progress': '🔄',
      'completed': '✅',
      'failed': '❌',
    };
    
    this.logger.log(`${statusEmoji[status]} [DEBUG] ${step}: ${message}`);
    if (details) {
      this.logger.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * 삭제 후 검증
   */
  async verifyDeletion(userId: string): Promise<void> {
    if (!this.debugInfo) {
      this.logger.warn('[DEBUG] No debug info initialized');
      return;
    }

    this.logger.log(`🔍 [DEBUG] Verifying deletion for user: ${userId}`);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // 사용자 존재 확인
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      
      this.debugInfo.afterDeletion.userExists = !!user;
      
      // 고아 데이터 확인
      const orphanedData = [];
      
      // 블로그 확인
      const orphanedBlogs = await queryRunner.manager.find(Blog, {
        where: { userId },
      });
      if (orphanedBlogs.length > 0) {
        orphanedData.push({ type: 'blogs', count: orphanedBlogs.length, items: orphanedBlogs });
      }
      
      // 포스트 확인
      const orphanedPosts = await queryRunner.manager
        .createQueryBuilder(Post, 'post')
        .where('post."authorId" = :userId', { userId })
        .getMany();
      if (orphanedPosts.length > 0) {
        orphanedData.push({ type: 'posts', count: orphanedPosts.length, items: orphanedPosts });
      }
      
      // 댓글 확인
      const orphanedComments = await queryRunner.manager
        .createQueryBuilder(Comment, 'comment')
        .where('comment."authorId" = :userId', { userId })
        .getMany();
      if (orphanedComments.length > 0) {
        orphanedData.push({ type: 'comments', count: orphanedComments.length, items: orphanedComments });
      }
      
      // 파일 확인
      const orphanedFiles = await queryRunner.manager.find(File, {
        where: { userId },
      });
      if (orphanedFiles.length > 0) {
        orphanedData.push({ type: 'files', count: orphanedFiles.length, items: orphanedFiles });
      }
      
      this.debugInfo.afterDeletion.orphanedData = orphanedData;
      this.debugInfo.afterDeletion.verificationStatus = orphanedData.length === 0 ? 'clean' : 'orphaned_data_found';
      
      // 결과 로깅
      if (user) {
        this.logger.warn(`⚠️ [DEBUG] User still exists after deletion!`);
      } else {
        this.logger.log(`✅ [DEBUG] User successfully deleted`);
      }
      
      if (orphanedData.length > 0) {
        this.logger.warn(`⚠️ [DEBUG] Found orphaned data:`);
        orphanedData.forEach(data => {
          this.logger.warn(`  - ${data.type}: ${data.count} items`);
        });
      } else {
        this.logger.log(`✅ [DEBUG] No orphaned data found`);
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 디버그 정보 가져오기
   */
  getDebugInfo(): DeletionDebugInfo | null {
    return this.debugInfo;
  }

  /**
   * 디버그 정보 초기화
   */
  clearDebugInfo(): void {
    this.debugInfo = null;
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}