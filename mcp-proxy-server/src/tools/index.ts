/**
 * 도구 등록 - API Key 인증 버전 (간단화)
 *
 * 변경 사항:
 * - OAuth2 세션 제거
 * - userData 직접 전달 (API Key 검증 결과)
 * - AsyncLocalStorage 제거 (불필요)
 * - 깔끔한 구조
 */

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { WritingStyleService } from '../services/WritingStyleService.js';
import axios from 'axios';


import { MetricsService } from '../services/MetricsService.js';

/**
 * 도구 컨텍스트 (API Key 또는 OAuth 인증 결과)
 */
export interface ToolContext {
  userData: {
    keyId: string;
    userId: string;
    blogId: string;
    user: { id: string; username: string; email: string };
    blog: { id: string; name: string; slug: string };
  };
  apiKey: string | null;     // API Key 인증 시 사용 (Backend 인증용)
  oauthToken?: string;       // OAuth 인증 시 사용 (Claude 커스텀 커넥터용)
  metricsService: MetricsService; // 메트릭 서비스 (도구 호출 추적용)
  config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;
    MCP_SHARED_SECRET?: string;
  };
}

/**
 * 모든 도구 등록
 *
 * @param mcpServer MCP 서버 인스턴스
 * @param context API Key 검증 결과 + 설정
 */
export async function registerAllTools(
  mcpServer: McpServer,
  context: ToolContext
): Promise<void> {
  // Initialize 핸들러
  mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
    logger.info('🔌 MCP Server initializing...');
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: true },
      },
      serverInfo: {
        name: 'codebase-blog-mcp',
        version: '8.0.0',
        title: 'Codebase.blog MCP Server',
        websiteUrl: 'https://codebase.blog'
      },
      instructions: `# Codebase.blog Auto-posting MCP Server

## ⚠️ CRITICAL RULE

> **create_post() must ALWAYS execute regardless of image generation success.**
> Never block or refuse posting due to image issues.

## Workflow

When user requests auto-posting:

1. **Call check_auth()** to verify authentication

2. **Call get_writing_style_guide(style)** with appropriate style:
   - --novel → 'novel'
   - --tutorial → 'tutorial'
   - --comedy → 'comedy'
   - --podcast → 'podcast'
   - --vibe → 'vibe'
   - --research → 'research'
   - --default or no flag → 'default'

3. **[IMAGE DETECTION]** Analyze if user wants image generation:

   **Direct Keywords:**
   - 한국어: 이미지 생성, 그림 그려, 사진 만들어, 포스터, 일러스트, 이미지 첨부
   - English: generate image, create image, make image, with image, attach image

   **Complex Patterns (also trigger image generation):**
   - "Transform [X] into [figurine/character/artwork]..."
   - "Turn [me/this] into [action figure/character/art]..."
   - "Create a [4K/HD/realistic] [photo/picture/portrait]..."
   - "Convert [this] into [1980s/Y2K/retro style]..."
   - "Design [a poster/artwork/illustration]..."
   - Any request describing visual transformation

4. **[IMAGE GENERATION - CONDITIONAL]**

   IF image generation is requested:

   a. **Check your capability:**
      - If you CAN generate images (Gemini/DALL-E/Midjourney):
        → Generate image locally.
      - If you CANNOT generate images:
        → Skip silently (NO error message to user)
        → Continue to step 5 WITHOUT blocking

   b. **Upload Protocol (Presigned URL + Curl):**
      **CRITICAL:** MCP Server cannot verify local files directly. You MUST use 'curl' locally.
      
      1. **Call \`get_image_upload_url(mimeType, fileSize)\`**
         → Returns: \`uploadUrl\` (S3 PUT URL) and \`fileKey\`.
      
      2. **Execute Local Command:**
         \`curl -X PUT -T "path/to/local/image.png" "uploadUrl"\`
      
      3. **Call \`finalize_uploaded_image(fileKey, ...)\`**
         → Returns: \`publicUrl\` (CDN URL).
         
      4. **Embed in Markdown:**
         Use the \`publicUrl\` in your post content: \`![description](publicUrl)\`

5. **Write content** following the retrieved style guide

6. **Select a category** (REQUIRED)

7. **Call create_post()** - THIS IS MANDATORY
   - Execute even if image generation failed
   - Execute even if you don't support image generation
   - Never skip this step

## Fallback Behavior Matrix

| Scenario | Image Included? | create_post Executed? |
|----------|-----------------|----------------------|
| Image requested + Generated successfully | ✅ Yes | ✅ Yes |
| Image requested + Generation failed | ❌ No | ✅ Yes |
| Image requested + Agent doesn't support images | ❌ No | ✅ Yes |
| No image requested | ❌ No | ✅ Yes |

## Available Styles

- **default**: Professional technical blog (formal, detailed analysis)
- **novel**: Narrative storytelling (vivid descriptions, emotional journey)
- **tutorial**: Step-by-step guide (beginner-friendly, verification checkpoints)
- **comedy**: Humorous tone (self-deprecating, relatable developer experiences)
- **podcast**: Conversational dialogue (audio-friendly, zero visual dependency)
- **vibe**: Developer learning guide (friendly, conversational, concept-focused)
- **research**: Academic paper analysis (claims, evidence, and practical insights)
- **custom**: Pass user-provided markdown to customMarkdown parameter

## Example Workflows

### With Image (Multimodal Agent)
User: "Y2K 스타일 포스터 이미지 생성해서 블로그에 올려줘"
1. check_auth() ✅
2. get_writing_style_guide('vibe') ✅
3. Detect: "이미지 생성" → Image requested
4. Generate image locally (e.g., image.png)
5. **get_image_upload_url** → Get Upload URL
6. **run_command(curl -X PUT...)** → Upload file
7. **finalize_uploaded_image** → Get CDN URL
8. Write: "# Y2K 포스터\\n![poster](CDN_URL)..."
9. create_post() ✅

### Complex Prompt (Multimodal Agent)
User: "Transform me into a fantasy RPG figurine and post about it"
1. check_auth() ✅
2. get_writing_style_guide('novel') ✅
3. Detect: "Transform...into...figurine" → Image requested
4. Generate image → Upload via Curl → Get URL
5. Write content with image markdown
6. create_post() ✅

### Non-Multimodal Agent
User: "이미지 생성해서 포스팅해줘"
1. check_auth() ✅
2. get_writing_style_guide('default') ✅
3. Detect image request ✅
4. Cannot generate images → Skip silently (NO error shown)
5. Write text-only content
6. create_post() ✅ ← Still executes!

### No Image Requested
User: "오늘의 개발 일기 포스팅해줘"
1. check_auth() ✅
2. get_writing_style_guide('default') ✅
3. No image keywords/patterns → Skip step 4
5. Write content
6. create_post() ✅

## Tools

- **check_auth**: Verify authentication status (required first call)
- **get_writing_style_guide**: Retrieve writing style guidelines
- **get_image_upload_url**: Step 1 of upload (Get S3 URL)
- **finalize_uploaded_image**: Step 2 of upload (Register file)
- **create_post**: Publish blog post (requires: title, content_markdown, category)`
    };
  });

  // 도구 정의
  const tools = [
    {
      name: 'check_auth',
      description: 'REQUIRED FIRST: Verify authentication status. Always call this before creating posts to confirm user identity and blog access.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_writing_style_guide',
      description: 'Retrieve writing style guidelines for blog posts. Returns comprehensive style guide with instructions and validation requirements.',
      inputSchema: {
        type: 'object',
        properties: {
          customMarkdown: {
            type: 'string',
            description: 'User-provided custom style markdown (highest priority). Use this when user provides their own style guide in the conversation.',
          },
          style: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast', 'vibe', 'research'],
            default: 'default',
            description: 'Preset style (used if customMarkdown not provided)',
          },
        },
      },
    },
    {
      name: 'create_post',
      description: 'Create and publish a new blog post to codebase.blog.',
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
            description: 'Category (required) - Select exactly 1 category that best describes the post content',
          },
          writingStyle: {
            type: 'string',
            enum: ['default', 'novel', 'tutorial', 'comedy', 'podcast', 'vibe', 'research'],
            default: 'default',
            description: 'Writing style preset',
          },
        },
        required: ['title', 'content_markdown', 'category'],
      },
    },
    {
      name: 'get_image_upload_url',
      description: 'Step 1: Request an S3 Presigned URL to upload a local file. Returns uploadUrl and fileKey. You must use curl to upload provided file to the uploadUrl.',
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
      description: 'Step 2: Notify server that the file has been uploaded via curl asynchronously.',
      inputSchema: {
        type: 'object',
        properties: {
          fileKey: { type: 'string', description: 'Returned from get_image_upload_url' },
          mimeType: { type: 'string' },
          fileSize: { type: 'number' },
        },
        required: ['fileKey'],
      },
    },
  ];

  // 도구 목록 핸들러
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // 도구 실행 핸들러
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.debug({
      tool: name,
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
    }, '🔧 Tool called');

    try {
      let result;

      switch (name) {
        case 'check_auth':
          result = await handleCheckAuth(context);
          break;

        case 'get_writing_style_guide':
          result = await handleGetWritingStyleGuide(args as any, context);
          break;

        case 'create_post':
          result = await handleCreatePost(args as any, context);
          break;

        case 'get_image_upload_url':
          result = await handleGetImageUploadUrl(args as any, context);
          break;

        case 'finalize_uploaded_image':
          result = await handleFinalizeUploadedImage(args as any, context);
          break;

        default:
          throw new Error(`Tool '${name}' not found`);
      }

      // 메트릭 기록 (성공)
      context.metricsService.recordRequest('success', name);

      return result;
    } catch (error) {
      // 메트릭 기록 (실패)
      context.metricsService.recordRequest('error', name);
      throw error;
    }
  });

  // Prompts 등록
  await registerPrompts(mcpServer);

  logger.info({
    toolCount: tools.length,
    tools: tools.map((t) => t.name),
    userId: context.userData.userId.substring(0, 8),
  }, '✅ Tools registered');
}

/**
 * Prompts 등록 (Writing Style 가이드)
 */
async function registerPrompts(mcpServer: McpServer): Promise<void> {
  const styleService = new WritingStyleService();
  const defaultStyle = await styleService.loadAndParseStyle('default');

  const prompts = [
    {
      name: 'markdown_quality_guidelines',
      description: 'Professional markdown writing guidelines for blog posts',
    },
    {
      name: 'blog_post_template',
      description: 'Standard blog post template structure',
    },
    {
      name: 'improve_markdown',
      description: 'Techniques for enhancing blog post quality',
    },
  ];

  mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts,
  }));

  mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    let content: string;

    switch (name) {
      case 'markdown_quality_guidelines':
        content = defaultStyle.qualityGuidelinesPrompt;
        break;
      case 'blog_post_template':
        content = defaultStyle.blogPostTemplatePrompt;
        break;
      case 'improve_markdown':
        content = defaultStyle.improveMarkdownPrompt;
        break;
      default:
        throw new Error(`Prompt '${name}' not found`);
    }

    return {
      description: `Writing style guide: ${name}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
  });

  logger.debug({
    promptCount: prompts.length,
  }, '✅ Prompts registered');
}

/**
 * check_auth 핸들러
 *
 * 사용자 인증 상태를 확인하고 안내 메시지를 반환합니다.
 * 실제 인증은 MCP 연결 시점에 이미 완료되었으므로,
 * 이 함수는 인증된 사용자 정보를 표시하는 역할만 합니다.
 */
async function handleCheckAuth(context: ToolContext): Promise<any> {
  const authMode = context.oauthToken ? 'OAuth 2.1' : 'API Key';

  logger.info({
    userId: context.userData.userId.substring(0, 8),
    blogSlug: context.userData.blog.slug,
    authMode,
  }, '🔐 Authentication check');

  return {
    content: [
      {
        type: 'text',
        text: `✅ *** CODEBASE.BLOG 유저 인증이 완료됨 ***
✅ ${context.userData.user.username} (${context.userData.user.email})
✅ 블로그 주소 : https://www.codebase.blog/${context.userData.blog.slug}
✅ 인증 방식 : ${authMode}`,
      },
    ],
  };
}

/**
 * get_writing_style_guide 핸들러
 */
async function handleGetWritingStyleGuide(
  args: { style?: string; customMarkdown?: string },
  context: ToolContext
): Promise<any> {
  const styleService = new WritingStyleService();
  let styleData;

  // 우선순위 1: 사용자 제공 커스텀 마크다운 (최우선)
  if (args.customMarkdown) {
    logger.info({
      userId: context.userData.userId.substring(0, 8),
      source: 'custom-markdown',
    }, '📖 Using user-provided custom markdown style');
    styleData = await styleService.parseRawMarkdown(args.customMarkdown);
  } else {
    // 우선순위 2: 프리셋 스타일 (플래그 없으면 default)
    const style = args.style || 'default';
    logger.info({
      style,
      userId: context.userData.userId.substring(0, 8),
      source: 'preset',
    }, '📖 Writing style guide retrieved');
    styleData = await styleService.loadAndParseStyle(style);
  }

  // 전체 스타일 가이드 조합
  const fullGuide = [
    `# ${styleData.metadata.styleName}`,
    '',
    `**Requirements:** ${styleData.metadata.minLength}+ chars (target: ${styleData.metadata.targetLength}) | Language: ${styleData.metadata.language} | AI tag: ${styleData.metadata.aiTagRequired ? 'required' : 'optional'}`,
    '',
    styleData.instructions,
  ].join('\n');

  return {
    content: [
      {
        type: 'text',
        text: fullGuide,
      },
    ],
  };
}

/**
 * create_post 핸들러
 */
async function handleCreatePost(
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
    const aiDisclosure =
      '본 콘텐츠는 사용자의 작업 및 대화 맥락을 기반으로 AI가 자동 생성하였습니다.';

    // 태그 10개 제한
    const tags = args.tags ? args.tags.slice(0, 10) : [];

    // AI 고지 문구는 모든 글 하단에 통일적으로 추가
    let contentMarkdown = args.content_markdown.trimEnd();
    if (!contentMarkdown.includes(aiDisclosure)) {
      contentMarkdown = `${contentMarkdown}\n\n---\n\n${aiDisclosure}`;
    }

    logger.debug({
      title: args.title,
      contentLength: contentMarkdown.length,
      tagCount: tags.length,
      userId: context.userData.userId.substring(0, 8),
      blogSlug: context.userData.blog.slug,
    }, '📝 Creating post...');

    // Backend MCP API 호출 (포스트 생성)
    // API Key 또는 OAuth 토큰 인증
    const headers: Record<string, string> = {};

    if (context.apiKey) {
      // API Key 인증 모드 (기존 방식)
      headers['X-API-Key'] = context.apiKey;
    } else if (context.oauthToken) {
      // OAuth 인증 모드 (Claude 커스텀 커넥터)
      headers['Authorization'] = `Bearer ${context.oauthToken}`;
      headers['X-OAuth-User-Id'] = context.userData.userId;
      headers['X-OAuth-Blog-Id'] = context.userData.blogId;
    }

    if (context.config.MCP_SHARED_SECRET) {
      headers['X-Internal-Secret'] = context.config.MCP_SHARED_SECRET;
    }

    const response = await axios.post(
      `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
      {
        title: args.title,
        content_markdown: contentMarkdown, // 하단 고지 포함 마크다운
        tags,
        category: args.category,
      },
      {
        headers,
        timeout: 30000,
      }
    );

    // Backend MCP 엔드포인트는 Fast Path 응답 (status 202)
    // response.data = { id, slug, title, url, blog, _meta }
    const post = response.data;

    // MCP API Key의 postsCreated 카운트 증가 (비동기, 블로킹 안 함)
    // OAuth 모드에서는 API Key가 없으므로 건너뜀
    if (context.apiKey && !context.userData.keyId.startsWith('oauth:')) {
      incrementPostsCreated(
        context.userData.keyId,
        context.config.BACKEND_BASE_URL,
        context.config.MCP_SHARED_SECRET
      ).catch((err) => {
        logger.warn({ error: err.message }, '⚠️ Failed to increment postsCreated');
      });
    }

    logger.info({
      postId: post.id.substring(0, 8),
      slug: post.slug,
      userId: context.userData.userId.substring(0, 8),
    }, '✅ Post created (Fast Path)');

    return {
      content: [
        {
          type: 'text',
          text: `✅ Post created successfully!

**Title:** ${post.title}
**Slug:** ${post.slug}
**URL:** https://codebase.blog${post.url}

The post has been published to your blog "${context.userData.blog.name}".
${post._meta ? `\n_Processing in background: ${post._meta.processingTime || 'ongoing'}_` : ''}`,
        },
      ],
    };
  } catch (error: any) {
    logger.error({
      error: error.message,
      userId: context.userData.userId.substring(0, 8),
      title: args.title,
    }, '❌ Failed to create post');

    // 에러 메시지 포맷팅
    let errorMessage = 'Failed to create post';

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

/**
 * MCP API Key의 postsCreated 카운트 증가 (비동기)
 */
async function incrementPostsCreated(
  keyId: string,
  backendUrl: string,
  sharedSecret?: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (sharedSecret) {
    headers['X-Internal-Secret'] = sharedSecret;
  }

  await axios.post(
    `${backendUrl}/api/v1/mcp/keys/${keyId}/increment-posts`,
    {},
    { timeout: 3000, headers }
  );
}

// [NEW HANDLERS]
// 동시성 제어는 더 이상 필요하지 않으므로 제거 (Agent가 직접 CURL 업로드)

async function handleGetImageUploadUrl(
  args: { mimeType?: string; fileSize?: number },
  context: ToolContext
): Promise<any> {
  try {
    const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';
    const fileName = `generated-${Date.now()}.${(args.mimeType || 'image/png').split('/')[1]}`;

    logger.debug({ userId: context.userData.userId }, '🔗 Requesting upload URL');
    
    // Auth header fallback
    const headers: Record<string, string> = {
      ...(context.config.MCP_SHARED_SECRET ? { 'X-Internal-Secret': context.config.MCP_SHARED_SECRET } : {})
    };

    if (context.apiKey) {
      headers['X-API-Key'] = context.apiKey;
    } else if (context.oauthToken) {
      headers['Authorization'] = `Bearer ${context.oauthToken}`;
    }

    const response = await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-url`,
      {
        fileName,
        mimeType: args.mimeType || 'image/png',
        fileSize: args.fileSize || 1024 * 1024,
        fileType: (args.mimeType || 'image/png').startsWith('image/') ? 'image' : 'general',
      },
      {
        headers,
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            uploadUrl: response.data.uploadUrl,
            fileKey: response.data.fileKey,
            instructions: `Run this command locally: curl -X PUT -H "Content-Type: ${args.mimeType || 'image/png'}" -T <path_to_file> "${response.data.uploadUrl}"`,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get upload URL');
    // Soft fail: Return error info but allows Agent to proceed to create_post
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'failed',
            error: error.response?.data?.message || error.message,
            instruction: "Image upload failed. STOP retrying upload. Proceed immediately to 'create_post' with text only.",
          }, null, 2),
        },
      ],
      isError: true, // Mark as error for visibility, but content instructs next step
    };
  }
}

async function handleFinalizeUploadedImage(
  args: { fileKey: string; mimeType?: string; fileSize?: number },
  context: ToolContext
): Promise<any> {
  try {
    const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';
    // Construct public URL (Standard Cloudflare R2 / S3 pattern or trust backend/user)
    const fileUrl = `https://cdn.codebase.blog/${args.fileKey}`;

    // Auth header fallback
    const headers: Record<string, string> = {
      ...(context.config.MCP_SHARED_SECRET ? { 'X-Internal-Secret': context.config.MCP_SHARED_SECRET } : {})
    };

    if (context.apiKey) {
      headers['X-API-Key'] = context.apiKey;
    } else if (context.oauthToken) {
      headers['Authorization'] = `Bearer ${context.oauthToken}`;
    }

    await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-complete`,
      {
        fileKey: args.fileKey,
        fileUrl: fileUrl, // Presigned URL에서 쿼리 파라미터 제외하고 사용하는 것이 정석
        fileName: args.fileKey,
        mimeType: args.mimeType || 'image/png',
        fileSize: args.fileSize || 0,
      },
      {
        headers,
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            publicUrl: fileUrl, 
            descriptor: `![Generated Image](${fileUrl})`
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to finalize upload');
    // Soft fail
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'failed',
            error: error.response?.data?.message || error.message,
            instruction: "Image finalization failed. STOP retrying. Proceed immediately to 'create_post' with text only.",
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
