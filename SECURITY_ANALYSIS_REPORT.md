# 🔒 보안 분석 보고서 - My Blog App

## 📅 분석 일자: 2025-01-23
## 🎯 분석 범위: 전체 블로그 시스템 (Frontend + Backend + MCP Server)

---

## 🚨 핵심 보안 취약점 요약

### 위험도 분류
- **🔴 긴급 (Critical)**: 즉시 수정 필요
- **🟠 높음 (High)**: 24시간 내 수정 권장
- **🟡 중간 (Medium)**: 7일 내 수정 권장
- **🟢 낮음 (Low)**: 30일 내 수정 권장

---

## 1. 🔴 **Markdown → HTML 저장형 XSS 취약점**

### 현재 상황
- **위치**: `/backend/src/common/services/markdown-renderer.service.ts`
- **문제점**:
  ```javascript
  // marked 라이브러리 기본 설정만 사용 중
  marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false
  });
  ```
- **취약점**: `marked.parse()`가 악성 스크립트를 필터링하지 않음

### 공격 시나리오
```markdown
# 악성 제목 <img src=x onerror="alert('XSS')">
[링크](javascript:alert('XSS'))
![이미지](data:text/html,<script>alert('XSS')</script>)
```

### ✅ 개선 방안
```typescript
// 1. DOMPurify 강화 설정
const STRICT_PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'code', 'pre', ...],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
  ALLOWED_URI_REGEXP: /^https?:\/\//i, // HTTP(S)만 허용
  FORBID_TAGS: ['script', 'style', 'iframe'], // YouTube 제외
  FORBID_ATTR: ['onerror', 'onload', 'onclick']
};

// 2. 마크다운 파싱 후 무조건 sanitize
const htmlContent = marked.parse(markdown);
const sanitizedHtml = DOMPurify.sanitize(htmlContent, STRICT_PURIFY_CONFIG);
```

---

## 2. 🔴 **dangerouslySetInnerHTML 무분별 사용**

### 현재 상황
- **위치**:
  - `/frontend/src/components/ui/content-renderer/components/HtmlRenderer.tsx`
  - `/frontend/src/components/ui/MermaidDiagram.tsx`
  - `/frontend/src/components/ui/Modal.tsx`
  - `/frontend/src/components/ui/content-renderer/components/CodeRenderer.tsx`

### 문제 코드
```tsx
// HtmlRenderer.tsx
<div
  className={`html-content ${className}`}
  dangerouslySetInnerHTML={{ __html: processedHtml }} // 🚨 위험!
/>
```

### ✅ 개선 방안
```tsx
// 1. 클라이언트 사이드에서도 재검증
import DOMPurify from 'isomorphic-dompurify';

const SafeHtmlRenderer = ({ html }) => {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'], // 필요한 속성만
    ALLOWED_TAGS: [...], // 허용 태그 명시
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

// 2. 가능한 경우 React 컴포넌트로 변환
import parse from 'html-react-parser';
const parsed = parse(sanitizedHtml);
```

---

## 3. 🟠 **외부 리소스 SSRF/트래킹 취약점**

### 현재 상황
- **문제**: 이미지/링크 URL 검증 없이 직접 요청
- **위치**: 이미지 프록시 및 OG 태그 처리

### 취약 패턴
```javascript
// 위험한 코드
const imageUrl = userInput; // 검증 없음
<img src={imageUrl} /> // 내부 IP 접근 가능
```

### 공격 시나리오
- `http://169.254.169.254/latest/meta-data/` (AWS 메타데이터)
- `http://192.168.1.1/admin` (내부망 접근)
- `file:///etc/passwd` (로컬 파일)

### ✅ 개선 방안
```typescript
// URL 화이트리스트 검증
const ALLOWED_DOMAINS = ['youtube.com', 'ytimg.com', 's3.amazonaws.com'];
const BLOCKED_IPS = ['127.0.0.1', '169.254.169.254', '10.0.0.0/8'];

function validateImageUrl(url: string): boolean {
  const parsed = new URL(url);

  // 프로토콜 검증
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;

  // 내부 IP 차단
  if (isInternalIP(parsed.hostname)) return false;

  // 도메인 화이트리스트 검증
  return ALLOWED_DOMAINS.some(domain =>
    parsed.hostname.endsWith(domain)
  );
}
```

---

## 4. 🟡 **H1 변환 시 인코딩/디코딩 취약점**

### 현재 상황
```typescript
// mcp-blog-server-ts/src/lib/markdown.ts
const h1Match = /^#\s+(.+)$/m.exec(body);
if (h1Match && h1Match[1]) {
  metadata.title = h1Match[1]; // 🚨 직접 할당
}
```

### 문제점
- HTML 엔티티 이중 디코딩 가능
- `&lt;img onerror=alert(1)&gt;` → `<img onerror=alert(1)>`

### ✅ 개선 방안
```typescript
import he from 'he'; // HTML 엔티티 처리

function extractTitle(markdown: string): string {
  const h1Match = /^#\s+(.+)$/m.exec(markdown);
  if (!h1Match) return 'Untitled';

  // HTML 엔티티 디코딩 + 태그 제거
  const decoded = he.decode(h1Match[1]);
  const textOnly = decoded.replace(/<[^>]*>/g, '');

  return textOnly.trim();
}
```

---

## 5. 🟡 **슬러그/파일명 경로 조작 취약점**

### 현재 상황
```typescript
// Post.entity.ts
generateSlug() {
  const baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .substring(0, 50);
  // UUID로 고유성은 보장하지만...
}
```

### 문제점
- `../../../etc/passwd` 같은 경로 조작 가능
- OS 예약어 처리 미흡 (`CON`, `PRN`, `AUX` 등)

### ✅ 개선 방안
```typescript
import slug from 'slug';
import path from 'path';

function generateSafeSlug(title: string): string {
  // 경로 조작 문자 제거
  const cleaned = title
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '-');

  // slug 라이브러리 사용
  const baseSlug = slug(cleaned, {
    lower: true,
    strict: true,
    locale: 'ko'
  });

  // OS 예약어 체크
  const RESERVED = ['CON', 'PRN', 'AUX', 'NUL'];
  if (RESERVED.includes(baseSlug.toUpperCase())) {
    return `post-${uuidv4()}`;
  }

  return `${baseSlug}-${uuidv4().split('-')[0]}`;
}
```

---

## 6. 🟠 **API 인증/인가 보안 강화 필요**

### 현재 상황 (양호)
- HMAC-SHA256 서명 사용 ✅
- 타임스탬프 검증 (5분) ✅
- Nonce 재사용 방지 ✅
- API Secret 전송 안함 ✅

### 추가 개선 필요
```typescript
// 1. Rate Limiting 추가
@UseGuards(RateLimitGuard)
@RateLimit({ ttl: 60, limit: 10 }) // 분당 10회

// 2. API Key 권한 세분화
enum ApiKeyPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete'
}

// 3. IP 화이트리스트 (옵션)
const ALLOWED_IPS = process.env.API_ALLOWED_IPS?.split(',') || [];
```

---

## 7. 🔴 **보안 헤더 미설정**

### 현재 상황
- CSP (Content-Security-Policy) ❌
- X-Frame-Options ❌
- X-Content-Type-Options ❌
- Strict-Transport-Security ❌
- Referrer-Policy ❌

### ✅ 개선 방안

#### Next.js 설정 (`next.config.js`)
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 점진적 강화
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "frame-src 'self' https://www.youtube.com",
              "connect-src 'self' https://api.example.com"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
};
```

#### NestJS 설정 (Helmet 미들웨어)
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 8. 🟡 **링크 보안 (rel 속성)**

### 현재 상황
```html
<!-- 취약한 코드 -->
<a href={userUrl} target="_blank">{text}</a>
```

### 문제점
- `window.opener` 접근 가능 (탭 탈취)
- Referrer 정보 유출

### ✅ 개선 방안
```typescript
// MarkdownRenderer에 이미 구현됨 - 전체 적용 필요
renderer.link = function({ href, title, tokens }) {
  const isExternal = href.startsWith('http');
  const rel = isExternal
    ? 'rel="noopener noreferrer ugc"' // ugc = User Generated Content
    : '';
  const target = isExternal ? 'target="_blank"' : '';

  return `<a href="${href}" ${target} ${rel}>${text}</a>`;
};
```

---

## 9. 🟢 **기타 보안 고려사항**

### 잘 구현된 부분 ✅
- bcrypt 비밀번호 해싱
- HttpOnly 쿠키 사용
- JWT 토큰 만료 관리
- 파일 업로드 크기 제한 (30MB)
- SQL Injection 방지 (TypeORM 파라미터화)

### 추가 권장사항
```typescript
// 1. 비밀번호 복잡도 강화
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// 2. 로그인 실패 제한
@UseGuards(ThrottlerGuard)
@Throttle(5, 300) // 5분에 5회

// 3. 세션 관리 강화
- 유휴 시간 초과: 30분
- 동시 세션 제한: 3개
- 디바이스 기반 세션 추적

// 4. 민감한 작업 재인증
- 비밀번호 변경
- API Key 생성
- 계정 삭제
```

---

## 📊 우선순위 액션 플랜

### 🔴 즉시 수정 (24시간 내)
1. **보안 헤더 설정** - CSP, X-Frame-Options 등
2. **마크다운 렌더링 강화** - 모든 사용자 입력 sanitize
3. **dangerouslySetInnerHTML 최소화** - 가능한 대안 사용

### 🟠 단기 수정 (1주일 내)
4. **SSRF 방지** - URL 화이트리스트/블랙리스트
5. **Rate Limiting** - API 남용 방지
6. **링크 보안** - rel="noopener noreferrer ugc" 전체 적용

### 🟡 중기 개선 (1개월 내)
7. **슬러그 생성 강화** - 경로 조작 방지
8. **API Key 권한 세분화** - 최소 권한 원칙
9. **로그인 보안 강화** - 실패 제한, 2FA 옵션

### 🟢 장기 개선 (3개월 내)
10. **보안 감사 로깅** - 모든 중요 작업 기록
11. **침입 탐지 시스템** - 이상 행동 감지
12. **정기 보안 스캔** - 자동화된 취약점 점검

---

## 🎯 결론

현재 블로그 시스템은 **기본적인 보안 체계**는 갖추고 있으나, **사용자 생성 콘텐츠(UGC) 처리**와 **클라이언트 보안 헤더** 부분에서 개선이 필요합니다.

### 종합 보안 점수: **65/100** 🟡

- **강점**: API 인증, 비밀번호 관리, SQL Injection 방지
- **약점**: XSS 방지, 보안 헤더, SSRF 방지
- **권장**: 즉시 보안 헤더 설정 및 XSS 방지 강화

---

## 📚 참고 자료
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/helmet)