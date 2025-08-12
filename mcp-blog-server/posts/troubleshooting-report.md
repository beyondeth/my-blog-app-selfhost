---
title: MCP 블로그 자동 포스팅 문제 해결 과정
category: tech
tags: [MCP, 블로그, 트러블슈팅, HTML, 마크다운]
status: published
---

# MCP 블로그 자동 포스팅 문제 해결 과정

MCP(Model Context Protocol) 블로그 서버를 통한 자동 포스팅 기능을 구현하면서 겪었던 문제점들과 해결 과정을 정리합니다.

## 🔴 문제 1: 마크다운이 HTML로 변환되지 않음

### 증상
- 블로그에 포스팅하면 마크다운 문법이 그대로 노출됨
- `**굵은 글씨**`, `# 헤딩` 등이 텍스트로 표시됨
- 가독성이 매우 떨어지는 상태

### 원인 분석
```javascript
// frontend/src/components/ui/ContentRenderer.tsx
<div 
  className={`prose prose-lg max-w-none ${className}`}
  dangerouslySetInnerHTML={{ __html: processedContent }}
/>
```
프론트엔드는 HTML을 기대하지만, 서버에서 마크다운 원문을 전송하고 있었음

### 해결 방법
마크다운을 HTML로 변환하는 로직 구현:
```python
def markdown_to_html(text):
    # 헤딩 변환
    text = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)
    # 굵은 글씨
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # 기울임
    text = re.sub(r'\*([^*\n]+)\*', r'<em>\1</em>', text)
    # ... 기타 마크다운 문법 변환
```

## 🔴 문제 2: 코드 블록이 플레이스홀더로 표시됨

### 증상
- 코드 블록이 `CODEBLOCK0`, `CODEBLOCK1` 등으로 표시
- 실제 코드 내용이 사라짐

### 원인 분석
HTML 이스케이프 과정에서 플레이스홀더가 변형되어 복원 시 매칭 실패:
```python
# 잘못된 접근
text = html.escape(text)  # 플레이스홀더도 이스케이프됨
# __CODEBLOCK_0__ → __CODEBLOCK_0__  (언더스코어가 이스케이프)
```

### 해결 방법
코드 블록을 먼저 처리하고 HTML로 직접 변환:
```python
def process_code_block(match):
    lang = match.group(1) or 'plaintext'
    code = match.group(2)
    escaped_code = html.escape(code)
    return f'<pre><code class="language-{lang}">{escaped_code}</code></pre>'

text = re.sub(r'```(\w*)\n(.*?)```', process_code_block, text, flags=re.DOTALL)
```

## 🔴 문제 3: 코드 블록 배경색과 글자색이 같음

### 증상
- 코드 블록이 검정색 배경에 검정색 글씨로 표시
- 코드 내용을 전혀 읽을 수 없음

### 원인 분석
프론트엔드의 syntax highlighter가 배경색만 적용하고 글자색을 지정하지 않음

### 해결 방법
인라인 스타일로 명시적 색상 지정:
```python
def process_code_block(match):
    lang = match.group(1) or 'plaintext'
    code = match.group(2)
    escaped_code = html.escape(code)
    
    # 검정 배경에 밝은 회색 글씨
    return f'''<pre style="background-color: #1e1e1e; color: #d4d4d4; 
               padding: 16px; border-radius: 8px; overflow-x: auto;">
               <code class="language-{lang}">{escaped_code}</code></pre>'''
```

## 🔴 문제 4: 의존성 모듈 오류

### 증상
- `ModuleNotFoundError: No module named 'aiohttp'`
- `ModuleNotFoundError: No module named 'requests'`
- 가상 환경 문제로 인한 반복적인 실패

### 원인 분석
- 복잡한 의존성 관리
- 가상 환경과 시스템 Python 간의 충돌

### 해결 방법
Python 표준 라이브러리만 사용하는 단순화된 스크립트 작성:
```python
import json
import urllib.request
import urllib.parse
import http.cookiejar
import html
import re
# 외부 의존성 없이 표준 라이브러리만 사용
```

## ✅ 최종 해결 방안

### 1. 단순하고 안정적인 접근
- 외부 라이브러리 의존성 최소화
- Python 표준 라이브러리 활용
- 명확한 변환 로직

### 2. 코드 블록 처리 전략
```python
# 1. 코드 블록을 먼저 HTML로 변환
# 2. 나머지 텍스트 이스케이프
# 3. 마크다운 문법 변환
# 4. 단락 처리
```

### 3. 스타일링 고려사항
- 인라인 스타일로 명시적 색상 지정
- 프론트엔드 렌더러와의 호환성 확보
- 가독성을 위한 적절한 색상 대비

## 📊 결과

| 항목 | Before | After |
|------|--------|-------|
| 마크다운 렌더링 | ❌ 원문 그대로 표시 | ✅ HTML로 변환 |
| 코드 블록 | ❌ 플레이스홀더 표시 | ✅ 정상 표시 |
| 코드 가독성 | ❌ 검정색 글씨 | ✅ 밝은 회색 글씨 |
| 의존성 | ❌ 복잡한 외부 라이브러리 | ✅ 표준 라이브러리만 사용 |

## 💡 교훈

1. **프론트엔드와 백엔드 간의 데이터 형식을 명확히 파악해야 함**
   - API가 기대하는 형식 확인
   - 렌더링 컴포넌트의 동작 방식 이해

2. **단순한 해결책이 최선일 수 있음**
   - 복잡한 라이브러리보다 표준 라이브러리 활용
   - 직접적이고 명확한 변환 로직

3. **스타일링은 명시적으로**
   - 암묵적 스타일 상속에 의존하지 말 것
   - 중요한 스타일은 인라인으로 명시

4. **디버깅 시 문제를 정확히 파악**
   - 증상과 근본 원인 구분
   - 단계별 검증 필요

## 🚀 최종 작동 스크립트

`color_fixed_post.py`가 모든 문제를 해결한 최종 버전입니다:
- ✅ 마크다운 → HTML 변환
- ✅ 코드 블록 정상 표시
- ✅ 적절한 색상 대비
- ✅ 표준 라이브러리만 사용
- ✅ 이모지 지원

이제 MCP 블로그 서버를 통한 자동 포스팅이 완벽하게 작동합니다!