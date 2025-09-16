# S3 Upload Examples - Visual Guide

## 🎯 Real-World Upload Scenarios

### Scenario 1: User Updates Profile Picture

**User Action**: John (userId: `user-123`) uploads profile photo `selfie.jpg`

**What Happens**:
```
selfie.jpg (2MB) → Upload → Processing → S3 Storage

Generated Files:
📁 v2/users/user-123/avatar/
  📁 original/
    📄 avatar_1704067200000.jpg (2MB) ← Original file
  📁 thumb_200x200/
    📄 avatar_1704067200000.webp (15KB) ← For comments, user lists
  📁 medium_400x400/
    📄 avatar_1704067200000.webp (35KB) ← For profile page
```

**URLs Generated**:
- Thumbnail: `https://cdn.yourdomain.com/v2/users/user-123/avatar/thumb_200x200/avatar_1704067200000.webp`
- Profile: `https://cdn.yourdomain.com/v2/users/user-123/avatar/medium_400x400/avatar_1704067200000.webp`

**Where It's Used**:
- Comments section: Uses `thumb_200x200`
- User profile page: Uses `medium_400x400`
- User settings: Shows `medium_400x400`

---

### Scenario 2: Blog Post with Featured Image

**User Action**: Sarah writes blog post "React Best Practices" and adds hero image

**Blog Info**:
- Blog ID: `tech-blog`
- Post ID: `post-react-best-practices`
- Upload: `react-hero.png`

**What Happens**:
```
react-hero.png (5MB) → Upload → Processing → S3 Storage

Generated Files:
📁 v2/blogs/tech-blog/posts/post-react-best-practices/featured/
  📁 original/
    📄 featured_1704067300000.png (5MB)
  📁 large_1920x1080/
    📄 featured_1704067300000.webp (250KB) ← Article header
  📁 medium_1200x630/
    📄 featured_1704067300000.webp (120KB) ← Social media cards
  📁 thumb_400x300/
    📄 featured_1704067300000.webp (25KB) ← Blog post lists
```

**Where It's Used**:
- Blog homepage card: `thumb_400x300`
- Article header: `large_1920x1080`
- Twitter/Facebook share: `medium_1200x630` (Open Graph)
- RSS feed: `thumb_400x300`

---

### Scenario 3: Multiple Images in Post Content

**User Action**: Mike inserts 3 screenshots in his tutorial post

**Post**: "Setting up Docker" (postId: `post-docker-setup`)

**What Happens for Each Image**:
```
Image 1: docker-install.png
Image 2: docker-compose.png  
Image 3: docker-running.png

Each generates:
📁 v2/blogs/dev-blog/posts/post-docker-setup/content/
  📁 original/
    📄 img_1_1704067400000.png (800KB)
    📄 img_2_1704067401000.png (600KB)
    📄 img_3_1704067402000.png (700KB)
  📁 full_1920w/
    📄 img_1_1704067400000.webp (180KB)
    📄 img_2_1704067401000.webp (140KB)
    📄 img_3_1704067402000.webp (160KB)
  📁 medium_1200w/
    📄 img_1_1704067400000.webp (120KB)
    📄 img_2_1704067401000.webp (95KB)
    📄 img_3_1704067402000.webp (110KB)
  📁 small_600w/
    📄 img_1_1704067400000.webp (45KB)
    📄 img_2_1704067401000.webp (38KB)
    📄 img_3_1704067402000.webp (42KB)
```

**HTML Output in Post**:
```html
<img 
  src="https://cdn.yourdomain.com/v2/blogs/dev-blog/posts/post-docker-setup/content/medium_1200w/img_1_1704067400000.webp"
  srcset="
    https://cdn.yourdomain.com/v2/blogs/dev-blog/posts/post-docker-setup/content/small_600w/img_1_1704067400000.webp 600w,
    https://cdn.yourdomain.com/v2/blogs/dev-blog/posts/post-docker-setup/content/medium_1200w/img_1_1704067400000.webp 1200w,
    https://cdn.yourdomain.com/v2/blogs/dev-blog/posts/post-docker-setup/content/full_1920w/img_1_1704067400000.webp 1920w"
  sizes="(max-width: 600px) 600px, (max-width: 1200px) 1200px, 1920px"
  alt="Docker installation screenshot"
/>
```

---

### Scenario 4: Blog Cover/Banner Image

**User Action**: Emma sets a cover image for her blog profile

**Blog**: `food-blog`

**What Happens**:
```
blog-banner.jpg (3MB) → Upload → Processing → S3 Storage

Generated Files:
📁 v2/users/user-emma/cover/
  📁 original/
    📄 cover_1704067500000.jpg (3MB)
  📁 desktop_1920x600/
    📄 cover_1704067500000.webp (180KB) ← Desktop view
  📁 mobile_800x400/
    📄 cover_1704067500000.webp (65KB) ← Mobile view
```

---

## 📊 Storage Summary by User Activity

### For a Typical Active Blogger:

```
User: Jane Doe (user-456)
Blog: jane-tech-blog

After 6 months of blogging:
📁 v2/
  📁 users/user-456/
    📁 avatar/           (3 versions × 1 upload = 3 files)
    📁 cover/            (2 versions × 1 upload = 2 files)
  
  📁 blogs/jane-tech-blog/
    📁 posts/            (20 posts)
      📁 post-001/
        📁 featured/     (3 versions = 3 files)
        📁 content/      (3 versions × 5 images = 15 files)
      📁 post-002/
        📁 featured/     (3 versions = 3 files)
        📁 content/      (3 versions × 3 images = 9 files)
      ... (18 more posts)
    
    📁 media/           (Reusable assets)
      📁 images/2024/
        📁 01/          (10 files)
        📁 02/          (15 files)
        📁 03/          (12 files)

Total: ~500 files, ~200MB storage
```

---

## 🚀 Migration Example: Moving from Old Structure

### Before (v1 - Flat Structure):
```
/uploads/
  user-123-avatar.jpg
  user-123-cover.jpg
  post-456-image-1.jpg
  post-456-image-2.jpg
  post-789-featured.jpg
  blog-logo.png
  random-upload-1234.jpg
  temp-file-5678.png
```

### After (v2 - Organized Structure):
```
/v2/
  users/
    user-123/
      avatar/
        original/avatar_1704067200000.jpg
        thumb_200x200/avatar_1704067200000.webp
        medium_400x400/avatar_1704067200000.webp
      cover/
        original/cover_1704067300000.jpg
        desktop_1920x600/cover_1704067300000.webp
        mobile_800x400/cover_1704067300000.webp
  
  blogs/
    blog-abc/
      logo/
        original/logo_1704067400000.png
        optimized/logo_1704067400000.svg
      posts/
        post-456/
          content/
            original/img_1_1704067500000.jpg
            original/img_2_1704067600000.jpg
            [responsive versions...]
        post-789/
          featured/
            original/featured_1704067700000.jpg
            [multiple sizes...]
```

---

## 💡 Quick Reference: File Naming Pattern

```
{type}_{timestamp}.{extension}

Where:
- type: avatar, cover, featured, img_1, img_2, media, logo
- timestamp: Unix timestamp in milliseconds (e.g., 1704067200000)
- extension: webp for optimized, original extension for originals

Examples:
✅ avatar_1704067200000.webp
✅ featured_1704067300000.webp
✅ img_3_1704067400000.webp
✅ media_1704067500000.jpg
```

---

## 🎨 Image Size Reference

| Image Type | Size | Dimensions | Use Case | File Size |
|------------|------|------------|----------|-----------|
| **Avatar** |
| Original | - | As uploaded | Storage only | 1-5 MB |
| Thumbnail | Small | 200×200 | Comments, lists | ~15 KB |
| Medium | Medium | 400×400 | Profile pages | ~35 KB |
| **Featured Image** |
| Original | - | As uploaded | Storage only | 2-10 MB |
| Large | Full | 1920×1080 | Article header | ~250 KB |
| Social | Medium | 1200×630 | OG/Twitter cards | ~120 KB |
| Thumbnail | Small | 400×300 | Post lists | ~25 KB |
| **Content Images** |
| Original | - | As uploaded | Storage only | 1-10 MB |
| Desktop | Full | 1920px wide | Large screens | ~180 KB |
| Tablet | Medium | 1200px wide | Medium screens | ~120 KB |
| Mobile | Small | 600px wide | Small screens | ~45 KB |
| **Cover Images** |
| Original | - | As uploaded | Storage only | 2-8 MB |
| Desktop | Wide | 1920×600 | Desktop view | ~180 KB |
| Mobile | Medium | 800×400 | Mobile view | ~65 KB |

---

## 🔗 CDN URL Examples

### Development Environment:
```
http://localhost:9000/minio/blog-bucket/v2/users/user-123/avatar/thumb_200x200/avatar_1704067200000.webp
```

### Production Environment:
```
https://cdn.myblog.com/v2/users/user-123/avatar/thumb_200x200/avatar_1704067200000.webp
```

### With CloudFront:
```
https://d1234abcd.cloudfront.net/v2/users/user-123/avatar/thumb_200x200/avatar_1704067200000.webp
```

This visual guide shows exactly how files are organized when users perform common upload actions in your blog system.