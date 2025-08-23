# S3 이미지 관리 시스템 개선 계획

## 📊 현재 상황 분석

### 🔍 발견된 주요 문제점

#### 1. 임시 파일 삭제 로직 문제
- **Frontend**: `usePostImageTracker.ts`에서 컴포넌트 unmount 시 업로드된 파일 삭제
- **Backend**: `posts.service.ts`의 `cleanupUnusedImages`가 포스트 수정 시 이미지 자동 삭제
- **영향**: 정상 업로드된 이미지가 의도치 않게 삭제될 수 있음

#### 2. 폴더 구조 혼재
- **v1 구조**: `uploads/{fileType}/{year}/{month}/{uuid}` (현재 사용 중)
- **v2 구조**: `v2/users/{userId}/profile/...` (부분적 사용, 미완성)
- **문제**: 일관성 없는 경로 관리로 인한 복잡도 증가

#### 3. URL 처리 불일치
- 프로필 이미지: v2 경로 → 프록시 URL 변환
- 포스트 이미지: uploads 경로 직접 사용
- 일부 코드에서 `/api/v1` 중복 문제 발생

## 🎯 스마트 이미지 변환 전략

### 핵심 원칙
"모든 이미지를 WebP로 변환"은 현대 웹서비스의 Best Practice에 가깝지만, 일부 로고/아이콘류는 PNG 그대로 두는 것이 가장 현실적입니다.

### 자동 변환 규칙

#### 포스트 이미지
- **50KB 이상 JPG/PNG**: WebP로 자동 변환 (85% 품질)
- **SVG, GIF**: 원본 형식 유지
- **최대 크기**: 2400x2400px

#### 프로필 이미지
- **모든 크기**: WebP로 변환 (90% 품질)
- **최대 크기**: 800x800px
- **썸네일 생성**: 150x150, 400x400, 800x800

#### 블로그 브랜딩 (로고, 파비콘)
- **200KB 이상 JPG**: WebP로 변환 (95% 품질)
- **PNG, SVG, ICO**: 원본 형식 유지 (투명도, 선명도 보존)

#### 시스템 자산
- **500KB 이상**: WebP 변환 검토
- **대부분**: 원본 형식 유지

### 이미지 타입별 처리

| 이미지 타입 | 파일 형식 | 처리 방식 | 이유 |
|------------|----------|------------|------|
| 사진 | JPG, JPEG | WebP 변환 | 용량 절감 (30-50%) |
| 그래픽/로고 | PNG (<200KB) | 원본 유지 | 투명도, 선명도 |
| 대형 PNG | PNG (>200KB) | WebP 변환 | 용량 절감 |
| 아이콘 | PNG, ICO (<50KB) | 원본 유지 | 품질 보존 |
| 벡터 | SVG | 원본 유지 | 무한 확대 가능 |
| 애니메이션 | GIF | 원본 유지 | 애니메이션 보존 |

## 🎯 개선된 S3 폴더 구조 (Medium 스타일)

```
📁 S3 Bucket Root
├── 📂 content/                      # 모든 사용자 콘텐츠
│   ├── 📂 users/                    # 사용자별 콘텐츠
│   │   └── 📂 {userId}/            
│   │       ├── 📂 posts/            # 포스트 이미지
│   │       │   └── 📂 {yyyy}/{MM}/
│   │       │       └── {uuid}.webp
│   │       └── 📂 media/            # 기타 미디어
│   │           └── 📂 {yyyy}/{MM}/
│   │               └── {uuid}.*
│   │
│   ├── 📂 profiles/                 # 프로필 자산
│   │   └── 📂 {userId}/
│   │       ├── avatar_{timestamp}_{uuid}.webp
│   │       └── cover_{timestamp}_{uuid}.webp
│   │
│   └── 📂 blogs/                    # 블로그 브랜딩
│       └── 📂 {blogId}/
│           ├── logo_{timestamp}_{uuid}.webp
│           ├── banner_{timestamp}_{uuid}.webp
│           └── favicon_{timestamp}_{uuid}.ico
│
├── 📂 system/                       # 시스템 자산
│   ├── 📂 defaults/                 # 기본 이미지
│   └── 📂 assets/                   # 플랫폼 자산
│
└── 📂 cdn/                          # CDN 최적화 버전
    ├── 📂 thumb/                    # 150x150
    ├── 📂 small/                    # 400x400
    ├── 📂 medium/                   # 800x800
    └── 📂 large/                    # 1600x1600
```

## 📝 단계별 구현 계획

### Phase 1: 긴급 버그 수정 (즉시 시행)

#### 1.1 Frontend 임시 파일 삭제 로직 제거
```typescript
// usePostImageTracker.ts 수정사항
// cleanupUploadedFiles 함수를 비활성화하거나 
// 실제 삭제 대신 로깅만 수행하도록 변경

const cleanupUploadedFiles = useCallback(async (force: boolean = false): Promise<void> => {
  // 임시로 비활성화
  console.log('Cleanup disabled - files preserved for user management');
  return;
  
  // 기존 삭제 로직은 주석 처리
}, []);
```

#### 1.2 Backend 자동 삭제 로직 비활성화
```typescript
// posts.service.ts 수정사항
private async cleanupUnusedImages(...): Promise<void> {
  // 임시로 비활성화 - 로깅만 수행
  console.log('Image cleanup disabled - manual management required');
  return;
  
  // 기존 삭제 로직은 주석 처리
}
```

### Phase 2: 폴더 구조 정리 (1주차)

#### 2.1 새로운 S3 키 생성 로직
```typescript
// file.utils.ts - 개선된 S3 키 생성
export function generateS3KeyV3(
  context: {
    type: 'post' | 'profile' | 'blog' | 'media';
    userId?: string;
    blogId?: string;
    purpose?: string;
  },
  fileName: string,
  mimeType: string
): string {
  const uuid = uuidv4().substring(0, 8);
  const timestamp = Date.now();
  const ext = '.webp'; // 이미지는 WebP로 통일
  
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  switch (context.type) {
    case 'post':
      return `content/users/${context.userId}/posts/${year}/${month}/${uuid}${ext}`;
      
    case 'profile':
      const profileType = context.purpose || 'avatar';
      return `content/profiles/${context.userId}/${profileType}_${timestamp}_${uuid}${ext}`;
      
    case 'blog':
      const assetType = context.purpose || 'logo';
      return `content/blogs/${context.blogId}/${assetType}_${timestamp}_${uuid}${ext}`;
      
    default:
      return `content/users/${context.userId}/media/${year}/${month}/${uuid}${ext}`;
  }
}
```

#### 2.2 기존 파일 마이그레이션 (선택사항)
- 새 업로드부터 새 구조 적용
- 기존 파일은 점진적 마이그레이션
- 프록시 URL로 모든 경로 호환 보장

### Phase 3: 이미지 관리 시스템 구축 (2-3주차)

#### 3.1 이미지 메타데이터 관리
```typescript
// file.entity.ts 확장
interface FileMetadata {
  uploadContext: 'post' | 'profile' | 'blog';
  relatedEntityId?: string;  // postId, blogId 등
  lastAccessedAt?: Date;
  accessCount: number;
  isOptimized: boolean;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}
```

#### 3.2 사용자 이미지 관리 대시보드
- 업로드한 이미지 목록 조회
- 수동 삭제 기능
- 스토리지 사용량 모니터링
- 이미지 재사용 갤러리

#### 3.3 자동 최적화 파이프라인
1. 업로드 시 WebP 변환
2. 다중 사이즈 썸네일 생성
3. CDN 배포 및 캐싱
4. 30일 미사용 파일 아카이빙

## 🚀 즉시 실행 작업

### 1. Frontend 수정 (usePostImageTracker.ts)
- [ ] cleanupUploadedFiles 함수 비활성화
- [ ] 페이지 이탈 경고만 표시
- [ ] cleanup 이벤트 리스너 제거

### 2. Backend 수정 (posts.service.ts)
- [ ] cleanupUnusedImages 함수 비활성화
- [ ] 이미지 URL 추출 로직은 유지 (링킹용)

### 3. 에디터 수정 (RichTextEditor.tsx)
- [✓] unmount 시 cleanup 제거
- [✓] 이미지 업로드 성공 메시지 개선

## 📋 체크리스트

### 즉시 수정 (버그 픽스) ✅ 완료
- [✓] Frontend 임시 파일 삭제 로직 제거
- [✓] Backend 자동 이미지 정리 비활성화
- [✓] 에디터 cleanup 이벤트 제거
- [✓] 스마트 WebP 변환 규칙 구현
- [✓] 새로운 S3 키 생성 함수 (generateS3KeyV2)

### 단기 개선 (1주)
- [✓] 새로운 S3 키 생성 함수 구현
- [ ] URL 정규화 로직 통합
- [ ] 프록시 URL 일관성 확보
- [ ] Frontend WebP 변환 로직 추가

### 중장기 개선 (2-4주)
- [ ] 이미지 관리 대시보드 구현
- [ ] 자동 WebP 변환 파이프라인
- [ ] CDN 연동 및 최적화
- [ ] 스토리지 정리 배치 작업

## 🎯 기대 효과

1. **안정성 향상**: 의도치 않은 이미지 삭제 방지 ✅
2. **일관성 확보**: 통일된 폴더 구조와 URL 처리
3. **확장성 개선**: 글로벌 서비스를 위한 확장 가능한 구조
4. **성능 최적화**: 선택적 WebP 변환으로 30-50% 용량 절감
5. **사용자 경험**: 이미지 관리 대시보드 제공
6. **유연한 형식 지원**: 로고/아이콘은 PNG 유지, 사진은 WebP 최적화

## 📚 참고 사항

### Medium의 이미지 관리 방식
- 사용자별 격리된 스토리지
- 자동 최적화 및 다중 사이즈 제공
- CDN을 통한 글로벌 배포
- 스마트 캐싱 및 지연 로딩

### 권장 사항 (업데이트)
1. **선택적 WebP 변환**:
   - 100KB 이상 JPG/PNG → WebP (85-90% 품질)
   - 로고/아이콘 PNG, SVG, ICO → 원본 유지
2. 최대 파일 크기: 10MB (개별), 30MB (포스트당)
3. 썸네일 사이즈: 150x150, 400x400, 800x800, 1600x1600
4. 30일 미사용 시 cold storage로 이동
5. 90일 미사용 시 아카이빙 검토

## 📄 구현 완료 파일

### Backend
- `image-conversion.utils.ts` - 스마트 WebP 변환 규칙 및 유틸리티
- `file.utils.ts` - generateS3KeyV2() 함수 추가
- `s3.service.ts` - 선택적 형식 허용 로직 구현
- `posts.service.ts` - cleanupUnusedImages() 비활성화

### Frontend  
- `usePostImageTracker.ts` - cleanupUploadedFiles() 비활성화
- `RichTextEditor.tsx` - cleanup 이벤트 제거