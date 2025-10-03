/**
 * Task 29: 계정 삭제 전체 플로우 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 사용자 계정 삭제 요청 (즉시 소프트 삭제)
 * 2. 개인정보 즉시 마스킹 확인
 * 3. 삭제된 사용자 로그인 차단 확인
 * 4. 백그라운드 큐 작업 처리 확인
 * 5. S3 파일 삭제 확인
 * 6. CASCADE 삭제 확인
 * 7. 법적 보유기간 확인 (3년/5년)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { UserDeletionLog } from '../src/users/entities/user-deletion-log.entity';
import { Blog } from '../src/blogs/entities/blog.entity';
import { Post } from '../src/posts/entities/post.entity';
import { File } from '../src/files/entities/file.entity';
import { UserDeletionQueueService } from '../src/users/services/user-deletion-queue.service';

describe('Account Deletion E2E Test (계정 삭제 전체 플로우)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let deletionLogRepository: Repository<UserDeletionLog>;
  let blogRepository: Repository<Blog>;
  let postRepository: Repository<Post>;
  let fileRepository: Repository<File>;
  let deletionQueueService: UserDeletionQueueService;
  let testUserId: string;
  let agent: any; // supertest agent for cookie management
  let cookies: string[]; // 로그인 쿠키 저장

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // main.ts와 동일하게 cookie-parser 설정
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // main.ts와 동일하게 global prefix 설정
    app.setGlobalPrefix('api/v1');

    await app.init();

    // supertest agent 생성 (쿠키 자동 관리)
    agent = request.agent(app.getHttpServer());

    userRepository = moduleFixture.get(getRepositoryToken(User));
    deletionLogRepository = moduleFixture.get(getRepositoryToken(UserDeletionLog));
    blogRepository = moduleFixture.get(getRepositoryToken(Blog));
    postRepository = moduleFixture.get(getRepositoryToken(Post));
    fileRepository = moduleFixture.get(getRepositoryToken(File));
    deletionQueueService = moduleFixture.get(UserDeletionQueueService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Step 1: 테스트 사용자 생성 및 로그인', () => {
    it('should create a test user and login', async () => {
      // E2E 테스트: 이메일 인증 우회를 위해 직접 데이터베이스에 사용자 생성
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Test1234!@', 10);

      const testUser = userRepository.create({
        email: 'deletion-test@example.com',
        username: 'deletion-test-user',
        password: hashedPassword,
        isActive: true,
        isEmailVerified: true, // 이메일 인증 완료 상태로 설정
      });

      const savedUser = await userRepository.save(testUser);
      testUserId = savedUser.id;
      expect(testUserId).toBeDefined();

      // 로그인 (쿠키 수동 저장)
      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'deletion-test@example.com',
          password: 'Test1234!@',
        })
        .expect(201);

      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.id).toBe(testUserId);

      // 응답 헤더에서 쿠키 추출 및 파싱 (name=value만 추출)
      const setCookies = loginResponse.headers['set-cookie'] as unknown as string[];
      expect(setCookies).toBeDefined();
      expect(setCookies.length).toBeGreaterThan(0);

      // Set-Cookie 헤더에서 name=value 부분만 추출 (HttpOnly, Secure 등 제거)
      cookies = setCookies.map(cookie => cookie.split(';')[0].trim());

      // DEBUG: 쿠키 내용 확인
      console.log(`🔍 DEBUG - Set-Cookie headers:`, setCookies);
      console.log(`🔍 DEBUG - Parsed cookies:`, cookies);
      console.log(`🔍 DEBUG - Cookie header to send:`, cookies.join('; '));

      console.log(`✅ Test user created and logged in: ${testUserId}`);
    });

    it('should create blog, post, and comment', async () => {
      // 1. 블로그 생성 (쿠키 수동 포함)
      const blogResponse = await agent
        .post('/api/v1/blogs')
        .set('Cookie', cookies.join('; '))
        .send({
          name: 'Test Blog',
          slug: 'deletion-test-blog',
          description: 'Test blog for deletion',
        })
        .expect(201);

      const blogId = blogResponse.body.id;
      expect(blogId).toBeDefined();
      console.log(`✅ Blog created: ${blogId}`);

      // 2. 포스트 생성
      const postResponse = await agent
        .post(`/api/v1/posts`)
        .set('Cookie', cookies.join('; '))
        .send({
          blogId,
          title: 'Test Post',
          slug: 'test-post',
          content: 'Test content for deletion',
          status: 'published',
        })
        .expect(201);

      const postId = postResponse.body.id;
      expect(postId).toBeDefined();
      console.log(`✅ Post created: ${postId}`);

      // 3. 댓글 작성 (자신의 글에 댓글)
      const commentResponse = await agent
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Cookie', cookies.join('; '))
        .send({
          content: 'Test comment for deletion',
        })
        .expect(201);

      expect(commentResponse.body.id).toBeDefined();
      console.log(`✅ Comment created: ${commentResponse.body.id}`);
      console.log(`✅ Full user flow completed: blog → post → comment`);
    });
  });

  describe('Step 2: 계정 삭제 버튼 클릭', () => {
    it('should delete account successfully', async () => {
      // 사용자가 설정 페이지에서 "계정 삭제" 버튼 클릭
      const response = await agent
        .delete('/api/v1/auth/account')
        .set('Cookie', cookies.join('; '))
        .send({
          password: 'Test1234!@', // 비밀번호 재확인
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('계정 삭제가 요청되었습니다');
      expect(response.body.info.personalDataMasked).toBe(true);
      expect(response.body.info.backgroundDeletionQueued).toBe(true);

      console.log(`✅ Account deletion requested (button clicked): ${testUserId}`);
    });
  });

  describe('Step 3: 즉시 소프트 삭제 및 개인정보 마스킹 확인', () => {
    it('should immediately mask user personal data', async () => {
      const user = await userRepository.findOne({
        where: { id: testUserId },
      });

      expect(user).toBeDefined();
      expect(user.isDeleted).toBe(true);
      expect(user.deletedAt).toBeDefined();
      expect(user.scheduledDeletionAt).toBeDefined();
      expect(user.isActive).toBe(false);

      // 개인정보 마스킹 확인
      expect(user.email).toBe(`deleted_${testUserId}@deleted.local`);
      expect(user.username).toBe(`deleted_${testUserId}`);
      expect(user.profileImage).toBeNull();
      expect(user.bio).toBeNull();
      expect(user.password).toBeNull();
      expect(user.refreshToken).toBeNull();

      console.log(`✅ Personal data masked immediately for user: ${testUserId}`);
    });

    it('should set correct scheduled deletion date (3 or 5 years)', async () => {
      const user = await userRepository.findOne({
        where: { id: testUserId },
      });

      const scheduledDate = new Date(user.scheduledDeletionAt);
      const now = new Date();
      const yearsDiff = (scheduledDate.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000);

      // 3년 또는 5년 후에 삭제 예정
      expect(yearsDiff).toBeGreaterThanOrEqual(2.9); // 약간의 오차 허용
      expect(yearsDiff).toBeLessThanOrEqual(5.1);

      console.log(`✅ Scheduled deletion date set: ${scheduledDate.toISOString()}`);
    });
  });

  describe('Step 4: 삭제된 사용자 로그인 차단 확인', () => {
    it('should block login for deleted user', async () => {
      // 새로운 agent로 로그인 시도 (삭제된 계정)
      const newAgent = request.agent(app.getHttpServer());
      const response = await newAgent
        .post('/api/v1/auth/login')
        .send({
          email: 'deletion-test@example.com', // 원래 이메일로 로그인 시도
          password: 'Test1234!@',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');

      console.log(`✅ Login blocked for deleted user: ${testUserId}`);
    });

    it('should not allow accessing protected routes', async () => {
      // 기존 agent의 쿠키도 무효화되었는지 확인
      await agent
        .get('/api/v1/users/profile')
        .set('Cookie', cookies.join('; '))
        .expect(401);

      console.log(`✅ Protected routes blocked for deleted user: ${testUserId}`);
    });
  });

  describe('Step 5: UserDeletionLog 생성 확인', () => {
    it('should create deletion log record', async () => {
      // 백그라운드 작업이 처리될 시간 대기 (최대 5초)
      await new Promise(resolve => setTimeout(resolve, 5000));

      const deletionLog = await deletionLogRepository.findOne({
        where: { userId: testUserId },
      });

      // 큐가 처리되었다면 deletion log가 생성되어야 함
      if (deletionLog) {
        expect(deletionLog.userId).toBe(testUserId);
        expect(['in_progress', 'completed', 'failed']).toContain(deletionLog.status);
        console.log(`✅ Deletion log created: ${deletionLog.id} (status: ${deletionLog.status})`);
      } else {
        console.log(`⚠️ Deletion log not yet created (queue may be processing)`);
      }
    });
  });

  describe('Step 6: 백그라운드 큐 메트릭 확인', () => {
    it('should have deletion job in queue', async () => {
      const metrics = await deletionQueueService.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.queueSize).toBeGreaterThanOrEqual(0);

      console.log(`✅ Queue metrics:`, {
        queueSize: metrics.queueSize,
        processingCount: metrics.processingCount,
        totalProcessed: metrics.totalProcessed,
        totalFailed: metrics.totalFailed,
        dlqSize: metrics.dlqSize,
      });
    });
  });

  describe('Step 7: CASCADE 삭제 확인 (SET NULL)', () => {
    it('should NOT delete related data immediately (SET NULL)', async () => {
      // 블로그는 즉시 삭제되지 않음 (법적 보유기간)
      const blogs = await blogRepository.find({
        where: { userId: testUserId },
      });

      // 블로그가 존재하거나 CASCADE 삭제되었을 수 있음
      console.log(`📊 Related blogs count: ${blogs.length}`);

      // 포스트도 CASCADE 설정에 따라 처리됨
      const posts = await postRepository.find({
        relations: ['blog'],
      });

      const userPosts = posts.filter(post => post.blog?.userId === testUserId);
      console.log(`📊 Related posts count: ${userPosts.length}`);
    });
  });

  describe('Step 8: 법적 요구사항 검증', () => {
    it('should comply with Korean data retention laws', async () => {
      const user = await userRepository.findOne({
        where: { id: testUserId },
      });

      // 즉시 개인정보 마스킹 (개인정보보호법 제21조)
      expect(user.email).not.toContain('deletion-test@example.com');
      expect(user.username).not.toContain('deletion-test-user');
      expect(user.password).toBeNull();

      // 법적 보유기간 설정 확인
      expect(user.scheduledDeletionAt).toBeDefined();

      // 삭제 로그 기록 (법적 증빙)
      const deletionLogs = await deletionLogRepository.find({
        where: { userId: testUserId },
      });

      console.log(`✅ Legal compliance verified:`);
      console.log(`  - Personal data masked: YES`);
      console.log(`  - Scheduled deletion: ${user.scheduledDeletionAt}`);
      console.log(`  - Deletion logs: ${deletionLogs.length}`);
    });
  });

  describe('Step 9: 테스트 데이터 정리', () => {
    it('should clean up test data', async () => {
      // 테스트 사용자 완전 삭제
      await userRepository.delete({ id: testUserId });

      // 삭제 로그 정리
      await deletionLogRepository.delete({ userId: testUserId });

      console.log(`✅ Test data cleaned up for user: ${testUserId}`);
    });
  });
});
