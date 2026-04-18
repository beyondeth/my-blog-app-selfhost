import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import { buildBackendAuthHeaders } from './shared.js';

type SearchKnowledgeNodesArgs = {
  query: string;
  limit?: number;
};

type ReadKnowledgeNodeArgs = {
  slug: string;
};

type ListFollowupSuggestionsArgs = {
  status?: 'pending' | 'dismissed' | 'accepted';
};

type DismissFollowupSuggestionArgs = {
  suggestionId: string;
};

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

export async function handleGetKnowledgeManifest(
  _args: Record<string, never>,
  context: ToolContext
): Promise<any> {
  const headers = buildBackendAuthHeaders(context);
  const response = await axios.get(
    `${context.config.BACKEND_BASE_URL}/api/v1/mcp/knowledge/manifest`,
    {
      headers,
      timeout: 30000,
    }
  );

  return {
    content: [
      {
        type: 'text',
        text: `Knowledge manifest loaded. Version: ${response.data?.version ?? 'unknown'}`,
      },
    ],
    structuredContent: response.data,
  };
}

export async function handleSearchKnowledgeNodes(
  args: SearchKnowledgeNodesArgs,
  context: ToolContext
): Promise<any> {
  if (!args.query?.trim()) {
    throw new Error('query is required');
  }

  const headers = buildBackendAuthHeaders(context);
  const params = new URLSearchParams();
  params.set('query', args.query.trim());
  if (args.limit) {
    params.set('limit', String(args.limit));
  }

  try {
    const response = await axios.get(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/knowledge/search?${params.toString()}`,
      {
        headers,
        timeout: 30000,
      }
    );
    const items = Array.isArray(response.data) ? response.data : [];
    const text =
      items.length === 0
        ? `No knowledge nodes matched "${args.query.trim()}".`
        : items
            .map(
              (item: any, index: number) =>
                `${index + 1}. ${item.title} [${item.slug}]${item.canonicalPath ? ` | path=${item.canonicalPath}` : ''}`
            )
            .join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        query: args.query.trim(),
        items,
      },
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, 'Failed to search knowledge nodes'),
        userId: context.userData.userId.substring(0, 8),
      },
      '❌ Failed to search knowledge nodes'
    );
    throw new Error(resolveBackendError(error, 'Failed to search knowledge nodes'));
  }
}

export async function handleReadKnowledgeNode(
  args: ReadKnowledgeNodeArgs,
  context: ToolContext
): Promise<any> {
  if (!args.slug?.trim()) {
    throw new Error('slug is required');
  }

  const headers = buildBackendAuthHeaders(context);
  try {
    const response = await axios.get(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/knowledge/nodes/${encodeURIComponent(args.slug.trim())}`,
      {
        headers,
        timeout: 30000,
      }
    );
    const node = response.data?.node;
    const posts = Array.isArray(response.data?.posts) ? response.data.posts : [];
    const edges = Array.isArray(response.data?.edges) ? response.data.edges : [];
    const text = [
      `Node: ${node?.title || args.slug}`,
      node?.canonicalPath ? `Path: ${node.canonicalPath}` : null,
      node?.summary ? `Summary: ${node.summary}` : null,
      `Linked posts: ${posts.length}`,
      `Edges: ${edges.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: response.data,
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, 'Failed to read knowledge node'),
        userId: context.userData.userId.substring(0, 8),
      },
      '❌ Failed to read knowledge node'
    );
    throw new Error(resolveBackendError(error, 'Failed to read knowledge node'));
  }
}

export async function handleListFollowupSuggestions(
  args: ListFollowupSuggestionsArgs,
  context: ToolContext
): Promise<any> {
  const headers = buildBackendAuthHeaders(context);
  const query = args.status ? `?status=${encodeURIComponent(args.status)}` : '';

  try {
    const response = await axios.get(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/knowledge/followups${query}`,
      {
        headers,
        timeout: 30000,
      }
    );

    const items = Array.isArray(response.data) ? response.data : [];
    const text =
      items.length === 0
        ? 'No follow-up suggestions found.'
        : items
            .map((item: any, index: number) => `${index + 1}. ${item.title} [${item.id}]`)
            .join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        status: args.status || null,
        items,
      },
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, 'Failed to list follow-up suggestions'),
        userId: context.userData.userId.substring(0, 8),
      },
      '❌ Failed to list follow-up suggestions'
    );
    throw new Error(resolveBackendError(error, 'Failed to list follow-up suggestions'));
  }
}

export async function handleDismissFollowupSuggestion(
  args: DismissFollowupSuggestionArgs,
  context: ToolContext
): Promise<any> {
  if (!args.suggestionId?.trim()) {
    throw new Error('suggestionId is required');
  }

  const headers = buildBackendAuthHeaders(context);

  try {
    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/knowledge/followups/${encodeURIComponent(args.suggestionId.trim())}/dismiss`,
      {},
      {
        headers,
        timeout: 30000,
      }
    );

    return {
      content: [{ type: 'text', text: `Dismissed follow-up suggestion ${args.suggestionId}.` }],
      structuredContent: response.data,
    };
  } catch (error) {
    logger.error(
      {
        error: resolveBackendError(error, 'Failed to dismiss follow-up suggestion'),
        userId: context.userData.userId.substring(0, 8),
      },
      '❌ Failed to dismiss follow-up suggestion'
    );
    throw new Error(resolveBackendError(error, 'Failed to dismiss follow-up suggestion'));
  }
}
