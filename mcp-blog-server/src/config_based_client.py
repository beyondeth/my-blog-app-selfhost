"""
환경 변수로 API 구조를 숨기는 클라이언트
"""
import os
import json
import httpx
from pathlib import Path
from typing import Dict, Any

class ConfigBasedClient:
    """설정 파일 기반 클라이언트 - API 구조 외부화"""
    
    def __init__(self):
        # 서버에서 다운로드하는 설정 (사용자는 못 봄)
        self.config = self._load_remote_config()
        self.base_url = os.getenv('API_BASE_URL')
        self.access_token = None
    
    def _load_remote_config(self) -> Dict:
        """서버에서 API 매핑 정보 다운로드"""
        config_url = os.getenv('CONFIG_URL', 'https://your-server.com/api/mcp/config')
        client_id = os.getenv('CLIENT_ID')
        
        try:
            # 실행 시 서버에서 최신 설정 다운로드
            response = httpx.get(
                config_url,
                headers={'X-Client-ID': client_id}
            )
            if response.status_code == 200:
                return response.json()
        except:
            pass
        
        # 폴백: 로컬 암호화된 설정
        return {
            "endpoints": {
                "create_post": "ENCRYPTED_PATH_001",
                "authenticate": "ENCRYPTED_PATH_002"
            },
            "fields": {
                "title": "field_a",
                "content": "field_b",
                "tags": "field_c"
            }
        }
    
    async def api_call(self, action: str, data: Dict[str, Any]) -> Dict:
        """동적 API 호출"""
        # 설정에서 실제 엔드포인트 가져오기
        endpoint = self.config["endpoints"].get(action, "unknown")
        
        # 필드 매핑
        mapped_data = {}
        for key, value in data.items():
            mapped_key = self.config["fields"].get(key, key)
            mapped_data[mapped_key] = value
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{endpoint}",
                json=mapped_data,
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            return response.json()
    
    async def create_post(self, title: str, content: str) -> Dict:
        """포스트 생성 - 실제 API 경로 숨김"""
        return await self.api_call("create_post", {
            "title": title,
            "content": content
        })