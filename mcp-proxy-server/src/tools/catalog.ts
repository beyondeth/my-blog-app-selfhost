type InputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export const WRITING_STYLE_PRESETS = [
  'default',
  'novel',
  'podcast',
  'vibe',
  'research',
  'pm',
  'designer',
  'marketer',
  'sell',
] as const;

export type WritingStylePreset = (typeof WRITING_STYLE_PRESETS)[number];

export const TOOL_NAMES = [
  'check_auth',
  'list_my_published_posts',
  'search_my_published_posts',
  'read_my_published_post',
  'get_writing_style_guide',
  'create_post',
  'get_image_upload_url',
  'finalize_uploaded_image',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolCatalogItem {
  name: ToolName;
  description: string;
  discoveryDescription: string;
  inputSchema: InputSchema;
}

export const TOOL_CATALOG: ToolCatalogItem[] = [
  {
    name: 'check_auth',
    description:
      'REQUIRED FIRST: Verify authentication status. Always call this before creating posts to confirm user identity and blog access.',
    discoveryDescription: 'Verify authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_my_published_posts',
    description:
      'List the authenticated user\'s published blog posts. Supports pagination and optional tag/category/date filters.',
    discoveryDescription: 'List your published blog posts',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 20, max: 50)',
        },
        category: {
          type: 'string',
          description: 'Optional category filter',
        },
        tag: {
          type: 'string',
          description: 'Optional tag filter',
        },
        dateFrom: {
          type: 'string',
          description: 'Optional ISO date lower bound for publishedAt',
        },
        dateTo: {
          type: 'string',
          description: 'Optional ISO date upper bound for publishedAt',
        },
      },
    },
  },
  {
    name: 'search_my_published_posts',
    description:
      'Search the authenticated user\'s published blog posts by keyword, with optional pagination and metadata filters.',
    discoveryDescription: 'Search your published blog posts',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 20, max: 50)',
        },
        category: {
          type: 'string',
          description: 'Optional category filter',
        },
        tag: {
          type: 'string',
          description: 'Optional tag filter',
        },
        dateFrom: {
          type: 'string',
          description: 'Optional ISO date lower bound for publishedAt',
        },
        dateTo: {
          type: 'string',
          description: 'Optional ISO date upper bound for publishedAt',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_my_published_post',
    description:
      'Read a single published blog post owned by the authenticated user, including full content and metadata.',
    discoveryDescription: 'Read one of your published blog posts',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'Published post ID',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'get_writing_style_guide',
    description:
      'Retrieve writing style guidelines for blog posts. Returns comprehensive style guide with instructions and validation requirements.',
    discoveryDescription: 'Retrieve writing style guidelines',
    inputSchema: {
      type: 'object',
      properties: {
        customMarkdown: {
          type: 'string',
          description:
            'User-provided custom style markdown (highest priority). Use this when user provides their own style guide in the conversation.',
        },
        styleAlias: {
          type: 'string',
          description:
            'Optional alias for a custom style markdown. Use this when customMarkdown came from a local skill or named custom preset.',
        },
        style: {
          type: 'string',
          enum: WRITING_STYLE_PRESETS,
          default: 'default',
          description: 'Preset style (used if customMarkdown not provided)',
        },
      },
    },
  },
  {
    name: 'create_post',
    description: 'Create and publish a new blog post to codebase.blog.',
    discoveryDescription: 'Create and publish blog posts to codebase.blog',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Post title',
        },
        content_markdown: {
          type: 'string',
          description: 'Post content in markdown format',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags (optional, max 10)',
        },
        category: {
          type: 'string',
          description:
            'Category (required) - Select exactly 1 category that best describes the post content',
        },
        visibility: {
          type: 'string',
          enum: ['public', 'private'],
          description:
            'Post visibility (optional). If omitted, backend applies the user/blog default.',
        },
        writingStyle: {
          type: 'string',
          description:
            'Writing style identifier for analytics or traceability. Use a preset id, or pass custom:<alias> when a custom markdown style was used.',
        },
        sell: {
          type: 'boolean',
          description:
            '판매 상품으로 등록. true면 마켓플레이스에 등록됩니다. price와 productCategory가 필수입니다.',
        },
        price: {
          type: 'number',
          description:
            '상품 가격 (KRW, 최소 100). sell=true일 때 필수.',
        },
        productCategory: {
          type: 'string',
          enum: [
            'ai_prompts',
            'coding_templates',
            'tech_guides',
            'ai_workflows',
            'data_analytics',
            'others',
          ],
          description:
            '상품 카테고리. sell=true일 때 필수.',
        },
      },
      required: ['title', 'content_markdown', 'category'],
    },
  },
  {
    name: 'get_image_upload_url',
    description:
      'Step 1: Request an S3 Presigned URL to upload a local file. Returns uploadUrl and fileKey. You must use curl to upload provided file to the uploadUrl.',
    discoveryDescription: 'Get image upload URL (step 1 of image upload)',
    inputSchema: {
      type: 'object',
      properties: {
        mimeType: { type: 'string', default: 'image/png' },
        fileSize: { type: 'number' },
      },
    },
  },
  {
    name: 'finalize_uploaded_image',
    description:
      'Step 2: Notify server that the file has been uploaded via curl asynchronously.',
    discoveryDescription: 'Finalize uploaded image (step 2 of image upload)',
    inputSchema: {
      type: 'object',
      properties: {
        fileKey: {
          type: 'string',
          description: 'Returned from get_image_upload_url',
        },
        mimeType: { type: 'string' },
        fileSize: { type: 'number' },
      },
      required: ['fileKey'],
    },
  },
];

export function getDiscoveryTools(): Array<{
  name: ToolName;
  description: string;
}> {
  return TOOL_CATALOG.map((tool) => ({
    name: tool.name,
    description: tool.discoveryDescription,
  }));
}

export const MCP_SERVER_INSTRUCTIONS = `# Codebase.blog Auto-posting MCP Server

## Workflow

1. Call check_auth() first
2. During auto-posting, do not call list_my_published_posts(), search_my_published_posts(), or read_my_published_post() unless the user explicitly asks to review previous posts
3. To create a new post, call get_writing_style_guide() without arguments first so the user can choose a style
4. Write content
   - If you have a local custom style file, pass it via customMarkdown (+ styleAlias when available)
5. If image upload is needed:
   - get_image_upload_url(...)
   - upload with local curl PUT
   - finalize_uploaded_image(...)
6. Call create_post() to publish

## Important Rules

- create_post() must execute even if image upload fails.
- If image upload fails, stop retrying and continue with text-only create_post().
- Category is required and tags are optional (max 10).
- Do not inspect previous posts to infer category or style during auto-posting. Pick the best fitting category from the current request.

## Available Tools

- check_auth
- list_my_published_posts
- search_my_published_posts
- read_my_published_post
- get_writing_style_guide
- create_post
- get_image_upload_url
- finalize_uploaded_image`;
