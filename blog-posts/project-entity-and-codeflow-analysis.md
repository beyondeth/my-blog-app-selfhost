### 프로젝트 구조 분석: 엔티티 및 코드 흐름

#### 1. 💾 엔티티 구조 분석 (데이터 모델)

프로젝트의 데이터 모델은 여러 기능 영역으로 나뉘어 체계적으로 설계되어 있습니다.

*   **핵심 콘텐츠 엔티티**:
    *   `User`: 사용자 계정의 중심. 프로필, 역할, 인증 정보를 가지며 `Blog`, `Post`, `Comment` 등 대부분의 다른 엔티티와 관계를 맺습니다.
    *   `Blog`: 사용자의 개인 블로그. `User`와 1:1 관계이며, 여러 `Post`를 포함합니다.
    *   `Post`: 핵심 콘텐츠. `User`(작성자)와 `Blog`에 소속됩니다. 제목, 내용(HTML/마크다운), 태그, 썸네일 등 다양한 속성을 가집니다.
    *   `Comment`: `Post`에 달리는 댓글. `User`가 작성하며, 대댓글 구조를 지원합니다.

*   **인증 및 권한 엔티티**:
    *   `UserIdentity`: 여러 소셜 로그인(Google, GitHub 등)을 단일 `User` 계정에 연결해주는 핵심 엔티티입니다. 확장성 높은 인증 아키텍처를 구성합니다.
    *   `ApiKey`: 외부 시스템 연동을 위한 API 키. `User` 및 `Blog`에 연결되어 HMAC 인증에 사용됩니다.
    *   `PasswordResetToken` / `EmailVerification`: 비밀번호 재설정 및 이메일 인증 절차를 위한 임시 토큰을 관리합니다.

*   **소셜 및 상호작용 엔티티**:
    *   `Follow`: 사용자 간의 팔로우 관계를 기록합니다.
    *   `CommentLike`: 댓글에 대한 '좋아요'/'싫어요'를 관리합니다.
    *   `Notification`: 새 팔로워, 댓글, 포스트 등 다양한 활동에 대한 알림을 생성하고 관리합니다.

*   **파일 관리 엔티티**:
    *   `File`: 업로드된 파일(이미지 등)의 메타데이터(S3 키, URL, MIME 타입 등)를 저장합니다.
    *   `FileContext`: 파일의 '용도'(`avatar`, `post_content` 등)와 '소속'(`User`, `Post` 등)을 정의하여 파일을 체계적으로 관리하는 중요한 엔티티입니다.

*   **관리 및 로깅 엔티티**:
    *   `AuditLog`: 시스템 내 주요 변경 이력(예: `post_updated`)을 기록하여 보안 및 감사에 활용됩니다.
    *   `Report`: 사용자가 부적절한 콘텐츠나 사용자를 신고하는 기능을 지원합니다.
    *   `AnalyticsEvent`: 사용자 행동 데이터를 수집하여 서비스 분석에 사용됩니다.

#### 2. 🌊 코드 흐름 분석: 새 포스트 생성 시나리오

사용자가 새 블로그 포스트를 작성할 때의 일반적인 백엔드 코드 흐름은 다음과 같이 추론할 수 있습니다.

1.  **API 요청 (Controller)**
    *   클라이언트가 `POST /api/v1/posts` 엔드포인트로 제목, 내용 등이 담긴 요청을 보냅니다.
    *   `PostsController`가 이 요청을 받아 `CreatePostDto`를 통해 유효성을 검사합니다.
    *   JWT 인증 가드를 통과하며 얻은 `user` 정보도 함께 확보합니다.

2.  **비즈니스 로직 (Service)**
    *   `PostsController`는 `PostsService`의 `create(createPostDto, user)`와 같은 메서드를 호출합니다.
    *   `PostsService`는 핵심 비즈니스 로직을 수행합니다.
        *   새 `Post` 엔티티 인스턴스를 생성합니다.
        *   DTO의 데이터(제목, 마크다운 내용, 태그 등)와 `user.id` (작성자), `user.blog.id` (소속 블로그)를 엔티티에 채워 넣습니다.
        *   마크다운(`content_markdown`)을 HTML(`content`)로 변환하는 로직을 수행합니다.

3.  **데이터베이스 저장 (Repository & TypeORM)**
    *   `PostsService`가 `PostRepository.save(newPost)`를 호출합니다.
    *   TypeORM은 `@BeforeInsert` 데코레이터가 붙은 `generateSlug()`(고유 URL 생성)와 `extractThumbnailFromContent()`(콘텐츠 내 첫 이미지로 썸네일 자동 생성) 메서드를 실행합니다.
    *   최종적으로 `INSERT` SQL 쿼리가 실행되어 데이터베이스에 새 포스트가 저장됩니다.

4.  **후속 처리 (Events / Listeners)**
    *   포스트가 성공적으로 저장된 후, 비동기적으로 추가 작업이 트리거될 수 있습니다.
        *   **알림**: `NotificationService`를 통해 작성자의 팔로워들에게 새 글 알림을 보냅니다.
        *   **분석**: `AnalyticsService`를 통해 'post_created' 이벤트를 기록합니다.

5.  **응답 (Controller)**
    *   `PostsService`는 생성된 `Post` 객체를 `PostsController`에 반환합니다.
    *   `PostsController`는 이 객체를 `201 Created` 상태 코드와 함께 클라이언트에 응답합니다.