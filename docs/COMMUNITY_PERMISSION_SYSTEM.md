# 커뮤니티 권한 시스템 가이드

> Reddit 스타일의 모더레이터 권한 시스템 구조 및 사용법

## 목차

1. [핵심 개념](#핵심-개념)
2. [역할(Role) vs 권한(Permission)](#역할role-vs-권한permission)
3. [운영진 계층 구조](#운영진-계층-구조)
4. [권한별 기능 설명](#권한별-기능-설명)
5. [핵심 규칙](#핵심-규칙)
6. [마이그레이션 정보](#마이그레이션-정보)
7. [구현 파일 목록](#구현-파일-목록)
8. [사용 예시](#사용-예시)

---

## 핵심 개념

### 두 가지 시스템 병행 운영

현재 커뮤니티 시스템은 **기존 역할 시스템**과 **새 권한 시스템**을 병행 운영합니다.

| 시스템 | 필드 | 용도 |
|--------|------|------|
| **기존 역할 시스템** | `role` | 하위 호환성, UI 표시용 |
| **새 권한 시스템** | `permissions` + `moderatorOrder` | 실제 권한 체크, Reddit 스타일 |

### 왜 두 시스템을 병행하는가?

1. **하위 호환성**: 기존 코드에서 `role` 필드를 사용하는 부분이 많음
2. **UI 단순화**: 사용자에게 보여줄 때는 단순한 역할명이 더 직관적
3. **세밀한 권한 제어**: 실제 기능 접근은 세분화된 권한으로 체크

---

## 역할(Role) vs 권한(Permission)

### 1. 역할 (Role) - 기존 시스템

```typescript
enum CommunityRole {
  OWNER = 'owner',        // 커뮤니티 창설자
  ADMIN = 'admin',        // 부관리자
  MODERATOR = 'moderator', // 모더레이터
  MEMBER = 'member',      // 일반 멤버
}
```

**특징:**
- 단순 4단계 계층 구조
- UI 표시용으로 주로 사용
- 하위 호환성 유지를 위해 존재
- 기존 가드(`CommunityRolesGuard`)에서 사용

### 2. 권한 (Permission) - 새 시스템

```typescript
enum ModeratorPermission {
  ALL = 'all',           // 전체 관리 (모든 권한 + 다른 운영진 관리)
  MEMBERS = 'members',   // 멤버 관리 (차단/승인)
  SETTINGS = 'settings', // 설정 변경
  POSTS = 'posts',       // 게시물/댓글 관리
  TAGS = 'tags',         // 태그(플레어) 관리
  MESSAGES = 'messages', // 문의/신고 관리
}
```

**특징:**
- **조합 가능**: 여러 권한을 동시에 보유 가능
- **세밀한 제어**: 각 기능별 접근 권한 분리
- **Reddit 스타일**: Reddit의 모더레이터 권한 시스템 참고
- 새 가드(`CommunityPermissionsGuard`)에서 사용

---

## 운영진 계층 구조

### 데이터베이스 필드

```typescript
// community_members 테이블 (TypeORM Entity)
interface CommunityMember {
  // 기존 필드
  role: CommunityRole;              // 'owner' | 'admin' | 'moderator' | 'member'

  // 새 권한 필드
  permissions: ModeratorPermission[] | null;  // 권한 배열 (예: ['all'] 또는 ['posts', 'members'])
  moderatorOrder: number | null;              // 운영진 순서 (1 = Top-Mod, 2, 3, ...)
  promotedAt: Date | null;                    // 운영진 승격 시간

  // 초대/승인 관련 필드
  applicationMessage: string | null;  // 가입 신청서 (RESTRICTED 커뮤니티용)
  inviteId: string | null;            // 초대를 통한 가입인 경우
  approvedById: string | null;        // 가입 승인한 모더레이터 ID
  approvedAt: Date | null;            // 가입 승인 시간
}
```

### 계층 구조 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                     커뮤니티 운영진 구조                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [moderatorOrder: 1] Top-Mod (대표 운영자)                       │
│  ├── role: 'owner'                                              │
│  ├── permissions: ['all']                                       │
│  └── 모든 권한 + 아래 운영진 관리 가능                             │
│                                                                 │
│  [moderatorOrder: 2] 부운영자                                    │
│  ├── role: 'admin'                                              │
│  ├── permissions: ['all']                                       │
│  └── moderatorOrder 3+ 운영진 관리 가능                          │
│                                                                 │
│  [moderatorOrder: 3] 모더레이터 A                                │
│  ├── role: 'moderator'                                          │
│  ├── permissions: ['posts', 'members']                          │
│  └── 게시물/댓글 관리 + 멤버 관리만 가능                           │
│                                                                 │
│  [moderatorOrder: 4] 모더레이터 B                                │
│  ├── role: 'moderator'                                          │
│  ├── permissions: ['posts']                                     │
│  └── 게시물/댓글 관리만 가능                                      │
│                                                                 │
│  [moderatorOrder: null] 일반 멤버                                │
│  ├── role: 'member'                                             │
│  ├── permissions: null                                          │
│  └── 읽기/쓰기만 가능 (관리 권한 없음)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 주요 개념

| 용어 | 설명 |
|------|------|
| **Top-Mod** | `moderatorOrder = 1`인 최상위 운영자. 커뮤니티의 대표 관리자 |
| **운영진** | `moderatorOrder`가 null이 아닌 모든 멤버 (staff) |
| **일반 멤버** | `moderatorOrder = null`, `role = 'member'` |

---

## 권한별 기능 설명

| 권한 | 코드 | 한국어 | 할 수 있는 것 |
|------|------|--------|--------------|
| **전체 관리** | `all` | 전체 관리 | 모든 기능 + 자신보다 아래 순서 운영진 관리 |
| **멤버 관리** | `members` | 멤버 관리 | 사용자 차단/해제, 가입 승인/거부, 멤버 목록 관리 |
| **설정** | `settings` | 설정 | 커뮤니티 정보 수정, 규칙 편집, 외관 변경 |
| **게시물 관리** | `posts` | 게시물 관리 | 게시물/댓글 삭제, 공지 작성, 고정글 설정 |
| **태그 관리** | `tags` | 태그 관리 | 게시물/사용자 태그(플레어) 생성/편집/삭제 |
| **문의 관리** | `messages` | 문의 관리 | 모드메일 응답, 신고 처리 |

### 권한별 상세 기능

#### ALL (전체 관리)
- 모든 권한을 포함 (MEMBERS, SETTINGS, POSTS, TAGS, MESSAGES)
- 자신보다 `moderatorOrder`가 큰 운영진 관리 가능:
  - 운영진 추가/제거
  - 권한 변경
  - 순서 변경
- Top-Mod만 가진 특별 권한:
  - 커뮤니티 양도

> **참고**: 커뮤니티 삭제는 Reddit 정책에 따라 **플랫폼 관리자(Site Admin)만** 가능합니다.
> Owner를 포함한 모든 커뮤니티 운영진은 커뮤니티를 삭제할 수 없습니다.

#### MEMBERS (멤버 관리)
- 사용자 차단 (ban) / 해제 (unban)
- 가입 승인 / 거부 (RESTRICTED 커뮤니티)
- 멤버 목록 조회 및 관리
- 초대 링크 생성

#### SETTINGS (설정)
- 커뮤니티 기본 정보 수정 (이름, 설명, 아이콘, 배너)
- 커뮤니티 규칙 편집
- 가입 방식 변경 (PUBLIC, RESTRICTED, PRIVATE)
- 성인 커뮤니티 설정

#### POSTS (게시물 관리)
- 게시물 삭제 / 복원
- 댓글 삭제 / 복원
- 게시물 고정 / 해제
- 공지사항 작성

#### TAGS (태그 관리)
- 게시물 태그(플레어) CRUD
- 사용자 태그(플레어) CRUD
- 태그 색상/스타일 설정

#### MESSAGES (문의 관리)
- 모드메일 수신 및 응답
- 신고 처리
- 사용자 문의 대응

---

## 핵심 규칙

### 1. 권한 조합 방식

권한은 배열로 저장되어 여러 개를 조합할 수 있습니다:

```typescript
// 다양한 권한 조합 예시
Top-Mod:       ['all']                    // 모든 권한
부관리자:      ['all']                    // 모든 권한
콘텐츠 관리자: ['posts', 'tags']          // 게시물 + 태그만
신규 운영자:   ['posts']                  // 게시물만
멤버 관리자:   ['members', 'messages']    // 멤버 + 문의만
```

### 2. 순서 기반 관리 (Reddit 스타일)

`moderatorOrder`가 낮을수록 상위 권한을 가집니다:

```
[order: 1] → [order: 2, 3, 4, ...] 관리 가능
[order: 2] → [order: 3, 4, 5, ...] 관리 가능
[order: 3] → [order: 4, 5, 6, ...] 관리 가능
```

**중요**: `ALL` 권한이 있어야만 다른 운영진을 관리할 수 있습니다!

```typescript
// 운영진 관리 가능 여부 판단
function canManageModerator(actor: CommunityMember, target: CommunityMember): boolean {
  // ALL 권한이 없으면 관리 불가
  if (!hasPermission(actor, ModeratorPermission.ALL)) {
    return false;
  }

  // 자신보다 순서가 큰(낮은 권한) 운영진만 관리 가능
  return actor.moderatorOrder! < target.moderatorOrder!;
}
```

### 3. Top-Mod 승계 규칙

Top-Mod (`moderatorOrder = 1`)가 커뮤니티를 떠날 때:

```
1. 다음 순서(order=2) 운영진이 자동으로 Top-Mod가 됨
2. 해당 운영진에게 ['all'] 권한 자동 부여
3. 커뮤니티 creatorId도 업데이트
4. 나머지 운영진 순서 1씩 감소
```

```typescript
// 승계 로직 (community-membership.service.ts)
async handleTopModSuccession(community: Community, leavingMember: CommunityMember) {
  // 다음 순서 운영진 찾기
  const nextMod = await this.memberRepo.findOne({
    where: {
      communityId: community.id,
      moderatorOrder: 2,
    },
  });

  if (nextMod) {
    // Top-Mod 권한 부여
    nextMod.moderatorOrder = 1;
    nextMod.permissions = [ModeratorPermission.ALL];
    nextMod.role = CommunityRole.OWNER;

    // 커뮤니티 소유자 업데이트
    community.creatorId = nextMod.userId;

    // 나머지 운영진 순서 조정
    await this.memberRepo
      .createQueryBuilder()
      .update()
      .set({ moderatorOrder: () => '"moderatorOrder" - 1' })
      .where('communityId = :communityId', { communityId: community.id })
      .andWhere('moderatorOrder > 2')
      .execute();
  }
}
```

---

## 마이그레이션 정보

### 적용된 마이그레이션

1. **AddModeratorPermissionsSystem1784000000000**
   - `permissions` 컬럼 추가 (text[] 타입)
   - `moderatorOrder` 컬럼 추가 (integer 타입)
   - `promotedAt` 컬럼 추가 (timestamptz 타입)
   - 기존 데이터 변환

2. **AddCommunityInviteSystem1784000000000**
   - `community_invites` 테이블 생성
   - `applicationMessage`, `inviteId`, `approvedById`, `approvedAt` 컬럼 추가

### 기존 데이터 변환 규칙

| 기존 role | 변환 후 permissions | 변환 후 moderatorOrder |
|-----------|--------------------|-----------------------|
| `owner` | `['all']` | `1` (Top-Mod) |
| `admin` | `['all']` | `2, 3, ...` (가입 순서) |
| `moderator` | `['posts', 'members']` | `N+1, N+2, ...` |
| `member` | `null` | `null` |

---

## 구현 파일 목록

### 백엔드

| 파일 | 설명 |
|------|------|
| `backend/src/communities/enums/moderator-permission.enum.ts` | 권한 enum 정의 |
| `backend/src/communities/entities/community-member.entity.ts` | 엔티티 필드 (permissions, moderatorOrder, promotedAt) |
| `backend/src/communities/utils/permission.utils.ts` | 권한 체크 유틸리티 함수 |
| `backend/src/communities/guards/community-permissions.guard.ts` | 권한 기반 가드 |
| `backend/src/communities/decorators/community-permissions.decorator.ts` | `@RequirePermission()` 데코레이터 |
| `backend/src/communities/services/community-membership.service.ts` | Top-Mod 승계 로직 |
| `backend/src/migrations/1784000000000-AddModeratorPermissionsSystem.ts` | 마이그레이션 |

### 프론트엔드

| 파일 | 설명 |
|------|------|
| `frontend/src/types/community.ts` | 타입 정의 및 헬퍼 함수 |
| `frontend/src/components/community/JoinButton.tsx` | "운영중" 버튼 UI |

---

## 사용 예시

### 백엔드 - 권한 체크

```typescript
import { hasPermission, canManageModerator } from '../utils/permission.utils';
import { ModeratorPermission } from '../enums/moderator-permission.enum';

// 특정 권한 확인
if (hasPermission(member, ModeratorPermission.POSTS)) {
  // 게시물 삭제 가능
}

// 운영진 관리 가능 여부
if (canManageModerator(actor, target)) {
  // target 운영진 제거/권한 변경 가능
}

// 여러 권한 중 하나라도 있는지 확인
if (hasAnyPermission(member, [ModeratorPermission.POSTS, ModeratorPermission.MEMBERS])) {
  // 게시물 또는 멤버 관리 가능
}
```

### 백엔드 - 가드 데코레이터 사용

```typescript
import { RequirePermission } from '../decorators/community-permissions.decorator';
import { CommunityPermissionsGuard } from '../guards/community-permissions.guard';

@Controller('communities/:slug/posts')
export class CommunityPostController {

  @Delete(':postId')
  @UseGuards(CommunityPermissionsGuard)
  @RequirePermission(ModeratorPermission.POSTS)
  async deletePost(
    @Param('slug') slug: string,
    @Param('postId') postId: string,
  ) {
    // POSTS 권한이 있는 운영진만 접근 가능
  }

  @Patch(':postId/pin')
  @UseGuards(CommunityPermissionsGuard)
  @RequirePermission(ModeratorPermission.POSTS)
  async pinPost(
    @Param('slug') slug: string,
    @Param('postId') postId: string,
  ) {
    // POSTS 권한이 있는 운영진만 접근 가능
  }
}
```

### 프론트엔드 - 권한 체크

```typescript
import {
  hasPermission,
  isStaff,
  formatPermissions,
  ModeratorPermission
} from '@/types/community';

// 운영진 여부 확인
if (isStaff(member)) {
  // "운영중" 버튼 표시
}

// 특정 권한 확인
if (hasPermission(member, ModeratorPermission.SETTINGS)) {
  // 설정 버튼 표시
}

// 권한 목록 표시 (한국어)
const permText = formatPermissions(member.permissions);
// 결과: "전체 관리" 또는 "게시물 관리, 멤버 관리"
```

### 프론트엔드 - 조건부 UI 렌더링

```tsx
import { hasPermission, isStaff, ModeratorPermission } from '@/types/community';

function CommunityHeader({ community, currentMember }) {
  return (
    <div>
      {/* 운영진에게만 관리 버튼 표시 */}
      {isStaff(currentMember) && (
        <Button onClick={() => openModPanel()}>
          관리 패널
        </Button>
      )}

      {/* 설정 권한이 있는 경우만 설정 버튼 표시 */}
      {hasPermission(currentMember, ModeratorPermission.SETTINGS) && (
        <Button onClick={() => openSettings()}>
          설정
        </Button>
      )}

      {/* 멤버 관리 권한이 있는 경우만 멤버 관리 버튼 표시 */}
      {hasPermission(currentMember, ModeratorPermission.MEMBERS) && (
        <Button onClick={() => openMemberManagement()}>
          멤버 관리
        </Button>
      )}
    </div>
  );
}
```

---

## FAQ

### Q: 기존 `role` 필드와 새 `permissions` 필드 중 어떤 것을 사용해야 하나요?

**A:**
- **권한 체크**: `permissions` 필드와 `hasPermission()` 함수 사용
- **UI 표시**: `role` 필드 사용 가능 (더 단순함)
- **운영진 여부**: `isStaff()` 함수 또는 `moderatorOrder !== null` 체크

### Q: ALL 권한과 개별 권한을 동시에 가질 수 있나요?

**A:** 가능하지만 불필요합니다. ALL 권한이 있으면 모든 개별 권한을 포함합니다.

### Q: 운영진 순서는 어떻게 변경하나요?

**A:** ALL 권한을 가진 상위 운영진이 자신보다 순서가 낮은 운영진의 순서를 변경할 수 있습니다.

### Q: 커뮤니티 삭제는 누가 할 수 있나요?

**A:** Reddit 정책에 따라 커뮤니티 삭제는 **플랫폼 관리자(Site Admin)만** 가능합니다. Top-Mod를 포함한 모든 커뮤니티 운영진은 커뮤니티를 삭제할 수 없습니다. 이는 커뮤니티와 해당 콘텐츠를 보호하기 위한 정책입니다.

---

## 관련 문서

- [커뮤니티 기능 개요](./dev/community-feature.md) (예정)
- [API 엔드포인트 문서](./dev/api-endpoints.md) (예정)

---

**Last Updated**: 2024-12-05
**Version**: 1.0.0
