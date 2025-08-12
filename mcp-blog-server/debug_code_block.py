#!/usr/bin/env python3
"""코드 블록 디버깅"""

import re

test_text = """
### 테스트 1: HTML 태그가 포함된 Python 코드

```python
def create_element():
    html = '<div class="container">'
    html += '<p>안녕하세요</p>'
    html += '</div>'
    return html
```

### 테스트 2: JavaScript에서 React 컴포넌트

```javascript
const MyComponent = () => {
    return (
        <div className="wrapper">
            <h1>제목</h1>
            <p>내용</p>
        </div>
    );
};
```
"""

# 현재 정규식 테스트
pattern1 = r'```([a-zA-Z0-9_+-]*)\s*\n(.*?)(?:\n```|```)'
matches1 = re.findall(pattern1, test_text, re.DOTALL)

print("현재 정규식 결과:")
for i, (lang, code) in enumerate(matches1):
    print(f"\n매치 {i+1}:")
    print(f"  언어: '{lang}'")
    print(f"  코드 첫 30자: {code[:30]}")

# 개선된 정규식 테스트
pattern2 = r'```([a-zA-Z0-9_+-]*)\n(.*?)\n```'
matches2 = re.findall(pattern2, test_text, re.DOTALL)

print("\n\n개선된 정규식 결과:")
for i, (lang, code) in enumerate(matches2):
    print(f"\n매치 {i+1}:")
    print(f"  언어: '{lang}'")
    print(f"  코드 첫 30자: {code[:30]}")