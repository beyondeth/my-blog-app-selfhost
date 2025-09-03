# 🔧 React 이미지 갤러리와 에디터 동기화 문제 해결하기

## 📋 문제 상황

React 블로그 에디터 개발 중 이미지 관리 기능에서 다음과 같은 문제가 발생했습니다:

### 사용자 요구사항
- 이미지 갤러리에서 순서를 변경하면 에디터 본문의 이미지 순서도 변경되어야 함
- 갤러리에서 이미지를 삭제하면 에디터 본문에서도 제거되어야 함
- 첫 번째 이미지는 자동으로 썸네일로 선택되어야 함

### 실제 발생한 문제
> "내가 말한게 본문에 삽입된 이미지에 제대로 반영안되는데?"

갤러리에서의 변경사항(순서 변경, 삭제)이 에디터 본문에 실시간으로 반영되지 않는 문제가 있었습니다.

## 🔍 문제 분석

### 1. **순환 참조 문제**
```javascript
// ❌ 문제 코드
const handleImagesChange = useCallback((images) => {
  // removeImageFromEditor를 호출하려 하지만
  // 이 함수가 아직 정의되지 않음
  removeImageFromEditor(deletedImg.url);
  updateAllEditorImages(images);
}, [removeImageFromEditor, updateAllEditorImages]); // 순환 의존성
```

### 2. **Stale Closure 문제**
```javascript
// ❌ 문제 코드
const handleImagesChange = useCallback((images) => {
  const prevImages = uploadedImages; // stale closure 발생
  // uploadedImages가 업데이트되어도 이전 값을 참조
}, [uploadedImages]); // 의존성 배열에 있어도 문제 발생
```

### 3. **함수 호출 순서 문제**
- `handleImagesChange`가 `removeImageFromEditor`보다 먼저 정의됨
- JavaScript 호이스팅이 함수 표현식에는 적용되지 않음

## 💡 해결 방안

### 1. **useRef를 활용한 순환 참조 해결**
```javascript
// ✅ 해결 코드
export function useImageUploadManager({ editor, onFilesChange }) {
  // refs를 사용하여 함수 참조 저장
  const removeImageFromEditorRef = useRef();
  const updateAllEditorImagesRef = useRef();
  
  // handleImagesChange에서 ref를 통해 함수 호출
  const handleImagesChange = useCallback((images) => {
    setUploadedImages(prevImages => {
      const deletedImages = prevImages.filter(
        prevImg => !images.find(img => img.id === prevImg.id)
      );
      
      deletedImages.forEach(deletedImg => {
        if (deletedImg.url && removeImageFromEditorRef.current) {
          removeImageFromEditorRef.current(deletedImg.url);
        }
      });
      
      if (orderChanged && updateAllEditorImagesRef.current) {
        updateAllEditorImagesRef.current(images);
      }
      
      return images;
    });
  }, [onFilesChange]); // 의존성 최소화
  
  // 함수 정의 후 ref에 할당
  const removeImageFromEditor = useCallback((imageUrl) => {
    // 구현...
  }, [editor]);
  
  // useEffect로 ref 업데이트
  useEffect(() => {
    removeImageFromEditorRef.current = removeImageFromEditor;
    updateAllEditorImagesRef.current = updateAllEditorImages;
  }, [removeImageFromEditor, updateAllEditorImages]);
}
```

### 2. **setState 콜백 패턴 활용**
```javascript
// ✅ Stale closure 문제 해결
const handleImagesChange = useCallback((images) => {
  setUploadedImages(prevImages => {
    // prevImages는 항상 최신 상태
    const deletedImages = prevImages.filter(
      prevImg => !images.find(img => img.id === prevImg.id)
    );
    
    // 상태 업데이트와 부수 효과를 동시에 처리
    return images;
  });
}, []);
```

### 3. **이미지 동기화 로직 구현**

#### 삭제 감지 및 처리
```javascript
// 갤러리에서 삭제된 이미지 찾기
const deletedImages = prevImages.filter(
  prevImg => !images.find(img => img.id === prevImg.id)
);

// 에디터에서도 제거
deletedImages.forEach(deletedImg => {
  if (deletedImg.url) {
    removeImageFromEditor(deletedImg.url);
  }
});
```

#### 순서 변경 감지 및 처리
```javascript
// 같은 개수지만 순서가 다른지 확인
const orderChanged = images.some((img, index) => 
  prevImages[index] && prevImages[index].id !== img.id
);

if (orderChanged) {
  // 모든 이미지를 제거하고 새 순서로 다시 삽입
  updateAllEditorImages(images);
}
```

### 4. **에디터 이미지 재구성 함수**
```javascript
const updateAllEditorImages = useCallback((images) => {
  if (!editor) return;
  
  // 1. 현재 모든 이미지 위치 찾기
  const imagePositions = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image') {
      imagePositions.push(pos);
    }
  });
  
  // 2. 역순으로 모든 이미지 제거 (위치 보존)
  const tr = editor.state.tr;
  imagePositions.reverse().forEach(pos => {
    const node = editor.state.doc.nodeAt(pos);
    if (node) {
      tr.delete(pos, pos + node.nodeSize);
    }
  });
  editor.view.dispatch(tr);
  
  // 3. 새 순서로 이미지 삽입
  images.forEach((image, index) => {
    if (image.url && !image.isUploading) {
      if (index > 0) {
        editor.chain().insertContent('<br/>').run();
      }
      
      editor.chain().focus().setImage({
        src: image.url,
        alt: image.name,
        title: image.name,
        'data-image-id': image.id, // 추적용 ID
      }).run();
    }
  });
}, [editor]);
```

## 🎯 핵심 개선사항

### 1. **디버깅 로그 추가**
```javascript
console.log('[ImageManager] Detected deleted images:', deletedImages);
console.log('[ImageManager] Images reordered - rebuilding editor content');
console.log('[removeImageFromEditor] Found and removing image');
```

### 2. **안전한 함수 호출**
- ref가 존재하는지 확인 후 호출
- editor 인스턴스 존재 여부 체크
- 에러 처리 및 fallback 로직

### 3. **성능 최적화**
- 불필요한 리렌더링 방지
- 의존성 배열 최소화
- 배치 업데이트 활용

## 📊 결과

### Before
- 갤러리 변경사항이 에디터에 반영되지 않음
- 순환 참조로 인한 에러 발생
- Stale closure로 인한 동기화 실패

### After
- ✅ 이미지 순서 변경 시 에디터 본문에 즉시 반영
- ✅ 이미지 삭제 시 에디터에서도 제거
- ✅ 안정적인 상태 관리 및 동기화

## 🔑 핵심 교훈

1. **React Hook의 순환 참조 문제는 useRef로 해결**
2. **setState 콜백 패턴으로 최신 상태 보장**
3. **복잡한 상태 동기화는 명확한 이벤트 플로우 설계 필요**
4. **디버깅 로그는 문제 해결의 핵심 도구**

## 🛠️ 사용 기술

- React 18
- TypeScript
- TipTap Editor
- @dnd-kit (드래그 앤 드롭)
- React Hooks (useState, useCallback, useRef, useEffect)

---

*이 포스트는 실제 프로젝트에서 발생한 문제를 해결한 과정을 정리한 것입니다.*