# Cloudflare 캐시 제거 설정 가이드

Editor's Pick 실시간 반영을 위해 Cloudflare 캐시를 즉시 제거하는 설정 가이드입니다.

## 1. Zone ID 확인

1. [Cloudflare 대시보드](https://dash.cloudflare.com)에 로그인
2. 해당 도메인 선택
3. 우측 상단에서 **"Get your Zone ID"** 클릭 또는
4. **Overview** 페이지에서 **Zone ID** 확인

## 2. API Token 생성

### API Token 생성 단계

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)에서 **Create Token** 클릭
2. **Custom token** 선택

### Token 설정

- **Token name**: `blog-cache-purge`
- **Permissions**:
  - Zone → Zone → **Purge Cache**
- **Zone Resources**:
  - Include → **Specific zone** → `{사용자 도메인}`
- **TTL**: 특정 기간 설정 (권장: 무제한)

### 권한 확인
```
Zone:Purge:Cache
Zone:Read
```

## 3. 환경변수 설정

`.env` 파일에 다음 내용 추가:

```bash
# Cloudflare 설정
CLOUDFLARE_ZONE_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://your-domain.com
```

## 4. 테스트

### API 테스트 (curl)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://your-domain.com/api/v1/posts/editor-picks"]}'
```

### 성공 응답 예시
```json
{
  "success": true,
  "errors": [],
  "result": {
    "id": "023e105f4ecef8ad9ca31a8372c0b353"
  }
}
```

## 5. 적용 확인

1. 백엔드 재시작: `pnpm start:dev`
2. Editor's Pick 추가/제거 시 로그 확인:
   ```
   ✅ Successfully purged Cloudflare cache for Editor's Pick
   ```
3. 홈페이지에서 즉시 반영되는지 확인

## 주의사항

- API Token은 **절대 GitHub에 커밋하지 마세요**
- Token은 Zone:Purge:Cache 권한만 가지도록 제한
- 문제 발생 시 Cloudflare Rate Limit 확인 (100회/분)
- FRONTEND_URL은 실제 운영 중인 도메인으로 설정

## 문제 해결

### 1. "Authentication error" 발생 시
- API Token 올바른지 확인
- Token 권한에 Zone:Purge:Cache 포함되어 있는지 확인

### 2. "Zone not found" 발생 시
- Zone ID 올바른지 확인
- Token의 Zone Resources에 해당 도메인 포함되어 있는지 확인

### 3. 캐시가 즉시 제거되지 않을 때
- Cloudflare Edge 노드에 따라 약간의 지연 가능성 (1-5초)
- 브라우저 캐시도 함께 확인 필요