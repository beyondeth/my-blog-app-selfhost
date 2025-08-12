#!/usr/bin/env python3
"""
MCP 블로그 자동 포스팅 스크립트
마크다운을 HTML로 변환하여 블로그에 포스팅합니다.
"""

import json
import urllib.request
import urllib.parse
import http.cookiejar
import html
import re
from pathlib import Path
import sys
from datetime import datetime

def load_env():
    """환경 변수 로드"""
    env_path = Path.home() / '.blog-mcp' / '.env'
    env_vars = {}
    
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value
    return env_vars

def markdown_to_html(text):
    """마크다운을 HTML로 변환"""
    if not text:
        return ''
    
    # 코드 블록을 안전하게 보호
    protected_blocks = {}
    block_counter = 0
    
    def protect_code_block(match):
        """코드 블록을 보호하고 플레이스홀더 반환"""
        nonlocal block_counter
        lang = match.group(1).strip() if match.group(1) else ''
        code = match.group(2)
        
        # 언어가 없으면 plaintext로 설정
        if not lang:
            lang = 'plaintext'
        
        # HTML 이스케이프
        escaped_code = html.escape(code)
        
        # 코드 블록 HTML 생성 - 검정 배경에 밝은 글씨
        block_html = (
            f'<pre style="background-color: #1e1e1e; color: #d4d4d4; '
            f'padding: 16px; border-radius: 8px; overflow-x: auto; '
            f'margin: 1em 0; font-family: \'Courier New\', monospace;">'
            f'<code class="language-{lang}">{escaped_code}</code></pre>'
        )
        
        # 안전한 플레이스홀더 생성
        key = f'[[CODEBLOCK{block_counter}]]'
        protected_blocks[key] = block_html
        block_counter += 1
        return key
    
    # 코드 블록 추출 (개선된 정규식 - 하이픈, 플러스 등 특수문자 포함 언어 지원)
    text = re.sub(
        r'```([a-zA-Z0-9_+-]*)\s*\n(.*?)(?:\n```|```)',
        protect_code_block,
        text,
        flags=re.DOTALL
    )
    
    # 인라인 코드 보호
    protected_inline = {}
    inline_counter = 0
    
    def protect_inline_code(match):
        """인라인 코드를 보호하고 플레이스홀더 반환"""
        nonlocal inline_counter
        code = html.escape(match.group(1))
        
        inline_html = (
            f'<code style="background-color: #f6f8fa; color: #e36209; '
            f'padding: 2px 6px; border-radius: 3px; font-size: 0.9em; '
            f'font-family: \'Courier New\', monospace;">{code}</code>'
        )
        
        key = f'[[INLINE{inline_counter}]]'
        protected_inline[key] = inline_html
        inline_counter += 1
        return key
    
    # 인라인 코드 추출
    text = re.sub(r'`([^`\n]+)`', protect_inline_code, text)
    
    # HTML 이스케이프 (플레이스홀더는 보호)
    lines = text.split('\n')
    escaped_lines = []
    for line in lines:
        # 플레이스홀더가 있는 라인은 그대로 유지
        if '[[CODEBLOCK' in line or '[[INLINE' in line:
            escaped_lines.append(line)
        else:
            escaped_lines.append(html.escape(line))
    text = '\n'.join(escaped_lines)
    
    # 마크다운 문법 변환
    
    # 헤딩
    for level in range(6, 0, -1):
        pattern = r'^{} (.*)$'.format('#' * level)
        replacement = r'<h{}>\1</h{}>'.format(level, level)
        text = re.sub(pattern, replacement, text, flags=re.MULTILINE)
    
    # 굵은 글씨 (순서 중요: ** 먼저 처리)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__([^_]+)__', r'<strong>\1</strong>', text)
    
    # 기울임 (굵은 글씨 처리 후)
    text = re.sub(r'\*([^*\n]+)\*', r'<em>\1</em>', text)
    text = re.sub(r'(?<![_])_([^_\n]+)_(?![_])', r'<em>\1</em>', text)
    
    # 취소선
    text = re.sub(r'~~([^~]+)~~', r'<s>\1</s>', text)
    
    # 링크
    text = re.sub(
        r'\[([^\]]+)\]\(([^)]+)\)',
        r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>',
        text
    )
    
    # 이미지
    text = re.sub(
        r'!\[([^\]]*)\]\(([^)]+)\)',
        r'<img src="\2" alt="\1" style="max-width: 100%; height: auto;">',
        text
    )
    
    # 수평선
    text = re.sub(r'^---+$', r'<hr>', text, flags=re.MULTILINE)
    
    # 인용문
    lines = text.split('\n')
    result_lines = []
    in_blockquote = False
    blockquote_lines = []
    
    for line in lines:
        if line.strip().startswith('&gt; '):
            content = line.strip()[5:]
            if not in_blockquote:
                in_blockquote = True
            blockquote_lines.append(content)
        else:
            if in_blockquote:
                quote_html = (
                    '<blockquote style="border-left: 4px solid #dfe2e5; '
                    'padding-left: 1em; margin: 1em 0; color: #6a737d;">'
                    + '<br>'.join(blockquote_lines) + '</blockquote>'
                )
                result_lines.append(quote_html)
                blockquote_lines = []
                in_blockquote = False
            result_lines.append(line)
    
    if in_blockquote and blockquote_lines:
        quote_html = (
            '<blockquote style="border-left: 4px solid #dfe2e5; '
            'padding-left: 1em; margin: 1em 0; color: #6a737d;">'
            + '<br>'.join(blockquote_lines) + '</blockquote>'
        )
        result_lines.append(quote_html)
    
    text = '\n'.join(result_lines)
    
    # 리스트 처리
    lines = text.split('\n')
    result_lines = []
    in_ul = False
    in_ol = False
    
    for line in lines:
        # 순서 없는 리스트
        if line.strip().startswith('- '):
            if not in_ul:
                if in_ol:
                    result_lines.append('</ol>')
                    in_ol = False
                result_lines.append('<ul>')
                in_ul = True
            result_lines.append(f'<li>{line.strip()[2:]}</li>')
        # 순서 있는 리스트
        elif re.match(r'^\d+\. ', line.strip()):
            if not in_ol:
                if in_ul:
                    result_lines.append('</ul>')
                    in_ul = False
                result_lines.append('<ol>')
                in_ol = True
            content = re.sub(r'^\d+\. ', '', line.strip())
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
    
    # 테이블 처리
    def process_table(match):
        lines = match.group(0).strip().split('\n')
        if len(lines) < 3:
            return match.group(0)
        
        html = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">'
        html += '<thead><tr>'
        
        # 헤더
        headers = [cell.strip() for cell in lines[0].split('|')[1:-1]]
        for header in headers:
            html += f'<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">{header}</th>'
        html += '</tr></thead><tbody>'
        
        # 바디 (구분선 건너뛰기)
        for line in lines[2:]:
            if '|' in line:
                cells = [cell.strip() for cell in line.split('|')[1:-1]]
                html += '<tr>'
                for cell in cells:
                    html += f'<td style="border: 1px solid #ddd; padding: 8px;">{cell}</td>'
                html += '</tr>'
        
        html += '</tbody></table>'
        return html
    
    # 테이블 패턴 매칭
    text = re.sub(
        r'\|[^\n]+\|\s*\n\|[\s\-:|]+\|\s*\n(\|[^\n]+\|\s*\n?)+',
        process_table,
        text,
        flags=re.MULTILINE
    )
    
    # 보호된 코드 블록과 인라인 코드 복원
    for key, value in protected_blocks.items():
        text = text.replace(key, value)
    
    for key, value in protected_inline.items():
        text = text.replace(key, value)
    
    # 단락 처리
    paragraphs = text.split('\n\n')
    formatted = []
    
    for para in paragraphs:
        para = para.strip()
        if para:
            # HTML 태그로 시작하지 않으면 p 태그로 감싸기
            if not re.match(r'^<(?:h[1-6]|ul|ol|pre|blockquote|table|hr)', para):
                # 단락 내 줄바꿈은 <br>로 변환
                para = para.replace('\n', '<br>')
                para = f'<p style="line-height: 1.6;">{para}</p>'
        formatted.append(para)
    
    html_content = '\n'.join(formatted)
    
    # HTML 엔티티는 복원하지 않음 (보안 및 렌더링 문제 방지)
    # 코드 블록 내의 이스케이프된 HTML은 그대로 유지되어야 함
    
    return html_content

def parse_markdown(content):
    """마크다운 파싱 및 메타데이터 추출"""
    metadata = {
        'title': 'Untitled',
        'category': 'general',
        'tags': []
    }
    body = content
    
    # Front matter 파싱
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            front = parts[1].strip()
            body = parts[2].strip()
            
            for line in front.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    if key == 'tags':
                        # 태그 파싱 (배열 형식)
                        if value.startswith('[') and value.endswith(']'):
                            value = value[1:-1]
                            metadata['tags'] = [t.strip().strip('"\'') for t in value.split(',')]
                        else:
                            metadata['tags'] = [value]
                    else:
                        metadata[key] = value
    
    # HTML 변환
    html_content = markdown_to_html(body)
    
    return metadata, html_content

def login(api_url, email, password):
    """블로그 로그인"""
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar)
    )
    
    login_url = f"{api_url}/api/v1/auth/login"
    login_data = json.dumps({
        "email": email,
        "password": password
    }).encode('utf-8')
    
    req = urllib.request.Request(
        login_url,
        data=login_data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        response = opener.open(req)
        if response.status in [200, 201]:
            print("✅ 로그인 성공!")
            return opener, cookie_jar
    except urllib.error.HTTPError as e:
        print(f"❌ 로그인 실패: HTTP {e.code}")
        print(f"   응답: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"❌ 로그인 오류: {e}")
    
    return None, None

def create_post(opener, api_url, title, content, category='general', tags=None):
    """블로그 포스트 생성"""
    if tags is None:
        tags = []
    
    post_url = f"{api_url}/api/v1/posts"
    post_data = json.dumps({
        "title": title,
        "content": content,
        "category": category,
        "tags": tags
    }, ensure_ascii=False).encode('utf-8')
    
    req = urllib.request.Request(
        post_url,
        data=post_data,
        headers={'Content-Type': 'application/json; charset=utf-8'}
    )
    
    try:
        response = opener.open(req)
        if response.status in [200, 201]:
            result = json.loads(response.read().decode('utf-8'))
            print(f"✅ 포스트 생성 성공!")
            print(f"   ID: {result.get('id')}")
            print(f"   제목: {result.get('title')}")
            print(f"   URL: {api_url}/posts/{result.get('slug', result.get('id'))}")
            return result
    except urllib.error.HTTPError as e:
        print(f"❌ 포스트 생성 실패: HTTP {e.code}")
        print(f"   응답: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"❌ 포스트 생성 오류: {e}")
    
    return None

def publish_post(opener, api_url, post_id):
    """포스트 발행"""
    publish_url = f"{api_url}/api/v1/posts/{post_id}"
    publish_data = json.dumps({"status": "published"}).encode('utf-8')
    
    req = urllib.request.Request(
        publish_url,
        data=publish_data,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    
    try:
        response = opener.open(req)
        if response.status == 200:
            print("✅ 포스트가 발행되었습니다!")
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ 발행 실패: HTTP {e.code}")
        print(f"   응답: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"❌ 발행 오류: {e}")
    
    return False

def main():
    """메인 함수"""
    if len(sys.argv) < 2:
        print("사용법: python blog_post.py <markdown_file> [--publish]")
        print("  --publish: 포스트를 즉시 발행합니다")
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    auto_publish = '--publish' in sys.argv
    
    # 파일 확인
    if not file_path.exists():
        # posts 폴더에서도 찾아보기
        alt_path = Path('posts') / file_path.name
        if alt_path.exists():
            file_path = alt_path
        else:
            print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
            sys.exit(1)
    
    # 마크다운 파일 읽기
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 마크다운 파싱 및 HTML 변환
    metadata, html_content = parse_markdown(content)
    
    # 환경 변수 로드
    env = load_env()
    api_url = env.get('BLOG_API_URL', 'http://localhost:3000')
    email = env.get('BLOG_EMAIL')
    password = env.get('BLOG_PASSWORD')
    
    if not email or not password:
        print("❌ 블로그 자격 증명이 설정되지 않았습니다.")
        print("   ~/.blog-mcp/.env 파일을 확인하세요.")
        sys.exit(1)
    
    # 포스팅 정보 출력
    print(f"\n📝 블로그 포스팅 준비")
    print(f"   제목: {metadata.get('title')}")
    print(f"   카테고리: {metadata.get('category')}")
    print(f"   태그: {metadata.get('tags')}")
    print(f"   상태: {'발행 예정' if auto_publish else '초안'}")
    
    # 로그인
    opener, cookies = login(api_url, email, password)
    if not opener:
        sys.exit(1)
    
    # 포스트 생성
    post = create_post(
        opener,
        api_url,
        metadata.get('title'),
        html_content,
        metadata.get('category', 'general'),
        metadata.get('tags', [])
    )
    
    # 발행 처리
    if post and auto_publish:
        publish_post(opener, api_url, post['id'])
    elif post:
        print("\n💡 포스트가 초안으로 저장되었습니다.")
        print("   발행하려면 --publish 옵션을 사용하세요.")

if __name__ == "__main__":
    main()