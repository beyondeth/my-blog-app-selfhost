# API Contract History

## 0.1.0
- Initial mobile contract scaffold.
- Added mobile auth and feed endpoint placeholders.

## 0.1.1
- Added mobile feed contract as cursor-based unified feed (`/mobile/feed`) with `items/nextCursor/hasMore`.
- Added explicit mobile auth response payload fields for `/mobile/auth/*`.
- Marked `/mobile/feed` as production path and aligned to `/feed` backend response contract until dedicated mobile DTO split is completed.

## 0.1.2
- Added mobile post domain contracts for details, create, vote, view count, and comments:
  - `/mobile/posts`
  - `/mobile/posts/{id}`
  - `/mobile/posts/{id}/vote`
  - `/mobile/posts/{id}/view`
  - `/mobile/posts/{postId}/comments`

## 0.1.3
- Added post image upload contract for mobile clients:
  - `/files/upload-url`
  - presigned storage `PUT`
  - `/files/upload-complete`
  - `/mobile/posts` with `attachedFileIds` and `thumbnailImageId`
- Added architecture spec file:
  - `api/mobile/post-image-upload-architecture.md`

## 0.1.4
- Added mobile settings contract for Android/iOS parity:
  - `GET /mobile/settings`
  - `PATCH /mobile/settings/theme`
  - `PATCH /mobile/settings/notifications`
  - `PATCH /mobile/settings/privacy`
- Aligned settings payload enum values with Android domain (`SYSTEM`, `LIGHT`, `DARK`).
