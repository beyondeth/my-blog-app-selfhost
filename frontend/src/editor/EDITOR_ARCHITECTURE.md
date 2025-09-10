# 📝 Rich Text Editor Architecture & YouTube Integration

## 🎯 Overview
TipTap 기반의 리치 텍스트 에디터로 YouTube 비디오 임베딩, 이미지 관리, 코드 하이라이팅 등의 고급 기능을 제공합니다.

## 🏗️ Core Architecture

### 1. Editor Extensions Configuration
**File**: `config/editor-extensions.ts`

#### 핵심 Extensions
- **CustomYoutube**: YouTube 비디오 임베딩 (685x540 고정 크기)
- **YoutubeAutoEmbed**: URL 자동 변환 (스페이스/엔터 키)
- **ResizableImage**: 드래그 가능한 이미지
- **SlashCommands**: 슬래시 명령어 메뉴
- **CodeBlockLowlight**: 코드 하이라이팅

### 2. YouTube Integration System

#### 2.1 YouTube 크기 표준화 (685x540)
모든 YouTube 비디오는 **685x540px** 크기로 통일:
- 홈화면 (PostArticle)
- 슬러그 페이지 (HtmlContentRenderer)  
- 에디터 내부

#### 2.2 YouTube 처리 Flow
```
사용자 입력 → URL 검증 → 임베드 변환 → 썸네일 추출 → 갤러리 동기화
```

#### 2.3 주요 컴포넌트

**CustomYoutube Extension** (`extensions/CustomYoutube.extension.ts`)
- TipTap YouTube 노드 정의
- 렌더링: `div[data-youtube-video]` 컨테이너 + iframe
- Paste/Input Rules 처리
- 크기: 685x540 고정

**YoutubeAutoEmbed Extension** (`extensions/YoutubeAutoEmbed.extension.ts`)
- 스페이스/엔터 키로 URL 자동 변환
- 임베드 불가능 URL 검증 (채널, 플레이리스트 거부)
- Toast 알림 제공

**YouTube Utils** (`utils/youtube.utils.ts`)
- URL 유효성 검증
- Video ID 추출
- 썸네일 URL 생성
- 지원 형식: youtube.com, youtu.be, shorts

### 3. Image Management System

#### 3.1 Image Upload Manager
**File**: `components/ImageManager/ImageUploadManager.tsx`

**기능**:
- 드래그 앤 드롭 업로드
- 이미지 순서 변경 (드래그)
- 썸네일 설정 (클릭)
- 용량 제한: 개별 5MB, 총 30MB
- YouTube 썸네일 자동 추가

**UI/UX 특징**:
- 왼쪽 Tip 컨테이너 (flex-1 확장)
- 오른쪽 통계 컨테이너 (고정 크기)
- 둘 다 `bg-gray-50 rounded-lg` 스타일
- 갤러리: 3열 그리드, 드래그 가능

#### 3.2 ResizableImage Extension
**File**: `extensions/ResizableImage.extension.ts`

**기능**:
- React-resizable 기반 크기 조절
- 원본 크기 리셋 버튼
- 실시간 크기 표시
- Base64 이미지 지원

### 4. Toolbar System

#### Enhanced Editor Toolbar
**File**: `components/Toolbar/EnhancedEditorToolbar.tsx`

**섹션 구성**:
1. **텍스트 포맷팅**: Bold, Italic, Underline, Strike
2. **헤딩**: H1-H6 드롭다운
3. **리스트**: Bullet, Ordered
4. **미디어**: 이미지, YouTube
5. **코드**: Code, CodeBlock
6. **정렬**: Left, Center, Right, Justify
7. **기타**: Link, Blockquote, HR

**UI 특징**:
- 고정 상단 툴바
- 그룹별 구분선
- 활성 상태 표시 (`bg-gray-200`)
- 호버 효과 (`hover:bg-gray-100`)

### 5. Slash Commands System
**File**: `extensions/SlashCommands.extension.ts`

**지원 명령어**:
- `/heading` - 제목 추가
- `/image` - 이미지 삽입
- `/youtube` - YouTube 비디오
- `/code` - 코드 블록
- `/quote` - 인용문
- `/divider` - 구분선

### 6. Styling System

#### 6.1 Editor Styles
**File**: `styles/editor.css`

**YouTube 스타일링**:
```css
.ProseMirror div[data-youtube-video] {
  width: 685px;
  height: 540px;
  max-width: 100%;
  margin: 1.5rem auto;
}
```

#### 6.2 Markdown Styles  
**File**: `styles/components/markdown.css`

**슬러그 페이지 YouTube 처리**:
```css
.prose div[data-youtube-video] {
  width: 685px;
  height: 540px;
}
```

### 7. Content Rendering

#### HtmlContentRenderer
**File**: `components/ui/HtmlContentRenderer.tsx`

**YouTube 크기 자동 조정**:
- 백엔드 HTML의 640x360 → 685x540 자동 변환
- DOMPurify로 보안 처리
- iframe 속성 허용

## 🎨 UI/UX Design Principles

### 1. Visual Consistency
- **Border Radius**: 모든 컨테이너 `rounded-lg`
- **Background**: `bg-gray-50` for info containers
- **Spacing**: `mb-7` between YouTube and metadata

### 2. YouTube Display Standards
- **크기**: 685x540px (모든 위치 동일)
- **비율**: 약 1.27:1
- **여백**: 상하 1.5rem auto centering
- **그림자**: `shadow-sm` for depth

### 3. Interactive Elements
- **드래그 가능**: 이미지, YouTube 순서 변경
- **클릭 동작**: 썸네일 설정, 이미지 확대
- **호버 효과**: 툴바 버튼, 리사이즈 핸들

## 📦 Constants & Configuration

### Editor Constants
**File**: `constants/editor.constants.ts`

```typescript
export const YOUTUBE_CONFIG = {
  DEFAULT_WIDTH: 685,
  DEFAULT_HEIGHT: 540,
  THUMBNAIL_PREFIX: 'yt_thumb_',
}
```

### Image Upload Config
```typescript
export const IMAGE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_TOTAL_SIZE: 30 * 1024 * 1024, // 30MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}
```

## 🔄 Data Flow

### YouTube URL Processing
1. **입력**: 사용자가 URL 입력/붙여넣기
2. **검증**: `isEmbeddableYouTubeUrl()` 체크
3. **변환**: URL → YouTube 노드
4. **렌더링**: iframe 임베드
5. **썸네일**: 자동 추출 및 갤러리 추가
6. **이벤트**: `youtubeEmbedAdded` 발생

### Image Upload Flow  
1. **업로드**: 드래그 앤 드롭 / 파일 선택
2. **검증**: 크기, 형식, 용량 체크
3. **프리뷰**: Base64 즉시 표시
4. **서버**: S3 업로드
5. **에디터**: ResizableImage 노드 삽입

## 🐛 Known Issues & Solutions

### 1. YouTube 크기 불일치
**문제**: 다른 페이지에서 크기가 다르게 표시
**해결**: 모든 설정을 685x540으로 통일

### 2. CSS Variable Missing
**문제**: `--radius` 변수 미정의로 rounded 적용 안됨
**해결**: `variables.css`에 `--radius: 0.5rem` 추가

### 3. YouTube 하단 회색 공간
**문제**: iframe이 컨테이너를 채우지 못함
**해결**: `position: absolute`와 `width/height: 100%` 적용

## 🚀 Future Improvements
- [ ] YouTube 플레이리스트 지원
- [ ] 이미지 크롭 기능
- [ ] 협업 편집 (CRDT)
- [ ] 마크다운 import/export
- [ ] 테이블 에디터 개선