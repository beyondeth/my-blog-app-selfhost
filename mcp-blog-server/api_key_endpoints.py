#!/usr/bin/env python3
"""
API 키 관리 엔드포인트 - NestJS 백엔드 참조용
실제로는 TypeScript로 구현하거나, FastAPI로 별도 서버 구성
"""
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import asyncpg

from improved_api_key_manager import (
    APIKeyManager, APIKey, APIKeyType, APIKeyScope
)

app = FastAPI(title="Blog API Key Management", version="1.0.0")
security = HTTPBearer()

# Pydantic 모델들
class APIKeyCreateRequest(BaseModel):
    name: str
    key_type: APIKeyType = APIKeyType.FULL
    scopes: List[APIKeyScope] = None
    allowed_ips: List[str] = None
    rate_limit_per_hour: int = 1000
    rate_limit_per_day: int = 10000
    expires_in_days: int = 90

class APIKeyResponse(BaseModel):
    id: str
    key_id: str
    name: str
    key_type: str
    scopes: List[str]
    allowed_ips: List[str]
    rate_limit_per_hour: int
    rate_limit_per_day: int
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime

class APIKeyCreateResponse(BaseModel):
    api_key: APIKeyResponse
    secret_key: str  # 한 번만 반환

class UsageStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    total_data_bytes: int
    avg_response_time: float
    active_days: int
    top_endpoints: List[dict]

# 전역 매니저
api_key_manager: Optional[APIKeyManager] = None

async def get_api_key_manager():
    """API 키 매니저 의존성"""
    global api_key_manager
    if not api_key_manager:
        db_pool = await asyncpg.create_pool(os.getenv('DATABASE_URL'))
        api_key_manager = APIKeyManager(db_pool)
    return api_key_manager

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """현재 사용자 확인"""
    # JWT 토큰에서 user_id 추출 (기존 인증 시스템 활용)
    # 실제 구현에서는 JWT 검증 로직 필요
    user_id = "extracted_from_jwt"  # 플레이스홀더
    return user_id

# API 엔드포인트들

@app.post("/api/v1/api-keys", response_model=APIKeyCreateResponse)
async def create_api_key(
    request: APIKeyCreateRequest,
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """새 API 키 생성 (GitHub/OpenAI 스타일)"""
    try:
        api_key, secret_key = await manager.create_api_key(
            user_id=user_id,
            name=request.name,
            key_type=request.key_type,
            scopes=request.scopes or [
                APIKeyScope.BLOG_READ,
                APIKeyScope.BLOG_WRITE,
                APIKeyScope.POSTS_CREATE,
                APIKeyScope.POSTS_READ
            ],
            allowed_ips=request.allowed_ips,
            rate_limit_per_hour=request.rate_limit_per_hour,
            rate_limit_per_day=request.rate_limit_per_day,
            expires_in_days=request.expires_in_days
        )
        
        return APIKeyCreateResponse(
            api_key=APIKeyResponse(
                id=api_key.id,
                key_id=api_key.key_id,
                name=api_key.name,
                key_type=api_key.key_type.value,
                scopes=[s.value for s in api_key.scopes],
                allowed_ips=api_key.allowed_ips,
                rate_limit_per_hour=api_key.rate_limit_per_hour,
                rate_limit_per_day=api_key.rate_limit_per_day,
                is_active=api_key.is_active,
                expires_at=api_key.expires_at,
                last_used_at=api_key.last_used_at,
                created_at=api_key.created_at
            ),
            secret_key=secret_key
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """사용자의 API 키 목록 조회"""
    try:
        keys = await manager.list_user_api_keys(user_id)
        return [
            APIKeyResponse(
                id=key.id,
                key_id=key.key_id,
                name=key.name,
                key_type=key.key_type.value,
                scopes=[s.value for s in key.scopes],
                allowed_ips=key.allowed_ips,
                rate_limit_per_hour=key.rate_limit_per_hour,
                rate_limit_per_day=key.rate_limit_per_day,
                is_active=key.is_active,
                expires_at=key.expires_at,
                last_used_at=key.last_used_at,
                created_at=key.created_at
            ) for key in keys
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """API 키 무효화"""
    try:
        await manager.revoke_api_key(key_id, user_id)
        return {"message": "API key revoked successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/api-keys/{key_id}/rotate")
async def rotate_api_key(
    key_id: str,
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """API 키 회전 (GitHub 스타일)"""
    try:
        new_key, secret_key = await manager.rotate_api_key(
            old_key_id=key_id,
            user_id=user_id,
            reason="manual_rotation"
        )
        
        return APIKeyCreateResponse(
            api_key=APIKeyResponse(
                id=new_key.id,
                key_id=new_key.key_id,
                name=new_key.name,
                key_type=new_key.key_type.value,
                scopes=[s.value for s in new_key.scopes],
                allowed_ips=new_key.allowed_ips,
                rate_limit_per_hour=new_key.rate_limit_per_hour,
                rate_limit_per_day=new_key.rate_limit_per_day,
                is_active=new_key.is_active,
                expires_at=new_key.expires_at,
                last_used_at=new_key.last_used_at,
                created_at=new_key.created_at
            ),
            secret_key=secret_key
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/api-keys/{key_id}/usage", response_model=UsageStatsResponse)
async def get_api_key_usage(
    key_id: str,
    days: int = 30,
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """API 키 사용량 통계 (OpenAI/Stripe 스타일)"""
    try:
        stats = await manager.get_usage_statistics(key_id, days)
        summary = stats['summary']
        
        success_rate = (
            summary['successful_requests'] / summary['total_requests'] * 100
            if summary['total_requests'] > 0 else 0
        )
        
        return UsageStatsResponse(
            total_requests=summary['total_requests'],
            successful_requests=summary['successful_requests'],
            failed_requests=summary['failed_requests'],
            success_rate=success_rate,
            total_data_bytes=summary['total_data_bytes'],
            avg_response_time=summary['avg_response_time'],
            active_days=summary['active_days'],
            top_endpoints=stats['top_endpoints']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/usage-analytics")
async def get_usage_analytics(
    days: int = 30,
    user_id: str = Depends(get_current_user),
    manager: APIKeyManager = Depends(get_api_key_manager)
):
    """전체 사용량 분석 대시보드"""
    # 구현 생략 - 복잡한 집계 쿼리 필요
    pass

# 관리자용 엔드포인트 (별도 권한 필요)
@app.get("/admin/api-keys/stats")
async def get_admin_stats():
    """관리자용 전체 통계"""
    # 전체 사용자, API 키, 사용량 통계
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)