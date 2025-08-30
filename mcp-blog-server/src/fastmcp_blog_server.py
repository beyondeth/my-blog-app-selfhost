#!/usr/bin/env python3
"""
FastMCP 기반 블로그 서버 - 마크다운을 백엔드 API로 전송
백엔드에서 HTML 렌더링 처리 (중앙화된 렌더링 로직)
"""
import os
import json
import asyncio
import re
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# FastMCP imports
from fastmcp import FastMCP

# HTTP client
import httpx

# 환경 변수 로드
load_dotenv()

# .env 파일 경로 추가 로드
env_file = Path(__file__).parent.parent / '.env'
if env_file.exists():
    load_dotenv(env_file)

# FastMCP 서버 생성
mcp = FastMCP(
    name="blog-mcp-fastmcp",
    instructions="FastMCP 기반 블로그 포스트 자동 생성 서버. 2단계 인증을 통해 안전하게 마크다운을 백엔드 API로 전송하여 블로그에 포스팅합니다."
)


def parse_markdown_metadata(content: str) -> Tuple[Dict, str]:
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
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if key == 'title':
                        metadata['title'] = value.strip('"\'')
                    elif key == 'category':
                        metadata['category'] = value.strip('"\'')
                    elif key == 'tags':
                        # tags: [tag1, tag2] 형식 파싱
                        value = value.strip('[]')
                        metadata['tags'] = [t.strip().strip('"\'') for t in value.split(',')]
    
    # 제목이 없으면 첫 번째 h1에서 추출
    if metadata['title'] == 'Untitled':
        h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
        if h1_match:
            metadata['title'] = h1_match.group(1)
    
    return metadata, body


class TwoFactorAuth:
    """2단계 인증 클래스"""
    
    def __init__(self):
        self.base_url = os.getenv('BLOG_API_URL', 'http://localhost:3000')
        self.api_url = f"{self.base_url}/api/v1"
        self.email = os.getenv('BLOG_EMAIL')
        self.password = os.getenv('BLOG_PASSWORD')
        self.api_key = os.getenv('BLOG_API_KEY')
        
        self.access_token = None
        self.blog_info = None
        
    async def authenticate(self) -> bool:
        """2단계 인증 수행 (기존 로직 유지)"""
        try:
            # 1단계: Email/Password 인증
            if not self.email or not self.password:
                return False
            
            # 2단계: API Key 확인
            if not self.api_key:
                return False
            
            async with httpx.AsyncClient() as client:
                # /mcp/auth/verify 엔드포인트로 2단계 인증
                response = await client.post(
                    f"{self.base_url}/mcp/auth/verify",
                    json={
                        "email": self.email,
                        "password": self.password
                    },
                    headers={
                        "x-api-key": self.api_key
                    },
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    if data.get('authenticated'):
                        self.blog_info = data['blog']
                        
                        # JWT 토큰 획득
                        await self._get_jwt_token()
                        return True
                
                return False
                
        except Exception as e:
            print(f"인증 오류: {e}")
            return False
    
    async def _get_jwt_token(self):
        """JWT 토큰 획득"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/auth/login",
                json={
                    "email": self.email,
                    "password": self.password
                },
                timeout=30.0
            )
            if response.status_code == 201:
                data = response.json()
                self.access_token = data['access_token']


# 전역 인스턴스
auth = TwoFactorAuth()


# FastMCP 리소스
@mcp.resource("resource://blog-status")
def get_blog_status() -> str:
    """블로그 상태 정보 제공"""
    if auth.blog_info:
        return f"""🎯 블로그 연결 정보
📝 블로그명: {auth.blog_info['name']}
🔗 슬러그: {auth.blog_info['slug']}
✅ 인증 상태: 활성화
🌐 API URL: {auth.base_url}"""
    else:
        return """⚠️ 블로그 연결 안됨
인증이 필요합니다."""


@mcp.resource("resource://posting-guide")
def get_posting_guide() -> str:
    """포스팅 가이드 제공"""
    return """📚 FastMCP 블로그 포스팅 가이드

🔐 1. 인증
authenticate() - 2단계 인증 수행

📝 2. 포스팅 방법
create_post(title="제목", content="마크다운 내용", tags=["태그1", "태그2"])
create_post_from_file(file_path="posts/파일명.md")

✨ 3. 지원 기능
- 마크다운 → HTML 자동 변환
- Front matter 메타데이터 지원
- 코드 블록 하이라이팅
- 테이블, 리스트, 이미지 지원"""


# FastMCP 도구들
@mcp.tool()
async def authenticate() -> str:
    """2단계 인증 수행"""
    if await auth.authenticate():
        return f"""✅ 인증 성공!
📝 블로그: {auth.blog_info['name']}
🔗 슬러그: {auth.blog_info['slug']}
🎯 포스팅 준비 완료!"""
    else:
        return """❌ 인증 실패
⚠️ .env 파일의 다음 항목을 확인하세요:
- BLOG_EMAIL
- BLOG_PASSWORD  
- BLOG_API_KEY
- BLOG_API_URL"""


@mcp.tool()
async def create_post(
    title: str = None,
    content: str = None, 
    file_path: str = None,
    tags: List[str] = None
) -> str:
    """블로그 포스트 생성 (마크다운을 백엔드로 전송, 백엔드에서 HTML 변환)
    
    Args:
        title: 포스트 제목 (선택, 마크다운에서 추출 가능)
        content: 마크다운 내용 (file_path와 둘 중 하나 필수)
        file_path: 마크다운 파일 경로 (content와 둘 중 하나 필수)
        tags: 태그 목록 (선택)
    """
    
    # 인증 확인
    if not auth.access_token or not auth.blog_info:
        auth_result = await auth.authenticate()
        if not auth_result:
            return "❌ 인증이 필요합니다. 먼저 authenticate()를 실행하세요."
    
    # 마크다운 내용 준비
    if file_path:
        if not os.path.exists(file_path):
            return f"❌ 파일을 찾을 수 없습니다: {file_path}"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    elif not content:
        return "❌ content 또는 file_path가 필요합니다."
    
    # 마크다운 메타데이터 파싱
    metadata, body = parse_markdown_metadata(content)
    
    # 제목과 태그 결정
    final_title = title or metadata['title']
    final_tags = tags or metadata.get('tags', [])
    
    # MD 파일 저장 (posts 폴더에)
    posts_dir = Path(__file__).parent.parent / 'posts'
    posts_dir.mkdir(exist_ok=True)
    
    # 파일명 생성: YYYYMMDD_제목 (특수문자 제거)
    date_str = datetime.now().strftime('%Y%m%d')
    
    # 제목에서 파일명 생성 (한글 포함 안전한 처리)
    safe_title = final_title
    # 특수문자를 언더스코어로 변경
    safe_title = re.sub(r'[\\/:*?"<>|\s]+', '_', safe_title)
    # 연속된 언더스코어 제거
    safe_title = re.sub(r'_+', '_', safe_title)
    # 앞뒤 언더스코어 제거
    safe_title = safe_title.strip('_')
    # 길이 제한 (파일명이 너무 길면 문제 발생)
    if len(safe_title) > 50:
        safe_title = safe_title[:50]
    
    filename = f"{date_str}_{safe_title}.md"
    file_path_saved = posts_dir / filename
    
    # Front matter와 함께 전체 마크다운 저장
    full_content = f"""---
title: "{final_title}"
tags: {json.dumps(final_tags, ensure_ascii=False)}
date: {datetime.now().isoformat()}
---

{body}"""
    
    try:
        with open(file_path_saved, 'w', encoding='utf-8') as f:
            f.write(full_content)
        saved_message = f"💾 MD 파일 저장: {filename}"
    except Exception as e:
        saved_message = f"⚠️ MD 파일 저장 실패: {str(e)}"
    
    # 포스트 생성 API 호출
    try:
        async with httpx.AsyncClient() as client:
            # 백엔드로 마크다운 전송 (백엔드에서 HTML 변환 처리)
            response = await client.post(
                f"{auth.api_url}/posts",
                json={
                    "title": final_title,
                    "content_markdown": body,  # 마크다운 원본 전송 (백엔드에서 렌더링)
                    "tags": final_tags
                },
                headers={
                    "Authorization": f"Bearer {auth.access_token}"
                },
                timeout=60.0
            )
            
            if response.status_code in [200, 201]:
                post = response.json()
                blog_slug = post.get('blogSlug', auth.blog_info['slug'])
                post_url = f"{auth.base_url}/blog/{blog_slug}/posts/{post['slug']}"
                
                return f"""✅ 포스트 생성 성공!
{saved_message}
📝 제목: {post['title']}
🔗 슬러그: {post['slug']}
🏷️ 태그: {', '.join(final_tags) if final_tags else '없음'}
📅 생성일: {post.get('createdAt', 'N/A')}
🌐 URL: {post_url}"""
            else:
                error_text = response.text
                return f"❌ 포스트 생성 실패 (HTTP {response.status_code}): {error_text}"
                
    except Exception as e:
        return f"❌ 포스트 생성 중 오류 발생: {str(e)}"


@mcp.tool()
async def create_post_from_file(file_path: str) -> str:
    """파일에서 마크다운을 읽어 포스트 생성
    
    Args:
        file_path: 마크다운 파일 경로
    """
    
    # 인증 확인
    if not auth.access_token or not auth.blog_info:
        auth_result = await auth.authenticate()
        if not auth_result:
            return "❌ 인증이 필요합니다. 먼저 authenticate()를 실행하세요."
    
    # 파일 존재 확인
    if not os.path.exists(file_path):
        return f"❌ 파일을 찾을 수 없습니다: {file_path}"
    
    # 파일 읽기
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f"❌ 파일 읽기 실패: {str(e)}"
    
    # 마크다운 메타데이터 파싱
    metadata, body = parse_markdown_metadata(content)
    
    # 제목과 태그 결정
    final_title = metadata['title']
    final_tags = metadata.get('tags', [])
    
    # MD 파일 저장 (posts 폴더에) - 원본 파일과 별도로 백업
    posts_dir = Path(__file__).parent.parent / 'posts'
    posts_dir.mkdir(exist_ok=True)
    
    # 파일명 생성: YYYYMMDD_제목 (특수문자 제거)
    date_str = datetime.now().strftime('%Y%m%d')
    
    # 제목에서 파일명 생성 (한글 포함 안전한 처리)
    safe_title = final_title
    # 특수문자를 언더스코어로 변경
    safe_title = re.sub(r'[\\/:*?"<>|\s]+', '_', safe_title)
    # 연속된 언더스코어 제거
    safe_title = re.sub(r'_+', '_', safe_title)
    # 앞뒤 언더스코어 제거
    safe_title = safe_title.strip('_')
    # 길이 제한 (파일명이 너무 길면 문제 발생)
    if len(safe_title) > 50:
        safe_title = safe_title[:50]
    
    filename = f"{date_str}_{safe_title}.md"
    file_path_saved = posts_dir / filename
    
    # Front matter와 함께 전체 마크다운 저장
    full_content = f"""---
title: "{final_title}"
tags: {json.dumps(final_tags, ensure_ascii=False)}
date: {datetime.now().isoformat()}
source: {Path(file_path).name}
---

{body}"""
    
    try:
        with open(file_path_saved, 'w', encoding='utf-8') as f:
            f.write(full_content)
        saved_message = f"💾 MD 파일 저장: {filename}"
    except Exception as e:
        saved_message = f"⚠️ MD 파일 저장 실패: {str(e)}"
    
    # 포스트 생성 API 호출
    try:
        async with httpx.AsyncClient() as client:
            # 백엔드로 마크다운 전송 (백엔드에서 HTML 변환 처리)
            response = await client.post(
                f"{auth.api_url}/posts",
                json={
                    "title": final_title,
                    "content_markdown": body,  # 마크다운 원본 전송 (백엔드에서 렌더링)
                    "tags": final_tags
                },
                headers={
                    "Authorization": f"Bearer {auth.access_token}"
                },
                timeout=60.0
            )
            
            if response.status_code in [200, 201]:
                post = response.json()
                blog_slug = post.get('blogSlug', auth.blog_info['slug'])
                post_url = f"{auth.base_url}/blog/{blog_slug}/posts/{post['slug']}"
                
                return f"""✅ 포스트 생성 성공!
{saved_message}
📝 제목: {post['title']}
🔗 슬러그: {post['slug']}
🏷️ 태그: {', '.join(final_tags) if final_tags else '없음'}
📅 생성일: {post.get('createdAt', 'N/A')}
🌐 URL: {post_url}"""
            else:
                error_text = response.text
                return f"❌ 포스트 생성 실패 (HTTP {response.status_code}): {error_text}"
                
    except Exception as e:
        return f"❌ 포스트 생성 중 오류 발생: {str(e)}"


@mcp.tool()
async def diagnose_connection() -> str:
    """연결 상태 진단"""
    results = []
    
    # 환경 변수 확인
    required_vars = ['BLOG_EMAIL', 'BLOG_PASSWORD', 'BLOG_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        results.append(f"❌ 환경 변수 누락: {', '.join(missing_vars)}")
    else:
        results.append("✅ 환경 변수 모두 설정됨")
    
    # API 연결 테스트
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{auth.base_url}/health", timeout=10.0)
            if response.status_code == 200:
                results.append("✅ API 서버 연결 성공")
            else:
                results.append(f"⚠️ API 서버 응답 이상: {response.status_code}")
    except Exception as e:
        results.append(f"❌ API 서버 연결 실패: {str(e)}")
    
    # 인증 상태 확인
    if auth.access_token and auth.blog_info:
        results.append("✅ 인증 상태: 활성화")
        results.append(f"📝 블로그: {auth.blog_info['name']}")
    else:
        results.append("⚠️ 인증 상태: 비활성화")
    
    return "\n".join([
        "🔍 연결 상태 진단 보고서",
        "=" * 30
    ] + results)


def main():
    """서버 실행"""
    print("🚀 FastMCP 블로그 서버 시작...")
    
    # 개발 모드에서는 Inspector UI도 사용 가능
    # mcp.run(debug=True, port=8000)
    
    # 표준 MCP 모드 실행 (Claude Desktop 연동용)
    mcp.run()


if __name__ == "__main__":
    main()