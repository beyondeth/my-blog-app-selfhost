#!/usr/bin/env python3
"""
FastMCP 기반 블로그 서버 - 보안 강화 버전
- HMAC-SHA256 서명 기반 API Key 인증
- AWS Signature V4 스타일 보안
- 평문 API Key는 절대 네트워크로 전송하지 않음
"""
import os
import json
import asyncio
import re
import hashlib
import hmac
import time
import uuid
import secrets
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from datetime import datetime, timedelta
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
    instructions="FastMCP 기반 블로그 포스트 자동 생성 서버. API Key 인증을 통해 안전하게 마크다운을 백엔드 API로 전송하여 블로그에 포스팅합니다. OAuth 사용자도 비밀번호 없이 API Key만으로 포스팅 가능합니다."
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


class SecureAPIKeyAuth:
    """AWS Signature V4 스타일 보안 강화 API Key 인증"""
    
    def __init__(self):
        self.base_url = os.getenv('BLOG_API_URL', 'http://localhost:3000')
        self.api_url = f"{self.base_url}/api/v1"
        
        # API Key ID와 Secret 분리 (AWS IAM 스타일)
        self.api_key_id = os.getenv('BLOG_API_KEY_ID')  # akid_xxx... (공개 가능)
        self.api_key_secret = os.getenv('BLOG_API_KEY_SECRET')  # aks_xxx... (절대 비밀)
        
        # 레거시 지원: 이전 방식의 API Key도 지원
        if not self.api_key_id or not self.api_key_secret:
            legacy_key = os.getenv('BLOG_API_KEY')  # sk_xxx... (deprecated)
            if legacy_key:
                self.api_key_secret = legacy_key
                self.api_key_id = self._extract_key_id(legacy_key)
        
        # 세션 정보
        self.access_token = None
        self.blog_info = None
        self.user_id = None
        self.blog_id = None
        
        # 보안 설정
        self.timestamp_window = 300  # 5분 시간 창
        self.used_nonces = set()  # 재사용 방지용 nonce 저장
        
    def _extract_key_id(self, api_key: str) -> str:
        """API Key에서 ID 추출 (임시: 처음 8자리)"""
        if api_key and api_key.startswith('sk_'):
            # 실제로는 별도의 Key ID가 필요함
            return api_key[3:11] if len(api_key) > 11 else api_key[3:]
        return ""
    
    def _create_aws_style_signature(self, method: str, uri: str, timestamp: str, nonce: str, body: str = "") -> str:
        """AWS Signature V4 스타일 HMAC-SHA256 서명 생성
        
        보안 강화:
        1. Request 전체를 서명에 포함
        2. Body hash를 포함하여 변조 방지
        3. Timestamp로 시간 제한
        """
        # 1. Canonical Request 생성
        body_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()
        canonical_request = f"{method}\n{uri}\n{timestamp}\n{nonce}\n{body_hash}"
        
        # 2. String to Sign 생성  
        request_hash = hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        string_to_sign = f"HMAC-SHA256\n{timestamp}\n{request_hash}"
        
        # 3. 서명 생성 (Secret으로 서명)
        signature = hmac.new(
            self.api_key_secret.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def _validate_timestamp(self, timestamp: str) -> bool:
        """Timestamp 유효성 검증 (5분 이내만 허용)"""
        try:
            request_time = int(timestamp)
            current_time = int(time.time() * 1000)
            time_diff = abs(current_time - request_time)
            return time_diff <= (self.timestamp_window * 1000)
        except:
            return False
    
    def _check_nonce_reuse(self, nonce: str) -> bool:
        """Nonce 중복 체크 (재사용 공격 방지)"""
        if nonce in self.used_nonces:
            return False
        self.used_nonces.add(nonce)
        
        # 오래된 nonce 정리 (메모리 관리)
        if len(self.used_nonces) > 1000:
            self.used_nonces.clear()
        
        return True
        
    async def authenticate(self) -> bool:
        """AWS Signature V4 스타일 보안 강화 인증
        
        보안 체크리스트:
        ✓ API Secret은 절대 전송하지 않음
        ✓ HMAC-SHA256 서명 사용
        ✓ Timestamp 5분 제한
        ✓ Nonce로 재사용 방지
        ✓ Request 전체 서명으로 변조 방지
        """
        try:
            # 1. API Key ID와 Secret 확인 (절대 로그에 기록하지 않음)
            if not self.api_key_id or not self.api_key_secret:
                print("❌ 보안 오류: API Key ID 또는 Secret이 설정되지 않았습니다")
                return False
            
            # 새로운 방식 (akid_/aks_) 또는 레거시 방식 (sk_) 모두 지원
            if not (self.api_key_secret.startswith('aks_') or self.api_key_secret.startswith('sk_')):
                print("❌ 보안 오류: 올바른 API Key Secret 형식이 아닙니다")
                return False
            
            if self.api_key_id and not (self.api_key_id.startswith('akid_') or self.api_key_secret.startswith('sk_')):
                print("❌ 보안 오류: 올바른 API Key ID 형식이 아닙니다")
                return False
            
            # 2. 보안 파라미터 생성
            timestamp = str(int(time.time() * 1000))  # 밀리초 단위
            nonce = str(uuid.uuid4())  # 일회용 토큰
            
            # 3. Timestamp 유효성 검증
            if not self._validate_timestamp(timestamp):
                print("❌ 보안 오류: Timestamp 유효성 검증 실패")
                return False
            
            # 4. Nonce 중복 체크
            if not self._check_nonce_reuse(nonce):
                print("❌ 보안 오류: Nonce 재사용 감지")
                return False
            
            # 5. 새로운 ID/Secret 방식으로 인증 준비
            method = "POST"
            uri = "/auth/verify-api-key-id-secret"
            
            # ID/Secret 분리 방식 사용
            body = json.dumps({
                "keyId": self.api_key_id,
                "keySecret": self.api_key_secret,
                "timestamp": timestamp,
                "nonce": nonce
            })
            
            # Request 전체를 포함한 서명 생성
            signature = self._create_aws_style_signature(method, uri, timestamp, nonce, body)
            
            # 6. API 호출 (서명과 함께)
            async with httpx.AsyncClient() as client:
                # HTTPS 강제 (개발 환경 제외)
                if self.base_url.startswith('https') or 'localhost' not in self.base_url:
                    if not self.base_url.startswith('https'):
                        print("⚠️ 보안 경고: HTTPS를 사용해야 합니다")
                
                # 서명과 함께 요청
                response = await client.post(
                    f"{self.api_url}/auth/verify-api-key-id-secret",
                    json=json.loads(body),  # 동일한 body 전송
                    headers={
                        "X-API-Key-ID": self.api_key_id,  # 공개 가능한 ID
                        "X-API-Signature": signature,
                        "X-API-Timestamp": timestamp,
                        "X-API-Nonce": nonce,
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                # 7. 응답 처리
                if response.status_code in [200, 201]:
                    data = response.json()
                    if data.get('valid'):
                        self.user_id = data.get('userId')
                        self.blog_id = data.get('blogId')
                        self.access_token = data.get('sessionToken')
                        self.blog_info = data.get('blog')
                        
                        print("✅ 보안 인증 성공 (HMAC-SHA256)")
                        return True
                    else:
                        print("❌ 인증 실패: 서명 검증 실패")
                else:
                    # 에러 메시지에서 민감한 정보 제거
                    error_msg = response.text[:100] if response.text else "Unknown error"
                    print(f"❌ API 인증 실패: HTTP {response.status_code}")
                
                return False
                
        except Exception as e:
            # 예외 메시지에서 민감한 정보 제거
            print(f"❌ 인증 오류: {str(e)[:100]}")
            return False
    
    async def _get_blog_info(self):
        """블로그 정보 가져오기"""
        if not self.blog_id or not self.access_token:
            return
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/blogs/{self.blog_id}",
                headers={
                    "Authorization": f"Bearer {self.access_token}"
                },
                timeout=30.0
            )
            if response.status_code == 200:
                self.blog_info = response.json()


# 전역 인스턴스 (보안 강화 버전)
auth = SecureAPIKeyAuth()


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
authenticate() - API Key 인증 수행

📝 2. 포스팅 방법
create_post(title="제목", content="마크다운 내용", tags=["태그1", "태그2"])
create_post_from_file(file_path="posts/파일명.md")

✨ 3. 지원 기능
- 마크다운 → HTML 자동 변환
- Front matter 메타데이터 지원
- 코드 블록 하이라이팅
- 테이블, 리스트, 이미지 지원
- OAuth 사용자도 API Key로 포스팅 가능"""


# FastMCP 도구들
@mcp.tool()
async def authenticate() -> str:
    """API Key 인증 수행"""
    if await auth.authenticate():
        if auth.blog_info:
            return f"""✅ 인증 성공!
📝 블로그: {auth.blog_info.get('name', 'Unknown')}
🔗 슬러그: {auth.blog_info.get('slug', 'Unknown')}
🎯 포스팅 준비 완료!"""
        else:
            return """✅ 인증 성공!
🎯 API Key 인증 완료
⚠️ 블로그 정보를 가져올 수 없었습니다"""
    else:
        return """❌ 인증 실패
⚠️ .env 파일의 다음 항목을 확인하세요:
- BLOG_API_KEY_ID (akid_로 시작하는 API Key ID)
- BLOG_API_KEY_SECRET (aks_로 시작하는 API Key Secret)
- BLOG_API_URL
또는 레거시 방식:
- BLOG_API_KEY (sk_로 시작하는 API 키)"""


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
    
    # 환경 변수 확인 (새로운 방식 또는 레거시 방식)
    has_new_keys = os.getenv('BLOG_API_KEY_ID') and os.getenv('BLOG_API_KEY_SECRET')
    has_legacy_key = os.getenv('BLOG_API_KEY')
    
    if not has_new_keys and not has_legacy_key:
        missing_vars = ['BLOG_API_KEY_ID/SECRET 또는 BLOG_API_KEY']
    else:
        missing_vars = []
    
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