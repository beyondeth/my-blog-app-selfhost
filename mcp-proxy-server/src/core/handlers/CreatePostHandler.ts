import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import {
  buildBackendAuthHeaders,
  incrementPostsCreated,
  toPublicPostUrl,
} from './shared.js';

type VisibilityValue = 'public' | 'private';

type BackendCreatePostResponse = {
  id: string;
  slug: string;
  title: string;
  url?: string;
  blog?: {
    id?: string;
    name?: string;
    slug?: string;
    isPublic?: boolean;
  };
  isPublished?: boolean;
  visibility?: VisibilityValue | string;
  effectiveVisibility?: VisibilityValue | string;
  visibilityBlockedByBlogPrivacy?: boolean;
  _meta?: {
    processingTime?: number | string;
    status?: string;
  };
};

function normalizeVisibility(value: unknown): VisibilityValue | null {
  if (value === 'public' || value === 'private') {
    return value;
  }
  return null;
}

function normalizeProcessingTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * create_post 핸들러
 */
export async function handleCreatePost(
  args: {
    title: string;
    content_markdown: string;
    tags?: string[];
    category?: string;
    writingStyle?: string;
    visibility?: 'public' | 'private';
    sell?: boolean;
    price?: number;
    productCategory?: string;
  },
  context: ToolContext
): Promise<any> {
  try {
    const tags = args.tags ? args.tags.slice(0, 10) : [];
    const isSell = args.sell === true;
    const hasRawMermaidBlock = /```mermaid\b/i.test(args.content_markdown);

    // --sell 유효성 검증
    if (isSell) {
      if (!args.price || args.price < 100) {
        return {
          content: [{ type: 'text', text: '❌ A price is required for marketplace listings (minimum KRW 100).' }],
          isError: true,
        };
      }
      if (!args.productCategory) {
        return {
          content: [{ type: 'text', text: '❌ A product category is required for marketplace listings. (ai_prompts, coding_templates, tech_guides, ai_workflows, data_analytics, others)' }],
          isError: true,
        };
      }
    }

    if (hasRawMermaidBlock) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Raw Mermaid fenced blocks are not allowed in new auto-posted content. For structure diagrams, workflows, architecture maps, or flowcharts, rewrite the visual as a ```diagram fenced block so it renders through the D2 path.',
          },
        ],
        isError: true,
      };
    }

    logger.debug(
      {
        title: args.title,
        contentLength: args.content_markdown.length,
        tagCount: tags.length,
        userId: context.userData.userId.substring(0, 8),
        blogSlug: context.userData.blog.slug,
        sell: isSell,
      },
      isSell ? '🏷️ Creating marketplace product...' : '📝 Creating post...'
    );

    const headers = buildBackendAuthHeaders(context);

    // 요청 body 구성 — sell=true이면 상품 필드 추가
    const requestBody: Record<string, unknown> = {
      title: args.title,
      content_markdown: args.content_markdown,
      tags,
      category: args.category,
      visibility: args.visibility,
    };

    if (isSell) {
      requestBody.postType = 'product';
      requestBody.price = args.price;
      requestBody.productCategory = args.productCategory;
    }

    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      requestBody,
      {
        headers,
        timeout: 30000,
      }
    );

    const post = response.data as BackendCreatePostResponse;

    if (context.apiKey && !context.userData.keyId.startsWith('oauth:')) {
      incrementPostsCreated(
        context.userData.keyId,
        context.config.BACKEND_BASE_URL,
        context.config.MCP_SHARED_SECRET
      ).catch((err) => {
        logger.warn({ error: err.message }, '⚠️ Failed to increment postsCreated');
      });
    }

    logger.info(
      {
        postId: post.id.substring(0, 8),
        slug: post.slug,
        userId: context.userData.userId.substring(0, 8),
      },
      '✅ Post created (Fast Path)'
    );

    const rawPostUrl =
      post.url
      || (post.blog?.slug && post.slug ? `/${post.blog.slug}/${post.slug}` : `/posts/${post.slug}`);
    const publicPostUrl = toPublicPostUrl(rawPostUrl, context.config.FRONTEND_URL);
    const postVisibility = normalizeVisibility(post.visibility);
    const effectiveVisibility =
      normalizeVisibility(post.effectiveVisibility) ?? postVisibility;
    const blogIsPublic =
      typeof post.blog?.isPublic === 'boolean'
        ? post.blog.isPublic
        : typeof context.userData.blog.isPublic === 'boolean'
          ? context.userData.blog.isPublic
          : null;
    const blogVisibilityStatus =
      blogIsPublic === null ? null : blogIsPublic ? 'public' : 'private';
    const visibilityBlockedByBlogPrivacy = Boolean(post.visibilityBlockedByBlogPrivacy);
    const warnings: string[] = [];

    if (effectiveVisibility !== 'public') {
      warnings.push('effective_visibility_private');
    }
    if (visibilityBlockedByBlogPrivacy) {
      warnings.push('blog_private_overrides_post_visibility');
    }

    // Add marketplace details only for sell-mode posts.
    const sellInfo = isSell
      ? `\n\n🏷️ **Marketplace listing**\n- Price: ₩${args.price?.toLocaleString()}\n- Category: ${args.productCategory}\n- Marketplace URL: ${context.config.FRONTEND_URL || ''}/marketplace/${post.slug}`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${isSell ? 'Product listed' : 'Post created'} successfully!

**Title:** ${post.title}
**Slug:** ${post.slug}
**URL:** ${publicPostUrl}

The ${isSell ? 'product has been listed on the marketplace and' : 'post has been'} published to your blog "${context.userData.blog.name}".${sellInfo}
${post._meta ? `\n_Processing in background: ${post._meta.processingTime || 'ongoing'}_` : ''}`,
        },
      ],
      structuredContent: {
        tool: 'create_post',
        postId: post.id,
        title: post.title,
        slug: post.slug,
        postUrl: publicPostUrl,
        postType: isSell ? 'product' : 'blog',
        isPublished: Boolean(post.isPublished),
        postVisibility,
        effectiveVisibility,
        visibilityBlockedByBlogPrivacy,
        blogName: post.blog?.name || context.userData.blog.name,
        blogSlug: post.blog?.slug || context.userData.blog.slug,
        blogIsPublic,
        blogVisibilityStatus,
        processingTimeMs: normalizeProcessingTime(post._meta?.processingTime),
        warnings,
        ...(isSell ? {
          marketplace: {
            price: args.price,
            productCategory: args.productCategory,
            marketplaceUrl: `${context.config.FRONTEND_URL || ''}/marketplace/${post.slug}`,
          },
        } : {}),
      },
    };
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        userId: context.userData.userId.substring(0, 8),
        title: args.title,
      },
      '❌ Failed to create post'
    );

    let errorMessage = 'Failed to create post';

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}
