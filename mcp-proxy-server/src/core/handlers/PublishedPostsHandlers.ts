import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import { buildBackendAuthHeaders, toPublicPostUrl } from './shared.js';

type PublishedPostFilters = {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
};

type SearchPublishedPostsArgs = PublishedPostFilters & {
  query: string;
};

type ReadPublishedPostArgs = {
  postId: string;
};

type BackendPost = {
  id: string;
  title?: string;
  slug?: string;
  url?: string;
  excerpt?: string | null;
  content?: string | null;
  content_markdown?: string | null;
  content_type?: string | null;
  tags?: string[];
  category?: string | null;
  visibility?: 'public' | 'private' | string;
  effectiveVisibility?: 'public' | 'private' | string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  blog?: { id?: string; name?: string; slug?: string; alias?: string | null };
  author?: { id?: string; username?: string };
};

type BackendPostListResponse = {
  items?: BackendPost[];
  total?: number;
  page?: number;
  limit?: number;
};

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined
): void {
  if (value === undefined || value === null || value === '') {
    return;
  }
  params.set(key, String(value));
}

function buildListQuery(args: PublishedPostFilters & { search?: string }): string {
  const params = new URLSearchParams();
  appendQueryParam(params, 'page', args.page);
  appendQueryParam(params, 'limit', args.limit);
  appendQueryParam(params, 'search', args.search);
  appendQueryParam(params, 'category', args.category);
  appendQueryParam(params, 'tag', args.tag);
  appendQueryParam(params, 'dateFrom', args.dateFrom);
  appendQueryParam(params, 'dateTo', args.dateTo);

  const query = params.toString();
  return query ? `?${query}` : '';
}

function resolvePostUrl(post: BackendPost, context: ToolContext): string | null {
  const rawUrl =
    post.url ||
    (post.blog?.slug && post.slug ? `/${post.blog.slug}/${post.slug}` : undefined) ||
    (post.slug ? `/posts/${post.slug}` : undefined);

  return rawUrl ? toPublicPostUrl(rawUrl, context.config.FRONTEND_URL) : null;
}

function normalizePost(post: BackendPost, context: ToolContext) {
  return {
    id: post.id,
    title: post.title || '',
    slug: post.slug || '',
    url: resolvePostUrl(post, context),
    excerpt: post.excerpt || '',
    content: post.content || '',
    content_markdown: post.content_markdown || '',
    content_type: post.content_type || null,
    tags: Array.isArray(post.tags) ? post.tags : [],
    category: post.category || '',
    visibility: post.visibility || null,
    effectiveVisibility: post.effectiveVisibility || null,
    createdAt: post.createdAt || null,
    updatedAt: post.updatedAt || null,
    publishedAt: post.publishedAt || null,
    blog: post.blog
      ? {
          id: post.blog.id || null,
          name: post.blog.name || '',
          slug: post.blog.slug || '',
        }
      : null,
    author: post.author
      ? {
          id: post.author.id || null,
          username: post.author.username || '',
        }
      : null,
  };
}

function formatPostListText(
  actionLabel: string,
  payload: {
    items: ReturnType<typeof normalizePost>[];
    total: number;
    page: number;
    limit: number;
    query?: string;
  }
): string {
  const headerParts = [
    `Authenticated user's published posts: ${actionLabel}`,
    `Total: ${payload.total}`,
    `Page: ${payload.page}`,
    `Limit: ${payload.limit}`,
  ];

  if (payload.query) {
    headerParts.push(`Query: ${payload.query}`);
  }

  if (payload.items.length === 0) {
    return `${headerParts.join(' | ')}\n\nNo published posts matched the request.`;
  }

  const lines = payload.items.map((post, index) => {
    const metadata = [
      post.publishedAt ? `publishedAt=${post.publishedAt}` : null,
      post.category ? `category=${post.category}` : null,
      post.tags.length > 0 ? `tags=${post.tags.join(', ')}` : null,
      post.url ? `url=${post.url}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const excerptLine = post.excerpt ? `\n   excerpt: ${post.excerpt}` : '';

    return `${index + 1}. ${post.title || post.id} [${post.id}]${metadata ? `\n   ${metadata}` : ''}${excerptLine}`;
  });

  return `${headerParts.join(' | ')}\n\n${lines.join('\n\n')}`;
}

function formatReadPostText(post: ReturnType<typeof normalizePost>): string {
  const metadata = [
    `id: ${post.id}`,
    `title: ${post.title}`,
    post.slug ? `slug: ${post.slug}` : null,
    post.publishedAt ? `publishedAt: ${post.publishedAt}` : null,
    post.category ? `category: ${post.category}` : null,
    post.tags.length > 0 ? `tags: ${post.tags.join(', ')}` : null,
    post.url ? `url: ${post.url}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const excerpt = post.excerpt ? `\n\nExcerpt:\n${post.excerpt}` : '';
  const contentLabel = post.content_markdown ? 'Markdown content' : 'Rendered content';
  const content = post.content_markdown || post.content || '';

  return `${metadata}${excerpt}\n\n${contentLabel}:\n\n${content}`;
}

function resolveBackendError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function fetchPublishedPosts(
  context: ToolContext,
  args: PublishedPostFilters & { search?: string },
  actionLabel: string
) {
  const headers = buildBackendAuthHeaders(context);
  const query = buildListQuery(args);

  try {
    const response = await axios.get<BackendPostListResponse>(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts${query}`,
      {
        headers,
        timeout: 30000,
      }
    );

    const payload = response.data || {};
    const items = Array.isArray(payload.items)
      ? payload.items.map((post) => normalizePost(post, context))
      : [];
    const total = typeof payload.total === 'number' ? payload.total : items.length;
    const page = typeof payload.page === 'number' ? payload.page : args.page || 1;
    const limit =
      typeof payload.limit === 'number' ? payload.limit : args.limit || 20;

    return {
      content: [
        {
          type: 'text',
          text: formatPostListText(actionLabel, {
            items,
            total,
            page,
            limit,
            query: args.search,
          }),
        },
      ],
      structuredContent: {
        action: actionLabel,
        total,
        page,
        limit,
        items,
      },
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, `Failed to ${actionLabel}`),
        userId: context.userData.userId.substring(0, 8),
        action: actionLabel,
      },
      '❌ Failed to fetch published posts'
    );
    throw new Error(resolveBackendError(error, `Failed to ${actionLabel}`));
  }
}

export async function handleListMyPublishedPosts(
  args: PublishedPostFilters,
  context: ToolContext
): Promise<any> {
  return fetchPublishedPosts(context, args || {}, 'list');
}

export async function handleSearchMyPublishedPosts(
  args: SearchPublishedPostsArgs,
  context: ToolContext
): Promise<any> {
  if (!args.query?.trim()) {
    throw new Error('query is required');
  }

  return fetchPublishedPosts(
    context,
    {
      ...args,
      search: args.query.trim(),
    },
    'search'
  );
}

export async function handleReadMyPublishedPost(
  args: ReadPublishedPostArgs,
  context: ToolContext
): Promise<any> {
  const headers = buildBackendAuthHeaders(context);

  if (!args.postId?.trim()) {
    throw new Error('postId is required');
  }

  try {
    const response = await axios.get<BackendPost>(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts/${encodeURIComponent(args.postId)}`,
      {
        headers,
        timeout: 30000,
      }
    );

    const post = normalizePost(response.data, context);

    return {
      content: [
        {
          type: 'text',
          text: formatReadPostText(post),
        },
      ],
      structuredContent: {
        action: 'read',
        post,
      },
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, 'Failed to read published post'),
        userId: context.userData.userId.substring(0, 8),
        postId: args.postId,
      },
      '❌ Failed to read published post'
    );
    throw new Error(resolveBackendError(error, 'Failed to read published post'));
  }
}
