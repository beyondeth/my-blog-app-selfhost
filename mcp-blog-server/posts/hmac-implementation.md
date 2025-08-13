---
title: HMAC API Key Signature Implementation
category: security  
tags: [api, security, hmac, authentication]
---

# HMAC API Key Signature Implementation

## 🔐 보안 강화 구현 완료

오늘 백엔드 API에 **HMAC-SHA256 서명 검증** 시스템을 성공적으로 구현했습니다. 이제 API 키를 더욱 안전하게 사용할 수 있게 되었습니다.

## 📋 구현 내용

### 1. 서명 검증 시스템

HMAC-SHA256 알고리즘을 사용한 강력한 서명 검증 시스템을 구축했습니다:

- **HMAC-SHA256 알고리즘**: 업계 표준 암호화 알고리즘 사용
- **타임스탬프 기반 재생 공격 방지**: 5분 유효 시간 설정
- **Nonce를 통한 중복 요청 방지**: 각 요청에 고유 식별자 부여
- **타이밍 안전 비교**: 타이밍 공격 방지를 위한 constant-time 비교

### 2. 보안 강화 사항

```typescript
// API 키 엔티티에 signingSecret 필드 추가
@Column({ nullable: true })
signingSecret: string; // AES-256-GCM으로 암호화 저장
```

- **AES-256-GCM 암호화**: 서명 시크릿을 안전하게 암호화하여 저장
- **환경 변수 기반 암호화 키**: 시스템 레벨에서 암호화 키 관리
- **IV와 Auth Tag**: 각 암호화마다 고유한 초기화 벡터와 인증 태그 사용

### 3. 성능 최적화

기존 O(n) 복잡도의 API 키 검색을 O(1)로 개선했습니다:

```typescript
// Before: 모든 API 키를 순회하며 검증
for (const apiKey of allApiKeys) {
  // 검증 로직
}

// After: keyId로 직접 조회
const apiKey = await this.apiKeyRepository.findOne({
  where: { id: keyId, isActive: true },
  relations: ['user', 'blog']
});
```

## 🏗️ 구현 파일 구조

| 파일 | 역할 |
|------|------|
| `api-keys.entity.ts` | signingSecret 필드 추가 |
| `api-keys.service.ts` | 암호화/복호화 메서드 구현 |
| `auth-api-key.service.ts` | HMAC 검증 로직 구현 |
| `mcp-auth.guard.ts` | 서명 검증 통합 |

## 🔒 보안 특징

### 다층 방어 (Defense in Depth)

1. **API 키 해싱**: bcrypt로 API 키 해시 저장
2. **서명 시크릿 암호화**: AES-256-GCM으로 시크릿 암호화
3. **재생 공격 방지**: 타임스탬프와 Nonce 조합
4. **타이밍 공격 방지**: Timing-safe comparison 구현

## 🚀 MCP 통합

MCP(Model Context Protocol) 서버와의 통합도 완료했습니다:

### 2단계 인증 시스템
1. **1차 인증**: 이메일/패스워드 검증
2. **2차 인증**: API 키 검증
3. **세션 관리**: JWT 토큰 발급

## 💡 주요 개선 사항

### Before
- API 키가 평문으로 전송
- 재생 공격에 취약
- O(n) 검색 복잡도

### After
- HMAC 서명으로 API 키 보호
- 타임스탬프 + Nonce로 재생 공격 방지
- O(1) 검색 복잡도로 성능 개선

---

*🔒 보안은 한 번에 완성되는 것이 아니라 지속적으로 개선해나가는 과정입니다.*
EOF < /dev/null