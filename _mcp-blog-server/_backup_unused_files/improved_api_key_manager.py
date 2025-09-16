#!/usr/bin/env python3
"""
개선된 API 키 관리 시스템
글로벌 기업 베스트 프랙티스 적용 (GitHub, Google, OpenAI, Stripe 스타일)
"""
import os
import secrets
import hashlib
import hmac
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import asyncpg
import redis.asyncio as redis
import json


class APIKeyType(Enum):
    """API 키 타입 (Stripe 스타일)"""
    FULL = "full"              # 전체 권한
    READ_ONLY = "read_only"    # 읽기 전용
    WRITE_ONLY = "write_only"  # 쓰기 전용


class APIKeyScope(Enum):
    """API 스코프 (GitHub 스타일)"""
    BLOG_READ = "blog:read"
    BLOG_WRITE = "blog:write"
    POSTS_CREATE = "posts:create"
    POSTS_UPDATE = "posts:update"
    POSTS_DELETE = "posts:delete"
    POSTS_READ = "posts:read"
    ANALYTICS_READ = "analytics:read"


@dataclass
class APIKey:
    """API 키 데이터 모델"""
    id: str
    key_id: str
    user_id: str
    name: str
    key_type: APIKeyType
    scopes: List[APIKeyScope]
    allowed_ips: List[str]
    rate_limit_per_hour: int
    rate_limit_per_day: int
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime


@dataclass
class APIUsage:
    """API 사용량 정보"""
    requests_today: int
    requests_hour: int
    data_bytes_today: int
    last_request_at: Optional[datetime]


class APIKeyManager:
    """개선된 API 키 매니저 - 글로벌 기업 베스트 프랙티스 구현"""
    
    def __init__(self, db_pool: asyncpg.Pool, redis_client: redis.Redis = None):
        self.db = db_pool
        self.redis = redis_client
        self.key_prefix = "ak_blog_"  # API Key prefix (GitHub 스타일)
        
    def generate_api_key(self, user_id: str) -> Tuple[str, str]:
        """
        API 키 생성 (GitHub/OpenAI 스타일)
        Returns: (public_key_id, secret_key)
        """
        # 공개 식별자 생성 (ak_blog_xxxxxxxxxx)
        key_id = f"{self.key_prefix}{secrets.token_hex(10)}"
        
        # 실제 비밀 키 생성 (더 긴 보안 키)
        secret_key = f"{self.key_prefix}{secrets.token_urlsafe(32)}"
        
        return key_id, secret_key
    
    def hash_api_key(self, secret_key: str) -> str:
        """API 키 해싱 (SHA-256 + salt)"""
        salt = os.urandom(32)
        key_hash = hashlib.pbkdf2_hmac('sha256', secret_key.encode(), salt, 100000)
        return salt.hex() + key_hash.hex()
    
    def verify_api_key(self, secret_key: str, stored_hash: str) -> bool:
        """API 키 검증"""
        try:
            salt = bytes.fromhex(stored_hash[:64])
            key_hash = bytes.fromhex(stored_hash[64:])
            expected_hash = hashlib.pbkdf2_hmac('sha256', secret_key.encode(), salt, 100000)
            return hmac.compare_digest(key_hash, expected_hash)
        except:
            return False
    
    async def create_api_key(
        self,
        user_id: str,
        name: str,
        key_type: APIKeyType = APIKeyType.FULL,
        scopes: List[APIKeyScope] = None,
        allowed_ips: List[str] = None,
        rate_limit_per_hour: int = 1000,
        rate_limit_per_day: int = 10000,
        expires_in_days: int = 90
    ) -> Tuple[APIKey, str]:
        """
        새 API 키 생성
        Returns: (APIKey 객체, secret_key)
        """
        if scopes is None:
            scopes = [
                APIKeyScope.BLOG_READ,
                APIKeyScope.BLOG_WRITE,
                APIKeyScope.POSTS_CREATE,
                APIKeyScope.POSTS_READ
            ]
        
        key_id, secret_key = self.generate_api_key(user_id)
        key_hash = self.hash_api_key(secret_key)
        
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        async with self.db.acquire() as conn:
            api_key_data = await conn.fetchrow("""
                INSERT INTO api_keys (
                    key_id, key_hash, key_prefix, user_id, name, key_type,
                    scopes, allowed_ips, rate_limit_per_hour, rate_limit_per_day,
                    expires_at, created_by_ip
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            """, 
                key_id, key_hash, self.key_prefix, user_id, name, key_type.value,
                json.dumps([s.value for s in scopes]), allowed_ips or [],
                rate_limit_per_hour, rate_limit_per_day, expires_at, None
            )
        
        api_key = APIKey(
            id=str(api_key_data['id']),
            key_id=api_key_data['key_id'],
            user_id=str(api_key_data['user_id']),
            name=api_key_data['name'],
            key_type=APIKeyType(api_key_data['key_type']),
            scopes=[APIKeyScope(s) for s in json.loads(api_key_data['scopes'])],
            allowed_ips=api_key_data['allowed_ips'],
            rate_limit_per_hour=api_key_data['rate_limit_per_hour'],
            rate_limit_per_day=api_key_data['rate_limit_per_day'],
            is_active=api_key_data['is_active'],
            expires_at=api_key_data['expires_at'],
            last_used_at=api_key_data['last_used_at'],
            created_at=api_key_data['created_at']
        )
        
        return api_key, secret_key
    
    async def validate_api_key(
        self, 
        secret_key: str,
        client_ip: str = None,
        required_scope: APIKeyScope = None
    ) -> Optional[APIKey]:
        """
        API 키 유효성 검증 (GitHub 스타일)
        """
        # 키 형식 확인
        if not secret_key.startswith(self.key_prefix):
            return None
        
        # 키 ID 추출 (보안상 실제로는 해시 매칭 필요)
        try:
            # 실제 구현에서는 모든 활성 키를 확인해야 함
            async with self.db.acquire() as conn:
                api_key_data = await conn.fetchrow("""
                    SELECT * FROM api_keys 
                    WHERE is_active = true 
                    AND (expires_at IS NULL OR expires_at > NOW())
                """)
                
                # 모든 활성 키에 대해 해시 검증
                async for key_row in conn.cursor("SELECT * FROM api_keys WHERE is_active = true"):
                    if self.verify_api_key(secret_key, key_row['key_hash']):
                        api_key_data = key_row
                        break
                else:
                    return None
        except:
            return None
        
        if not api_key_data:
            return None
        
        # IP 검증 (Google Cloud 스타일)
        if api_key_data['allowed_ips'] and client_ip:
            if client_ip not in api_key_data['allowed_ips']:
                return None
        
        # 스코프 검증 (GitHub 스타일)
        scopes = [APIKeyScope(s) for s in json.loads(api_key_data['scopes'])]
        if required_scope and required_scope not in scopes:
            return None
        
        # Rate limiting 확인
        if not await self.check_rate_limit(api_key_data['id']):
            return None
        
        # 마지막 사용 시간 업데이트
        await self.update_last_used(api_key_data['id'])
        
        return APIKey(
            id=str(api_key_data['id']),
            key_id=api_key_data['key_id'],
            user_id=str(api_key_data['user_id']),
            name=api_key_data['name'],
            key_type=APIKeyType(api_key_data['key_type']),
            scopes=scopes,
            allowed_ips=api_key_data['allowed_ips'],
            rate_limit_per_hour=api_key_data['rate_limit_per_hour'],
            rate_limit_per_day=api_key_data['rate_limit_per_day'],
            is_active=api_key_data['is_active'],
            expires_at=api_key_data['expires_at'],
            last_used_at=api_key_data['last_used_at'],
            created_at=api_key_data['created_at']
        )
    
    async def check_rate_limit(self, api_key_id: str) -> bool:
        """Rate limiting 확인 (OpenAI 스타일)"""
        now = datetime.utcnow()
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        async with self.db.acquire() as conn:
            # 현재 시간 및 일일 사용량 확인
            limits = await conn.fetchrow("""
                SELECT 
                    COALESCE(SUM(CASE WHEN window_start >= $2 AND window_type = 'hour' 
                                     THEN request_count ELSE 0 END), 0) as hour_requests,
                    COALESCE(SUM(CASE WHEN window_start >= $3 AND window_type = 'day' 
                                     THEN request_count ELSE 0 END), 0) as day_requests,
                    ak.rate_limit_per_hour,
                    ak.rate_limit_per_day
                FROM api_keys ak
                LEFT JOIN api_rate_limits arl ON ak.id = arl.api_key_id
                WHERE ak.id = $1
                GROUP BY ak.rate_limit_per_hour, ak.rate_limit_per_day
            """, api_key_id, hour_start, day_start)
            
            if not limits:
                return False
            
            # 제한 확인
            if limits['hour_requests'] >= limits['rate_limit_per_hour']:
                return False
            if limits['day_requests'] >= limits['rate_limit_per_day']:
                return False
            
            return True
    
    async def log_api_usage(
        self,
        api_key_id: str,
        user_id: str,
        endpoint: str,
        method: str,
        status_code: int,
        request_size: int = 0,
        response_size: int = 0,
        processing_time_ms: int = 0,
        client_ip: str = None,
        user_agent: str = None,
        error_code: str = None,
        error_message: str = None
    ):
        """API 사용량 로깅 (모든 기업 공통)"""
        async with self.db.acquire() as conn:
            # 상세 로그
            await conn.execute("""
                INSERT INTO api_usage_logs (
                    api_key_id, user_id, endpoint, method, status_code,
                    request_size_bytes, response_size_bytes, processing_time_ms,
                    ip_address, user_agent, error_code, error_message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """, 
                api_key_id, user_id, endpoint, method, status_code,
                request_size, response_size, processing_time_ms,
                client_ip, user_agent, error_code, error_message
            )
            
            # Rate limiting 카운터 업데이트
            await self.update_rate_limit_counters(api_key_id, request_size + response_size)
    
    async def update_rate_limit_counters(self, api_key_id: str, data_bytes: int = 0):
        """Rate limiting 카운터 업데이트"""
        now = datetime.utcnow()
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        async with self.db.acquire() as conn:
            # 시간당 카운터
            await conn.execute("""
                INSERT INTO api_rate_limits (api_key_id, window_start, window_type, request_count, data_bytes)
                VALUES ($1, $2, 'hour', 1, $3)
                ON CONFLICT (api_key_id, window_start, window_type)
                DO UPDATE SET 
                    request_count = api_rate_limits.request_count + 1,
                    data_bytes = api_rate_limits.data_bytes + $3,
                    updated_at = NOW()
            """, api_key_id, hour_start, data_bytes)
            
            # 일일 카운터
            await conn.execute("""
                INSERT INTO api_rate_limits (api_key_id, window_start, window_type, request_count, data_bytes)
                VALUES ($1, $2, 'day', 1, $3)
                ON CONFLICT (api_key_id, window_start, window_type)
                DO UPDATE SET 
                    request_count = api_rate_limits.request_count + 1,
                    data_bytes = api_rate_limits.data_bytes + $3,
                    updated_at = NOW()
            """, api_key_id, day_start, data_bytes)
    
    async def update_last_used(self, api_key_id: str):
        """마지막 사용 시간 업데이트"""
        async with self.db.acquire() as conn:
            await conn.execute(
                "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
                api_key_id
            )
    
    async def get_usage_statistics(
        self, 
        api_key_id: str,
        days: int = 30
    ) -> Dict:
        """사용량 통계 조회 (모든 기업 공통)"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        async with self.db.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
                    COALESCE(SUM(request_size_bytes + response_size_bytes), 0) as total_data_bytes,
                    COALESCE(AVG(processing_time_ms), 0) as avg_response_time,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    MIN(created_at) as first_request,
                    MAX(created_at) as last_request
                FROM api_usage_logs
                WHERE api_key_id = $1 AND created_at >= $2
            """, api_key_id, start_date)
            
            # 엔드포인트별 사용량
            endpoint_stats = await conn.fetch("""
                SELECT 
                    endpoint,
                    method,
                    COUNT(*) as request_count,
                    AVG(processing_time_ms) as avg_response_time
                FROM api_usage_logs
                WHERE api_key_id = $1 AND created_at >= $2
                GROUP BY endpoint, method
                ORDER BY request_count DESC
                LIMIT 10
            """, api_key_id, start_date)
            
            return {
                "summary": dict(stats),
                "top_endpoints": [dict(row) for row in endpoint_stats]
            }
    
    async def rotate_api_key(
        self,
        old_key_id: str,
        user_id: str,
        reason: str = "manual"
    ) -> Tuple[APIKey, str]:
        """API 키 회전 (GitHub 스타일)"""
        async with self.db.acquire() as conn:
            # 기존 키 정보 가져오기
            old_key = await conn.fetchrow(
                "SELECT * FROM api_keys WHERE id = $1 AND user_id = $2",
                old_key_id, user_id
            )
            
            if not old_key:
                raise ValueError("API key not found")
            
            # 새 키 생성 (기존 설정 유지)
            new_api_key, secret_key = await self.create_api_key(
                user_id=user_id,
                name=old_key['name'] + " (Rotated)",
                key_type=APIKeyType(old_key['key_type']),
                scopes=[APIKeyScope(s) for s in json.loads(old_key['scopes'])],
                allowed_ips=old_key['allowed_ips'],
                rate_limit_per_hour=old_key['rate_limit_per_hour'],
                rate_limit_per_day=old_key['rate_limit_per_day']
            )
            
            # 회전 이력 기록
            await conn.execute("""
                INSERT INTO api_key_rotations (old_key_id, new_key_id, rotation_reason, rotated_by)
                VALUES ($1, $2, $3, $4)
            """, old_key_id, new_api_key.id, reason, user_id)
            
            # 기존 키는 48시간 후 비활성화 (Stripe 스타일)
            # 실제로는 스케줄러로 처리
            
            return new_api_key, secret_key
    
    async def list_user_api_keys(self, user_id: str) -> List[APIKey]:
        """사용자의 API 키 목록 조회"""
        async with self.db.acquire() as conn:
            keys = await conn.fetch("""
                SELECT * FROM api_keys 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            """, user_id)
            
            return [
                APIKey(
                    id=str(key['id']),
                    key_id=key['key_id'],
                    user_id=str(key['user_id']),
                    name=key['name'],
                    key_type=APIKeyType(key['key_type']),
                    scopes=[APIKeyScope(s) for s in json.loads(key['scopes'])],
                    allowed_ips=key['allowed_ips'],
                    rate_limit_per_hour=key['rate_limit_per_hour'],
                    rate_limit_per_day=key['rate_limit_per_day'],
                    is_active=key['is_active'],
                    expires_at=key['expires_at'],
                    last_used_at=key['last_used_at'],
                    created_at=key['created_at']
                ) for key in keys
            ]
    
    async def revoke_api_key(self, api_key_id: str, user_id: str):
        """API 키 무효화"""
        async with self.db.acquire() as conn:
            await conn.execute("""
                UPDATE api_keys 
                SET is_active = false, updated_at = NOW()
                WHERE id = $1 AND user_id = $2
            """, api_key_id, user_id)