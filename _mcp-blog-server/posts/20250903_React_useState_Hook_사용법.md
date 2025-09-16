---
title: "React useState Hook 사용법"
tags: []
date: 2025-09-03T10:40:13.739680
---

# React useState Hook 사용법

React의 useState Hook은 함수형 컴포넌트에서 상태를 관리하는 가장 기본적인 방법입니다.

## 기본 사용법

useState는 현재 상태값과 상태를 업데이트하는 함수를 반환합니다.

```
const [count, setCount] = useState(0);
```

## 예제

다음은 간단한 카운터 예제입니다.

```
function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

## 주의사항

- 상태 업데이트는 비동기적으로 처리됩니다
- 이전 상태를 기반으로 업데이트할 때는 함수형 업데이트를 사용하세요
- Hook은 반드시 컴포넌트 최상위에서 호출해야 합니다

이상으로 useState Hook에 대한 설명을 마칩니다.