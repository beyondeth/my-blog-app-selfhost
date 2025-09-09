// Improved YouTube Handler for Post Creation
// This is a proposed solution for better YouTube video handling

interface PostData {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  thumbnail?: string;
  // New fields for YouTube handling
  mediaType?: 'youtube' | 'image' | 'none';
  youtubeVideoId?: string;
}

// When saving a post with YouTube thumbnail:
const preparePostData = (formData: any, selectedThumbnailId: string, images: any[]) => {
  const postData: PostData = {
    title: formData.title,
    content: formData.content,
    category: formData.category,
    tags: formData.tags,
  };

  if (selectedThumbnailId) {
    if (selectedThumbnailId.startsWith('yt_thumb_')) {
      // YouTube thumbnail
      const videoId = selectedThumbnailId.replace('yt_thumb_', '');
      const selectedImage = images.find(img => img.id === selectedThumbnailId);
      
      postData.thumbnail = selectedImage?.url || '';
      postData.mediaType = 'youtube';
      postData.youtubeVideoId = videoId; // Store video ID explicitly
    } else {
      // Regular image
      postData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
      postData.mediaType = 'image';
    }
  } else {
    postData.mediaType = 'none';
  }

  return postData;
};

// In PostArticle component, check for mediaType:
const PostArticleImproved = ({ post }: any) => {
  // Much simpler and more reliable check
  if (post.mediaType === 'youtube' && post.youtubeVideoId) {
    // Render YouTube player layout
    return <YouTubePostLayout videoId={post.youtubeVideoId} post={post} />;
  }
  
  // Render regular post layout
  return <RegularPostLayout post={post} />;
};