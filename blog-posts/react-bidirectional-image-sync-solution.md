# 🎯 React 양방향 이미지 동기화 문제 해결: Props Drilling 안티패턴 제거

### 📋 문제 상황

React 블로그 에디터에서 TipTap Editor와 이미지 갤러리 간의 양방향 동기화를 구현하던 중 발생한 문제:

1. **갤러리 → 에디터**: 이미지 순서 변경/삭제가 에디터에 반영 ✅
2. **에디터 → 갤러리**: 에디터에서 이미지 삭제 시 갤러리에 반영 ❌

### 🔍 근본 원인 분석

#### Gemini의 접근 (Props Drilling 안티패턴)
```typescript
// ❌ 잘못된 접근: 부모 컴포넌트가 모든 상태 관리
export default function BlogNewPostPage() {
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState('');
  
  return (
    <BlogRichTextEditor
      images={images}  // 부모가 관리
      onImagesChange={setImages}
      selectedThumbnailId={selectedThumbnailId}  // 부모가 관리
      onThumbnailSelect={setSelectedThumbnailId}
    />
  );
}
```

**문제점:**
- 부모 컴포넌트가 자식의 내부 상태를 관리 (책임 위반)
- 모든 부모 컴포넌트가 동일한 props 전달 코드 작성 필요 (DRY 위반)
- 컴포넌트 간 결합도 증가

### ✅ 올바른 해결 방법

#### 1. 컴포넌트 캡슐화 원칙 적용

```typescript
// ✅ 올바른 접근: 컴포넌트가 자체 상태 관리
interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFilesChange?: (fileIds: string[]) => void;  // 선택적
  onThumbnailSelect?: (thumbnailId: string) => void;  // 선택적
  enableImageManager?: boolean;
  maxImages?: number;
}

export default function BlogRichTextEditor(props: RichTextEditorProps) {
  // 내부 상태 관리 (캡슐화)
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');
  
  // useImageUploadManager 훅이 내부 상태 관리
  const imageUploadManager = useImageUploadManager({
    editor,
    images,
    onImagesChange: (newImages) => {
      setImages(newImages);
      // 필요시 부모에게만 ID 전달
      if (props.onFilesChange) {
        props.onFilesChange(newImages.map(img => img.id));
      }
    },
    selectedThumbnailId,
    onThumbnailSelect: (id) => {
      setSelectedThumbnailId(id);
      props.onThumbnailSelect?.(id);
    },
  });
}
```

#### 2. ImageUploadManager 컴포넌트 - Controlled/Uncontrolled 모드 지원

```typescript
interface ImageUploadManagerProps {
  images?: UploadedImageInfo[];  // Optional - controlled mode
  maxImages?: number;
  onImagesChange: (images: UploadedImageInfo[]) => void;
  // ...
}

export default function ImageUploadManager({
  images: controlledImages,
  ...
}: ImageUploadManagerProps) {
  const [internalImages, setInternalImages] = useState<UploadedImageInfo[]>([]);
  
  // Controlled vs Uncontrolled 모드 자동 감지
  const images = controlledImages ?? internalImages;
  
  // setState 래퍼로 두 모드 모두 지원
  const setImages = useCallback((newImages) => {
    if (controlledImages) {
      // Controlled: 부모에게 전달
      const updatedImages = typeof newImages === 'function' 
        ? newImages(images)
        : newImages;
      onImagesChange(updatedImages);
    } else {
      // Uncontrolled: 내부 상태 사용
      setInternalImages(newImages);
    }
  }, [controlledImages, images, onImagesChange]);
}
```

#### 3. 핵심 문제 해결: setState 함수형 업데이트 처리

```typescript
// ❌ 문제: onImagesChange를 직접 setState로 사용
const setImages = controlledImages ? onImagesChange : setInternalImages;
setImages(prev => [...prev, newImage]);  // 에러!

// ✅ 해결: 함수형 업데이트 패턴 지원
const setImages = useCallback((newImages) => {
  if (controlledImages) {
    const updatedImages = typeof newImages === 'function' 
      ? newImages(images)  // 함수형 업데이트 처리
      : newImages;
    onImagesChange(updatedImages);  // 항상 배열 전달
  } else {
    setInternalImages(newImages);
  }
}, [controlledImages, images, onImagesChange]);
```

### 🏗️ 최종 아키텍처

```
Component Hierarchy (Clean Architecture):
├── Parent Components (Simple Interface)
│   └── Props: content, onChange, [onFilesChange]
│
└── RichTextEditor (Self-Contained)
    ├── Internal State: images[], selectedThumbnailId
    ├── Hook: useImageUploadManager (양방향 동기화 관리)
    │   ├── useEditorImageMonitor (에디터 → 갤러리)
    │   └── Gallery handlers (갤러리 → 에디터)
    └── Child: ImageUploadManager (controlled mode)
```

### 📊 핵심 교훈

1. **캡슐화 > Props Drilling**: 컴포넌트 내부 상태는 컴포넌트가 관리
2. **관심사 분리**: 부모는 필요한 것만 알면 됨 (content, fileIds)
3. **DRY 원칙**: 중복 코드 제거, 재사용 가능한 컴포넌트
4. **SOLID 원칙**: 단일 책임, 개방-폐쇄 원칙 준수
5. **React 패턴**: Controlled/Uncontrolled 모드 동시 지원

### 🚀 결과

- ✅ 양방향 동기화 완벽 작동
- ✅ 깔끔한 컴포넌트 인터페이스
- ✅ 재사용 가능한 컴포넌트
- ✅ 유지보수 용이한 구조
- ✅ React 모범 사례 준수

---

*이 문제는 Props를 통한 상태 전달 자체가 문제가 아니라, **어디서 상태를 관리할 것인가**의 설계 문제였습니다. Gemini의 힌트는 틀렸지만, 역설적으로 올바른 해결책을 찾게 해준 계기가 되었습니다.*