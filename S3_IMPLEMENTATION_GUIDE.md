# S3 Upload Implementation Guide

## 🚀 Quick Reference: Upload Paths by Feature

### 1. User Profile Avatar Upload
```
When user uploads profile picture:
→ Original: v2/users/{userId}/avatar/original/avatar_1704067200000.jpg
→ Thumb:    v2/users/{userId}/avatar/thumb_200x200/avatar_1704067200000.webp
→ Medium:   v2/users/{userId}/avatar/medium_400x400/avatar_1704067200000.webp

Example for user "550e8400-e29b-41d4-a716-446655440000":
v2/users/550e8400-e29b-41d4-a716-446655440000/avatar/thumb_200x200/avatar_1704067200000.webp
```

### 2. Blog Post Featured Image
```
When user adds featured image to post:
→ Original: v2/blogs/{blogId}/posts/{postId}/featured/original/featured_1704067200000.jpg
→ Large:    v2/blogs/{blogId}/posts/{postId}/featured/large_1920x1080/featured_1704067200000.webp
→ Social:   v2/blogs/{blogId}/posts/{postId}/featured/medium_1200x630/featured_1704067200000.webp
→ Thumb:    v2/blogs/{blogId}/posts/{postId}/featured/thumb_400x300/featured_1704067200000.webp

Example for blog "tech-blog" post "react-hooks-guide":
v2/blogs/tech-blog/posts/react-hooks-guide/featured/medium_1200x630/featured_1704067200000.webp
```

### 3. In-Post Content Images
```
When user inserts image in post content:
→ Original: v2/blogs/{blogId}/posts/{postId}/content/original/img_1_1704067200000.jpg
→ Desktop:  v2/blogs/{blogId}/posts/{postId}/content/full_1920w/img_1_1704067200000.webp
→ Tablet:   v2/blogs/{blogId}/posts/{postId}/content/medium_1200w/img_1_1704067200000.webp
→ Mobile:   v2/blogs/{blogId}/posts/{postId}/content/small_600w/img_1_1704067200000.webp

Example for 3rd image in post:
v2/blogs/tech-blog/posts/react-hooks-guide/content/medium_1200w/img_3_1704067200000.webp
```

## 📝 NestJS Service Implementation

### Upload Service (upload.service.ts)
```typescript
import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3: AWS.S3;
  private bucketName = process.env.AWS_S3_BUCKET;
  private cdnUrl = process.env.CDN_URL;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  /**
   * Upload user avatar with automatic resizing
   */
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const timestamp = Date.now();
    const basePath = `v2/users/${userId}/avatar`;
    
    // Upload original
    const originalKey = `${basePath}/original/avatar_${timestamp}.${this.getExtension(file)}`;
    await this.uploadToS3(originalKey, file.buffer, file.mimetype);

    // Generate and upload thumbnails
    const thumbnails = await Promise.all([
      this.resizeAndUpload(file.buffer, `${basePath}/thumb_200x200/avatar_${timestamp}.webp`, 200, 200),
      this.resizeAndUpload(file.buffer, `${basePath}/medium_400x400/avatar_${timestamp}.webp`, 400, 400),
    ]);

    return {
      original: `${this.cdnUrl}/${originalKey}`,
      thumb: `${this.cdnUrl}/${basePath}/thumb_200x200/avatar_${timestamp}.webp`,
      medium: `${this.cdnUrl}/${basePath}/medium_400x400/avatar_${timestamp}.webp`,
    };
  }

  /**
   * Upload post featured image with multiple sizes
   */
  async uploadPostFeaturedImage(
    blogId: string, 
    postId: string, 
    file: Express.Multer.File
  ) {
    const timestamp = Date.now();
    const basePath = `v2/blogs/${blogId}/posts/${postId}/featured`;
    
    // Upload original
    const originalKey = `${basePath}/original/featured_${timestamp}.${this.getExtension(file)}`;
    await this.uploadToS3(originalKey, file.buffer, file.mimetype);

    // Generate responsive versions
    const versions = await Promise.all([
      this.resizeAndUpload(file.buffer, `${basePath}/large_1920x1080/featured_${timestamp}.webp`, 1920, 1080),
      this.resizeAndUpload(file.buffer, `${basePath}/medium_1200x630/featured_${timestamp}.webp`, 1200, 630),
      this.resizeAndUpload(file.buffer, `${basePath}/thumb_400x300/featured_${timestamp}.webp`, 400, 300),
    ]);

    return {
      original: `${this.cdnUrl}/${originalKey}`,
      large: `${this.cdnUrl}/${basePath}/large_1920x1080/featured_${timestamp}.webp`,
      medium: `${this.cdnUrl}/${basePath}/medium_1200x630/featured_${timestamp}.webp`,
      thumb: `${this.cdnUrl}/${basePath}/thumb_400x300/featured_${timestamp}.webp`,
      // For Open Graph meta tags
      ogImage: `${this.cdnUrl}/${basePath}/medium_1200x630/featured_${timestamp}.webp`,
    };
  }

  /**
   * Upload content image for post with responsive versions
   */
  async uploadPostContentImage(
    blogId: string,
    postId: string,
    file: Express.Multer.File,
    index: number
  ) {
    const timestamp = Date.now();
    const basePath = `v2/blogs/${blogId}/posts/${postId}/content`;
    
    // Upload original
    const originalKey = `${basePath}/original/img_${index}_${timestamp}.${this.getExtension(file)}`;
    await this.uploadToS3(originalKey, file.buffer, file.mimetype);

    // Generate responsive versions
    await Promise.all([
      this.resizeAndUpload(file.buffer, `${basePath}/full_1920w/img_${index}_${timestamp}.webp`, 1920),
      this.resizeAndUpload(file.buffer, `${basePath}/medium_1200w/img_${index}_${timestamp}.webp`, 1200),
      this.resizeAndUpload(file.buffer, `${basePath}/small_600w/img_${index}_${timestamp}.webp`, 600),
    ]);

    // Return srcset for responsive images
    return {
      src: `${this.cdnUrl}/${basePath}/medium_1200w/img_${index}_${timestamp}.webp`,
      srcset: [
        `${this.cdnUrl}/${basePath}/small_600w/img_${index}_${timestamp}.webp 600w`,
        `${this.cdnUrl}/${basePath}/medium_1200w/img_${index}_${timestamp}.webp 1200w`,
        `${this.cdnUrl}/${basePath}/full_1920w/img_${index}_${timestamp}.webp 1920w`,
      ].join(', '),
      sizes: '(max-width: 600px) 600px, (max-width: 1200px) 1200px, 1920px',
    };
  }

  /**
   * Upload to media library for reusable assets
   */
  async uploadToMediaLibrary(
    blogId: string,
    file: Express.Multer.File,
    type: 'images' | 'videos' | 'documents'
  ) {
    const timestamp = Date.now();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const key = `v2/blogs/${blogId}/media/${type}/${year}/${month}/media_${timestamp}.${this.getExtension(file)}`;
    
    await this.uploadToS3(key, file.buffer, file.mimetype);
    
    return {
      url: `${this.cdnUrl}/${key}`,
      key: key,
      type: type,
      uploadedAt: date.toISOString(),
    };
  }

  /**
   * Helper: Resize image and upload to S3
   */
  private async resizeAndUpload(
    buffer: Buffer,
    key: string,
    width: number,
    height?: number
  ): Promise<void> {
    const resized = await sharp(buffer)
      .resize(width, height, {
        fit: height ? 'cover' : 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    await this.uploadToS3(key, resized, 'image/webp');
  }

  /**
   * Helper: Upload to S3
   */
  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    await this.s3.upload({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year cache
    }).promise();
  }

  /**
   * Helper: Get file extension
   */
  private getExtension(file: Express.Multer.File): string {
    return file.originalname.split('.').pop().toLowerCase();
  }
}
```

## 🎯 Frontend Usage Examples

### React Component for Avatar Upload
```tsx
// components/AvatarUpload.tsx
import { useState } from 'react';
import { useUploadAvatar } from '@/hooks/useUpload';

export function AvatarUpload({ userId }: { userId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const { mutate: uploadAvatar, isLoading } = useUploadAvatar();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append('avatar', file);

    uploadAvatar(formData, {
      onSuccess: (data) => {
        console.log('Avatar uploaded:', data);
        // data.thumb for small display
        // data.medium for profile page
      },
    });
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange}
        disabled={isLoading}
      />
      {preview && <img src={preview} alt="Preview" />}
    </div>
  );
}
```

### Markdown Editor with Image Upload
```tsx
// components/MarkdownEditor.tsx
import { useCallback } from 'react';
import { useUploadPostImage } from '@/hooks/useUpload';

export function MarkdownEditor({ blogId, postId }: Props) {
  const { mutate: uploadImage } = useUploadPostImage();
  
  const handleImagePaste = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('blogId', blogId);
    formData.append('postId', postId);

    uploadImage(formData, {
      onSuccess: (data) => {
        // Insert responsive image markdown
        const markdown = `
![Image description](${data.src})
{.responsive srcset="${data.srcset}" sizes="${data.sizes}"}
        `;
        // Insert at cursor position
        insertAtCursor(markdown);
      },
    });
  }, [blogId, postId]);

  return (
    // Editor implementation
  );
}
```

## 🔐 Environment Variables

```bash
# .env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-blog-bucket
CDN_URL=https://cdn.yourdomain.com

# Image processing
MAX_IMAGE_SIZE=10485760  # 10MB
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp
AVATAR_MAX_SIZE=5242880   # 5MB
```

## 📊 Database Schema for Image References

```sql
-- Users table
ALTER TABLE users ADD COLUMN avatar_urls JSONB DEFAULT '{}';
-- Example: {"thumb": "...", "medium": "...", "original": "..."}

-- Posts table  
ALTER TABLE posts ADD COLUMN featured_image_urls JSONB DEFAULT '{}';
-- Example: {"thumb": "...", "medium": "...", "large": "...", "ogImage": "..."}

-- Post content images
CREATE TABLE post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  image_index INTEGER NOT NULL,
  urls JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🧹 Cleanup and Migration Scripts

### Clean Orphaned Images
```typescript
async function cleanOrphanedImages() {
  // 1. List all S3 objects
  const s3Objects = await listAllS3Objects('v2/');
  
  // 2. Get all referenced URLs from database
  const referencedUrls = await getAllReferencedImageUrls();
  
  // 3. Find orphaned objects
  const orphaned = s3Objects.filter(obj => 
    !referencedUrls.includes(obj.Key)
  );
  
  // 4. Delete orphaned objects older than 30 days
  for (const obj of orphaned) {
    if (daysSince(obj.LastModified) > 30) {
      await s3.deleteObject({
        Bucket: bucketName,
        Key: obj.Key
      }).promise();
    }
  }
}
```

This implementation provides a complete, production-ready solution for handling all image uploads in your multi-user blog system with proper organization, optimization, and scalability.