# 📐 에디터 리팩토링 설계 문서

## 🎯 목표
1. **디자인 100% 보존**: 현재 UI/UX를 그대로 유지
2. **레거시 로직 보존**: 기존 동작 방식 변경 없음
3. **구조 개선**: 에디터 관련 파일을 `/editor` 디렉토리로 통합 관리

## 📊 현재 상태 분석

### 현재 파일 분포
```
src/
├── components/
│   ├── posts/
│   │   ├── RichTextEditor.tsx (메인 - 실제 사용중)
│   │   ├── RichTextEditorRefactored.tsx (테스트용)
│   │   ├── EnhancedEditorToolbar.tsx
│   │   ├── EditorToolbar.tsx
│   │   ├── ImageUploadManager.tsx
│   │   ├── ResizableImageNode.tsx
│   │   └── SlashCommands.tsx
│   └── editor/
│       ├── EditorToolbar.tsx (새로 생성)
│       ├── ImageGallery.tsx
│       └── FileUploader.tsx
├── hooks/
│   ├── useImageUploadManager.ts
│   ├── useEditorImageMonitor.ts
│   ├── useRichTextEditor.ts
│   └── usePostImageTracker.ts
├── constants/
│   └── editor.constants.ts
├── config/
│   └── editor-extensions.ts
├── utils/
│   ├── image-upload.utils.ts
│   ├── youtube.utils.ts
│   └── youtubeUtils.ts
└── styles/
    └── editor.css
```

### 현재 사용 현황
- **실제 사용**: `components/posts/RichTextEditor.tsx`
- **페이지**: `/blog/[blogSlug]/posts/new`, `/blog/[blogSlug]/posts/[postSlug]/edit`
- **기능**: YouTube 삽입, 이미지 업로드, 갤러리 동기화, 슬래시 커맨드

## 🏗️ 제안하는 새 구조

```
src/
├── editor/                          # 모든 에디터 관련 파일 통합
│   ├── index.ts                    # 공개 API (export)
│   ├── RichTextEditor.tsx          # 메인 컴포넌트 (기존 로직 유지)
│   ├── components/
│   │   ├── Toolbar/
│   │   │   ├── index.tsx
│   │   │   ├── EnhancedToolbar.tsx
│   │   │   └── ToolbarButton.tsx
│   │   ├── ImageManager/
│   │   │   ├── index.tsx
│   │   │   ├── ImageGallery.tsx
│   │   │   ├── FileUploader.tsx
│   │   │   └── ResizableImage.tsx
│   │   └── SlashCommands/
│   │       ├── index.tsx
│   │       └── CommandList.tsx
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useImageUploadManager.ts
│   │   ├── useEditorImageMonitor.ts
│   │   ├── useRichTextEditor.ts
│   │   └── usePostImageTracker.ts
│   ├── utils/
│   │   ├── index.ts
│   │   ├── imageUpload.ts
│   │   ├── youtube.ts
│   │   └── validation.ts
│   ├── constants/
│   │   └── index.ts
│   ├── config/
│   │   ├── extensions.ts
│   │   └── settings.ts
│   └── styles/
│       └── editor.css
```

## 🔄 마이그레이션 전략

### 1단계: 디렉토리 생성 및 파일 이동
```bash
# 기본 구조 생성
mkdir -p src/editor/{components,hooks,utils,constants,config,styles}
mkdir -p src/editor/components/{Toolbar,ImageManager,SlashCommands}

# 파일 이동 (기존 코드 그대로 유지)
mv src/components/posts/RichTextEditor.tsx src/editor/
mv src/hooks/use*Editor*.ts src/editor/hooks/
mv src/styles/editor.css src/editor/styles/
```

### 2단계: Import 경로 업데이트 매핑
```typescript
// 이전
import BlogRichTextEditor from '@/components/posts/RichTextEditor';
import { useImageUploadManager } from '@/hooks/useImageUploadManager';

// 이후
import BlogRichTextEditor from '@/editor';
import { useImageUploadManager } from '@/editor/hooks';
```

### 3단계: Index 파일 생성
```typescript
// src/editor/index.ts
export { default as RichTextEditor } from './RichTextEditor';
export { default as BlogRichTextEditor } from './RichTextEditor'; // 호환성
export * from './hooks';
export * from './utils';
export * from './constants';
```

## 🔒 보존해야 할 핵심 요소

### 1. UI/UX 디자인
- ✅ 툴바 디자인과 레이아웃
- ✅ 이미지 갤러리 UI
- ✅ 슬래시 커맨드 UI
- ✅ 에디터 스타일 (prose 클래스 등)

### 2. 핵심 로직
- ✅ YouTube URL 자동 변환
- ✅ 이미지 업로드 프로세스
- ✅ 갤러리-에디터 동기화
- ✅ 이미지 리사이징
- ✅ 슬래시 커맨드 동작
- ✅ 파일 용량 제한 체크

### 3. 컴포넌트 Props Interface
```typescript
// 변경 없음 - 기존 interface 유지
interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;
  onThumbnailSelect?: (thumbnailId: string) => void;
  placeholder?: string;
  className?: string;
  enableImageManager?: boolean;
  maxImages?: number;
  enableCleanupOnUnmount?: boolean;
}
```

## 📋 실행 계획

### Phase 1: 준비 (위험도: 낮음)
1. [ ] `/editor` 디렉토리 구조 생성
2. [ ] 기존 파일 복사 (원본 유지)
3. [ ] index 파일 생성

### Phase 2: 마이그레이션 (위험도: 중간)
1. [ ] 에디터 내부 import 경로 수정
2. [ ] 컴포넌트 간 참조 업데이트
3. [ ] 스타일 import 경로 수정

### Phase 3: 통합 (위험도: 높음)
1. [ ] 페이지에서 import 경로 변경
2. [ ] 테스트 및 검증
3. [ ] 기존 파일 제거

### Phase 4: 정리
1. [ ] 중복 파일 제거
2. [ ] 문서 업데이트
3. [ ] 최종 테스트

## ⚠️ 주의사항

### 절대 변경하지 말아야 할 것들
1. **컴포넌트 이름**: `BlogRichTextEditor` 유지
2. **Props 구조**: 기존 interface 그대로
3. **CSS 클래스명**: 모든 스타일 클래스 유지
4. **이벤트 핸들러**: 기존 동작 방식 유지
5. **에디터 extensions**: TipTap 설정 유지

### 리스크 관리
- **백업**: 모든 변경 전 git commit
- **단계별 테스트**: 각 phase 후 동작 확인
- **롤백 계획**: 문제 발생 시 즉시 원복

## 🧪 검증 체크리스트

### 기능 테스트
- [ ] YouTube URL 붙여넣기 → 자동 변환
- [ ] 이미지 드래그 앤 드롭
- [ ] 갤러리 순서 변경 → 에디터 반영
- [ ] 슬래시 커맨드 동작
- [ ] 이미지 리사이징
- [ ] 툴바 모든 버튼 동작

### UI 테스트
- [ ] 툴바 디자인 동일
- [ ] 갤러리 디자인 동일
- [ ] 에디터 스타일 동일
- [ ] 반응형 레이아웃 유지

### 통합 테스트
- [ ] 새 포스트 작성 페이지
- [ ] 포스트 수정 페이지
- [ ] 이미지 업로드 → S3 저장
- [ ] 포스트 저장 → DB 저장

## 📝 예상 결과

### 장점
✅ **관리 용이성**: 에디터 관련 모든 파일이 한 곳에
✅ **모듈화**: 독립적인 에디터 모듈
✅ **재사용성**: 다른 프로젝트에서도 쉽게 사용
✅ **유지보수**: 명확한 구조로 수정 용이

### 단점 해결
❌ **Breaking Change 없음**: 모든 기존 코드 동작 유지
❌ **디자인 변경 없음**: 100% 동일한 UI/UX
❌ **로직 변경 없음**: 기존 동작 그대로

## 🚀 실행 명령

```bash
# 1. 백업
git add . && git commit -m "backup: before editor restructuring"

# 2. 구조 생성
mkdir -p src/editor/{components/{Toolbar,ImageManager,SlashCommands},hooks,utils,constants,config,styles}

# 3. 파일 복사 (원본 유지)
cp -r src/components/posts/* src/editor/temp/
cp -r src/hooks/*[Ee]ditor* src/editor/hooks/
cp src/styles/editor.css src/editor/styles/

# 4. 검증 후 원본 삭제
# (모든 테스트 통과 후)
```

---

이 설계를 승인하시면 단계적으로 실행하겠습니다.
기존 디자인과 로직은 100% 유지하면서 구조만 개선합니다.