#!/usr/bin/env python3
"""
실제 문제 시나리오를 재현하는 디버그 스크립트
"""

import re
import html
from blog_post import markdown_to_html

def debug_step_by_step(text):
    """단계별로 변환 과정을 추적"""
    print(f"🔍 단계별 변환 추적")
    print(f"원본 텍스트: {repr(text)}")
    print(f"{'='*50}")
    
    # 1단계: 코드 블록 정규식 매칭
    pattern = r'```([a-zA-Z0-9]*)\s*\n(.*?)\n?```'
    matches = re.findall(pattern, text, re.DOTALL)
    print(f"1단계 - 코드 블록 매칭: {matches}")
    
    # 2단계: HTML 이스케이프 후 상태
    escaped = html.escape(text)
    print(f"2단계 - HTML 이스케이프: {repr(escaped)}")
    
    # 3단계: 전체 변환 과정 확인
    result = markdown_to_html(text)
    print(f"3단계 - 최종 결과: {result}")
    
    return result

def test_problematic_cases():
    """문제가 될 수 있는 케이스들"""
    
    print("\n" + "="*60)
    print("CASE 1: HTML 태그가 실제로 해석되는 문제")
    print("="*60)
    
    case1 = """여기는 일반 텍스트입니다.

```html
<div class="container">
    <h1>제목</h1>
    <script>alert('이게 실행되면 문제!');</script>
</div>
```

그리고 여기는 또 다른 텍스트입니다."""
    
    result1 = debug_step_by_step(case1)
    
    # HTML 해석 여부 확인
    if '<div class="container">' in result1 and not '&lt;div' in result1:
        print("❌ 보안 위험: HTML 태그가 실제로 해석됨!")
    else:
        print("✅ 안전: HTML 태그가 이스케이프됨")
    
    print("\n" + "="*60)
    print("CASE 2: 1칸짜리 이상한 코드 블록")
    print("="*60)
    
    # 이런 경우에 1칸짜리 코드블록이 생성될 수 있음
    case2 = """텍스트 ```inline``` 텍스트

```
a
```

더 많은 텍스트"""
    
    result2 = debug_step_by_step(case2)
    
    print("\n" + "="*60)
    print("CASE 3: 중첩된 마크다운 구문")
    print("="*60)
    
    case3 = """```javascript
// 이 코드 안에 **굵은 글씨**가 있으면?
const text = "여기 `인라인 코드`도 있고";
function test() {
    return "이것은 *기울임*이어야 하나?";
}
```"""
    
    result3 = debug_step_by_step(case3)
    
    print("\n" + "="*60)
    print("CASE 4: HTML 엔티티 복원 문제")
    print("="*60)
    
    case4 = """```xml
<root>
    <element attr="value &amp; more">
        &lt;nested&gt; content
    </element>
</root>
```"""
    
    result4 = debug_step_by_step(case4)
    
    print("\n" + "="*60)
    print("CASE 5: 복잡한 중첩 구조")
    print("="*60)
    
    case5 = """# 제목

일반 텍스트와 `인라인 코드`.

```python
def example():
    '''
    이 docstring 안에 `백틱`이 있어요
    그리고 HTML <tags>도 있고
    '''
    return "완료"
```

- 리스트 아이템
- 또 다른 `인라인` 코드

```
short
```

마지막 텍스트."""
    
    result5 = debug_step_by_step(case5)

def test_regex_edge_cases():
    """정규식의 엣지 케이스들"""
    
    print("\n" + "="*60)
    print("정규식 엣지 케이스 분석")
    print("="*60)
    
    pattern = r'```([a-zA-Z0-9]*)\s*\n(.*?)\n?```'
    
    edge_cases = [
        # 언어 지정에 하이픈 포함 (css, shell-script 등)
        ("```css\nbody { color: red; }\n```", "하이픈 없는 CSS"),
        ("```shell-script\necho 'test'\n```", "하이픈 있는 언어 (실패 예상)"),
        
        # 코드 블록 시작/끝 공백 문제
        ("```   javascript   \ncode\n```", "언어명 주변 공백"),
        ("``` \ncode\n```", "언어명이 공백"),
        
        # 마지막 개행 문제
        ("```js\ncode```", "끝 개행 없음"),
        ("```js\ncode\n\n```", "끝에 빈 줄"),
        
        # 특수 문자 포함
        ("```typescript\ninterface A<T> { x: T & B; }\n```", "제네릭과 특수문자"),
    ]
    
    for test_text, description in edge_cases:
        print(f"\n테스트: {description}")
        print(f"입력: {repr(test_text)}")
        
        matches = re.findall(pattern, test_text, re.DOTALL)
        print(f"정규식 매칭: {matches}")
        
        result = markdown_to_html(test_text)
        has_pre = '<pre' in result
        print(f"코드 블록 생성: {'✅' if has_pre else '❌'}")

if __name__ == "__main__":
    test_problematic_cases()
    test_regex_edge_cases()