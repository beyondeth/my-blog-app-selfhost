# 🚀 Redis 캐싱 구현 가이드

## 📦 설치 및 설정

### 1. 패키지 설치
```bash
cd backend
pnpm add cache-manager-redis-store@^2.0.0 redis@^4.6.0
```

### 2. 환경 변수 추가
```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=300
```

### 3. 캐시 모듈 등록
```typescript
// app.module.ts
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    // ... other modules
    CacheModule, // Global cache module
  ],
})
export class AppModule {}
```

## 🔧 서비스별 구현

### 1. Posts Service 캐싱 구현

```typescript
// posts/posts.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';

@Injectable()
export class PostsService {
  constructor(
    private cacheService: CacheService,
    // ... other dependencies
  ) {}

  /**
   * 포스트 목록 조회 (캐싱 적용)
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    blogSlug?: string,
    user?: User,
    publishedFilter: string = 'all',
  ) {
    // 캐시 키 생성
    const cacheKey = CacheKeys.POST_LIST(page, limit, search, blogSlug);
    
    // 캐시에서 조회 시도
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        // 기존 DB 쿼리 로직
        const queryBuilder = this.postsRepository
          .createQueryBuilder('post')
          .leftJoinAndSelect('post.author', 'author')
          .leftJoinAndSelect('post.blog', 'blog')
          .leftJoinAndSelect('post.tags', 'tags')
          .leftJoinAndSelect('post.thumbnailImage', 'thumbnailImage');

        // 블로그 필터
        if (blogSlug) {
          queryBuilder.andWhere('blog.slug = :blogSlug', { blogSlug });
        }

        // 검색 필터
        if (search) {
          queryBuilder.andWhere(
            '(post.title ILIKE :search OR post.content ILIKE :search)',
            { search: `%${search}%` },
          );
        }

        // 공개 상태 필터
        if (publishedFilter === 'published') {
          queryBuilder.andWhere('post.isPublished = true');
        }

        // 정렬 및 페이징
        queryBuilder
          .orderBy('post.createdAt', 'DESC')
          .skip((page - 1) * limit)
          .take(limit);

        const [posts, total] = await queryBuilder.getManyAndCount();

        // 응답 포맷
        return {
          posts: posts.map(post => this.formatPostResponse(post)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      },
      CacheTTL.MEDIUM, // 5분 캐싱
    );
  }

  /**
   * 포스트 상세 조회 (캐싱 적용)
   */
  async findOne(id: string, user?: User) {
    const cacheKey = CacheKeys.POST_DETAIL(id);
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const post = await this.postsRepository.findOne({
          where: { id },
          relations: ['author', 'blog', 'tags', 'thumbnailImage'],
        });

        if (!post) {
          throw new NotFoundException('포스트를 찾을 수 없습니다.');
        }

        // 조회수 증가 (캐시와 별도로 처리)
        this.incrementViewCount(id);

        return this.formatPostResponse(post);
      },
      CacheTTL.LONG, // 10분 캐싱
    );
  }

  /**
   * 포스트 생성 (캐시 무효화)
   */
  async create(createPostDto: CreatePostDto, user: User, blogId: string) {
    // ... 포스트 생성 로직

    const post = await this.postsRepository.save(newPost);

    // 캐시 무효화
    await this.cacheService.invalidatePostCache(post.id, blog.slug);

    return post;
  }

  /**
   * 포스트 수정 (캐시 무효화)
   */
  async update(id: string, updatePostDto: UpdatePostDto, user: User) {
    // ... 포스트 수정 로직

    const updatedPost = await this.postsRepository.save(post);

    // 캐시 무효화
    await this.cacheService.invalidatePostCache(id, post.blog.slug);

    return updatedPost;
  }

  /**
   * 포스트 삭제 (캐시 무효화)
   */
  async remove(id: string, user: User) {
    // ... 포스트 삭제 로직

    await this.postsRepository.remove(post);

    // 캐시 무효화
    await this.cacheService.invalidatePostCache(id, post.blog.slug);
  }

  /**
   * 조회수 증가 (별도 캐싱)
   */
  private async incrementViewCount(postId: string) {
    const viewKey = CacheKeys.POST_VIEW_COUNT(postId);
    
    // Redis에서 조회수 증가
    const views = await this.cacheService.get<number>(viewKey) || 0;
    await this.cacheService.set(viewKey, views + 1, CacheTTL.STATIC);
    
    // 일정 조회수마다 DB 업데이트 (예: 10회마다)
    if ((views + 1) % 10 === 0) {
      await this.postsRepository.increment({ id: postId }, 'viewCount', 10);
    }
  }
}
```

### 2. Blogs Service 캐싱 구현

```typescript
// blogs/blogs.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';

@Injectable()
export class BlogsService {
  constructor(
    private cacheService: CacheService,
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
  ) {}

  /**
   * 슬러그로 블로그 조회 (캐싱 적용)
   */
  async findOneBySlug(slug: string, user?: any) {
    const cacheKey = CacheKeys.BLOG_BY_SLUG(slug);
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const blog = await this.blogRepository.findOne({
          where: { slug },
          relations: ['owner'],
        });

        if (!blog) {
          throw new NotFoundException('블로그를 찾을 수 없습니다.');
        }

        // 비공개 블로그 처리
        const isOwner = user && String(user.id) === String(blog.userId);
        if (!blog.isPublic && !isOwner) {
          return {
            id: blog.id,
            slug: blog.slug,
            isPrivate: true,
            message: '비공개 블로그입니다',
          };
        }

        return blog;
      },
      CacheTTL.STATIC, // 1시간 캐싱 (블로그 정보는 자주 변경되지 않음)
    );
  }

  /**
   * 블로그 생성 (캐시 무효화)
   */
  async create(createBlogDto: CreateBlogDto, user: User) {
    // ... 블로그 생성 로직

    const blog = await this.blogRepository.save(newBlog);

    // 캐시 무효화
    await this.cacheService.invalidateBlogCache(blog.id, blog.slug);

    return blog;
  }

  /**
   * 블로그 수정 (캐시 무효화)
   */
  async update(id: string, updateBlogDto: UpdateBlogDto) {
    // ... 블로그 수정 로직

    const updatedBlog = await this.blogRepository.save(blog);

    // 캐시 무효화
    await this.cacheService.invalidateBlogCache(id, blog.slug);

    return updatedBlog;
  }
}
```

### 3. Users Service 캐싱 구현

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';

@Injectable()
export class UsersService {
  constructor(
    private cacheService: CacheService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * 사용자명으로 프로필 조회 (캐싱 적용)
   */
  async findByUsername(username: string) {
    const cacheKey = CacheKeys.USER_PROFILE(username);
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.usersRepository.findOne({
          where: { username },
          select: ['id', 'username', 'email', 'bio', 'profileImage', 'createdAt'],
        });

        if (!user) {
          return null;
        }

        // 프로필 이미지 URL 변환
        if (user.profileImage && user.profileImage.startsWith('v2/')) {
          user.profileImage = `/api/v1/files/proxy/${user.profileImage}`;
        }

        return user;
      },
      CacheTTL.EXTRA_LONG, // 30분 캐싱
    );
  }

  /**
   * ID로 사용자 조회 (캐싱 적용)
   */
  async findOne(id: string) {
    const cacheKey = CacheKeys.USER_BY_ID(id);
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.usersRepository.findOne({
          where: { id },
          select: [
            'id', 'email', 'username', 'role', 'profileImage',
            'isEmailVerified', 'createdAt', 'lastLoginAt', 'bio',
          ],
        });

        if (!user) {
          throw new NotFoundException('사용자를 찾을 수 없습니다.');
        }

        // 프로필 이미지 URL 변환
        if (user.profileImage && user.profileImage.startsWith('v2/')) {
          user.profileImage = `/api/v1/files/proxy/${user.profileImage}`;
        }

        return user;
      },
      CacheTTL.EXTRA_LONG, // 30분 캐싱
    );
  }

  /**
   * 프로필 업데이트 (캐시 무효화)
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // ... 사용자 업데이트 로직

    const updatedUser = await this.usersRepository.save(user);

    // 캐시 무효화
    await this.cacheService.invalidateUserCache(
      id,
      updatedUser.username,
      updatedUser.email,
    );

    return updatedUser;
  }
}
```

## 🎯 컨트롤러 레벨 캐싱

### 인터셉터를 사용한 자동 캐싱

```typescript
// posts/posts.controller.ts
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '../cache/cache.interceptor';
import { CacheTTL } from '../cache/cache.decorator';

@Controller('posts')
export class PostsController {
  
  /**
   * 자동 캐싱이 적용된 엔드포인트
   */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5분 캐싱
  findAll(@Query() query: any) {
    return this.postsService.findAll(
      query.page,
      query.limit,
      query.search,
      query.blogSlug,
    );
  }

  /**
   * 인기 포스트 (긴 캐싱)
   */
  @Get('popular')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800) // 30분 캐싱
  getPopularPosts() {
    return this.postsService.getPopularPosts();
  }

  /**
   * 최신 포스트 (짧은 캐싱)
   */
  @Get('latest')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // 1분 캐싱
  getLatestPosts() {
    return this.postsService.getLatestPosts();
  }
}
```

## 📊 캐시 모니터링 엔드포인트

```typescript
// cache/cache.controller.ts
import { Controller, Get, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CacheService } from './cache.service';

@Controller('cache')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CacheController {
  constructor(private cacheService: CacheService) {}

  /**
   * 캐시 통계 조회
   */
  @Get('stats')
  async getStats() {
    return this.cacheService.getStats();
  }

  /**
   * 캐시 초기화
   */
  @Delete('clear')
  async clearCache() {
    await this.cacheService.reset();
    return { message: '캐시가 초기화되었습니다.' };
  }

  /**
   * 특정 패턴 캐시 삭제
   */
  @Delete('pattern/:pattern')
  async clearPattern(@Param('pattern') pattern: string) {
    await this.cacheService.delPattern(pattern);
    return { message: `패턴 ${pattern}에 해당하는 캐시가 삭제되었습니다.` };
  }
}
```

## 🧪 테스트

### 캐시 성능 테스트

```typescript
// cache/cache.service.spec.ts
describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: 1, title: 'Test' };
      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedData);

      const result = await service.getOrSet(
        'test-key',
        async () => ({ id: 2, title: 'New' }),
        300,
      );

      expect(result).toEqual(cachedData);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      const newData = { id: 2, title: 'New' };
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await service.getOrSet(
        'test-key',
        async () => newData,
        300,
      );

      expect(result).toEqual(newData);
      expect(cacheManager.set).toHaveBeenCalledWith('test-key', newData, 300);
    });
  });
});
```

## 📈 성능 모니터링

### Redis 모니터링 명령어

```bash
# Redis 연결 확인
redis-cli ping

# 메모리 사용량 확인
redis-cli info memory

# 캐시 히트율 확인
redis-cli info stats | grep keyspace

# 모든 키 조회 (주의: 프로덕션에서는 사용 자제)
redis-cli keys "*"

# 특정 패턴 키 조회
redis-cli keys "posts:*"

# TTL 확인
redis-cli ttl "posts:list:1:10:all"

# 캐시 값 확인
redis-cli get "posts:list:1:10:all"

# 메모리 사용량 상위 키
redis-cli --bigkeys

# 실시간 모니터링
redis-cli monitor
```

### PM2 모니터링

```bash
# 애플리케이션 상태 확인
pm2 status

# 실시간 모니터링
pm2 monit

# 메모리 사용량 확인
pm2 describe blog-backend | grep memory

# 로그 확인
pm2 logs blog-backend --lines 100
```

## 🔍 트러블슈팅

### 일반적인 문제와 해결

1. **캐시 미스가 많은 경우**
   - TTL이 너무 짧게 설정되어 있는지 확인
   - 캐시 키 생성 로직이 일관성 있는지 확인
   - 메모리 부족으로 인한 eviction 확인

2. **캐시 무효화가 제대로 안 되는 경우**
   - 패턴 매칭이 정확한지 확인
   - 트랜잭션 내에서 캐시 무효화 시점 확인
   - 캐시 키 네이밍 규칙 일관성 확인

3. **메모리 부족**
   - `maxmemory-policy` 설정 확인 (allkeys-lru 권장)
   - 불필요한 캐시 데이터 정리
   - TTL 조정으로 메모리 사용량 최적화

4. **성능이 개선되지 않는 경우**
   - 캐시 히트율 확인 (목표: 80% 이상)
   - 네트워크 레이턴시 확인
   - 캐시 직렬화/역직렬화 오버헤드 확인

## 📊 예상 성능 개선

| 메트릭 | 개선 전 | 개선 후 | 개선율 |
|--------|---------|---------|--------|
| 포스트 목록 API | 200ms | 15ms | 92.5% |
| 포스트 상세 API | 150ms | 10ms | 93.3% |
| 프로필 조회 API | 100ms | 8ms | 92% |
| 블로그 메타 API | 80ms | 5ms | 93.8% |
| DB 쿼리 수 | 100/sec | 20/sec | 80% 감소 |
| 서버 CPU 사용률 | 60% | 25% | 58% 감소 |

## 🚀 프로덕션 체크리스트

- [ ] Redis 비밀번호 설정
- [ ] 메모리 제한 설정 (maxmemory)
- [ ] 적절한 eviction 정책 설정
- [ ] 백업 전략 수립 (AOF 또는 RDB)
- [ ] 모니터링 대시보드 구성
- [ ] 알람 설정 (메모리, CPU, 히트율)
- [ ] 캐시 워밍업 스크립트 작성
- [ ] 캐시 무효화 전략 문서화
- [ ] 부하 테스트 실행
- [ ] 롤백 계획 수립

---

**작성일**: 2025년 9월
**예상 구현 기간**: 1주
**예상 성능 개선**: 응답 시간 90% 감소, DB 부하 80% 감소