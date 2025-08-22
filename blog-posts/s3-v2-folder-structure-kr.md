# 멀티유저 블로그 시스템을 위한 Amazon S3 v2 폴더 구조 설계

## 🎯 개요

멀티유저 블로그 시스템의 이미지 업로드를 위한 체계적인 S3 폴더 구조를 설계했습니다. v2 마이그레이션을 통해 더욱 효율적이고 확장 가능한 구조로 개선했습니다.

## 📁 S3 버킷 구조 전체 보기

```
your-blog-bucket/
├── v2/                                 # 버전 2 마이그레이션 루트
│   ├── users/                         # 사용자 관련 자산
│   │   ├── {userId}/                  # 개별 사용자 폴더
│   │   │   ├── avatar/               # 프로필 아바타
│   │   │   │   ├── original/        # 원본 이미지
│   │   │   │   ├── thumb_200x200/   # 썸네일 (댓글, 목록용)
│   │   │   │   └── medium_400x400/  # 중간 크기 (프로필 페이지용)
│   │   │   └── cover/                # 프로필 커버 이미지
│   │   │       ├── original/
│   │   │       ├── desktop_1920x600/ # 데스크톱용
│   │   │       └── mobile_800x400/   # 모바일용
│   │
│   ├── blogs/                         # 블로그별 자산
│   │   ├── {blogId}/
│   │   │   ├── posts/                # 블로그 포스트 콘텐츠
│   │   │   │   ├── {postId}/
│   │   │   │   │   ├── featured/    # 대표 이미지
│   │   │   │   │   │   ├── large_1920x1080/
│   │   │   │   │   │   ├── medium_1200x630/ # SNS 공유용
│   │   │   │   │   │   └── thumb_400x300/
│   │   │   │   │   └── content/     # 포스트 내 이미지
│   │   │   │   │       ├── full_1920w/
│   │   │   │   │       ├── medium_1200w/
│   │   │   │   │       └── small_600w/
│   │   │   └── media/                # 미디어 라이브러리
│   │   │       └── images/{year}/{month}/
```

## 🎯 주요 업로드 시나리오

### 1. 프로필 사진 업로드 시

사용자가 프로필 사진을 업로드하면 자동으로 3가지 크기로 변환됩니다:

```
원본 파일: selfie.jpg (2MB)
↓
생성되는 파일:
📁 v2/users/user-123/avatar/
  ├── original/avatar_1704067200000.jpg (2MB) - 원본 보관용
  ├── thumb_200x200/avatar_1704067200000.webp (15KB) - 댓글, 목록용
  └── medium_400x400/avatar_1704067200000.webp (35KB) - 프로필 페이지용
```

**실제 URL 예시:**
- 썸네일: `https://cdn.yourdomain.com/v2/users/user-123/avatar/thumb_200x200/avatar_1704067200000.webp`
- 프로필: `https://cdn.yourdomain.com/v2/users/user-123/avatar/medium_400x400/avatar_1704067200000.webp`

### 2. 블로그 포스트 대표 이미지

포스트 작성 시 대표 이미지를 설정하면:

```
📁 v2/blogs/tech-blog/posts/react-guide/featured/
  ├── original/featured_1704067300000.png (5MB)
  ├── large_1920x1080/featured_1704067300000.webp (250KB) - 포스트 헤더
  ├── medium_1200x630/featured_1704067300000.webp (120KB) - SNS 공유용
  └── thumb_400x300/featured_1704067300000.webp (25KB) - 목록 썸네일
```

### 3. 포스트 내용 이미지

포스트 작성 중 이미지를 삽입하면 반응형 이미지로 자동 변환:

```
📁 v2/blogs/dev-blog/posts/docker-setup/content/
  ├── original/img_1_1704067400000.png (800KB)
  ├── full_1920w/img_1_1704067400000.webp (180KB) - 데스크톱
  ├── medium_1200w/img_1_1704067400000.webp (120KB) - 태블릿
  └── small_600w/img_1_1704067400000.webp (45KB) - 모바일
```

**HTML 출력 예시:**
```html
<img 
  src="https://cdn.../medium_1200w/img_1_1704067400000.webp"
  srcset="
    https://cdn.../small_600w/img_1_1704067400000.webp 600w,
    https://cdn.../medium_1200w/img_1_1704067400000.webp 1200w,
    https://cdn.../full_1920w/img_1_1704067400000.webp 1920w"
  sizes="(max-width: 600px) 600px, (max-width: 1200px) 1200px, 1920px"
  alt="도커 설치 스크린샷"
/>
```

## 💡 핵심 특징

### 이미지 크기 참조표

| 이미지 타입 | 용도 | 크기 | 예상 파일 크기 |
|------------|------|------|---------------|
| **아바타** |
| 썸네일 | 댓글, 목록 | 200×200 | ~15KB |
| 중간 | 프로필 페이지 | 400×400 | ~35KB |
| **대표 이미지** |
| 대형 | 포스트 헤더 | 1920×1080 | ~250KB |
| 소셜 | SNS 공유 | 1200×630 | ~120KB |
| 썸네일 | 포스트 목록 | 400×300 | ~25KB |
| **콘텐츠 이미지** |
| 데스크톱 | 큰 화면 | 1920px 너비 | ~180KB |
| 태블릿 | 중간 화면 | 1200px 너비 | ~120KB |
| 모바일 | 작은 화면 | 600px 너비 | ~45KB |

### 파일 명명 규칙

```
{타입}_{타임스탬프}.{확장자}

예시:
✅ avatar_1704067200000.webp
✅ featured_1704067300000.webp
✅ img_3_1704067400000.webp
✅ media_1704067500000.jpg
```

## 🚀 구현 예시 (NestJS)

### 아바타 업로드 서비스

```typescript
@Injectable()
export class UploadService {
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const timestamp = Date.now();
    const basePath = `v2/users/${userId}/avatar`;
    
    // 원본 업로드
    const originalKey = `${basePath}/original/avatar_${timestamp}.jpg`;
    await this.uploadToS3(originalKey, file.buffer, file.mimetype);

    // 썸네일 생성 및 업로드
    await Promise.all([
      this.resizeAndUpload(file.buffer, `${basePath}/thumb_200x200/avatar_${timestamp}.webp`, 200, 200),
      this.resizeAndUpload(file.buffer, `${basePath}/medium_400x400/avatar_${timestamp}.webp`, 400, 400),
    ]);

    return {
      original: `${CDN_URL}/${originalKey}`,
      thumb: `${CDN_URL}/${basePath}/thumb_200x200/avatar_${timestamp}.webp`,
      medium: `${CDN_URL}/${basePath}/medium_400x400/avatar_${timestamp}.webp`,
    };
  }
}
```

### React 컴포넌트 예시

```tsx
export function AvatarUpload({ userId }: { userId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const { mutate: uploadAvatar, isLoading } = useUploadAvatar();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 미리보기
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // 업로드
    const formData = new FormData();
    formData.append('avatar', file);
    uploadAvatar(formData);
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="미리보기" />}
    </div>
  );
}
```

## 📊 6개월 후 예상 저장 용량

활발한 블로거 한 명 기준:
- 프로필 이미지: 5 파일
- 블로그 포스트: 20개
- 포스트당 이미지: 평균 5개
- 미디어 라이브러리: 50개

**총 예상 용량: ~500개 파일, ~200MB**

## 🔒 보안 고려사항

### S3 버킷 정책 예시

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-blog-bucket/v2/*/public/*"
    },
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::your-blog-bucket/v2/users/*/private/*"
    }
  ]
}
```

### 파일 검증
- **허용 타입**: jpg, jpeg, png, gif, webp, svg
- **최대 크기**: 
  - 아바타: 5MB
  - 포스트 이미지: 10MB
  - 비디오: 100MB

## 🔄 S3 라이프사이클 관리

```json
{
  "Rules": [
    {
      "Id": "DeleteTempFiles",
      "Status": "Enabled",
      "Prefix": "v2/temp/",
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "MoveOldMediaToGlacier",
      "Status": "Enabled",
      "Prefix": "v2/blogs/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "INTELLIGENT_TIERING"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

## 🎯 이 구조의 장점

1. **확장성**: 엔티티별(사용자/블로그/포스트) 구조로 쉬운 확장
2. **성능**: 반응형 이미지로 빠른 로딩
3. **SEO**: 소셜 미디어 공유를 위한 적절한 이미지 크기
4. **유지보수**: 명확한 계층 구조로 관리 용이
5. **비용 최적화**: WebP 포맷으로 대역폭 30-50% 절감
6. **보안**: 공개/비공개 콘텐츠 분리
7. **버전 관리**: v2 프리픽스로 향후 마이그레이션 대비

## 🔧 환경 변수 설정

```bash
# .env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2  # 서울 리전
AWS_S3_BUCKET=your-blog-bucket
CDN_URL=https://cdn.yourdomain.com

# 이미지 처리
MAX_IMAGE_SIZE=10485760  # 10MB
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp
AVATAR_MAX_SIZE=5242880   # 5MB
```

이 구조는 멀티유저 블로그 시스템의 모든 이미지 자산을 체계적으로 관리할 수 있는 강력하고 확장 가능한 기반을 제공합니다. v2 마이그레이션을 통해 더욱 효율적이고 유지보수가 용이한 시스템으로 발전했습니다.