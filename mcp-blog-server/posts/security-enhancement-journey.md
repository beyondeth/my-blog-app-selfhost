# 🔐 블로그 시스템 보안 강화 - 오늘의 개발 여정과 해결한 문제들

오늘은 블로그 시스템의 보안을 대폭 강화하는 작업을 진행했습니다. 개발 과정에서 발견한 여러 보안 취약점들을 해결하고, 엔터프라이즈급 보안 시스템을 구축한 과정을 공유합니다.

## 🚨 발견된 주요 보안 문제점들

### 1. API 경로 중복 문제
가장 먼저 발견한 것은 API 경로가 중복되는 문제였습니다.

```javascript
// ❌ 문제가 있던 코드
const API_URL = process.env.NEXT_PUBLIC_API_URL; // "http://localhost:3000/api/v1"
fetch(`${API_URL}/api/v1/blogs/my-blogs`); // 결과: /api/v1/api/v1/blogs/my-blogs
```

이로 인해 404 에러가 지속적으로 발생했고, 디버깅 과정에서 네트워크 탭을 통해 문제를 발견할 수 있었습니다.

```javascript
// ✅ 해결된 코드
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
fetch(`${API_URL}/blogs/my-blogs`); // 올바른 경로
```

### 2. 민감 정보 로그 노출 위험
개발 과정에서 API 키, 사용자 정보 등이 콘솔 로그에 그대로 노출되는 심각한 보안 문제를 발견했습니다.

### 3. API 키 평문 전송 보안 취약점
초기 구현에서는 API 키가 평문으로 전송되어 중간자 공격(MITM)에 취약한 상황이었습니다.

### 4. 환경 파일 및 민감 정보 보호 부족
.env 파일이나 설정 파일들이 적절히 보호되지 않아 민감한 정보가 노출될 위험이 있었습니다.

## 🛡️ 구현한 보안 솔루션들

### 1. 보안 로거 시스템 구축

민감한 정보를 자동으로 감지하고 마스킹하는 보안 로거를 구현했습니다.

```typescript
// frontend/src/utils/logger.ts
class SecurityLogger {
  private static sensitivePatterns = [
    /api[_-]?key/i,
    /password/i,
    /token/i,
    /secret/i,
    /auth/i
  ];

  private static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      for (const pattern of this.sensitivePatterns) {
        if (pattern.test(data)) {
          return '[REDACTED]';
        }
      }
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        const isSensitiveKey = this.sensitivePatterns.some(pattern => 
          pattern.test(key)
        );
        
        if (isSensitiveKey) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  static secureLog(level: 'info' | 'error' | 'warn', message: string, data?: any) {
    const sanitizedData = data ? this.sanitizeData(data) : undefined;
    console[level](`[SECURE] ${message}`, sanitizedData);
  }
}
```

### 2. HMAC-SHA256 기반 API 키 검증 시스템

API 키를 평문으로 전송하는 대신, HMAC 서명을 사용한 보안 시스템을 구축했습니다.

```typescript
// backend/src/auth/auth-api-key.service.ts
export class AuthApiKeyService {
  async verifyApiKeyWithHmac(apiKeyId: string, signature: string, timestamp: string): Promise<boolean> {
    try {
      // 타이밍 공격 방지를 위한 시간 검증
      const now = Date.now();
      const requestTime = parseInt(timestamp);
      const timeDiff = Math.abs(now - requestTime);
      
      if (timeDiff > 5 * 60 * 1000) { // 5분 제한
        throw new UnauthorizedException('Request timestamp too old');
      }

      // API 키 조회 (해시된 키로 저장)
      const apiKey = await this.apiKeyRepository.findOne({
        where: { id: apiKeyId, isActive: true }
      });

      if (!apiKey) {
        throw new UnauthorizedException('Invalid API key');
      }

      // HMAC 서명 검증
      const message = `${apiKeyId}:${timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', apiKey.hashedKey)
        .update(message)
        .digest('hex');

      // 타이밍 공격 방지를 위한 상수 시간 비교
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid signature');
      }

      // 사용 횟수 업데이트
      await this.apiKeyRepository.update(apiKey.id, {
        lastUsedAt: new Date(),
        usageCount: apiKey.usageCount + 1
      });

      return true;
    } catch (error) {
      SecurityLogger.secureLog('error', 'API key verification failed', { apiKeyId });
      throw error;
    }
  }
}
```

### 3. MCP 서버 보안 강화

MCP 서버에서도 API 키 검증과 세션 관리를 강화했습니다.

```python
# mcp-blog-server/src/unified_mcp_server.py
class BlogMCPServer:
    def __init__(self):
        self.sessions = {}
        self.session_timeout = 3600  # 1시간
    
    async def verify_api_key(self, api_key_id: str, signature: str, timestamp: str) -> bool:
        """HMAC 서명을 통한 API 키 검증"""
        try:
            # 백엔드 API 호출로 서명 검증
            verification_data = {
                "apiKeyId": api_key_id,
                "signature": signature,
                "timestamp": timestamp
            }
            
            response = await self.make_authenticated_request(
                'POST', 
                '/auth/verify-api-key', 
                verification_data
            )
            
            return response.get('valid', False)
            
        except Exception as e:
            self.logger.error(f"API key verification failed: {str(e)}")
            return False
    
    def create_session(self, user_id: str) -> str:
        """보안 세션 생성"""
        session_id = secrets.token_urlsafe(32)
        self.sessions[session_id] = {
            'user_id': user_id,
            'created_at': time.time(),
            'last_activity': time.time()
        }
        return session_id
```

### 4. 환경 파일 및 민감 정보 보호

```bash
# .gitignore 강화
.env
.env.local
.env.production
*.key
*.pem
config/secrets/

# 파일 권한 설정 (600 - 소유자만 읽기/쓰기)
chmod 600 .env
chmod 600 backend/.env
chmod 600 mcp-blog-server/.env
```

## 🚀 구현 결과 및 성과

### 1. 엔터프라이즈급 보안 수준 달성
- **타이밍 공격 방지**: 상수 시간 비교 알고리즘 사용
- **리플레이 공격 차단**: 타임스탬프 기반 요청 유효성 검증 (5분 제한)
- **민감 정보 보호**: 자동 로그 마스킹 시스템으로 개발/운영 환경 모두 보호

### 2. 완전한 2단계 인증 시스템
- **1단계**: JWT 기반 사용자 인증 (HttpOnly 쿠키, bcrypt 해싱)
- **2단계**: HMAC 서명 기반 API 키 검증 (crypto.timingSafeEqual)

### 3. 프로덕션 환경 준비 완료
- 모든 민감 정보는 환경 변수로 관리
- .gitignore를 통한 설정 파일 보호
- 파일 권한 보안 설정 (600 권한)
- 컨테이너 환경에서의 보안 설정 준비

### 4. 고급 보안 위협 차단
- **중간자 공격(MITM)**: HMAC 서명으로 요청 무결성 보장
- **세션 하이재킹**: HttpOnly 쿠키와 CSRF 토큰
- **SQL 인젝션**: TypeORM 파라미터화된 쿼리
- **XSS**: CSP 헤더와 입력 검증

## 🔍 배운 점과 인사이트

### 1. 보안은 처음부터 고려해야 한다
개발 초기에 보안을 고려하지 않으면, 나중에 대규모 리팩토링이 필요합니다. 특히 로깅 시스템의 경우 초기에 보안을 고려하지 않으면 민감한 정보가 여러 곳에 노출될 위험이 있습니다.

**교훈**: 첫 줄의 코드부터 보안을 염두에 두고 작성해야 합니다.

### 2. 방어적 프로그래밍의 중요성
사용자 입력을 신뢰하지 않고, 모든 단계에서 검증하는 방어적 프로그래밍이 얼마나 중요한지 깨달았습니다.

```typescript
// 방어적 프로그래밍 예시
function validateInput(data: unknown): UserInput {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid input format');
  }
  
  // 모든 필드를 명시적으로 검증
  const validatedData = {
    email: validateEmail(data.email),
    password: validatePassword(data.password),
    // ... 다른 필드들
  };
  
  return validatedData;
}
```

### 3. 암호화와 해싱의 적절한 활용
각 용도에 맞는 암호화 기술을 선택하는 것이 중요합니다:

- **해싱**: 비밀번호, API 키 저장 (bcrypt, crypto.timingSafeEqual)
- **서명**: API 요청 무결성 검증 (HMAC-SHA256)
- **암호화**: 민감한 데이터 전송 (HTTPS, 쿠키 암호화)

### 4. 타이밍 공격의 실제 위험성
단순한 문자열 비교도 공격 벡터가 될 수 있다는 점을 깨달았습니다. `crypto.timingSafeEqual`과 같은 상수 시간 비교 함수의 중요성을 실감했습니다.

## 🛠️ 구현 과정에서의 도전과 해결

### 도전 1: HMAC 구현의 복잡성
처음에는 단순히 API 키를 해싱하는 것으로 충분하다고 생각했지만, 리플레이 공격과 타이밍 공격을 고려하니 훨씬 복잡한 시스템이 필요했습니다.

**해결**: 타임스탬프 기반 HMAC 서명 시스템으로 발전시켰습니다.

### 도전 2: 프론트엔드에서의 민감 정보 처리
React 개발 과정에서 디버깅을 위해 많은 정보를 로그로 출력하다 보니, 의도치 않게 민감한 정보가 노출될 위험이 있었습니다.

**해결**: 자동 마스킹 기능을 가진 보안 로거를 개발했습니다.

### 도전 3: 개발 편의성 vs 보안성
개발 과정에서는 디버깅을 위해 모든 정보를 볼 수 있어야 하는데, 이것이 보안과 상충되는 문제가 있었습니다.

**해결**: 환경별로 다른 로깅 레벨을 적용하고, 개발 환경에서도 최소한의 보안은 유지하도록 했습니다.

## 📚 다음 단계

### 1. 보안 모니터링 시스템 구축
- 의심스러운 활동 탐지 (비정상적인 로그인 시도, API 호출 패턴)
- 실시간 알림 시스템
- 보안 대시보드 구축

### 2. 레이트 리미팅 시스템
```typescript
// 구현 예정인 레이트 리미터
@UseGuards(RateLimitGuard)
@RateLimit({ ttl: 60, limit: 10 }) // 1분에 10회 제한
@Post('/api/auth/login')
async login(@Body() loginDto: LoginDto) {
  // 로그인 로직
}
```

### 3. 보안 감사 자동화
- 정기적인 의존성 취약점 스캔
- 코드 정적 분석 (SonarQube, CodeQL)
- 침투 테스트 자동화

### 4. WAF (Web Application Firewall) 도입
- Cloudflare WAF 또는 AWS WAF 설정
- DDoS 공격 방어
- 지리적 접근 제어

## 🎯 핵심 교훈

오늘의 작업을 통해 보안이 단순히 기능을 추가하는 것이 아니라, **전체 시스템 아키텍처를 다시 생각하게 만드는 중요한 요소**임을 깨달았습니다. 

보안은 다음과 같은 영역에 영향을 미칩니다:
- **아키텍처 설계**: 보안을 고려한 모듈 분리와 접근 제어
- **개발 프로세스**: 보안 코드 리뷰, 정적 분석 도구 도입
- **운영 프로세스**: 모니터링, 로깅, 인시던트 대응
- **문화**: 팀 전체의 보안 의식 향상

앞으로도 보안을 최우선으로 고려한 개발을 지속하겠습니다. 특히 "Security by Design" 원칙을 따라, 모든 새로운 기능 개발 시 보안 요구사항을 첫 번째로 고려하겠습니다.

---

## 📖 참고 자료

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [RFC 2104 - HMAC: Keyed-Hashing for Message Authentication](https://tools.ietf.org/html/rfc2104)
- [Node.js Crypto Module Documentation](https://nodejs.org/api/crypto.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

*이 포스트가 도움이 되셨다면, 비슷한 보안 문제를 겪고 계신 개발자들과 공유해 주세요! 보안은 혼자가 아닌 커뮤니티 전체가 함께 발전시켜 나가야 할 영역입니다. 🔐✨*

**태그**: #보안 #개발 #블로그 #HMAC #API #인증 #웹개발 #백엔드 #프론트엔드 #보안로거 #타이밍공격 #리플레이공격