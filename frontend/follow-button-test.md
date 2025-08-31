# FollowButton 컴포넌트 개선 완료

## 변경사항

### 1. FollowButton 완전 재작성
- **명확한 상태 관리**: useState와 hover 상태 추가
- **분리된 API 함수**: followUser/unfollowUser로 분리
- **개선된 에러 처리**: 더 구체적인 에러 메시지
- **낙관적 업데이트**: 더 안정적인 상태 전환
- **토스트 메시지**: 정확한 성공/실패 피드백

### 2. 3가지 Variant 구현
- **default**: 전체 버튼 (최소 너비 110px)
- **minimal**: 작은 텍스트 + 아이콘 버튼
- **icon-only**: 아이콘만 있는 원형 버튼 (40px)

### 3. Facebook/Twitter 스타일 UX
- **팔로우**: 파란색 버튼 "팔로우" + UserPlus 아이콘
- **팔로잉**: 회색 버튼 "팔로잉" + UserCheck 아이콘
- **호버 시**: 빨간색 "언팔로우" + UserMinus 아이콘

### 4. 개선된 훅과 컴포넌트들
- **useFollowInfo**: 로그인 상태 체크 추가, 에러 처리 개선
- **FollowStats**: useFollowInfo 사용, 호버 효과 추가
- **FollowIndicator**: 스타일 개선, 조건부 표시 개선
- **FollowerCount**: 로딩 상태, 포매팅 개선
- **FollowingListSection**: 팔로워 섹션에서 불필요한 팔로우 버튼 제거
- **UserLinkWithTooltip**: 일관된 쿼리 키 사용

### 5. 캐시 키 일관성
- 모든 컴포넌트에서 `queryKeys.users.followInfo(userId)` 사용
- 관련 캐시 무효화 전략 통일

## 테스트 시나리오

### 기본 동작
- [ ] 팔로우 버튼 클릭 → "팔로우했습니다" 토스트
- [ ] 언팔로우 버튼 클릭 → "언팔로우했습니다" 토스트
- [ ] 자신의 프로필에서는 버튼 숨김
- [ ] 로그인하지 않은 상태에서 클릭 → 로그인 페이지로 이동

### 상태 전환
- [ ] 팔로우 상태: 파란색 "팔로우" 버튼
- [ ] 팔로잉 상태: 회색 "팔로잉" 버튼
- [ ] 호버 시: 빨간색 "언팔로우" + UserMinus 아이콘

### Variant별 테스트
- [ ] default: 풀 버튼 스타일
- [ ] minimal: 작은 인라인 스타일
- [ ] icon-only: 원형 아이콘 버튼

### 에러 처리
- [ ] 네트워크 에러 → "팔로우 상태 변경에 실패했습니다" 토스트
- [ ] 인증 에러 → "로그인이 필요합니다" 토스트 + 로그인 페이지
- [ ] 자신을 팔로우 → "자신을 팔로우할 수 없습니다" 토스트

### 성능
- [ ] 낙관적 업데이트로 즉시 UI 변경
- [ ] 에러 시 롤백
- [ ] 캐시 일관성 유지

## 사용 예시

```tsx
// 기본 사용
<FollowButton userId="user-id" />

// 미니멀 버전
<FollowButton userId="user-id" variant="minimal" />

// 아이콘만
<FollowButton userId="user-id" variant="icon-only" />

// 초기 상태와 팔로워 수 표시
<FollowButton 
  userId="user-id" 
  initialState={{ followersCount: 123, followingCount: 45, isFollowedByUser: false }}
  showFollowerCount={true}
/>
```