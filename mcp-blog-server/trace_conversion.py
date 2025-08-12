#!/usr/bin/env python3
"""변환 과정 추적"""

import sys
sys.path.append('.')
from blog_post import markdown_to_html

test_md = """```python
def create_element():
    html = '<div class="container">'
    return html
```"""

print("원본 마크다운:")
print(test_md)
print("\n" + "="*50 + "\n")

result = markdown_to_html(test_md)

print("변환 결과:")
print(result)
print("\n" + "="*50 + "\n")

# HTML 태그 확인
if '<pre' in result:
    print("✅ pre 태그 발견")
else:
    print("❌ pre 태그 없음")

if '&lt;div' in result:
    print("✅ HTML 이스케이프 됨")
else:
    print("❌ HTML 이스케이프 안됨")

if '<div class=' in result:
    print("⚠️ 실제 HTML 태그 발견!")
else:
    print("✅ 실제 HTML 태그 없음")