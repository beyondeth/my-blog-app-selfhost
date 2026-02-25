import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import {
  buildBackendAuthHeaders,
  incrementPostsCreated,
  toPublicPostUrl,
} from './shared.js';

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
  },
  context: ToolContext
): Promise<any> {
  try {
    const tags = args.tags ? args.tags.slice(0, 10) : [];

    logger.debug(
      {
        title: args.title,
        contentLength: args.content_markdown.length,
        tagCount: tags.length,
        userId: context.userData.userId.substring(0, 8),
        blogSlug: context.userData.blog.slug,
      },
      '📝 Creating post...'
    );

    const headers = buildBackendAuthHeaders(context);

    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      {
        title: args.title,
        content_markdown: args.content_markdown,
        tags,
        category: args.category,
      },
      {
        headers,
        timeout: 30000,
      }
    );

    const post = response.data;

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

    const publicPostUrl = toPublicPostUrl(post.url, context.config.FRONTEND_URL);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Post created successfully!

**Title:** ${post.title}
**Slug:** ${post.slug}
**URL:** ${publicPostUrl}

The post has been published to your blog "${context.userData.blog.name}".
${post._meta ? `\n_Processing in background: ${post._meta.processingTime || 'ongoing'}_` : ''}`,
        },
      ],
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
