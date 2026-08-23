# Aigory private media CDN

`cdn.aigory.com`은 private OCI Object Storage 버킷을 읽기 전용으로 노출합니다. 업로드는 백엔드가 발급한 짧은 수명의 OCI signed URL만 사용하며 Worker는 쓰기 요청을 거부합니다.

## OCI 준비

1. `aigory-blog-prod-media` private 버킷을 생성합니다.
2. 버킷 전체에 대해 **object reads only** PAR을 생성합니다.
3. PAR URL은 `/o`로 끝나는 값으로 보관합니다. 이 URL은 bearer credential이므로 저장소나 일반 Worker 변수에 기록하지 않습니다.
4. 별도 private 버킷 `aigory-blog-prod-backups`를 생성하고 보존 기간과 삭제 방지 정책을 설정합니다. CDN PAR에는 이 버킷을 포함하지 않습니다.

## Worker 배포

Cloudflare 인증이 완료된 환경에서 이 디렉터리를 기준으로 실행합니다.

```bash
pnpm dlx wrangler secret put ORIGIN_BASE_URL
pnpm dlx wrangler deploy
```

첫 명령의 입력 프롬프트에 OCI PAR URL을 넣습니다. `wrangler.toml`은 `cdn.aigory.com/*` route만 연결하며 `workers.dev` 공개 주소는 만들지 않습니다. Cloudflare DNS에는 proxied `cdn` 레코드가 있어야 합니다.

## 검증

```bash
node --test cdn-proxy.test.mjs
curl -I https://cdn.aigory.com/uploads/image/<known-object>.webp
curl -X PUT -i https://cdn.aigory.com/uploads/blocked.webp
```

정상 파일은 이미지 Content-Type과 public cache header를 반환해야 합니다. PUT은 `405`, 존재하지 않는 객체는 `404`여야 합니다. PAR을 교체하면 `ORIGIN_BASE_URL` secret도 즉시 갱신합니다.
