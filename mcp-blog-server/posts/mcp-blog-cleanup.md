---
title: MCP 블로그 서버 폴더 구조 정리 및 코드 개선
category: tech
tags: [MCP, 블로그, 리팩토링, Python, 코드정리]
status: published
---

# MCP 블로그 서버 폴더 구조 정리 및 코드 개선

MCP 블로그 자동 포스팅 시스템의 폴더 구조가 너무 복잡해져서 대대적인 정리 작업을 진행했습니다. 
사용하지 않는 코드를 제거하고, 체계적인 폴더 구조로 재구성했습니다.

## 🗂️ 이전 폴더 구조의 문제점

### 1. 파일 관리의 혼란
```
mcp-blog-server/
├── simple_post.py
├── html_post.py
├── enhanced_html_post.py
├── fixed_html_post.py
├── final_html_post.py
├── working_html_post.py
├── color_fixed_post.py
├── easy_post.py
├── debug_test.py
├── test_regex.py
├── test_simple.py
├── analysis-report.md
├── improved-analysis.md
├── mcp-development-journey.md
├── test-html-post.md
├── troubleshooting-report.md
└── ... (더 많은 파일들)
```

- 동일한 기능의 스크립트가 여러 버전으로 존재
- 마크다운 파일과 Python 스크립트가 섞여 있음
- 어떤 파일이 최종 버전인지 구분 불가능

### 2. 가상 환경 중복
```bash
drwxr-xr-x@  .venv/  # 64MB
drwxr-xr-x@  venv/   # 38MB
```
- 동일한 Python 3.13 가상 환경이 두 개 존재
- 불필요한 디스크 공간 낭비

## ✨ 개선된 폴더 구조

### 1. 체계적인 디렉토리 구성
```
mcp-blog-server/
├── blog_post.py           # ✅ 최종 작동 스크립트 (메인)
├── src/                    # 핵심 MCP 서버 코드
│   ├── mcp_server.py
│   ├── mcp_server_fixed.py
│   ├── blog_client.py
│   └── markdown_handler.py
├── posts/                  # 📝 모든 마크다운 포스트
│   ├── analysis-report.md
│   ├── improved-analysis.md
│   ├── mcp-development-journey.md
│   ├── test-html-post.md
│   └── troubleshooting-report.md
├── old_scripts/           # 📦 사용하지 않는 이전 버전들
│   ├── simple_post.py
│   ├── html_post.py
│   ├── enhanced_html_post.py
│   └── ... (테스트 스크립트들)
├── blog-mcp-cli/          # CLI 도구
├── .venv/                 # Python 가상 환경 (숨김)
├── requirements.txt       # 의존성 목록
├── setup.py              # 패키지 설정
├── README.md             # 프로젝트 문서
└── QUICK_START.md        # 빠른 시작 가이드
```

### 2. 정리 작업 내용

#### 폴더 생성 및 파일 이동
```bash
# 필요한 폴더 생성
mkdir -p posts old_scripts

# 마크다운 파일들을 posts 폴더로 이동
mv *.md posts/
mv posts/README.md .
mv posts/QUICK_START.md .

# 사용하지 않는 스크립트들을 old_scripts로 이동
mv simple_post.py html_post.py enhanced_html_post.py \
   fixed_html_post.py final_html_post.py working_html_post.py \
   color_fixed_post.py easy_post.py debug_test.py \
   test_regex.py test_simple.py old_scripts/
```

#### 중복 가상 환경 제거
```bash
# venv 폴더 제거 (.venv만 유지)
rm -rf venv
```

## 🚀 최종 포스팅 스크립트 개선

### `blog_post.py` 주요 개선 사항

#### 1. 안전한 코드 블록 처리
```python
def protect_code_block(match):
    """코드 블록을 보호하고 플레이스홀더 반환"""
    lang = match.group(1).strip() if match.group(1) else ''
    code = match.group(2)
    
    # HTML 이스케이프
    escaped_code = html.escape(code)
    
    # 안전한 플레이스홀더 생성
    key = f'[[CODEBLOCK{block_counter}]]'
    protected_blocks[key] = block_html
    return key
```

**개선점:**
- `[[CODEBLOCK0]]` 형식의 안전한 플레이스홀더 사용
- 특수문자 충돌 방지
- 딕셔너리 기반 안전한 저장/복원

#### 2. 유연한 파일 경로 처리
```python
# 파일 확인
if not file_path.exists():
    # posts 폴더에서도 찾아보기
    alt_path = Path('posts') / file_path.name
    if alt_path.exists():
        file_path = alt_path
    else:
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        sys.exit(1)
```

**개선점:**
- 파일명만 입력해도 posts 폴더에서 자동으로 찾기
- 더 편리한 사용성

#### 3. 명확한 스타일 지정
```python
# 코드 블록 HTML 생성 - 검정 배경에 밝은 글씨
# pre 태그에 인라인 스타일 적용
block_html = (
    f'[pre style="background-color: #1e1e1e; color: #d4d4d4; '
    f'padding: 16px; border-radius: 8px; overflow-x: auto; '
    f'margin: 1em 0; font-family: Courier New, monospace;"]'
    f'[code class="language-{lang}"]{escaped_code}[/code][/pre]'
)
# 실제 코드에서는 []를 <>로 치환하여 HTML 태그로 변환
```

**개선점:**
- 모든 스타일 인라인으로 명시
- 검정 배경에 밝은 회색 글씨로 가독성 확보
- 일관된 폰트와 여백 적용

## 📊 정리 결과

| 항목 | Before | After |
|------|--------|-------|
| Python 스크립트 수 | 15개 이상 | 1개 (메인) + 보관용 |
| 폴더 구조 | 평면적, 혼란 | 체계적, 계층적 |
| 가상 환경 | 2개 (중복) | 1개 (.venv) |
| 디스크 사용량 | ~120MB | ~70MB |
| 파일 찾기 난이도 | 어려움 | 쉬움 |

## 💡 사용법

### 포스트 작성 및 발행
```bash
# 포스트 작성 (초안)
python3 blog_post.py posts/my-post.md

# 포스트 즉시 발행
python3 blog_post.py posts/my-post.md --publish

# posts 폴더 경로 생략 가능
python3 blog_post.py my-post.md --publish
```

## 🎯 개선 효과

1. **명확한 파일 구조**: 용도별로 폴더가 분리되어 관리가 쉬워짐
2. **단일 진입점**: `blog_post.py` 하나로 모든 포스팅 작업 처리
3. **효율적인 리소스 사용**: 중복 제거로 디스크 공간 절약
4. **유지보수 용이성**: 코드 수정이 필요할 때 어디를 봐야 할지 명확
5. **안정적인 코드 블록 처리**: 플레이스홀더 충돌 문제 완전 해결

## 🔧 .venv vs venv 차이점

### Python 가상 환경 명명 규칙
- **`.venv`**: 숨김 폴더 (점으로 시작)
  - `ls` 명령에서 기본적으로 보이지 않음
  - 프로젝트 가상환경에 권장되는 표준 이름
  - Git 등에서 자동으로 무시되는 경우가 많음

- **`venv`**: 일반 폴더
  - 항상 보임
  - 가상 환경임을 명시적으로 표현

우리 프로젝트에서는 두 개가 중복으로 존재했으나, 표준적인 `.venv`만 남기고 `venv`는 삭제했습니다.

## 🚀 다음 단계

1. MCP 서버 자체의 리팩토링
2. 더 나은 에러 처리 추가
3. 포스트 미리보기 기능
4. 일괄 포스팅 기능
5. 포스트 업데이트 기능

이제 깔끔하게 정리된 구조로 더 효율적인 블로그 관리가 가능해졌습니다! 🎉