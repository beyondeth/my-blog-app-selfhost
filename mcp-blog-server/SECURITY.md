# MCP 서버 보안 가이드

## 🔒 API Key 보안 원칙

### ❌ 절대 하면 안 되는 것들
1. **평문 API Key를 네트워크로 전송** - 절대 금지
2. **API Secret을 로그에 기록** - 민감 정보 노출
3. **Git에 API Key 커밋** - .env는 .gitignore 필수
4. **클라이언트에서 API Key 사용** - 서버 전용

### ✅ 반드시 따라야 할 보안 규칙

#### 1. API Key 구조 (AWS 스타일)
```
Key ID: akid_xxxx (공개 가능, 식별용)
Key Secret: aks_xxxx (절대 비밀, 서명 생성용)
```

#### 2. HMAC-SHA256 서명 필수
- 모든 요청에 서명 첨부
- Secret은 서명 생성에만 사용
- 평문 Secret은 절대 전송 금지

#### 3. 재사용 공격 방지
- Timestamp: 5분 이내만 유효
- Nonce: 일회용 토큰으로 중복 방지
- Rate Limiting: 분당 60회 제한

#### 4. HTTPS 필수
- HTTP 요청 차단
- TLS 1.2 이상 사용
- 중간자 공격 방지

## 🛡️ 구현 체크리스트

- [ ] API Key를 ID와 Secret으로 분리
- [ ] HMAC-SHA256 서명 구현
- [ ] Timestamp 검증 (5분)
- [ ] Nonce 중복 체크
- [ ] Rate Limiting 적용
- [ ] HTTPS 강제
- [ ] 에러 메시지에서 민감 정보 제거
- [ ] 감사 로그 구현

## 📚 참고: 주요 플랫폼 보안 방식

### AWS Signature V4
- Access Key ID + Secret Access Key
- HMAC-SHA256 서명
- Request 전체를 서명에 포함

### GitHub
- Personal Access Token (HTTPS 전용)
- Webhook: X-Hub-Signature-256 헤더
- Secret은 생성 시 1회만 표시

### Stripe
- Secret Key는 서버 전용
- Webhook 서명 검증 필수
- stripe-signature 헤더 사용

## 🚨 보안 사고 대응

1. **API Key 노출 시**
   - 즉시 해당 Key 비활성화
   - 새 Key 발급
   - 감사 로그 확인
   - 영향 범위 파악

2. **비정상 접근 감지**
   - Rate Limit 초과
   - 잘못된 서명 반복
   - 오래된 Timestamp
   → 자동 차단 및 알림

## 💡 Best Practices

1. **최소 권한 원칙**
   - 필요한 권한만 부여
   - 정기적 권한 검토

2. **Key Rotation**
   - 90일마다 Key 갱신
   - 만료 7일 전 알림

3. **모니터링**
   - 모든 API 호출 로깅
   - 비정상 패턴 감지
   - 실시간 알림

## 🔗 관련 문서
- [AWS Signature Version 4](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html)
- [GitHub Webhook Security](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)
- [Stripe API Security](https://stripe.com/docs/security)