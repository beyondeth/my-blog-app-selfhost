---
title: "React 프로젝트 전체 Avatar 컴포넌트 통합 구현기"
tags: ["React", "Next.js", "TypeScript", "Component Design", "Avatar", "UI/UX", "리팩토링", "프론트엔드"]
date: 2025-08-22T15:51:00.836474
---

# React 프로젝트 전체 Avatar 컴포넌트 통합 구현기

## 🎯 프로젝트 개요

오늘은 Next.js 14 기반 블로그 프로젝트에서 사용자 프로필 이미지를 전체적으로 통합하는 작업을 진행했습니다. 기존에는 각 컴포넌트마다 제각각 다른 방식으로 아바타를 표시하고 있었는데, 이를 하나의 통합된 Avatar 컴포넌트로 교체하는 작업이었습니다.

## 🔍 문제 상황

### 기존 코드의 문제점
1. **중복 코드**: 각 컴포넌트마다 프로필 이미지 처리 로직이 중복
2. **일관성 부재**: FiUser 아이콘, 이니셜, 외부 서비스(ui-avatars.com) 등 제각각 다른 방식 사용
3. **유지보수 어려움**: 디자인 변경 시 모든 컴포넌트를 수정해야 함
4. **S3 프록시 처리**: 백엔드 이미지 URL 변환 로직이 산재

## 💡 해결 방안

### 1. 통합 Avatar 컴포넌트 설계

```tsx
// src/components/ui/avatar.tsx
interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}
```

### 2. 핵심 기능 구현

#### 크기 시스템
```tsx
const sizeClasses = {
  xs: 'w-6 h-6',  // 24px - 포스트 메타 정보
  sm: 'w-8 h-8',  // 32px - 댓글, 헤더
  md: 'w-10 h-10', // 40px - 기본
  lg: 'w-12 h-12', // 48px - 작성자 정보
  xl: 'w-16 h-16', // 64px - 프로필 섹션
};
```

#### 스마트 폴백 시스템
```tsx
// 1. 이미지가 있으면 표시
// 2. 이미지 로드 실패 시 이니셜 표시
// 3. 이름이 없으면 기본 아이콘 표시

if (fallback) {
  const initials = fallback
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  // 그라데이션 배경에 이니셜 표시
}
```

#### 백엔드 프록시 URL 처리
```tsx
const imageUrl = src && src.startsWith('/api/') 
  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${src.replace('/api/v1', '')}`
  : src;
```

## 📝 구현 과정

### Step 1: 컴포넌트 위치 파악
```bash
# FiUser 아이콘 사용 위치 검색
grep -r "FiUser" src/

# 발견된 14개 파일
- ProfileDropdown.tsx
- CommentItem.tsx
- PostHeader.tsx
- Admin Users page
- AuthorInfo.tsx
- ProfileSection.tsx
...
```

### Step 2: Avatar 컴포넌트 생성
- Next.js Image 컴포넌트 활용
- 로딩 상태 처리 (skeleton animation)
- 에러 처리 및 폴백
- 반응형 사이즈 지원

### Step 3: 각 컴포넌트 교체

#### Before (ProfileDropdown.tsx)
```tsx
{user.profileImage ? (
  <img 
    src={user.profileImage} 
    alt={user.username}
    className="w-8 h-8 rounded-full object-cover"
  />
) : (
  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
    <FiUser className="w-5 h-5 text-gray-400" />
  </div>
)}
```

#### After
```tsx
<Avatar 
  src={user.profileImage} 
  alt={user.username}
  fallback={user.username}
  size="sm"
/>
```

## 🎨 주요 특징

### 1. 로딩 상태 처리
```tsx
const [isLoading, setIsLoading] = useState(true);

// 로딩 중 스켈레톤 표시
{isLoading && (
  <div className="absolute inset-0 bg-gray-200 animate-pulse" />
)}
```

### 2. 에러 처리
```tsx
onError={() => {
  setImageError(true);
  setIsLoading(false);
}}
```

### 3. 이니셜 폴백
```tsx
// "Park Sihyung" → "PS"
const initials = fallback
  .split(' ')
  .map(word => word[0])
  .join('')
  .toUpperCase()
  .slice(0, 2);
```

## 📊 교체 현황

| 컴포넌트 | 위치 | 크기 | 특이사항 |
|---------|------|------|----------|
| ProfileDropdown | 헤더 | sm | 드롭다운 트리거 |
| CommentItem | 댓글 | sm | 작성자 표시 |
| PostHeader | 포스트 | xs | 메타 정보 |
| AuthorInfo | 포스트 하단 | lg | 작성자 소개 |
| Admin Users | 관리자 | sm | 사용자 목록 |
| ProfileSection | 사이드바 | xl | 프로필 섹션 |

## 🚀 성과

### 코드 개선
- **중복 제거**: 약 200줄의 중복 코드 제거
- **일관성**: 전체 앱에서 동일한 아바타 스타일
- **유지보수성**: 한 곳에서 모든 아바타 스타일 관리

### 사용자 경험
- **로딩 상태**: 부드러운 스켈레톤 애니메이션
- **폴백 처리**: 이미지 없을 때도 시각적으로 매력적
- **반응형**: 다양한 크기 지원

### 기술적 개선
- **Next.js Image 최적화**: 자동 이미지 최적화
- **TypeScript 타입 안정성**: 완벽한 타입 지원
- **재사용성**: 다른 프로젝트에서도 사용 가능

## 🎯 추가 기능 (보너스)

### AvatarGroup 컴포넌트
```tsx
export function AvatarGroup({ children, max = 3 }) {
  // 여러 아바타를 겹쳐서 표시
  // 초과분은 "+N" 으로 표시
}
```

## 📚 교훈

1. **컴포넌트 통합의 중요성**: 초기에 공통 컴포넌트를 만들면 나중에 많은 시간 절약
2. **폴백 전략**: 다양한 상황을 고려한 폴백 처리가 사용자 경험 향상
3. **점진적 마이그레이션**: 한 번에 모든 것을 바꾸지 않고 단계적으로 진행

## 🔗 관련 기술 스택
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Icons
- AWS S3 (이미지 저장소)

## 마무리

이번 작업을 통해 프로젝트 전체의 아바타 표시가 통일되었고, 코드 유지보수성이 크게 향상되었습니다. 특히 S3 프록시 URL 처리와 다양한 폴백 시나리오를 하나의 컴포넌트에서 처리함으로써 개발 효율성이 높아졌습니다.

앞으로도 이런 식으로 공통 컴포넌트를 만들어 재사용성을 높이고, 일관된 사용자 경험을 제공하도록 노력하겠습니다! 🚀