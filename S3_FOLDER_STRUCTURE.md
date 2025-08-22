# Amazon S3 Folder Structure Design for Multi-User Blog System

## 📁 S3 Bucket Structure Overview

```
your-blog-bucket/
├── v2/                                 # Version 2 migration root
│   ├── users/                         # User-related assets
│   │   ├── {userId}/                  # Individual user folder
│   │   │   ├── avatar/               # Profile avatars
│   │   │   │   ├── original/        # Original uploaded images
│   │   │   │   │   └── avatar_{timestamp}.{ext}
│   │   │   │   ├── thumb_200x200/   # Thumbnail versions
│   │   │   │   │   └── avatar_{timestamp}.webp
│   │   │   │   └── medium_400x400/  # Medium size for profile pages
│   │   │   │       └── avatar_{timestamp}.webp
│   │   │   │
│   │   │   └── cover/                # Profile cover images
│   │   │       ├── original/
│   │   │       │   └── cover_{timestamp}.{ext}
│   │   │       ├── desktop_1920x600/
│   │   │       │   └── cover_{timestamp}.webp
│   │   │       └── mobile_800x400/
│   │   │           └── cover_{timestamp}.webp
│   │   │
│   ├── blogs/                         # Blog-specific assets
│   │   ├── {blogId}/                  # Individual blog folder
│   │   │   ├── logo/                 # Blog logo/branding
│   │   │   │   ├── original/
│   │   │   │   │   └── logo_{timestamp}.{ext}
│   │   │   │   └── optimized/
│   │   │   │       └── logo_{timestamp}.svg
│   │   │   │
│   │   │   ├── posts/                # Blog post content
│   │   │   │   ├── {postId}/        # Individual post folder
│   │   │   │   │   ├── featured/    # Featured/hero image
│   │   │   │   │   │   ├── original/
│   │   │   │   │   │   │   └── featured_{timestamp}.{ext}
│   │   │   │   │   │   ├── large_1920x1080/
│   │   │   │   │   │   │   └── featured_{timestamp}.webp
│   │   │   │   │   │   ├── medium_1200x630/  # Social media sharing
│   │   │   │   │   │   │   └── featured_{timestamp}.webp
│   │   │   │   │   │   └── thumb_400x300/
│   │   │   │   │   │       └── featured_{timestamp}.webp
│   │   │   │   │   │
│   │   │   │   │   └── content/     # In-post images
│   │   │   │   │       ├── original/
│   │   │   │   │       │   └── img_{index}_{timestamp}.{ext}
│   │   │   │   │       ├── full_1920w/
│   │   │   │   │       │   └── img_{index}_{timestamp}.webp
│   │   │   │   │       ├── medium_1200w/
│   │   │   │   │       │   └── img_{index}_{timestamp}.webp
│   │   │   │   │       └── small_600w/
│   │   │   │   │           └── img_{index}_{timestamp}.webp
│   │   │   │   │
│   │   │   └── media/                # Blog media library
│   │   │       ├── images/
│   │   │       │   └── {year}/{month}/
│   │   │       │       └── media_{timestamp}.{ext}
│   │   │       ├── videos/
│   │   │       │   └── {year}/{month}/
│   │   │       │       └── video_{timestamp}.{ext}
│   │   │       └── documents/
│   │   │           └── {year}/{month}/
│   │   │               └── doc_{timestamp}.{ext}
│   │   │
│   ├── comments/                      # Comment attachments
│   │   └── {commentId}/
│   │       └── attachments/
│   │           └── attach_{timestamp}.{ext}
│   │
│   ├── temp/                          # Temporary uploads (auto-cleanup after 24h)
│   │   └── {sessionId}/
│   │       └── temp_{timestamp}.{ext}
│   │
│   └── system/                        # System assets
│       ├── defaults/                 # Default images
│       │   ├── avatar_default.svg
│       │   ├── blog_cover_default.jpg
│       │   └── post_featured_default.jpg
│       └── email/                     # Email templates assets
│           └── templates/
│               └── {templateName}/
│                   └── assets/
```

## 📋 Folder Structure Details

### 1. User Assets (`v2/users/{userId}/`)

#### Avatar Images
- **Path**: `v2/users/{userId}/avatar/`
- **Naming**: `avatar_{timestamp}.{ext}`
- **Sizes**:
  - `original/`: Original upload (max 5MB)
  - `thumb_200x200/`: Small thumbnail for comments, lists
  - `medium_400x400/`: Profile page display
- **Format**: WebP for optimized versions, original format preserved
- **Example**:
  ```
  v2/users/550e8400-e29b-41d4-a716-446655440000/avatar/
    original/avatar_1704067200000.jpg
    thumb_200x200/avatar_1704067200000.webp
    medium_400x400/avatar_1704067200000.webp
  ```

#### Cover Images
- **Path**: `v2/users/{userId}/cover/`
- **Naming**: `cover_{timestamp}.{ext}`
- **Sizes**:
  - `desktop_1920x600/`: Desktop viewport
  - `mobile_800x400/`: Mobile viewport
- **Example**:
  ```
  v2/users/550e8400-e29b-41d4-a716-446655440000/cover/
    original/cover_1704067200000.jpg
    desktop_1920x600/cover_1704067200000.webp
    mobile_800x400/cover_1704067200000.webp
  ```

### 2. Blog Post Images (`v2/blogs/{blogId}/posts/{postId}/`)

#### Featured Images
- **Path**: `v2/blogs/{blogId}/posts/{postId}/featured/`
- **Purpose**: Hero image for post cards and social sharing
- **Sizes**:
  - `large_1920x1080/`: Full article header
  - `medium_1200x630/`: Open Graph/Twitter Card (recommended)
  - `thumb_400x300/`: List views and cards
- **Example**:
  ```
  v2/blogs/blog-123/posts/post-456/featured/
    original/featured_1704067200000.png
    large_1920x1080/featured_1704067200000.webp
    medium_1200x630/featured_1704067200000.webp
    thumb_400x300/featured_1704067200000.webp
  ```

#### Content Images
- **Path**: `v2/blogs/{blogId}/posts/{postId}/content/`
- **Purpose**: Images embedded within post content
- **Responsive Sizes**:
  - `full_1920w/`: Desktop full width
  - `medium_1200w/`: Tablet and smaller desktop
  - `small_600w/`: Mobile devices
- **Example**:
  ```
  v2/blogs/blog-123/posts/post-456/content/
    original/img_1_1704067200000.jpg
    full_1920w/img_1_1704067200000.webp
    medium_1200w/img_1_1704067200000.webp
    small_600w/img_1_1704067200000.webp
  ```

### 3. Media Library (`v2/blogs/{blogId}/media/`)

- **Purpose**: Reusable media assets for the blog
- **Organization**: By type and date (year/month)
- **Example**:
  ```
  v2/blogs/blog-123/media/
    images/2024/01/media_1704067200000.jpg
    videos/2024/01/video_1704067200000.mp4
    documents/2024/01/doc_1704067200000.pdf
  ```

## 🔧 Implementation Guidelines

### File Naming Convention
```
{type}_{identifier}_{timestamp}.{extension}

Examples:
- avatar_1704067200000.jpg
- featured_1704067200000.png
- img_1_1704067200000.jpg
- media_1704067200000.pdf
```

### Image Processing Pipeline

1. **Upload Stage**
   ```
   Client → API → Temp Storage → Process → Final Storage
   ```

2. **Processing Steps**
   - Validate file type and size
   - Generate unique filename with timestamp
   - Create responsive versions
   - Convert to WebP for web delivery
   - Upload to appropriate S3 folder
   - Clean up temp files

3. **CDN URL Structure**
   ```
   https://cdn.yourdomain.com/v2/users/{userId}/avatar/thumb_200x200/avatar_1704067200000.webp
   ```

## 🔒 Security Considerations

### Access Control
```javascript
// S3 Bucket Policy Example
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-blog-bucket/v2/*/public/*"
    },
    {
      "Sid": "PrivateUserContent",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::your-blog-bucket/v2/users/*/private/*"
    }
  ]
}
```

### File Validation
- **Allowed Types**: jpg, jpeg, png, gif, webp, svg (images); mp4, webm (videos); pdf, doc, docx (documents)
- **Max Sizes**: 
  - Avatar: 5MB
  - Post images: 10MB
  - Videos: 100MB
  - Documents: 20MB

## 📊 Migration from v1 to v2

### Migration Path
```
Old Structure (v1):              New Structure (v2):
/uploads/                   →    /v2/blogs/{blogId}/media/
/users/{id}/profile.jpg     →    /v2/users/{userId}/avatar/
/posts/{id}/images/         →    /v2/blogs/{blogId}/posts/{postId}/content/
```

### Migration Script Example
```javascript
// Pseudo-code for migration
async function migrateToV2() {
  // 1. List all v1 objects
  const v1Objects = await s3.listObjectsV2({
    Bucket: 'your-blog-bucket',
    Prefix: 'uploads/'
  });

  // 2. Process each object
  for (const object of v1Objects) {
    const newKey = mapV1ToV2Path(object.Key);
    
    // 3. Copy to new location
    await s3.copyObject({
      Bucket: 'your-blog-bucket',
      CopySource: `your-blog-bucket/${object.Key}`,
      Key: newKey
    });
    
    // 4. Generate responsive versions
    await processImage(newKey);
  }
  
  // 5. Update database references
  await updateDatabaseUrls();
}
```

## 🚀 Benefits of This Structure

1. **Scalability**: Organized by entity (user/blog/post) for easy scaling
2. **Performance**: Multiple image sizes for responsive delivery
3. **SEO**: Proper image sizing for social media sharing
4. **Maintenance**: Clear hierarchy for cleanup and management
5. **Cost Optimization**: WebP format reduces bandwidth costs
6. **Security**: Separation of public/private content
7. **Versioning**: v2 prefix allows for future migrations

## 📈 Usage Examples

### Upload Avatar
```javascript
// POST /api/v1/users/{userId}/avatar
const uploadAvatar = async (file) => {
  const userId = getCurrentUserId();
  const timestamp = Date.now();
  const key = `v2/users/${userId}/avatar/original/avatar_${timestamp}.jpg`;
  
  // Upload to S3
  await s3.upload({
    Bucket: 'your-blog-bucket',
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });
  
  // Generate thumbnails
  await generateThumbnails(key);
  
  return {
    original: `${CDN_URL}/${key}`,
    thumb: `${CDN_URL}/v2/users/${userId}/avatar/thumb_200x200/avatar_${timestamp}.webp`,
    medium: `${CDN_URL}/v2/users/${userId}/avatar/medium_400x400/avatar_${timestamp}.webp`
  };
};
```

### Upload Post Image
```javascript
// POST /api/v1/blogs/{blogId}/posts/{postId}/images
const uploadPostImage = async (file, blogId, postId, index) => {
  const timestamp = Date.now();
  const basePath = `v2/blogs/${blogId}/posts/${postId}/content`;
  const originalKey = `${basePath}/original/img_${index}_${timestamp}.jpg`;
  
  // Upload original
  await s3.upload({
    Bucket: 'your-blog-bucket',
    Key: originalKey,
    Body: file.buffer
  });
  
  // Generate responsive versions
  const sizes = await generateResponsiveImages(originalKey);
  
  return {
    srcset: [
      `${CDN_URL}/${basePath}/small_600w/img_${index}_${timestamp}.webp 600w`,
      `${CDN_URL}/${basePath}/medium_1200w/img_${index}_${timestamp}.webp 1200w`,
      `${CDN_URL}/${basePath}/full_1920w/img_${index}_${timestamp}.webp 1920w`
    ].join(', '),
    src: `${CDN_URL}/${basePath}/medium_1200w/img_${index}_${timestamp}.webp`
  };
};
```

## 🔄 Lifecycle Management

### S3 Lifecycle Rules
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

This structure provides a robust, scalable foundation for managing all image assets in your multi-user blog system.