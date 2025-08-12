#!/usr/bin/env python3
"""개선된 마크다운 변환 테스트"""

import sys
sys.path.append('.')
from blog_post import markdown_to_html

# 테스트 마크다운
test_md = """
# 테스트 포스트

## 코드 블록 테스트

### Python 코드
```python
def hello():
    html = '<div>안녕하세요</div>'
    return html
```

### JavaScript 코드
```javascript
const element = '<span>테스트</span>';
console.log(element);
```

### Shell 스크립트
```shell-script
echo "Hello World"
```

### 짧은 코드
```
x
```

인라인 코드: `<div>테스트</div>`

일반 텍스트에서 < 와 > 기호 사용하기
"""

# 변환 테스트
html = markdown_to_html(test_md)

print("=== 변환된 HTML ===")
print(html)

# 문제 체크
issues = []
if '<div>' in html and 'div' not in html.lower().split('code'):
    issues.append("HTML 태그가 실제로 렌더링됨")
if '&lt;div&gt;' not in html:
    issues.append("HTML 태그가 이스케이프되지 않음")

print("\n=== 검증 결과 ===")
if issues:
    print("❌ 발견된 문제:")
    for issue in issues:
        print(f"  - {issue}")
else:
    print("✅ 모든 테스트 통과!")

# 코드 블록 개수 확인
pre_count = html.count('<pre')
print(f"\n코드 블록 개수: {pre_count}개")