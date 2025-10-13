# API Reference (API 레퍼런스)

## 목차
1. [개요](#개요)
2. [인증](#인증)
3. [Auth API](#auth-api)
4. [Users API](#users-api)
5. [Blogs API](#blogs-api)
6. [Posts API](#posts-api)
7. [Comments API](#comments-api)
8. [Files API](#files-api)
9. [Chat API](#chat-api)
10. [Notifications API](#notifications-api)
11. [Follows API](#follows-api)
12. [Bookmarks API](#bookmarks-api)
13. [에러 코드](#에러-코드)

---

## 개요

### Base URL
```
개발 환경: http://localhost:3000/api/v1
프로덕션: https://api.example.com/api/v1
```

### 공통 헤더
```http
Content-Type: application/json
Authorization: Bearer {jwt-token}  # 인증 필요한 엔드포인트
```

### 응답 형식

#### 성공 응답
```json
{
  "statusCode": 200,
  "data": {
    // 실제 데이터
  }
}
```

#### 에러 응답
```json
{
  "statusCode": 400,
  "message": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error message"
    }
  ]
}
```

---

## 인증

### JWT 토큰
대부분의 엔드포인트는 JWT 토큰이 필요합니다. 토큰은 HttpOnly 쿠키에 저장되며, 브라우저가 자동으로 전송합니다.

### 인증 헤더
```http
Cookie: access_token={jwt-token}
```

또는

```http
Authorization: Bearer {jwt-token}
```

---

## Auth API

### 1. 회원가입

**POST** `/auth/register`

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "username": "johndoe"
}
```

**Response (201 Created)**
```json
{
  "statusCode": 201,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "role": "USER",
      "createdAt": "2025-01-13T10:00:00Z"
    },
    "accessToken": "jwt-token"
  }
}
```

### 2. 로그인

**POST** `/auth/login`

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "profileImage": "https://...",
      "role": "USER",
      "subscriptionTier": "FREE"
    },
    "accessToken": "jwt-token"
  }
}
```

**Note**: 토큰은 HttpOnly 쿠키에도 저장됩니다.

### 3. 로그아웃

**POST** `/auth/logout`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "message": "Logged out successfully"
}
```

### 4. 현재 사용자 정보

**GET** `/auth/me`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "profileImage": "https://...",
    "bio": "Developer",
    "role": "USER",
    "subscriptionTier": "FREE",
    "blogSlug": "johndoe-blog",
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 5. OAuth2 로그인

**GET** `/auth/google`
**GET** `/auth/github`
**GET** `/auth/kakao`

브라우저에서 접근하면 OAuth 제공자의 인증 페이지로 리다이렉트됩니다.

**콜백 URL**
- Google: `/auth/google/callback`
- GitHub: `/auth/github/callback`
- Kakao: `/auth/kakao/callback`

### 6. 비밀번호 재설정 요청

**POST** `/auth/forgot-password`

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "message": "Password reset email sent"
}
```

### 7. 비밀번호 재설정

**POST** `/auth/reset-password`

**Request Body**
```json
{
  "token": "reset-token",
  "newPassword": "NewStrongPassword123!"
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "message": "Password reset successfully"
}
```

---

## Users API

### 1. 사용자 프로필 조회

**GET** `/users/:id`

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "profileImage": "https://...",
    "bio": "Developer",
    "blogSlug": "johndoe-blog",
    "followersCount": 100,
    "followingCount": 50,
    "postsCount": 25,
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 2. 사용자 프로필 수정

**PATCH** `/users/me`

**Authentication**: Required

**Request Body**
```json
{
  "username": "newusername",
  "bio": "Updated bio",
  "profileImage": "https://..."
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "username": "newusername",
    "bio": "Updated bio",
    "profileImage": "https://...",
    "updatedAt": "2025-01-13T10:00:00Z"
  }
}
```

### 3. 사용자 삭제 (탈퇴)

**DELETE** `/users/me`

**Authentication**: Required

**Request Body**
```json
{
  "password": "CurrentPassword123!"
}
```

**Response (204 No Content)**

---

## Blogs API

### 1. 내 블로그 조회

**GET** `/blogs/my-blog`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "slug": "johndoe-blog",
    "name": "John's Tech Blog",
    "description": "Thoughts on web development",
    "thumbnailUrl": "https://...",
    "isPublic": true,
    "allowComments": true,
    "owner": {
      "id": "uuid",
      "username": "johndoe",
      "profileImage": "https://..."
    },
    "postsCount": 25,
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 2. 블로그 생성/수정

**PUT** `/blogs`

**Authentication**: Required

**Request Body**
```json
{
  "slug": "johndoe-blog",
  "name": "John's Tech Blog",
  "description": "Thoughts on web development",
  "thumbnailUrl": "https://...",
  "isPublic": true,
  "allowComments": true
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "slug": "johndoe-blog",
    "name": "John's Tech Blog",
    "description": "Thoughts on web development",
    "thumbnailUrl": "https://...",
    "isPublic": true,
    "allowComments": true,
    "createdAt": "2025-01-13T10:00:00Z",
    "updatedAt": "2025-01-13T10:00:00Z"
  }
}
```

### 3. 블로그 조회 (Slug로)

**GET** `/blogs/:slug`

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "slug": "johndoe-blog",
    "name": "John's Tech Blog",
    "description": "Thoughts on web development",
    "thumbnailUrl": "https://...",
    "isPublic": true,
    "allowComments": true,
    "owner": {
      "id": "uuid",
      "username": "johndoe",
      "profileImage": "https://..."
    },
    "postsCount": 25,
    "recentPosts": [
      {
        "id": "uuid",
        "title": "Recent Post",
        "slug": "recent-post-abc123",
        "excerpt": "Post summary...",
        "thumbnail": "https://...",
        "publishedAt": "2025-01-13T10:00:00Z"
      }
    ]
  }
}
```

### 4. 블로그 삭제

**DELETE** `/blogs/:id`

**Authentication**: Required (Owner only)

**Response (204 No Content)**

---

## Posts API

### 1. 포스트 목록 조회

**GET** `/posts`

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
sortBy: 'recent' | 'popular' | 'trending' (default: 'recent')
category: string (optional)
tag: string (optional)
search: string (optional)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "posts": [
      {
        "id": "uuid",
        "title": "Understanding TypeScript",
        "slug": "understanding-typescript-abc123",
        "excerpt": "TypeScript basics and advanced concepts...",
        "thumbnail": "https://...",
        "author": {
          "id": "uuid",
          "username": "johndoe",
          "profileImage": "https://..."
        },
        "blog": {
          "id": "uuid",
          "slug": "johndoe-blog",
          "name": "John's Tech Blog"
        },
        "category": "Programming",
        "tagList": ["typescript", "javascript"],
        "viewCount": 1500,
        "likeCount": 120,
        "commentCount": 35,
        "isEditorPick": false,
        "publishedAt": "2025-01-13T10:00:00Z",
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 200,
      "itemsPerPage": 20
    }
  }
}
```

### 2. 포스트 상세 조회

**GET** `/posts/:slug`

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "title": "Understanding TypeScript",
    "slug": "understanding-typescript-abc123",
    "content": "<p>Full HTML content...</p>",
    "content_markdown": "# Full markdown content...",
    "excerpt": "TypeScript basics...",
    "thumbnail": "https://...",
    "author": {
      "id": "uuid",
      "username": "johndoe",
      "profileImage": "https://...",
      "bio": "Developer"
    },
    "blog": {
      "id": "uuid",
      "slug": "johndoe-blog",
      "name": "John's Tech Blog"
    },
    "category": "Programming",
    "tagList": ["typescript", "javascript"],
    "viewCount": 1500,
    "likeCount": 120,
    "commentCount": 35,
    "isLiked": false,
    "isBookmarked": false,
    "isEditorPick": false,
    "publishedAt": "2025-01-13T10:00:00Z",
    "createdAt": "2025-01-13T10:00:00Z",
    "updatedAt": "2025-01-13T10:00:00Z"
  }
}
```

### 3. 포스트 생성

**POST** `/posts`

**Authentication**: Required

**Request Body**
```json
{
  "title": "Understanding TypeScript",
  "content": "<p>HTML content...</p>",
  "content_markdown": "# Markdown content...",
  "excerpt": "TypeScript basics...",
  "thumbnail": "https://...",
  "category": "Programming",
  "tagList": ["typescript", "javascript"],
  "isPublished": false
}
```

**Response (201 Created)**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "title": "Understanding TypeScript",
    "slug": "understanding-typescript-abc123",
    "content": "<p>HTML content...</p>",
    "isPublished": false,
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 4. 포스트 수정

**PATCH** `/posts/:id`

**Authentication**: Required (Author only)

**Request Body** (모든 필드 선택적)
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content...</p>",
  "content_markdown": "# Updated markdown...",
  "tagList": ["typescript", "javascript", "webdev"],
  "isPublished": true
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "slug": "updated-title-abc123",
    "isPublished": true,
    "updatedAt": "2025-01-13T10:00:00Z"
  }
}
```

### 5. 포스트 삭제

**DELETE** `/posts/:id`

**Authentication**: Required (Author only)

**Response (204 No Content)**

### 6. 포스트 좋아요

**POST** `/posts/:id/like`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isLiked": true,
    "likeCount": 121
  }
}
```

### 7. 포스트 좋아요 취소

**DELETE** `/posts/:id/like`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isLiked": false,
    "likeCount": 120
  }
}
```

### 8. 포스트 검색

**GET** `/posts/search`

**Query Parameters**
```
q: string (검색 키워드)
page: number (default: 1)
limit: number (default: 20)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "posts": [
      {
        "id": "uuid",
        "title": "Understanding TypeScript",
        "slug": "understanding-typescript-abc123",
        "excerpt": "TypeScript basics...",
        "thumbnail": "https://...",
        "author": {
          "username": "johndoe"
        },
        "publishedAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 95
    }
  }
}
```

---

## Comments API

### 1. 댓글 목록 조회

**GET** `/posts/:postId/comments`

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 50)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "comments": [
      {
        "id": "uuid",
        "content": "Great article!",
        "author": {
          "id": "uuid",
          "username": "commenter",
          "profileImage": "https://..."
        },
        "parentId": null,
        "replies": [
          {
            "id": "uuid",
            "content": "Thanks!",
            "author": {
              "username": "johndoe"
            },
            "parentId": "parent-uuid",
            "likeCount": 5,
            "createdAt": "2025-01-13T10:05:00Z"
          }
        ],
        "likeCount": 10,
        "isLiked": false,
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 145
    }
  }
}
```

### 2. 댓글 작성

**POST** `/posts/:postId/comments`

**Authentication**: Required

**Request Body**
```json
{
  "content": "Great article!",
  "parentId": null  // 대댓글인 경우 부모 댓글 ID
}
```

**Response (201 Created)**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "content": "Great article!",
    "author": {
      "id": "uuid",
      "username": "commenter",
      "profileImage": "https://..."
    },
    "parentId": null,
    "likeCount": 0,
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 3. 댓글 수정

**PATCH** `/comments/:id`

**Authentication**: Required (Author only)

**Request Body**
```json
{
  "content": "Updated comment content"
}
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "content": "Updated comment content",
    "updatedAt": "2025-01-13T10:00:00Z"
  }
}
```

### 4. 댓글 삭제

**DELETE** `/comments/:id`

**Authentication**: Required (Author or Post Author or Admin)

**Response (204 No Content)**

### 5. 댓글 좋아요

**POST** `/comments/:id/like`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isLiked": true,
    "likeCount": 11
  }
}
```

---

## Files API

### 1. 파일 업로드

**POST** `/files/upload`

**Authentication**: Required

**Request** (multipart/form-data)
```
file: File (최대 10MB)
context: 'post' | 'avatar' | 'blog' | 'comment' (optional)
```

**Response (201 Created)**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "filename": "image-abc123.jpg",
    "originalName": "my-image.jpg",
    "mimeType": "image/jpeg",
    "size": 102400,
    "s3Url": "https://s3.amazonaws.com/bucket/uploads/...",
    "proxyUrl": "http://localhost:3000/api/v1/files/proxy/uploads/...",
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 2. 파일 조회 (Proxy)

**GET** `/files/proxy/:key(*)`

**Response**: 파일 바이너리 (이미지, 문서 등)

**Headers**
```
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000
```

### 3. 내 파일 목록

**GET** `/files/my-files`

**Authentication**: Required

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 20)
context: 'post' | 'avatar' | 'blog' (optional)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "files": [
      {
        "id": "uuid",
        "filename": "image-abc123.jpg",
        "originalName": "my-image.jpg",
        "mimeType": "image/jpeg",
        "size": 102400,
        "proxyUrl": "http://localhost:3000/api/v1/files/proxy/...",
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 95
    }
  }
}
```

### 4. 파일 삭제

**DELETE** `/files/:id`

**Authentication**: Required (Uploader only)

**Response (204 No Content)**

---

## Chat API

### 1. 대화 목록 조회

**GET** `/chat/conversations`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "participant": {
          "id": "uuid",
          "username": "friend",
          "profileImage": "https://..."
        },
        "lastMessage": {
          "content": "Hello!",
          "createdAt": "2025-01-13T10:00:00Z",
          "isRead": true
        },
        "unreadCount": 0,
        "createdAt": "2025-01-13T09:00:00Z",
        "updatedAt": "2025-01-13T10:00:00Z"
      }
    ]
  }
}
```

### 2. 대화 시작/조회

**GET** `/chat/conversations/:userId`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "participant": {
      "id": "uuid",
      "username": "friend",
      "profileImage": "https://..."
    },
    "messages": [
      {
        "id": "uuid",
        "content": "Hello!",
        "senderId": "uuid",
        "isRead": true,
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ]
  }
}
```

### 3. 메시지 전송 (REST)

**POST** `/chat/messages`

**Authentication**: Required

**Request Body**
```json
{
  "recipientId": "uuid",
  "content": "Hello!"
}
```

**Response (201 Created)**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "content": "Hello!",
    "senderId": "uuid",
    "recipientId": "uuid",
    "isRead": false,
    "createdAt": "2025-01-13T10:00:00Z"
  }
}
```

### 4. WebSocket 이벤트

**Connection**
```typescript
// Client
const socket = io('http://localhost:3000', {
  auth: { token: 'jwt-token' }
});
```

**이벤트: sendMessage**
```typescript
// Client → Server
socket.emit('sendMessage', {
  conversationId: 'uuid',
  content: 'Hello!',
  recipientId: 'uuid'
});
```

**이벤트: newMessage**
```typescript
// Server → Client
socket.on('newMessage', (message) => {
  // message: { id, content, senderId, createdAt }
});
```

**이벤트: markAsRead**
```typescript
// Client → Server
socket.emit('markAsRead', {
  conversationId: 'uuid'
});
```

---

## Notifications API

### 1. 알림 목록 조회

**GET** `/notifications`

**Authentication**: Required

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 20)
isRead: boolean (optional)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "like",
        "message": "johndoe님이 회원님의 포스트에 좋아요를 눌렀습니다.",
        "issuer": {
          "id": "uuid",
          "username": "johndoe",
          "profileImage": "https://..."
        },
        "relatedPost": {
          "id": "uuid",
          "title": "Understanding TypeScript",
          "slug": "understanding-typescript-abc123"
        },
        "isRead": false,
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 55
    }
  }
}
```

### 2. 알림 읽음 처리

**PATCH** `/notifications/:id/read`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "isRead": true
  }
}
```

### 3. 모든 알림 읽음 처리

**PATCH** `/notifications/read-all`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "message": "All notifications marked as read"
}
```

### 4. 알림 삭제

**DELETE** `/notifications/:id`

**Authentication**: Required

**Response (204 No Content)**

---

## Follows API

### 1. 팔로우

**POST** `/follows/:userId`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isFollowing": true,
    "followersCount": 101
  }
}
```

### 2. 언팔로우

**DELETE** `/follows/:userId`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isFollowing": false,
    "followersCount": 100
  }
}
```

### 3. 팔로워 목록

**GET** `/follows/:userId/followers`

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 20)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "followers": [
      {
        "id": "uuid",
        "username": "follower1",
        "profileImage": "https://...",
        "bio": "Developer",
        "isFollowing": false,
        "followedAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 100
    }
  }
}
```

### 4. 팔로잉 목록

**GET** `/follows/:userId/following`

**Response**: 팔로워 목록과 동일한 형식

---

## Bookmarks API

### 1. 북마크 추가

**POST** `/bookmarks/:postId`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isBookmarked": true,
    "bookmarkId": "uuid"
  }
}
```

### 2. 북마크 제거

**DELETE** `/bookmarks/:postId`

**Authentication**: Required

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "isBookmarked": false
  }
}
```

### 3. 내 북마크 목록

**GET** `/bookmarks`

**Authentication**: Required

**Query Parameters**
```
page: number (default: 1)
limit: number (default: 20)
```

**Response (200 OK)**
```json
{
  "statusCode": 200,
  "data": {
    "bookmarks": [
      {
        "id": "uuid",
        "post": {
          "id": "uuid",
          "title": "Understanding TypeScript",
          "slug": "understanding-typescript-abc123",
          "excerpt": "TypeScript basics...",
          "thumbnail": "https://...",
          "author": {
            "username": "johndoe"
          },
          "publishedAt": "2025-01-13T10:00:00Z"
        },
        "createdAt": "2025-01-13T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 55
    }
  }
}
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 204 | No Content | 성공 (응답 본문 없음) |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 실패 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 422 | Unprocessable Entity | 검증 실패 |
| 429 | Too Many Requests | Rate Limit 초과 |
| 500 | Internal Server Error | 서버 오류 |

### 공통 에러 응답

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "errors": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ]
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Post not found"
}
```

**422 Unprocessable Entity**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be at least 3 characters"
    },
    {
      "field": "content",
      "message": "Content is required"
    }
  ]
}
```

**429 Too Many Requests**
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

**500 Internal Server Error**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Rate Limiting

API는 다중 시간대 Rate Limit을 적용합니다:

- **분당**: 3회
- **시간당**: 10회
- **하루**: 20회

제한을 초과하면 `429 Too Many Requests` 응답을 받습니다.

---

## Pagination

목록 조회 엔드포인트는 페이지네이션을 지원합니다:

**Query Parameters**
```
page: 페이지 번호 (1부터 시작)
limit: 페이지당 아이템 수 (기본값: 20, 최대: 100)
```

**Response**
```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 200,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## API 문서 (Swagger)

개발 환경에서 Swagger UI를 통해 인터랙티브 API 문서에 접근할 수 있습니다:

```
http://localhost:3000/api-docs
```

---

**마지막 업데이트**: 2025-01-13
