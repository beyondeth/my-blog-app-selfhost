import type { UnifiedFeedItem } from '@/services/api/feed.service';
import type { Blog, Post } from '@/types';
import { AuthProvider, UserRole } from '@/types';
import type { CommunityFlair, CommunityRoleType } from '@/types/community';

export interface FeedCommunityContext {
  slug: string;
  name?: string;
  iconUrl?: string;
  iconImageFit?: 'cover' | 'contain';
  flair?: CommunityFlair | null;
  authorRole?: CommunityRoleType;
  isPinned?: boolean;
  isLocked?: boolean;
  isNsfw?: boolean;
  isSpoiler?: boolean;
}

export interface AdaptedFeedItem {
  post: Post;
  postUrl: string;
  communityContext?: FeedCommunityContext;
}

const adaptationCache = new WeakMap<UnifiedFeedItem, AdaptedFeedItem>();

export function adaptUnifiedFeedItem(item: UnifiedFeedItem): AdaptedFeedItem {
  const cached = adaptationCache.get(item);
  if (cached) {
    return cached;
  }

  const images = extractImageSources(item);
  const likeCount = item.likeCount ?? item.upvoteCount ?? 0;
  const upvoteCount = item.upvoteCount ?? likeCount;
  const downvoteCount = item.downvoteCount ?? 0;

  const post: Post = {
    id: item.id,
    title: item.title,
    slug: item.slug,
    content: item.excerpt ?? '',
    excerpt: item.excerpt,
    thumbnail: item.thumbnail ?? images[0],
    youtubeVideoId: item.youtubeVideoId,
    images,
    thumbnailImageId: undefined,
    isPublished: true,
    status: 'published',
    isDeleted: false,
    viewCount: item.viewCount ?? 0,
    likeCount,
    upvoteCount,
    downvoteCount,
    score: item.score ?? upvoteCount - downvoteCount,
    commentCount: item.commentCount ?? 0,
    liked: item.userVote === 'upvote' || item.liked === true,
    userVote: item.userVote ?? (item.liked ? 'upvote' : null),
    bookmarked: false,
    tags: item.tags ?? [],
    category: item.category ?? (item.sourceType === 'blog' ? 'blog' : 'community'),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.createdAt,
    author: createPlaceholderAuthor(item),
    blog: buildBlogMeta(item),
    blogId: item.blog?.id,
    comments: [],
    likedBy: [],
    attachedFiles: [],
    qualityScore: null,
    isEditorPick: false,
    editorPickedAt: undefined,
  };

  const adapted: AdaptedFeedItem = {
    post,
    postUrl: getPostUrl(item),
    communityContext: buildCommunityContext(item),
  };

  adaptationCache.set(item, adapted);
  return adapted;
}

function createPlaceholderAuthor(item: UnifiedFeedItem): Post['author'] {
  return {
    id: item.author.id,
    email: `${item.author.id || item.author.username}@feed.local`,
    username: item.author.username,
    profileImage: item.author.profileImage,
    role: UserRole.USER,
    authProvider: AuthProvider.LOCAL,
    isEmailVerified: true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function buildBlogMeta(item: UnifiedFeedItem): Blog | undefined {
  if (!item.blog) {
    return undefined;
  }

  const slug = item.blog.alias || item.blog.slug;
  return {
    id: item.blog.id,
    slug,
    alias: item.blog.alias,
    name: item.blog.name || slug,
    description: '',
    thumbnailUrl: undefined,
    userId: item.author.id,
    owner: undefined,
    posts: undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function extractImageSources(item: UnifiedFeedItem): string[] {
  const urls = new Set<string>();
  if (Array.isArray(item.images)) {
    for (const url of item.images) {
      if (typeof url === 'string' && url.trim()) {
        urls.add(url.trim());
      }
    }
  }

  if (item.thumbnail) {
    urls.add(item.thumbnail);
  }

  return Array.from(urls);
}

function buildCommunityContext(item: UnifiedFeedItem): FeedCommunityContext | undefined {
  if (item.sourceType !== 'community' || !item.community) {
    return undefined;
  }

  return {
    slug: item.community.slug,
    name: item.community.name,
    iconUrl: item.community.iconUrl,
    iconImageFit: item.community.iconImageFit,
    isPinned: item.isPinned,
    isNsfw: item.isNsfw,
    isSpoiler: item.isSpoiler,
  };
}

function getPostUrl(item: UnifiedFeedItem): string {
  if (item.sourceType === 'blog' && item.blog) {
    const blogSlug = item.blog.alias || item.blog.slug;
    return `/${blogSlug}/${item.slug}`;
  }

  if (item.sourceType === 'community' && item.community) {
    return `/c/${item.community.slug}/comments/${item.slug}`;
  }

  return '#';
}
