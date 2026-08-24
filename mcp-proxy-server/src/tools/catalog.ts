type InputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export const WRITING_STYLE_PRESETS = [
  'default',
  'novel',
  'tutorial',
  'comedy',
  'podcast',
  'vibe',
  'research',
  'human',
] as const;

export type WritingStylePreset = (typeof WRITING_STYLE_PRESETS)[number];

export const TOOL_NAMES = [
  'check_auth',
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
    description: 'Create and publish a new blog post to aigory.com.',
    discoveryDescription: 'Create and publish blog posts to aigory.com',
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
        attachedFileIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Finalized file IDs to attach to the post. Include thumbnailImageId here as well.',
        },
        thumbnailImageId: {
          type: 'string',
          description: 'Finalized file ID to use as the post cover image',
        },
      },
      required: ['title', 'content_markdown', 'category'],
    },
  },
  {
    name: 'get_image_upload_url',
    description:
      'Step 1: Request a signed presigned URL for one WebP image. Returns uploadUrl, tempId, fileKey, fileName, mimeType, and fileSize. PUT exactly those bytes to uploadUrl.',
    discoveryDescription: 'Get image upload URL (step 1 of image upload)',
    inputSchema: {
      type: 'object',
      properties: {
        mimeType: {
          type: 'string',
          enum: ['image/webp'],
          default: 'image/webp',
        },
        fileSize: { type: 'number', minimum: 1, maximum: 10485760 },
      },
      required: ['mimeType', 'fileSize'],
    },
  },
  {
    name: 'finalize_uploaded_image',
    description:
      'Step 2: Finalize the uploaded WebP using every value returned by get_image_upload_url. Returns fileId, publicUrl, and a file descriptor.',
    discoveryDescription: 'Finalize uploaded image (step 2 of image upload)',
    inputSchema: {
      type: 'object',
      properties: {
        tempId: {
          type: 'string',
          description: 'Signed upload intent returned by get_image_upload_url',
        },
        fileKey: {
          type: 'string',
          description: 'Returned from get_image_upload_url',
        },
        fileName: {
          type: 'string',
          description: 'Returned from get_image_upload_url',
        },
        mimeType: { type: 'string', enum: ['image/webp'] },
        fileSize: { type: 'number', minimum: 1, maximum: 10485760 },
      },
      required: ['tempId', 'fileKey', 'fileName', 'mimeType', 'fileSize'],
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

export const MCP_SERVER_INSTRUCTIONS = `# Aigory Auto-posting MCP Server

## Workflow

1. Call check_auth() first
2. Call get_writing_style_guide(style)
3. Write content
4. If image upload is needed:
   - get_image_upload_url(...)
   - upload with local curl PUT
   - finalize_uploaded_image(...)
5. Call create_post() to publish

## Important Rules

- create_post() must execute even if image upload fails.
- If image upload fails, stop retrying and continue with text-only create_post().
- Category is required and tags are optional (max 10).

## Available Tools

- check_auth
- get_writing_style_guide
- create_post
- get_image_upload_url
- finalize_uploaded_image`;
