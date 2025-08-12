#!/usr/bin/env python3
"""
개선된 마크다운 -> HTML 변환 함수
기존 blog_post.py의 문제점들을 해결한 버전
"""

import html
import re

def improved_markdown_to_html(text):
    """개선된 마크다운을 HTML로 변환"""
    if not text:
        return ''
    
    # 1. 코드 블록을 먼저 안전하게 보호
    protected_blocks = {}
    block_counter = 0
    
    def protect_code_block(match):
        """코드 블록을 보호하고 플레이스홀더 반환 - 개선된 버전"""
        nonlocal block_counter
        
        # 그룹 확인: 전체 매치, 언어, 코드 내용
        full_match = match.group(0)
        lang = match.group(1).strip() if match.group(1) else ''
        code = match.group(2)
        
        # 빈 코드 블록 처리
        if not code or code.isspace():
            code = ''
        
        # 언어 검증 - 하이픈, 언더스코어, 플러스 허용
        if not lang or not re.match(r'^[a-zA-Z0-9_+-]+$', lang):
            lang = 'plaintext'
        
        # HTML 완전 이스케이프 - 이중 이스케이프 방지
        if '&lt;' not in code:  # 이미 이스케이프되지 않은 경우만
            escaped_code = html.escape(code, quote=True)
        else:
            escaped_code = code
        
        # 스타일링된 코드 블록 HTML 생성
        block_html = f'''<pre class="code-block" style="background-color: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 1em 0; font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-word;"><code class="language-{lang}">{escaped_code}</code></pre>'''
        
        # 고유한 플레이스홀더 생성
        key = f'__CODEBLOCK_{block_counter}__'
        protected_blocks[key] = block_html
        block_counter += 1
        return key
    
    # 개선된 코드 블록 정규식
    # - 언어명에 하이픈, 언더스코어, 플러스 허용
    # - 앞뒤 공백 처리 개선
    # - 마지막 개행 선택적 처리
    code_block_pattern = r'```([a-zA-Z0-9_+-]*)\s*\n(.*?)(?:\n```|```)'
    text = re.sub(code_block_pattern, protect_code_block, text, flags=re.DOTALL)
    
    # 2. 인라인 코드 보호
    protected_inline = {}
    inline_counter = 0
    
    def protect_inline_code(match):
        """인라인 코드를 보호하고 플레이스홀더 반환"""
        nonlocal inline_counter
        code = match.group(1)
        
        # HTML 이스케이프
        escaped_code = html.escape(code, quote=True)
        
        inline_html = f'''<code class="inline-code" style="background-color: #f6f8fa; color: #e36209; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; font-family: 'Courier New', monospace;">{escaped_code}</code>'''
        
        key = f'__INLINE_{inline_counter}__'
        protected_inline[key] = inline_html
        inline_counter += 1
        return key
    
    # 인라인 코드 추출 (개선된 정규식)
    # 코드 블록 내부의 백틱은 이미 보호되었으므로 안전
    text = re.sub(r'`([^`\n]+)`', protect_inline_code, text)
    
    # 3. 나머지 텍스트의 HTML 이스케이프
    # 플레이스홀더가 포함된 라인은 보호
    lines = text.split('\n')
    escaped_lines = []
    for line in lines:
        if '__CODEBLOCK_' in line or '__INLINE_' in line:
            escaped_lines.append(line)
        else:
            escaped_lines.append(html.escape(line, quote=False))
    text = '\n'.join(escaped_lines)
    
    # 4. 마크다운 문법 변환 (기존과 동일하지만 순서 최적화)
    
    # 헤딩
    for level in range(6, 0, -1):
        pattern = r'^{} (.*)$'.format('#' * level)
        replacement = f'<h{level}>\\1</h{level}>'
        text = re.sub(pattern, replacement, text, flags=re.MULTILINE)
    
    # 굵은 글씨와 기울임 (순서 중요)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__([^_]+)__', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', text)
    text = re.sub(r'(?<!_)_([^_\n]+)_(?!_)', r'<em>\1</em>', text)
    
    # 취소선
    text = re.sub(r'~~([^~]+)~~', r'<s>\1</s>', text)
    
    # 링크 (보안 강화)
    def safe_link(match):
        text_content = match.group(1)
        url = match.group(2)
        # URL 검증 (기본적인 보안 체크)
        if url.startswith(('http://', 'https://', '//', '/', 'mailto:')):
            return f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{html.escape(text_content)}</a>'
        else:
            return match.group(0)  # 의심스러운 링크는 그대로 두기
    
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', safe_link, text)
    
    # 이미지
    def safe_image(match):
        alt_text = match.group(1)
        src = match.group(2)
        if src.startswith(('http://', 'https://', '//', '/', 'data:image/')):
            return f'<img src="{html.escape(src, quote=True)}" alt="{html.escape(alt_text, quote=True)}" style="max-width: 100%; height: auto;">'
        else:
            return match.group(0)
    
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', safe_image, text)
    
    # 수평선
    text = re.sub(r'^---+$', '<hr>', text, flags=re.MULTILINE)
    
    # 5. 인용문 처리 (개선됨)
    lines = text.split('\n')
    result_lines = []
    in_blockquote = False
    blockquote_lines = []
    
    for line in lines:
        if line.strip().startswith('&gt; ') or line.strip().startswith('> '):
            # HTML 이스케이프된 것과 원본 둘 다 처리
            if line.strip().startswith('&gt; '):
                content = line.strip()[5:]
            else:
                content = line.strip()[2:]
                
            if not in_blockquote:
                in_blockquote = True
            blockquote_lines.append(content)
        else:
            if in_blockquote:
                quote_html = f'''<blockquote style="border-left: 4px solid #dfe2e5; padding-left: 1em; margin: 1em 0; color: #6a737d; font-style: italic;">{'<br>'.join(blockquote_lines)}</blockquote>'''
                result_lines.append(quote_html)
                blockquote_lines = []
                in_blockquote = False
            result_lines.append(line)
    
    if in_blockquote and blockquote_lines:
        quote_html = f'''<blockquote style="border-left: 4px solid #dfe2e5; padding-left: 1em; margin: 1em 0; color: #6a737d; font-style: italic;">{'<br>'.join(blockquote_lines)}</blockquote>'''
        result_lines.append(quote_html)
    
    text = '\n'.join(result_lines)
    
    # 6. 리스트 처리 (중첩 지원 개선)
    lines = text.split('\n')
    result_lines = []
    in_ul = False
    in_ol = False
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('- ') or stripped.startswith('* '):
            if not in_ul:
                if in_ol:
                    result_lines.append('</ol>')
                    in_ol = False
                result_lines.append('<ul>')
                in_ul = True
            content = stripped[2:].strip()
            result_lines.append(f'<li>{content}</li>')
        elif re.match(r'^\d+\. ', stripped):
            if not in_ol:
                if in_ul:
                    result_lines.append('</ul>')
                    in_ul = False
                result_lines.append('<ol>')
                in_ol = True
            content = re.sub(r'^\d+\. ', '', stripped)
            result_lines.append(f'<li>{content}</li>')
        else:
            if in_ul:
                result_lines.append('</ul>')
                in_ul = False
            if in_ol:
                result_lines.append('</ol>')
                in_ol = False
            result_lines.append(line)
    
    if in_ul:
        result_lines.append('</ul>')
    if in_ol:
        result_lines.append('</ol>')
    
    text = '\n'.join(result_lines)
    
    # 7. 테이블 처리 (기존과 동일)
    def process_table(match):
        lines = match.group(0).strip().split('\n')
        if len(lines) < 3:
            return match.group(0)
        
        html_table = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">'
        html_table += '<thead><tr>'
        
        headers = [cell.strip() for cell in lines[0].split('|')[1:-1]]
        for header in headers:
            html_table += f'<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">{header}</th>'
        html_table += '</tr></thead><tbody>'
        
        for line in lines[2:]:
            if '|' in line:
                cells = [cell.strip() for cell in line.split('|')[1:-1]]
                html_table += '<tr>'
                for cell in cells:
                    html_table += f'<td style="border: 1px solid #ddd; padding: 8px;">{cell}</td>'
                html_table += '</tr>'
        
        html_table += '</tbody></table>'
        return html_table
    
    text = re.sub(
        r'\|[^\n]+\|\s*\n\|[\s\-:|]+\|\s*\n(\|[^\n]+\|\s*\n?)+',
        process_table,
        text,
        flags=re.MULTILINE
    )
    
    # 8. 보호된 코드 블록과 인라인 코드 복원
    for key, value in protected_blocks.items():
        text = text.replace(key, value)
    
    for key, value in protected_inline.items():
        text = text.replace(key, value)
    
    # 9. 단락 처리 (개선됨)
    paragraphs = text.split('\n\n')
    formatted = []
    
    for para in paragraphs:
        para = para.strip()
        if para:
            # HTML 태그나 보호된 요소로 시작하지 않으면 p 태그로 감싸기
            if not re.match(r'^<(?:h[1-6]|ul|ol|pre|blockquote|table|hr|div)', para):
                # 단락 내 줄바꿈은 <br>로 변환
                para = para.replace('\n', '<br>')
                para = f'<p style="line-height: 1.6; margin: 1em 0;">{para}</p>'
            formatted.append(para)
    
    html_content = '\n'.join(formatted)
    
    # 10. 최종 정리 - HTML 엔티티는 이미 적절히 처리되었으므로 복원하지 않음
    # 보안상 더 안전함
    
    return html_content

# 테스트 함수
def test_improved_version():
    """개선된 버전 테스트"""
    
    test_cases = [
        {
            "name": "보안 테스트 - HTML 태그",
            "input": """```html
<div class="container">
    <script>alert('XSS');</script>
</div>
```""",
            "expect": "HTML 태그가 이스케이프되어야 함"
        },
        {
            "name": "언어 지정 - 하이픈 포함",
            "input": "```shell-script\necho 'test'\n```",
            "expect": "shell-script 언어가 인식되어야 함"
        },
        {
            "name": "짧은 코드 블록",
            "input": "```\nx\n```",
            "expect": "1글자도 정상 처리되어야 함"
        },
        {
            "name": "복합 구조",
            "input": """# 제목

일반 텍스트와 `인라인` 코드

```python
def test():
    return "완료"
```

- 리스트 항목""",
            "expect": "모든 요소가 정상 변환되어야 함"
        }
    ]
    
    for case in test_cases:
        print(f"\n{'='*50}")
        print(f"테스트: {case['name']}")
        print(f"{'='*50}")
        
        result = improved_markdown_to_html(case['input'])
        
        print(f"입력:\n{case['input']}")
        print(f"\n출력:\n{result}")
        print(f"\n기대 결과: {case['expect']}")
        
        # 보안 검증
        if '<script>' in result and '&lt;script&gt;' not in result:
            print("❌ 보안 위험: script 태그가 이스케이프되지 않음")
        else:
            print("✅ 보안 OK")

if __name__ == "__main__":
    test_improved_version()