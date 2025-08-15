# MCP 블로그 시스템 보안 분석: 외부 접근과 민감 정보 보호

## 서론

MCP(Model Context Protocol) 기반 블로그 시스템을 운영하면서 가장 중요한 것은 보안입니다. 특히 API 키와 같은 민감한 정보가 어떻게 보호되고 있는지, 외부 공격자로부터 어떻게 시스템을 방어할 수 있는지는 프로덕션 배포 전 반드시 검토해야 할 사항입니다.

## 1. 외부 사용자의 데이터 접근 가능성

### 현재 시스템 구조의 문제점

현재 블로그 시스템의 API는 다음과 같은 구조를 가지고 있습니다:

```typescript
@Get()
@Public()  // ⚠️ 인증 없이 모든 포스트 조회 가능
findAll()
```

이는 **모든 블로그 포스트가 공개적으로 접근 가능**하다는 의미입니다.

### MCP만 설치한 외부 사용자 시나리오

#### 가능한 작업
```bash
# 누구나 가능 (인증 불필요)
curl http://your-domain.com/api/v1/posts  # ✅ 모든 포스트 읽기
```

#### 불가능한 작업
```bash
# API 키 필요
curl -X POST http://your-domain.com/api/v1/mcp/posts \
  -H "x-api-key: sk_xxx"  # ❌ 본인 API 키 없으면 불가
```

### 해커 공격 시나리오

#### 1. 데이터 스크래핑
```bash
# 모든 포스트 내용 수집
while true; do
  curl "http://your-site/api/v1/posts?page=$i"
  sleep 0.1
done
```

#### 2. Rate Limit 부재로 인한 DoS
```bash
# 무한 요청으로 서버 과부하
for i in {1..10000}; do
  curl "http://your-site/api/v1/posts" &
done
```

#### 3. API 키 무차별 대입
현재 구조의 취약점:
- 모든 활성 키를 순차 검증 (O(n) 복잡도)
- bcrypt 비교로 인한 느린 검증 속도

### 위험도 평가

| 공격 유형 | 현재 위험도 | 영향 | 대응 우선순위 |
|----------|------------|------|--------------|
| 데이터 스크래핑 | 🟠 High | 모든 콘텐츠 유출 | P0 |
| DoS/DDoS | 🔴 Critical | 서비스 마비 | P0 |
| API 키 무차별 대입 | 🟡 Medium | 느리지만 가능 | P1 |
| SQL Injection | 🟢 Low | TypeORM이 방어 | P2 |
| XSS | 🟢 Low | React가 기본 방어 | P2 |

## 2. 민감 정보 노출 위험

### MCP와 LLM 간 통신에서의 보안 취약점

#### 발견된 문제점들

##### 1. 민감 정보가 평문으로 메모리에 저장
```python
self.password = os.getenv('BLOG_PASSWORD')  # 평문 저장
self.api_key = os.getenv('BLOG_API_KEY')    # 평문 저장
```

##### 2. 에러 메시지에 민감 정보 노출 가능
```python
print(f"인증 오류: {e}")  # 에러에 패스워드 포함 가능
```

##### 3. 민감 정보 마스킹 코드 부재
현재 코드에는 **민감 정보를 숨기는 명시적인 보안 코드가 없습니다**.

### 현재 위험도 평가

| 위험 요소 | 현재 상태 | 위험도 | 노출 경로 |
|----------|----------|--------|----------|
| 패스워드 평문 저장 | ❌ 미보호 | 🔴 High | 메모리 덤프 |
| API 키 로그 노출 | ❌ 미보호 | 🔴 High | 에러 메시지 |
| LLM 응답 노출 | ⚠️ 부분 보호 | 🟠 Medium | MCP 응답 |
| 네트워크 전송 | ✅ HTTPS | 🟢 Low | TLS 암호화 |

## 3. 보안 강화 방안

### 즉시 적용 필요 (P0)

#### 1. Rate Limiting 구현
```typescript
@Get()
@Public()
@Throttle(10, 60)  // 분당 10회 제한
findAll()
```

#### 2. 민감 정보 마스킹
```python
class SecureLogger:
    SENSITIVE_KEYS = ['password', 'api_key', 'secret', 'token']
    
    @staticmethod
    def mask_sensitive(data):
        if isinstance(data, dict):
            return {
                k: '***MASKED***' if any(s in k.lower() for s in SecureLogger.SENSITIVE_KEYS) else v
                for k, v in data.items()
            }
        return data
```

#### 3. API 키 인덱싱 최적화
```typescript
@Column()
keyPrefix: string;  // 빠른 검색을 위한 prefix

// 검증 시 prefix로 필터링
const candidates = await this.apiKeyRepository.find({
  where: { keyPrefix: plainKey.substring(3, 11), isActive: true }
});
```

### 중기 개선 사항 (P1)

#### 1. 계층별 접근 제어
```typescript
enum AccessLevel {
  PUBLIC_SUMMARY = 'summary',     // 제목, 요약만
  PUBLIC_FULL = 'full',           // 전체 내용 (rate limit)
  AUTHENTICATED = 'authenticated', // 로그인 사용자
  API_KEY = 'api_key'            // API 키 인증
}
```

#### 2. 메모리 보안 강화
```python
class SecureStorage:
    def __init__(self):
        self._key = Fernet.generate_key()
        self._cipher = Fernet(self._key)
        self._encrypted_data = {}
    
    def store_sensitive(self, key: str, value: str):
        """민감 정보 암호화 저장"""
        encrypted = self._cipher.encrypt(value.encode())
        self._encrypted_data[key] = encrypted
```

#### 3. IP 기반 차단
```typescript
class SecurityMiddleware {
  private blacklist = new Set<string>();
  
  async validateRequest(ip: string) {
    if (this.blacklist.has(ip)) {
      throw new ForbiddenException();
    }
    
    const requestCount = await this.redis.incr(`ip:${ip}`);
    if (requestCount > 100) {  // 시간당 100회
      this.blacklist.add(ip);
    }
  }
}
```

## 4. 권장 아키텍처

### 보안 강화된 시스템 구조

```
Internet → Cloudflare → Load Balancer → API Gateway
                                              ↓
                                    [Rate Limiter]
                                              ↓
                                    [Auth Service]
                                              ↓
                              Public API    Private API
                                 ↓              ↓
                            Read Only      Full Access
```

### 비즈니스 모델 고려사항

- **Free Tier**: 공개 요약만 (분당 10회)
- **Authenticated**: 전체 내용 (시간당 100회)
- **API Key**: 무제한 (유료)

## 5. MCP 통신 보안

### 보안 미들웨어 구현

```python
# FastMCP 서버 보안 설정
mcp = FastMCP(
    name="blog-mcp",
    instructions="민감 정보는 절대 응답에 포함하지 않음",
    middleware=[
        SensitiveDataFilter(),
        RequestLogger(mask_sensitive=True),
        ResponseSanitizer()
    ]
)

class SensitiveDataFilter:
    """응답에서 민감 정보 자동 제거"""
    def process_response(self, response):
        if isinstance(response, dict):
            return self.remove_sensitive(response)
        if isinstance(response, str):
            return self.mask_strings(response)
        return response
```

## 결론

### 현재 상태 요약

#### 긍정적인 부분
- ✅ **쓰기는 보호됨** (API 키 필요)
- ✅ **네트워크 전송** (HTTPS 암호화)
- ✅ **SQL Injection 방어** (TypeORM)

#### 취약한 부분
- ❌ **읽기는 완전 공개** (누구나 가능)
- ❌ **Rate Limiting 없음** (DoS 취약)
- ❌ **민감 정보 마스킹 코드 없음**
- ❌ **에러 메시지에 패스워드 노출 가능**

### 즉시 조치 필요 사항

1. **Rate Limiting 구현** - DoS 공격 방지
2. **민감 정보 필터링** - 로그 및 응답 보안
3. **API 키 검증 최적화** - 성능 개선
4. **Cloudflare/WAF 도입** - DDoS 방어

### 장기적 개선 방향

1. **Zero-Trust Architecture** - 모든 요청 검증
2. **계층별 접근 제어** - 세분화된 권한 관리
3. **감사 로그 시스템** - 모든 활동 추적
4. **암호화된 메모리 저장** - 민감 정보 보호

현재 시스템은 기본적인 보안은 갖추었지만, **프로덕션 레벨에는 부족**합니다. 특히 **읽기 보안이 매우 취약**하며, **민감 정보 노출 위험**이 있습니다. 제안된 개선사항을 단계적으로 적용하면 안전하고 확장 가능한 플랫폼으로 성장할 수 있습니다.

## 태그
#security #mcp #api-security #data-protection #authentication #rate-limiting #sensitive-data #dos-prevention #architecture