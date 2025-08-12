#!/usr/bin/env python3
"""
마크다운 -> HTML 변환 테스트 스크립트
코드 블록 렌더링 문제를 재현하고 분석합니다.
"""

import re
import html
from blog_post import markdown_to_html

def test_case(name, markdown_text, expected_issues=None):
    """테스트 케이스 실행 및 결과 분석"""
    print(f"\n{'='*60}")
    print(f"테스트: {name}")
    print(f"{'='*60}")
    
    print(f"\n📝 입력 마크다운:")
    print(repr(markdown_text))
    
    result = markdown_to_html(markdown_text)
    
    print(f"\n🔄 변환 결과:")
    print(result)
    
    print(f"\n🔍 분석:")
    if expected_issues:
        for issue in expected_issues:
            if issue in result:
                print(f"❌ 예상된 문제 발견: {issue}")
            else:
                print(f"✅ 문제 없음: {issue}")
    
    # 코드 블록 관련 검사
    if '<pre' in result:
        print(f"✅ 코드 블록 생성됨")
    else:
        print(f"❌ 코드 블록이 생성되지 않음")
    
    # HTML 태그가 해석되는지 검사
    if '<script>' in result or '<div>' in result:
        print(f"⚠️  HTML 태그가 해석되어 보안 위험 가능")
    
    return result

def main():
    """메인 테스트 함수"""
    
    # 테스트 1: 기본 코드 블록
    test_case(
        "기본 JavaScript 코드 블록",
        """```javascript
function hello() {
    console.log("Hello World");
}
```""",
        expected_issues=["function hello()"]
    )
    
    # 테스트 2: 언어 없는 코드 블록
    test_case(
        "언어 지정 없는 코드 블록",
        """```
const x = 1;
const y = 2;
```""",
        expected_issues=["const x"]
    )
    
    # 테스트 3: HTML 포함 코드 블록
    test_case(
        "HTML 태그 포함 코드 블록",
        """```html
<div class="container">
    <script>alert('XSS');</script>
</div>
```""",
        expected_issues=["<div>", "<script>"]
    )
    
    # 테스트 4: 코드 블록 앞뒤 공백
    test_case(
        "공백이 있는 코드 블록",
        """
Some text before

```python
def test():
    pass
```

Some text after
""",
        expected_issues=["def test()"]
    )
    
    # 테스트 5: 중첩된 백틱
    test_case(
        "중첩된 백틱이 포함된 코드",
        """```bash
echo "Hello `whoami`"
```""",
        expected_issues=["whoami"]
    )
    
    # 테스트 6: 짧은 코드 블록 (1칸 문제)
    test_case(
        "매우 짧은 코드 블록",
        """```
x
```""",
        expected_issues=["x"]
    )
    
    # 테스트 7: 개행이 없는 코드 블록
    test_case(
        "개행 없는 코드 블록",
        """```js
console.log('test')```""",
        expected_issues=["console.log"]
    )
    
    # 테스트 8: 인라인 코드와 함께
    test_case(
        "인라인 코드와 블록 코드 혼합",
        """Here is some `inline code` and:

```python
def block_code():
    return "block"
```

More `inline` here.""",
        expected_issues=["inline", "def block_code"]
    )
    
    # 테스트 9: 정규식 문제 재현
    print(f"\n{'='*60}")
    print("정규식 패턴 분석")
    print(f"{'='*60}")
    
    # 현재 사용된 정규식
    current_pattern = r'```([a-zA-Z0-9]*)\s*\n(.*?)\n?```'
    
    test_strings = [
        "```js\nconsole.log('test')```",  # 개행 없음
        "```\nx\n```",  # 매우 짧은 코드
        "```python\ndef test():\n    pass\n```",  # 정상적인 코드
        "```html\n<div>\n<script>alert('xss')</script>\n</div>\n```",  # HTML 포함
    ]
    
    print(f"현재 정규식: {current_pattern}")
    for i, test_str in enumerate(test_strings):
        matches = re.findall(current_pattern, test_str, re.DOTALL)
        print(f"테스트 {i+1}: {repr(test_str)}")
        print(f"매칭 결과: {matches}")
        print()

if __name__ == "__main__":
    main()