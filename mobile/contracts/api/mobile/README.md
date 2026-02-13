# Mobile API Endpoints

This document lists mobile-oriented endpoints and behavior contracts.

## Current scope (MVP)

- Auth
  - POST `/mobile/auth/login`
  - POST `/mobile/auth/refresh`
  - POST `/mobile/auth/logout`
  - GET `/mobile/auth/me`
- Content
  - GET `/mobile/feed`
  - GET `/feed` (현재 백엔드 실제 구현: 공용 통합 피드).  
    iOS는 초기에는 `/mobile/feed`를 호출하되, 내부적으로는 통합 피드 응답 형식과 호환되도록 계약을 정합화.
- Settings
  - GET `/mobile/settings`
  - PATCH `/mobile/settings/theme`
  - PATCH `/mobile/settings/notifications`
  - PATCH `/mobile/settings/privacy`
- [완료] `/mobile/posts`: 글 작성
- [완료] `/mobile/posts/{id}`: 글 상세 조회
- [완료] `/mobile/posts/{id}/vote`: 좋아요/투표
- [완료] `/mobile/posts/{id}/comments`: 댓글 조회/작성
- [진행 예정] `/mobile/posts/{id}/likes` and `/mobile/posts/{id}/view`: 좋아요/조회수
- [완료] 이미지 업로드 체인: `/files/upload-url` -> storage PUT -> `/files/upload-complete` -> `/mobile/posts` (`attachedFileIds`, `thumbnailImageId`)
- Realtime
  - WebSocket/Socket.IO connection and token refresh flow

## Contract rule

Backend must continue to support web cookie authentication. Mobile APIs can return explicit tokens for secure storage.

## Compatibility decision

- 장기적으로 모바일은 `/api/v1/mobile/*` 경로를 정식 전용 API 계층으로 사용하고,  
  서버는 모바일 특화 응답 형태를 안정적으로 제공.
- 단기적으로는 공용 도메인(`/feed`)의 응답 구조 정합성에 맞춰 모바일 계약을 고정한 뒤,  
  필요 API를 단계적으로 `/mobile/*` 계층으로 마이그레이션.

## Image Upload Contract

- 상세 계약 문서: `post-image-upload-architecture.md`
- 모바일은 presigned URL 직접 업로드 후 파일 ID를 게시글 생성 payload에 전달
- CDN URL은 조회/표시에만 사용하고, 저장 시에는 `fileId`/`thumbnailImageId` 기준으로 처리
