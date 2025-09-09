# YouTube Video Display Debugging Guide

## Current Implementation Flow

### 1. Editor Input
When you paste a YouTube URL like `https://www.youtube.com/watch?v=Nn3cbL0RQ1w`:

1. **CustomYoutube extension** detects the URL
2. Creates a YouTube node in the editor
3. Fires `youtubeEmbedAdded` event
4. **addYouTubeThumbnail** function is called
5. Extracts video ID: `Nn3cbL0RQ1w`
6. Creates thumbnail URL: `https://img.youtube.com/vi/Nn3cbL0RQ1w/maxresdefault.jpg`
7. Adds to image gallery with ID: `yt_thumb_Nn3cbL0RQ1w`

### 2. Post Creation
When saving the post:

```javascript
// If YouTube thumbnail is selected
if (selectedThumbnailId.startsWith('yt_thumb_')) {
  // Saves YouTube thumbnail URL directly
  postData.thumbnail = 'https://img.youtube.com/vi/Nn3cbL0RQ1w/maxresdefault.jpg';
}
```

### 3. Home Screen Display
PostArticle component checks:

```javascript
// Pattern matching for YouTube thumbnails
/(?:https?:\/\/)?img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\/(?:maxresdefault|hqdefault|mqdefault|sddefault|default)\.jpg/
```

If matched → Shows Reddit-style video player

## How to Debug

### Step 1: Check Editor Console
When pasting YouTube URL, you should see:
```
[YouTube] 🎬 addYouTubeThumbnail 호출됨 - URL: https://www.youtube.com/watch?v=...
[YouTube] 추출된 비디오 ID: Nn3cbL0RQ1w
[YouTube] 새 썸네일 추가: yt_thumb_Nn3cbL0RQ1w
```

### Step 2: Check Post Creation Console
When saving post with YouTube thumbnail:
```
[NewPost] Setting YouTube thumbnail: https://img.youtube.com/vi/Nn3cbL0RQ1w/maxresdefault.jpg
[NewPost] YouTube video ID: Nn3cbL0RQ1w
```

### Step 3: Check Home Screen Console
When viewing the post:
```
[PostArticle] Post data: { thumbnail: 'https://img.youtube.com/vi/...' }
[PostArticle] ✅ YouTube video DETECTED!
[PostArticle] Video ID extracted: Nn3cbL0RQ1w
```

## Common Issues

### Issue 1: Thumbnail Not Added to Gallery
- Check if `enableImageManager` is true
- Check console for `[YouTube]` logs
- Verify YouTube URL is valid

### Issue 2: Thumbnail Not Selected
- Make sure to click on the YouTube thumbnail in the gallery
- Check if thumbnail ID starts with `yt_thumb_`

### Issue 3: Not Showing as Video on Home
- Check if `thumbnail` field contains YouTube URL
- Check console for `[PostArticle]` detection logs
- Verify URL matches YouTube patterns

## Test URLs
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Rick Roll)
- `https://youtu.be/dQw4w9WgXcQ` (Short format)
- `https://www.youtube.com/watch?v=Nn3cbL0RQ1w&t=10s` (With timestamp)