#!/usr/bin/env python3
"""
안전한 마크다운 생성을 위한 유틸리티
코드 블록 내 HTML 태그 문제를 자동으로 처리합니다.
"""

import re
from typing import List, Tuple

class SafeMarkdownGenerator:
    """마크다운 생성 시 안전성을 보장하는 클래스"""
    
    # HTML 태그 패턴
    HTML_TAG_PATTERN = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>')
    
    # 코드 블록에서 문제가 되는 HTML 태그들
    PROBLEMATIC_TAGS = [
        'pre', 'code', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'blockquote', 'a', 'img', 'strong', 'em', 'b', 'i'
    ]
    
    def __init__(self):
        self.code_blocks = []
        self.inline_codes = []
    
    def sanitize_markdown(self, content: str) -> str:
        """마크다운 콘텐츠를 안전하게 처리"""
        # 1. 코드 블록 추출 및 처리
        content = self._process_code_blocks(content)
        
        # 2. 인라인 코드 추출 및 처리
        content = self._process_inline_codes(content)
        
        # 3. 코드 블록과 인라인 코드 복원
        content = self._restore_code_blocks(content)
        content = self._restore_inline_codes(content)
        
        return content
    
    def _process_code_blocks(self, content: str) -> str:
        """코드 블록 내의 HTML 태그를 안전하게 처리"""
        self.code_blocks = []
        
        def process_block(match):
            lang = match.group(1) or ''
            code = match.group(2)
            
            # 코드 블록 내의 HTML 태그를 대괄호로 변경
            safe_code = self._sanitize_html_in_code(code)
            
            # 저장
            idx = len(self.code_blocks)
            self.code_blocks.append((lang, safe_code))
            
            return f'__CODEBLOCK_{idx}__'
        
        # 코드 블록 추출
        pattern = r'```(\w*)\n(.*?)```'
        content = re.sub(pattern, process_block, content, flags=re.DOTALL)
        
        return content
    
    def _process_inline_codes(self, content: str) -> str:
        """인라인 코드 내의 HTML 태그를 안전하게 처리"""
        self.inline_codes = []
        
        def process_inline(match):
            code = match.group(1)
            
            # 인라인 코드 내의 HTML 태그를 대괄호로 변경
            safe_code = self._sanitize_html_in_code(code)
            
            # 저장
            idx = len(self.inline_codes)
            self.inline_codes.append(safe_code)
            
            return f'__INLINE_{idx}__'
        
        # 인라인 코드 추출
        pattern = r'`([^`]+)`'
        content = re.sub(pattern, process_inline, content)
        
        return content
    
    def _sanitize_html_in_code(self, code: str) -> str:
        """코드 내의 HTML 태그를 안전하게 변경"""
        # 방법 1: 대괄호로 변경
        # <tag> → [tag]
        # </tag> → [/tag]
        
        def replace_tag(match):
            closing = match.group(1)  # '/' or ''
            tag_name = match.group(2)
            
            # 문제가 되는 태그인 경우에만 변경
            if tag_name.lower() in self.PROBLEMATIC_TAGS:
                return f'[{closing}{tag_name}]'
            
            # 그 외는 그대로 유지
            return match.group(0)
        
        return self.HTML_TAG_PATTERN.sub(replace_tag, code)
    
    def _restore_code_blocks(self, content: str) -> str:
        """처리된 코드 블록을 복원"""
        for idx, (lang, code) in enumerate(self.code_blocks):
            placeholder = f'__CODEBLOCK_{idx}__'
            replacement = f'```{lang}\n{code}```'
            content = content.replace(placeholder, replacement)
        
        return content
    
    def _restore_inline_codes(self, content: str) -> str:
        """처리된 인라인 코드를 복원"""
        for idx, code in enumerate(self.inline_codes):
            placeholder = f'__INLINE_{idx}__'
            replacement = f'`{code}`'
            content = content.replace(placeholder, replacement)
        
        return content

    @staticmethod
    def create_safe_code_example(code: str, language: str = 'python') -> str:
        """안전한 코드 예시 생성"""
        # HTML 태그를 대괄호로 변경
        safe_code = code.replace('<', '[').replace('>', ']')
        
        return f'```{language}\n{safe_code}\n```'
    
    @staticmethod
    def validate_markdown(content: str) -> List[str]:
        """마크다운 내용의 잠재적 문제 검사"""
        issues = []
        
        # 코드 블록 내 HTML 태그 검사
        code_block_pattern = r'```[\w]*\n(.*?)```'
        code_blocks = re.findall(code_block_pattern, content, re.DOTALL)
        
        for idx, code in enumerate(code_blocks, 1):
            if '<' in code and '>' in code:
                # HTML 태그가 있는지 확인
                if re.search(r'<[a-zA-Z][^>]*>', code):
                    issues.append(f"코드 블록 {idx}에 HTML 태그가 포함되어 있습니다.")
        
        # 인라인 코드 내 HTML 태그 검사
        inline_pattern = r'`([^`]+)`'
        inline_codes = re.findall(inline_pattern, content)
        
        for idx, code in enumerate(inline_codes, 1):
            if '<' in code and '>' in code:
                if re.search(r'<[a-zA-Z][^>]*>', code):
                    issues.append(f"인라인 코드 {idx}에 HTML 태그가 포함되어 있습니다.")
        
        return issues

# 사용 예시
if __name__ == "__main__":
    generator = SafeMarkdownGenerator()
    
    # 문제가 있는 마크다운 예시
    problematic_md = """
# HTML 예시

다음은 HTML 코드입니다:

```python
html = '<div class="container"><p>Hello</p></div>'
print(html)
```

인라인 코드: `<span>텍스트</span>`
"""
    
    # 안전하게 처리
    safe_md = generator.sanitize_markdown(problematic_md)
    print("안전한 마크다운:")
    print(safe_md)
    
    # 검증
    issues = SafeMarkdownGenerator.validate_markdown(problematic_md)
    if issues:
        print("\n발견된 문제:")
        for issue in issues:
            print(f"  - {issue}")