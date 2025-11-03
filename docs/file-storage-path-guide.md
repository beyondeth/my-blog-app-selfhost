# 파일 저장소 경로 체계 가이드

## 개요

이 문서는 Codebase 블로그 플랫폼의 파일 저장소 경로 체계와 관련 규칙을 설명합니다.

## 경로 체계

### 1. **v2/** 경로 (신규 시스템)
- **용도**: ContextualFileService에서 관리하는 모든 파일
- **주요 사용처**:
  - 프로필 이미지 (avatar, cover)
  - 블로그 브랜딩 이미지
  - 시스템 생성 파일
- **형식**: `v2/{context}/{userId}/{fileName}`
- **예시**:
  - `v2/profiles/user-123/avatar_abc123.webp`
  - `v2/blogs/blog-456/cover_xyz789.webp`

### 2. **uploads/** 경로 (레거시 시스템)
- **용도**: 기존 FileService에서 관리하는 일반 파일
- **주요 사용처**:
  - 포스트 첨부 이미지
  - 일반 업로드 파일
  - 마이그레이션 대상 파일들
- **형식**: `uploads/{year}/{month}/{fileName}`
- **예시**:
  - `uploads/2025/01/post_image_abc123.webp`
  - `uploads/2025/01/document_xyz789.pdf`

### 3. **content/** 경로 (사용 중단)
- **용도**: 더 이상 사용되지 않는 이전 버전
- **상태**: Deprecated
- **처리**: 기존 파일은 유지하되 신규 생성은 중단

## URL 처리 규칙

### 1. **프론트엔드 처리 (imageUtils.ts)**
```typescript
// S3 키인 경우 자동으로 프록시 URL로 변환
if (url.startsWith('uploads/') || url.startsWith('v2/')) {
  return getProxyImageUrl(url);
}
```

### 2. **백엔드 CDN 처리 (users.service.ts)**
```typescript
// 프로필 이미지 CDN URL로 변환
if (user.profileImage) {
  if (user.profileImage.startsWith('v2/') || user.profileImage.startsWith('uploads/')) {
    user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
  }
}
```

## 파일 업로드 파이프라인

### 1. **신규 파일 업로드 (ContextualFileService)**
1. 클라이언트에서 WebP 변환 (85% 품질)
2. v2/ 경로로 S3 업로드
3. DB에 파일 정보 저장
4. CDN URL 생성 및 캐싱

### 2. **레거시 파일 업로드 (FileService)**
1. 클라이언트에서 WebP 변환
2. uploads/ 경로로 S3 업로드
3. DB에 파일 정보 저장
4. 프록시 URL 통한 접근

## 캐시 전략

### 1. **브라우저 캐시**
- 정적 파일: 1년
- 프로필 이미지: 24시간 (업데이트 시 캐시 무효화)

### 2. **CDN 캐시**
- Cloudflare CDN: 24시간
- 이미지 변환 결과: 1년

### 3. **Redis 캐시**
- 사용자 정보: 5분
- 프로필 이미지 URL: 30분

## 캐시 무효화

### 1. **프로필 이미지 업데이트 시**
```typescript
// 1. Redis 캐시 삭제
const userCacheKeys = [
  `user_${id}`,
  `user_by_username_${username}`,
  `user_by_email_${email}`,
  `profile_${id}`,
  `user_profile_${id}`
];

// 2. CDN 캐시 무효화
await this.cdnService.invalidateCache([profileImageKey]);
```

## 보안 규칙

### 1. **파일 접근 제어**
- 인증된 사용자만 자신의 파일에 접근 가능
- 프록시 URL을 통한 간접 접근

### 2. **파일명 규칙**
- UUID 기반 고유 파일명 사용
- 개인정보 포함 금지
- 확장자는 소문자로 통일

## 모니터링

### 1. **성능 지표**
- 이미지 로딩 속도
- 캐시 적중률
- 저장공간 사용량

### 2. **오류 모니터링**
- 파일 업로드 실패율
- CDN 접근 오류
- 캐시 무효화 실패

## 마이그레이션 계획

### 1. **단계적 전환**
1. 신규 파일은 모두 v2/ 경로 사용
2. 기존 uploads/ 파일은 점진적 마이그레이션
3. content/ 경로 파일은 보관만

### 2. **우선순위**
1. 프로필 이미지 (즉시 마이그레이션)
2. 블로그 관련 파일 (차기 마이그레이션)
3. 포스트 첨부 파일 (장기 계획)

## 개발 가이드라인

### 1. **신규 개발 시**
- 무조건 v2/ 경로 사용
- ContextualFileService 우선
- CDN URL 생성 필수

### 2. **기존 코드 수정 시**
- uploads/ 경로 호환성 유지
- 점진적 v2/ 전환
- 캐시 무효화 로직 추가

---

**작성일**: 2025-01-03
**버전**: 1.0
**담당자**: 개발팀

> 이 문서는 시스템 현황에 맞춰 주기적으로 업데이트되어야 합니다.