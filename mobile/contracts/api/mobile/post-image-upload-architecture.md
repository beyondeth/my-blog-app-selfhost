# Mobile Post Image Upload Architecture (Web + iOS + CDN)

## Scope

- 대상 기능: 피드 글 작성 시 이미지 업로드
- 플랫폼: Web, iOS (Android는 동일 계약 재사용)
- 백엔드: 기존 `files` + `posts` 도메인 사용

## Canonical Flow

1. 클라이언트가 `/api/v1/files/upload-url` 호출
- payload: `fileName`, `mimeType`, `fileSize`, `fileType=image`
- 응답: `uploadUrl`, `fileKey`

2. 클라이언트가 `uploadUrl`로 스토리지 직접 PUT 업로드
- `Content-Type`은 실제 업로드 MIME과 일치
- 2xx 아니면 실패 처리

3. 클라이언트가 `/api/v1/files/upload-complete` 호출
- payload: `fileKey`, `fileUrl`, `fileName`, `mimeType`, `fileSize`, `fileType=image`
- 응답: 저장된 파일 레코드(`id`) + `accessUrl`

4. 글 작성 API(`/api/v1/mobile/posts` 또는 `/api/v1/posts`) 호출
- payload에 `attachedFileIds[]` 포함
- 썸네일 지정이 있으면 `thumbnailImageId` 포함

## Data Contract

- `CreatePostDto`는 `attachedFileIds`와 `thumbnailImageId`를 지원
- `thumbnail` 문자열 필드는 사용하지 않고 `thumbnailImageId`만 사용
- 최종 응답의 thumbnail URL은 서버 매퍼에서 동적 생성

## CDN & URL Policy

- 파일 저장은 `fileKey` 기준으로 일관화
- 외부 노출 URL은 `accessUrl` 사용 (CDN 활성화 시 CDN URL, 아니면 origin)
- 앱은 `accessUrl`을 캐시 가능 자원으로 취급하고, 게시글 저장에는 항상 파일 `id`를 사용

## Limits & Validation

- 이미지 MIME: `image/webp`, `image/png`, `image/jpeg`, `image/jpg`
- 게시글 첨부 수: 최대 10개
- 게시글 총 파일 용량: 30MB

## Failure Handling

- 업로드 URL 생성 실패: 즉시 사용자 에러 노출, 재시도 제공
- 스토리지 PUT 실패: 업로드 중단, 완료 API 호출 금지
- upload-complete 실패: orphan 가능성 있으므로 재시도 또는 정리 작업 필요
- post create 실패: 이미 업로드된 파일은 임시 상태이므로 추후 정리 대상

## Observability

- 필수 로그 키: `userId`, `fileKey`, `contextId`, `postId`, `thumbnailImageId`
- 필수 지표:
- `upload_url_success_rate`
- `storage_put_success_rate`
- `upload_complete_success_rate`
- `post_create_with_images_success_rate`
- `p95_upload_to_publish_latency`

## Android Reuse

- Android도 동일한 4-step 계약 사용 가능
- 플랫폼 차이는 UI, 이미지 압축 전략, 로컬 캐시 정책만 분기
