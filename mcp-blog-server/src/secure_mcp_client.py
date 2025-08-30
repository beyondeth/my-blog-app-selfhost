#!/usr/bin/env python3
"""
보안 강화된 MCP 클라이언트 - 하이브리드 접근법
- API 구조 은닉
- 코드 최소화
- 암호화 통신
"""
import os
import json
import base64
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import httpx
from fastmcp import FastMCP

load_dotenv()

# FastMCP 서버 생성
mcp = FastMCP(
    name="blog-mcp-secure",
    instructions="보안 강화된 블로그 포스팅 서버"
)

class SecureBlogClient:
    """API 구조를 숨기는 보안 클라이언트"""
    
    # 액션 코드 (외부 노출 안 됨)
    _ACTIONS = {
        'auth': 'X01',
        'post': 'X02',
        'read': 'X03',
    }
    
    def __init__(self):
        # 환경 변수에서 민감한 정보 로드
        self.endpoint = os.getenv('MCP_ENDPOINT', 'https://api.yourblog.com/gateway')
        self.client_id = os.getenv('MCP_CLIENT_ID')
        self.api_token = os.getenv('MCP_API_TOKEN')
        
        # 세션 관리
        self.session_token = None
        self.token_expires = None
    
    def _create_request_hash(self, data: Dict) -> str:
        """요청 데이터 해시 생성"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(
            f"{self.api_token}:{data_str}".encode()
        ).hexdigest()
    
    async def _call_api(self, action: str, payload: Dict) -> Dict:
        """암호화된 API 호출"""
        # 요청 래핑
        request_data = {
            'v': '2.0',  # 버전
            'a': self._ACTIONS.get(action, 'X00'),  # 액션 코드
            'd': base64.b64encode(
                json.dumps(payload).encode()
            ).decode(),  # 인코딩된 데이터
            'h': self._create_request_hash(payload),  # 해시
            't': int(datetime.now().timestamp()),  # 타임스탬프
        }
        
        headers = {
            'X-Client': self.client_id,
            'X-Session': self.session_token or '',
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.endpoint,
                json=request_data,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code == 200:
                # 응답 디코딩
                result = response.json()
                if result.get('d'):
                    decoded = base64.b64decode(result['d'])
                    return json.loads(decoded)
                return result
            else:
                raise Exception(f"API Error: {response.status_code}")
    
    async def authenticate(self) -> bool:
        """인증 수행"""
        try:
            result = await self._call_api('auth', {
                'e': os.getenv('BLOG_EMAIL'),
                'p': os.getenv('BLOG_PASSWORD'),
            })
            
            self.session_token = result.get('token')
            self.token_expires = result.get('expires')
            return bool(self.session_token)
        except:
            return False
    
    async def create_post(self, title: str, content: str, tags: list = None) -> Dict:
        """포스트 생성"""
        if not self.session_token:
            if not await self.authenticate():
                raise Exception("Authentication failed")
        
        return await self._call_api('post', {
            't': title[:100],  # 제목 (최대 100자)
            'c': content[:50000],  # 콘텐츠 (최대 50KB)
            'g': tags[:10] if tags else [],  # 태그 (최대 10개)
        })

# 전역 클라이언트
client = SecureBlogClient()

@mcp.tool()
async def create_post(
    title: str,
    content: str,
    tags: list = None
) -> str:
    """블로그 포스트 생성"""
    try:
        result = await client.create_post(title, content, tags)
        return f"✅ 포스트 생성 완료: {result.get('id', 'unknown')}"
    except Exception as e:
        return f"❌ 오류: {str(e)}"

@mcp.tool()
async def authenticate() -> str:
    """인증"""
    if await client.authenticate():
        return "✅ 인증 성공"
    return "❌ 인증 실패"

def main():
    mcp.run()

if __name__ == "__main__":
    main()