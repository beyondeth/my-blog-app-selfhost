# Developer Guide (개발자 가이드)

## 목차
1. [개발 환경 설정](#개발-환경-설정)
2. [프로젝트 구조](#프로젝트-구조)
3. [코딩 규칙](#코딩-규칙)
4. [개발 워크플로우](#개발-워크플로우)
5. [테스트](#테스트)
6. [디버깅](#디버깅)
7. [Git 워크플로우](#git-워크플로우)
8. [주요 기능 구현 가이드](#주요-기능-구현-가이드)
9. [FAQ](#faq)

---

## 개발 환경 설정

### 필수 도구

#### 1. Node.js 및 pnpm
```bash
# Node.js 20.x 설치 (nvm 사용 권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# pnpm 설치
npm install -g pnpm@9.0.0
```

#### 2. Docker 및 Docker Compose
```bash
# Docker 설치 (macOS)
brew install docker docker-compose

# Docker 설치 (Ubuntu)
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Docker 실행 확인
docker --version
docker-compose --version
```

#### 3. IDE 및 확장 프로그램

**VS Code 권장 확장**:
- ESLint
- Prettier - Code formatter
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense
- GitLens
- Thunder Client (API 테스트)
- Docker

**VS Code 설정** (.vscode/settings.json):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

### 초기 설정

```bash
# 1. 저장소 클론
git clone <repository-url>
cd my-blog-app

# 2. Docker 서비스 시작
docker-compose up -d

# 3. 백엔드 설정
cd backend
pnpm install
cp .env.example .env
# .env 파일 수정 (데이터베이스, Redis, JWT 시크릿 등)
pnpm migration:run

# 4. 프론트엔드 설정
cd ../frontend
pnpm install
cp .env.local.example .env.local
# .env.local 파일 수정 (API URL 등)
```

### 개발 서버 실행

#### 자동 재시작 모드로 실행

**터미널 1 - 백엔드**
```bash
cd backend
pnpm start:dev
# 서버: http://localhost:3000
# API 문서: http://localhost:3000/api-docs
```

**터미널 2 - 프론트엔드**
```bash
cd frontend
pnpm dev
# 서버: http://localhost:3001
```

---

## 프로젝트 구조

### Frontend 구조 (Next.js)

```
frontend/src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # 루트 레이아웃
│   ├── page.tsx              # 홈 페이지
│   ├── [blogSlug]/           # 동적 라우트 (블로그)
│   │   ├── page.tsx
│   │   └── [postSlug]/       # 중첩 동적 라우트 (포스트)
│   │       └── page.tsx
│   ├── new-story/            # 새 포스트 작성
│   ├── settings/             # 설정 페이지
│   ├── auth/                 # 인증 페이지
│   └── admin/                # 관리자 페이지
│
├── components/               # 재사용 가능한 컴포넌트
│   ├── ui/                   # 기본 UI (Button, Input 등)
│   ├── layout/               # 레이아웃 (Header, Footer)
│   ├── post/                 # 포스트 관련
│   └── blog/                 # 블로그 관련
│
├── editor/                   # Tiptap 에디터
│   ├── extensions/           # 커스텀 확장
│   ├── components/           # 에디터 UI
│   └── TiptapEditor.tsx      # 메인 에디터 컴포넌트
│
├── hooks/                    # 커스텀 Hooks
│   ├── useAuth.ts            # 인증
│   ├── usePosts.ts           # 포스트
│   └── useSocket.ts          # Socket.IO
│
├── lib/                      # 유틸리티
│   ├── api.ts                # API 클라이언트
│   ├── auth.ts               # 인증 헬퍼
│   └── utils.ts              # 일반 유틸리티
│
├── services/                 # API 서비스
│   ├── auth.service.ts
│   ├── posts.service.ts
│   └── chat.service.ts
│
├── stores/                   # Zustand 상태
│   ├── authStore.ts
│   └── chatStore.ts
│
└── types/                    # TypeScript 타입
    ├── api.types.ts
    └── post.types.ts
```

### Backend 구조 (NestJS)

```
backend/src/
├── auth/                     # 인증 모듈
│   ├── auth.controller.ts    # 인증 API
│   ├── auth.service.ts       # 인증 로직
│   ├── auth.module.ts
│   ├── strategies/           # Passport 전략
│   │   ├── jwt.strategy.ts
│   │   ├── google.strategy.ts
│   │   └── kakao.strategy.ts
│   └── dto/                  # 데이터 전송 객체
│       ├── register.dto.ts
│       └── login.dto.ts
│
├── users/                    # 사용자 모듈
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── entities/
│       └── user.entity.ts
│
├── posts/                    # 포스트 모듈
│   ├── posts.controller.ts
│   ├── posts.service.ts
│   ├── posts.module.ts
│   ├── services/             # 추가 서비스
│   │   └── post-indexing.service.ts
│   ├── workers/              # BullMQ 워커
│   │   └── post-indexing.worker.ts
│   └── entities/
│       └── post.entity.ts
│
├── common/                   # 공통 모듈
│   ├── guards/               # Guards
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/           # 커스텀 데코레이터
│   │   └── current-user.decorator.ts
│   ├── enums/                # Enum
│   │   └── role.enum.ts
│   ├── filters/              # 예외 필터
│   └── interceptors/         # 인터셉터
│
├── config/                   # 설정
│   ├── database.config.ts
│   └── jwt.config.ts
│
├── migrations/               # TypeORM 마이그레이션
├── app.module.ts             # 루트 모듈
└── main.ts                   # 진입점
```

---

## 코딩 규칙

### TypeScript 규칙

#### 1. 타입 정의
```typescript
// ✅ 명시적 타입 정의
function getUserById(id: string): Promise<User> {
  return this.usersRepository.findOne({ where: { id } });
}

// ❌ any 타입 사용 금지
function processData(data: any) { // 금지
  // ...
}

// ✅ 제네릭 또는 구체적 타입 사용
function processData<T>(data: T): T {
  return data;
}
```

#### 2. Interface vs Type
```typescript
// ✅ 객체 타입은 interface 선호
interface User {
  id: string;
  email: string;
  username: string;
}

// ✅ Union, Tuple 등은 type 사용
type Status = 'active' | 'inactive' | 'pending';
type Coordinates = [number, number];
```

#### 3. Enum 사용
```typescript
// ✅ 명확한 값이 있는 Enum
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR'
}

// ✅ 사용 예
user.role = Role.ADMIN;
```

### React 규칙 (Frontend)

#### 1. 함수형 컴포넌트 필수
```typescript
// ✅ 함수형 컴포넌트 + Hooks
export default function PostCard({ post }: { post: Post }) {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="post-card">
      {/* ... */}
    </div>
  );
}

// ❌ 클래스 컴포넌트 사용 금지
class PostCard extends React.Component { // 금지
  // ...
}
```

#### 2. Hooks 규칙
```typescript
// ✅ 커스텀 Hook
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  return { user, isLoading };
}

// ✅ 사용
function MyComponent() {
  const { user, isLoading } = useAuth();
  // ...
}
```

#### 3. Props 타입 정의
```typescript
// ✅ Props 인터페이스 정의
interface PostCardProps {
  post: Post;
  onLike?: () => void;
  showActions?: boolean;
}

export function PostCard({ post, onLike, showActions = true }: PostCardProps) {
  // ...
}
```

### NestJS 규칙 (Backend)

#### 1. 모듈 구조
```typescript
// ✅ 모듈 정의
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService]
})
export class PostsModule {}
```

#### 2. 의존성 주입
```typescript
// ✅ Constructor Injection
@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly usersService: UsersService,
  ) {}
}
```

#### 3. DTO 검증
```typescript
// ✅ class-validator 사용
export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
```

### 주석 규칙

```typescript
/**
 * 포스트를 생성합니다.
 *
 * @param createPostDto - 포스트 생성 데이터
 * @param userId - 작성자 ID
 * @returns 생성된 포스트
 * @throws {NotFoundException} - 사용자를 찾을 수 없는 경우
 */
async createPost(createPostDto: CreatePostDto, userId: string): Promise<Post> {
  // 사용자 확인
  const user = await this.usersService.findById(userId);
  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 포스트 생성 (복잡한 로직에만 주석)
  const post = this.postsRepository.create({
    ...createPostDto,
    authorId: userId,
  });

  return await this.postsRepository.save(post);
}
```

### 네이밍 컨벤션

```typescript
// 파일명: kebab-case
post-card.tsx
user.service.ts

// 컴포넌트/클래스: PascalCase
PostCard
UsersService

// 함수/변수: camelCase
getUserById
isAuthenticated

// 상수: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// 인터페이스: PascalCase (I 접두사 금지)
interface User { } // ✅
interface IUser { } // ❌

// Type: PascalCase
type PostStatus = 'draft' | 'published';
```

### 폴더 구조 규칙

```
모듈명/
├── module-name.controller.ts    # API 엔드포인트
├── module-name.service.ts       # 비즈니스 로직
├── module-name.module.ts        # 모듈 정의
├── dto/                         # 데이터 전송 객체
│   ├── create-module.dto.ts
│   └── update-module.dto.ts
├── entities/                    # 데이터베이스 엔티티
│   └── module-name.entity.ts
├── guards/                      # Guards (선택적)
├── decorators/                  # 커스텀 데코레이터 (선택적)
└── __tests__/                   # 테스트 파일
    └── module-name.service.spec.ts
```

---

## 개발 워크플로우

### 1. 새 기능 개발

```bash
# 1. 최신 코드 pull
git checkout main
git pull origin main

# 2. 새 브랜치 생성
git checkout -b feature/post-bookmarks

# 3. 개발 진행
# - 백엔드 API 개발
# - 프론트엔드 UI 개발
# - 테스트 작성

# 4. 커밋
git add .
git commit -m "feat: Add bookmark feature for posts"

# 5. Push 및 PR 생성
git push origin feature/post-bookmarks
```

### 2. 버그 수정

```bash
# 1. 버그 재현 확인
# 2. 테스트 케이스 작성
# 3. 수정
# 4. 테스트 통과 확인
# 5. 커밋 및 PR
```

### 3. 코드 리뷰

#### Pull Request 체크리스트
- [ ] 코드가 프로젝트 코딩 스타일을 따르는가?
- [ ] 모든 테스트가 통과하는가?
- [ ] 새로운 기능에 대한 테스트가 있는가?
- [ ] API 변경 사항이 문서화되었는가?
- [ ] 주요 변경 사항이 CHANGELOG에 기록되었는가?
- [ ] 마이그레이션이 필요한 경우 작성되었는가?

---

## 테스트

### Backend 테스트

#### 1. 단위 테스트 (Unit Test)
```typescript
// posts.service.spec.ts
describe('PostsService', () => {
  let service: PostsService;
  let repository: Repository<Post>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    repository = module.get<Repository<Post>>(getRepositoryToken(Post));
  });

  it('should create a post', async () => {
    const createPostDto = {
      title: 'Test Post',
      content: 'Test Content',
    };

    jest.spyOn(repository, 'save').mockResolvedValue({
      id: 'uuid',
      ...createPostDto,
    } as Post);

    const result = await service.create(createPostDto, 'user-id');

    expect(result.title).toBe(createPostDto.title);
    expect(repository.save).toHaveBeenCalled();
  });
});
```

#### 2. E2E 테스트
```typescript
// posts.e2e-spec.ts
describe('PostsController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 로그인 후 토큰 획득
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    accessToken = response.body.accessToken;
  });

  it('/posts (GET)', () => {
    return request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('posts');
        expect(Array.isArray(res.body.data.posts)).toBe(true);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Frontend 테스트

#### 1. 컴포넌트 테스트
```typescript
// PostCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import PostCard from './PostCard';

describe('PostCard', () => {
  const mockPost = {
    id: '1',
    title: 'Test Post',
    excerpt: 'Test excerpt',
    author: { username: 'testuser' },
  };

  it('renders post title', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });

  it('calls onLike when like button is clicked', () => {
    const onLike = jest.fn();
    render(<PostCard post={mockPost} onLike={onLike} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    expect(onLike).toHaveBeenCalled();
  });
});
```

### 테스트 실행

```bash
# Backend 테스트
cd backend
pnpm test              # 단위 테스트
pnpm test:e2e          # E2E 테스트
pnpm test:cov          # 커버리지

# Frontend 테스트
cd frontend
pnpm test
pnpm test:coverage
```

---

## 디버깅

### Backend 디버깅 (VS Code)

#### launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "port": 9229,
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

### Frontend 디버깅

#### Next.js 디버그
```bash
# 디버그 모드로 실행
NODE_OPTIONS='--inspect' pnpm dev
```

### 로그 활용

```typescript
// Backend (NestJS)
import { Logger } from '@nestjs/common';

export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  async findAll() {
    this.logger.log('Finding all posts');
    this.logger.debug('Additional debug info');
    this.logger.error('Error occurred', error.stack);
  }
}

// Frontend (Next.js)
console.log('Debug info:', data);
console.error('Error:', error);
```

---

## Git 워크플로우

### 브랜치 전략

```
main (프로덕션)
  └── develop (개발)
       ├── feature/user-profile
       ├── feature/post-comments
       └── bugfix/login-error
```

### 커밋 컨벤션

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드 업무, 패키지 매니저 설정

**예시**:
```bash
git commit -m "feat(posts): Add bookmark feature"
git commit -m "fix(auth): Fix JWT token expiration issue"
git commit -m "docs: Update API reference for posts endpoint"
```

---

## 주요 기능 구현 가이드

### 1. 새로운 API 엔드포인트 추가

#### Step 1: DTO 생성
```typescript
// backend/src/posts/dto/create-post.dto.ts
export class CreatePostDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  content: string;
}
```

#### Step 2: Service 로직 구현
```typescript
// backend/src/posts/posts.service.ts
@Injectable()
export class PostsService {
  async create(createPostDto: CreatePostDto, userId: string): Promise<Post> {
    const post = this.postsRepository.create({
      ...createPostDto,
      authorId: userId,
    });
    return await this.postsRepository.save(post);
  }
}
```

#### Step 3: Controller 엔드포인트 생성
```typescript
// backend/src/posts/posts.controller.ts
@Controller('posts')
export class PostsController {
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postsService.create(createPostDto, user.id);
  }
}
```

#### Step 4: Frontend API 서비스
```typescript
// frontend/src/services/posts.service.ts
export const createPost = async (data: CreatePostDto): Promise<Post> => {
  const response = await fetch(`${API_URL}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error('Failed to create post');
  return response.json();
};
```

### 2. 데이터베이스 마이그레이션

```bash
# 1. 엔티티 수정 후 마이그레이션 생성
cd backend
pnpm migration:generate -- src/migrations/AddBookmarkTable

# 2. 마이그레이션 파일 확인 및 수정
# backend/src/migrations/xxxxx-AddBookmarkTable.ts

# 3. 마이그레이션 실행
pnpm migration:run

# 4. 롤백 (필요 시)
pnpm migration:revert
```

### 3. React Query 사용

```typescript
// Frontend Hook
export function usePosts(page = 1) {
  return useQuery({
    queryKey: ['posts', page],
    queryFn: () => fetchPosts(page),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 컴포넌트에서 사용
function PostList() {
  const { data, isLoading, error } = usePosts(1);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

---

## FAQ

### Q1. 포트가 이미 사용 중이라는 오류가 발생합니다.

**A**: 포트를 사용 중인 프로세스를 종료하세요.
```bash
# 포트 확인
lsof -i :3000  # 백엔드
lsof -i :3001  # 프론트엔드

# 프로세스 종료
kill -9 <PID>
```

### Q2. 데이터베이스 연결 오류가 발생합니다.

**A**: Docker 서비스가 실행 중인지 확인하세요.
```bash
docker-compose ps
docker-compose up -d postgres redis
```

### Q3. pnpm install이 실패합니다.

**A**: 캐시를 정리하고 다시 시도하세요.
```bash
pnpm cache clean --force
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Q4. 마이그레이션이 실패합니다.

**A**: 데이터베이스 상태를 확인하고 필요 시 수동으로 수정하세요.
```bash
# 마이그레이션 상태 확인
npm run typeorm migration:show

# 마이그레이션 되돌리기
pnpm migration:revert

# 데이터베이스 초기화 (개발 환경만)
docker-compose down -v
docker-compose up -d
pnpm migration:run
```

### Q5. Hot Reload가 작동하지 않습니다.

**A**:
- Backend: `pnpm start:dev` 사용 확인
- Frontend: Next.js Fast Refresh 활성화 확인
- 파일 시스템 감시 한도 증가 (Linux):
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Q6. TypeScript 타입 에러가 발생합니다.

**A**: 타입 체크를 실행하세요.
```bash
# Backend
cd backend
pnpm type-check

# Frontend
cd frontend
pnpm type-check
```

---

## 유용한 명령어 모음

### Backend
```bash
# 개발 서버
pnpm start:dev

# 프로덕션 빌드
pnpm build
pnpm start:prod

# 테스트
pnpm test
pnpm test:e2e
pnpm test:cov

# 린트
pnpm lint
pnpm lint:fix

# 마이그레이션
pnpm migration:generate -- src/migrations/MigrationName
pnpm migration:run
pnpm migration:revert
```

### Frontend
```bash
# 개발 서버
pnpm dev

# 프로덕션 빌드
pnpm build
pnpm start

# 린트
pnpm lint

# 타입 체크
pnpm type-check
```

### Docker
```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 로그 확인
docker-compose logs -f postgres
docker-compose logs -f redis

# 컨테이너 재시작
docker-compose restart postgres
```

---

## 참고 자료

- [NestJS 공식 문서](https://docs.nestjs.com/)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [TypeORM 공식 문서](https://typeorm.io/)
- [React Query 공식 문서](https://tanstack.com/query/latest)
- [Tiptap 공식 문서](https://tiptap.dev/)

---

**마지막 업데이트**: 2025-01-13
