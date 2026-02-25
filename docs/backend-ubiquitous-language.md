# Backend Ubiquitous Language (용어 사전)

이 문서는 백엔드 리팩토링 진행 시 내부 서비스, 도메인, 리포지토리 계층에서 일관되게 사용해야 하는 용어의 기준을 정의합니다. **클라이언트(프론트/앱)와 통신하는 외부 DTO 명칭은 기존 스펙 하위 호환성을 위해 유지하되**, 컨트롤러 내부에서 이 사전의 용어로 반드시 매핑(Mapping)해야 합니다.

## 1. 전역(Global) 금지어 및 권장어

| ❌ 금지어 (Generic/Vague) | ✅ 권장어 (Domain Specific) | 📝 비고 / 예시 |
| :--- | :--- | :--- |
| `targetUserId` | `memberIdToBan`, `userIdToPromote`, `authorId` | 행위의 목적이 드러나야 함. (예: 밴 대상인지, 승급 대상인지) |
| `data`, `payload`, `info` | `updateProfileCommand`, `createPostPayload` | 제네릭한 객체명 금지. 어떤 행위에 대한 데이터인지 명시. |
| `result`, `res` | `createdPost`, `bannedMember` | 반환값의 정체를 명확히 표기. |
| `handle()`, `process()` | `approvePost()`, `suspendAccount()` | 뭉뚱그려진 동사 금지. 구체적인 비즈니스 액션 동사 사용. |
| `get()` (복잡한 조합 시) | `aggregateXYZ()`, `calculateXYZ()` | 단순 DB 조회가 아닌 여러 테이블/캐시 조인, 계산 로직이 포함될 때. |

## 2. 도메인별 용어 (Domain-Specific Terms)

### 2.1. Posts (게시글)
- **Draft:** 발행 전 상태의 임시 저장된 글.
- **Published:** 독자에게 공개된 상태의 글.
- **Editor's Pick:** 관리자나 알고리즘에 의해 선정된 추천 게시글.
- **`authorId`:** 글을 작성한 사람의 ID (DTO의 `userId` 역할).

### 2.2. Users & Auth (사용자 및 인증)
- **`accountId`:** 인증 시스템 맥락에서 사용자를 식별할 때.
- **`profileId`:** 프로필 정보(닉네임, 아바타 등) 맥락에서 사용자를 식별할 때.
- **Banned:** 시스템이나 커뮤니티 규칙 위반으로 이용이 제한된 상태.
- **Suspended:** 일시적으로 권한이 중지된 상태.

### 2.3. Communities (커뮤니티)
- **`memberId`:** 특정 커뮤니티에 소속된 사용자의 ID.
- **Owner / Top-Mod:** 커뮤니티의 최고 관리자 및 소유자. 
- **Moderator:** 커뮤니티 관리자 그룹 (Owner 포함 권한자들).

## 3. 컨트롤러 명명 규칙 (Controller Mapping Rule)

외부 DTO의 필드명에 제네릭한 변수가 포함된 경우 커맨드 객체(Command Object)나 서비스 호출 시점에 매핑합니다.

```typescript
// ❌ Bad (제네릭 변수 그대로 서비스에 전달)
this.communityService.banUser(dto.targetUserId);

// ✅ Good (도메인 용어로 매핑 후 전달)
this.communityService.banUser({ memberIdToBan: dto.targetUserId });
```
