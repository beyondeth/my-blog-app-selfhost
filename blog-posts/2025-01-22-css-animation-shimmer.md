# CSS 애니메이션으로 Admin Panel 아이콘 빛나게 만들기

## 요구사항

"Admin Panel 아이콘을 멋있게 반짝거리는 느낌으로 만들어줘. 그리고 가운데 색도 채워주면 좋겠어."

단순한 Shield 아이콘을 고급스럽게 만드는 과정을 공유합니다.

## 초기 상태

```tsx
<Shield className="h-8 w-8 text-indigo-600" />
```

평범한 아웃라인 아이콘. 뭔가 밋밋합니다.

## 개선 과정

### Step 1: 아이콘 채우기

```tsx
<Shield className="h-8 w-8 text-indigo-600 fill-indigo-200" />
```

Lucide 아이콘의 `fill` 속성을 사용해 내부를 연한 색으로 채웁니다.

### Step 2: 이중 레이어 구조

```tsx
<div className="relative">
  <Shield className="h-8 w-8 text-indigo-600 fill-indigo-200" />
  <div className="absolute inset-0 h-8 w-8">
    <Shield className="h-8 w-8 text-indigo-500 fill-transparent" />
  </div>
</div>
```

두 개의 아이콘을 겹쳐서 깊이감을 만듭니다.

### Step 3: Shimmer 애니메이션 추가

#### CSS 애니메이션 정의

```css
@keyframes shimmer {
  0% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
}

.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
}
```

#### 적용

```tsx
<div className="relative">
  <Shield className="h-8 w-8 text-indigo-600 fill-indigo-200" />
  <div className="absolute inset-0 h-8 w-8 animate-shimmer">
    <Shield className="h-8 w-8 text-indigo-500 fill-transparent" />
  </div>
</div>
```

## animate-ping vs animate-shimmer

### 처음 시도: animate-ping

```tsx
<div className="absolute inset-0 h-8 w-8 animate-ping">
```

**문제점:**
- 너무 빠르고 산만함
- 레이더 같은 느낌
- 고급스럽지 않음

### 개선: 커스텀 shimmer

**장점:**
- 부드러운 2초 주기
- 미세한 크기 변화 (scale 1.05)
- 은은한 투명도 변화
- 고급스러운 느낌

## 핵심 기법

### 1. 레이어링 (Layering)
```css
position: relative + absolute
```
여러 요소를 겹쳐서 복잡한 효과 생성

### 2. 투명도 게임
```css
opacity: 0.3 → 0.6 → 0.3
```
투명도 변화로 빛나는 효과

### 3. 미세한 스케일 변화
```css
transform: scale(1) → scale(1.05) → scale(1)
```
5%의 크기 변화가 생동감을 만듦

### 4. ease-in-out 타이밍
```css
animation: shimmer 2s ease-in-out infinite
```
자연스러운 가속과 감속

## 다른 활용 예시

### 로딩 인디케이터
```css
.animate-shimmer-slow {
  animation: shimmer 3s ease-in-out infinite;
}
```

### 호버 효과
```css
.hover\:animate-shimmer:hover {
  animation: shimmer 1s ease-in-out;
}
```

### 알림 뱃지
```css
.animate-shimmer-fast {
  animation: shimmer 1s ease-in-out infinite;
}
```

## 성능 고려사항

1. **GPU 가속 활용**
   - `transform`과 `opacity`는 GPU 가속
   - `position`이나 `width` 변경보다 효율적

2. **애니메이션 최적화**
   - `will-change: transform, opacity` 사용 고려
   - 보이지 않는 요소는 애니메이션 중지

3. **접근성**
   - `prefers-reduced-motion` 미디어 쿼리 고려
   ```css
   @media (prefers-reduced-motion: reduce) {
     .animate-shimmer {
       animation: none;
     }
   }
   ```

## 교훈

### 1. 작은 디테일이 큰 차이를 만든다
단순한 아이콘도 애니메이션 하나로 고급스러워집니다.

### 2. 커스텀 > 기본 제공
Tailwind의 animate-ping보다 상황에 맞는 커스텀 애니메이션이 낫습니다.

### 3. 레이어링의 힘
여러 요소를 겹치면 단일 요소로는 불가능한 효과를 만들 수 있습니다.

## 최종 코드

```tsx
// AdminLayout.tsx
<div className="relative">
  <Shield className="h-8 w-8 text-indigo-600 fill-indigo-200" />
  <div className="absolute inset-0 h-8 w-8 animate-shimmer">
    <Shield className="h-8 w-8 text-indigo-500 fill-transparent" />
  </div>
</div>
```

```css
/* globals.css */
@keyframes shimmer {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
}
```

## 마무리

작은 애니메이션이 전체 UI의 품질을 높입니다. "반짝거리는 느낌"이라는 추상적 요구사항을 구체적인 CSS 애니메이션으로 구현하는 과정에서, 투명도와 크기의 미세한 변화가 얼마나 큰 시각적 효과를 만드는지 배웠습니다.

#CSS #Animation #UI디자인 #Tailwind #React