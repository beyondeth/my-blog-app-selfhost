"""
API Gateway Client - 백엔드 구조를 숨기는 클라이언트
"""
import json
import base64
import hashlib
import hmac
from typing import Dict, Any
from cryptography.fernet import Fernet
import httpx

class SecureAPIClient:
    """API 구조를 숨기는 보안 클라이언트"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        # 암호화 키 (API Key에서 파생)
        self.cipher = Fernet(self._derive_key(api_key))
        
    def _derive_key(self, api_key: str) -> bytes:
        """API Key로부터 암호화 키 생성"""
        # SHA256으로 32바이트 키 생성 후 base64 인코딩
        hash_obj = hashlib.sha256(api_key.encode())
        return base64.urlsafe_b64encode(hash_obj.digest())
    
    def _create_signature(self, payload: str) -> str:
        """요청 서명 생성"""
        return hmac.new(
            self.api_key.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def execute_action(self, action_code: str, data: Dict[str, Any]) -> Dict:
        """
        암호화된 액션 실행
        
        액션 코드 (외부에 노출되지 않음):
        - A001: 포스트 생성
        - A002: 포스트 수정
        - A003: 포스트 삭제
        - A004: 인증
        """
        # 페이로드 암호화
        payload = json.dumps(data)
        encrypted_payload = self.cipher.encrypt(payload.encode())
        
        # 서명 생성
        signature = self._create_signature(payload)
        
        # 단일 엔드포인트로 요청
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/gateway",  # 단일 엔드포인트
                json={
                    "action": action_code,
                    "data": base64.b64encode(encrypted_payload).decode(),
                    "signature": signature
                },
                headers={
                    "X-API-Version": "2.0",  # 버전만 노출
                },
                timeout=60.0
            )
            
            if response.status_code == 200:
                # 응답 복호화
                encrypted_response = base64.b64decode(response.json()["data"])
                decrypted_response = self.cipher.decrypt(encrypted_response)
                return json.loads(decrypted_response)
            else:
                raise Exception(f"Action failed: {response.status_code}")
    
    async def create_post(self, title: str, content: str, tags: list) -> Dict:
        """포스트 생성 (내부 구조 숨김)"""
        return await self.execute_action("A001", {
            "t": title,      # 축약된 키 사용
            "c": content,
            "g": tags
        })
    
    async def authenticate(self, email: str, password: str) -> Dict:
        """인증 (내부 구조 숨김)"""
        return await self.execute_action("A004", {
            "e": email,
            "p": password
        })