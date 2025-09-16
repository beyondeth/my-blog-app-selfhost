-- 개선된 API 키 관리 시스템 스키마
-- 글로벌 기업 베스트 프랙티스 적용

-- 1. API 키 테이블 (GitHub/OpenAI 스타일)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(20) UNIQUE NOT NULL,           -- 공개 식별자 (ak_xxxxxxxxxx)
    key_hash VARCHAR(255) NOT NULL,               -- 해시된 키 값
    key_prefix VARCHAR(10) NOT NULL,              -- 키 접두사 (ak_blog_)
    
    -- 사용자 연결
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 키 메타데이터
    name VARCHAR(100) NOT NULL,                   -- 키 이름/설명
    key_type VARCHAR(20) DEFAULT 'full',          -- full, read_only, write_only
    
    -- 권한 스코프 (GitHub 스타일)
    scopes JSONB DEFAULT '["blog:read", "blog:write", "posts:create", "posts:update", "posts:delete"]',
    
    -- 보안 설정
    allowed_ips TEXT[],                           -- IP 화이트리스트
    rate_limit_per_hour INTEGER DEFAULT 1000,    -- 시간당 요청 제한
    rate_limit_per_day INTEGER DEFAULT 10000,    -- 일일 요청 제한
    
    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,         -- 만료 시간
    last_used_at TIMESTAMP WITH TIME ZONE,       -- 마지막 사용 시간
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_ip INET,                          -- 생성 IP
    user_agent TEXT                              -- 생성 시 User-Agent
);

-- 2. API 사용량 추적 테이블 (OpenAI/Stripe 스타일)
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 요청 정보
    endpoint VARCHAR(255) NOT NULL,              -- API 엔드포인트
    method VARCHAR(10) NOT NULL,                 -- HTTP 메소드
    status_code INTEGER NOT NULL,               -- 응답 상태 코드
    
    -- 사용량 메트릭
    request_size_bytes INTEGER DEFAULT 0,       -- 요청 크기
    response_size_bytes INTEGER DEFAULT 0,      -- 응답 크기
    processing_time_ms INTEGER DEFAULT 0,       -- 처리 시간
    
    -- 컨텍스트 정보
    ip_address INET NOT NULL,                   -- 클라이언트 IP
    user_agent TEXT,                            -- User-Agent
    referer TEXT,                               -- Referer
    
    -- 에러 정보
    error_code VARCHAR(50),                     -- 에러 코드
    error_message TEXT,                         -- 에러 메시지
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 파티셔닝을 위한 날짜 컬럼
    log_date DATE DEFAULT CURRENT_DATE
) PARTITION BY RANGE (log_date);

-- 3. 일별 사용량 집계 테이블 (효율적인 분석용)
CREATE TABLE api_usage_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 날짜
    usage_date DATE NOT NULL,
    
    -- 집계 메트릭
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    total_data_bytes BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    
    -- 엔드포인트별 집계
    endpoint_usage JSONB DEFAULT '{}',          -- {"POST /posts": 100, "GET /posts": 50}
    
    -- 시간대별 사용량 (24시간)
    hourly_usage INTEGER[] DEFAULT ARRAY_FILL(0, ARRAY[24]),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(api_key_id, usage_date)
);

-- 4. Rate Limiting 테이블 (Redis 대안)
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- 시간 윈도우
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_type VARCHAR(20) NOT NULL,           -- hour, day, minute
    
    -- 카운터
    request_count INTEGER DEFAULT 0,
    data_bytes BIGINT DEFAULT 0,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(api_key_id, window_start, window_type)
);

-- 5. API 키 회전 히스토리
CREATE TABLE api_key_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_key_id UUID NOT NULL REFERENCES api_keys(id),
    new_key_id UUID NOT NULL REFERENCES api_keys(id),
    
    rotation_reason VARCHAR(100),               -- expired, compromised, manual
    rotated_by UUID REFERENCES users(id),
    rotated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 이전 키 비활성화 정책
    old_key_grace_period_hours INTEGER DEFAULT 48
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, expires_at);

CREATE INDEX idx_api_usage_logs_key_date ON api_usage_logs(api_key_id, log_date);
CREATE INDEX idx_api_usage_logs_user_date ON api_usage_logs(user_id, log_date);
CREATE INDEX idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);

CREATE INDEX idx_api_usage_daily_key_date ON api_usage_daily_summary(api_key_id, usage_date);
CREATE INDEX idx_api_rate_limits_key_window ON api_rate_limits(api_key_id, window_start, window_type);

-- 파티션 테이블 생성 (로그 데이터 효율적 관리)
CREATE TABLE api_usage_logs_2024_01 PARTITION OF api_usage_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE api_usage_logs_2024_02 PARTITION OF api_usage_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- 월별 파티션 추가...

-- 자동 데이터 정리 정책 (30일 이후 로그 삭제)
-- 실제로는 pg_cron이나 외부 스케줄러로 실행
-- DELETE FROM api_usage_logs WHERE log_date < NOW() - INTERVAL '30 days';