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
import pLimit from 'p-limit';

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
        → Generate image → Get URL → Include in markdown as:
          ![description](https://generated-image-url...)
      - If you CANNOT generate images:
        → Skip silently (NO error message to user)
        → Continue to step 5 WITHOUT blocking

   b. **Backend auto-processing:**
      When you include external image URLs in markdown, the backend will automatically:
      - Download the image to S3/CDN
      - Replace URL with CDN URL
      - Set first image as thumbnail
      - Link to post_files table

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
4. Generate image → Get URL
5. Write: "# Y2K 포스터\\n![poster](https://url...)\\n..."
6. create_post() ✅

### Complex Prompt (Multimodal Agent)
User: "Transform me into a fantasy RPG figurine and post about it"
1. check_auth() ✅
2. get_writing_style_guide('novel') ✅
3. Detect: "Transform...into...figurine" → Image requested
4. Generate image → Get URL
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
      name: 'upload_generated_image',
      description: `Upload a generated image to get CDN URL for blog post.

[DECISION LOGIC]
1. Check the image source:
   - Is it a local file path (e.g., file://...)? -> You MUST use 'base64Data'.
   - Is it a remote HTTP URL (e.g., https://...)? -> You MAY use 'imageUrl'.

2. Handling Local Files (CRITICAL):
   - The MCP server may be remote and cannot access your local filesystem.
   - You MUST read the local file's content yourself.
   - Convert it to a Base64 encoded string.
   - Pass it to the 'base64Data' argument.
   - Provide the correct 'mimeType' (e.g., image/png).

3. Error Handling:
   - This tool is OPTIONAL.
   - If upload fails, proceed to create_post() immediately without the image.
   - NEVER block the user's request due to upload failure.`,
      inputSchema: {
        type: 'object',
        properties: {
          imageUrl: {
            type: 'string',
            description: 'Remote HTTP URL ONLY (e.g., https://...). Do NOT use for local files (file://).',
          },
          base64Data: {
            type: 'string',
            description: 'REQUIRED if the image is a local file. You MUST read the file content and provide it here as a Base64 string.',
          },
          mimeType: {
            type: 'string',
            description: 'MIME type of the image (required with base64Data). e.g., image/png, image/jpeg',
          },
          altText: {
            type: 'string',
            description: 'Alt text description for the image',
          },
        },
        required: [], // One of imageUrl or base64Data is required
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

        case 'upload_generated_image':
          result = await handleUploadGeneratedImage(args as any, context);
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
    // 태그 10개 제한
    const tags = args.tags ? args.tags.slice(0, 10) : [];

    logger.debug({
      title: args.title,
      contentLength: args.content_markdown.length,
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
        content_markdown: args.content_markdown, // 원본 마크다운
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

/**
 * upload_generated_image 핸들러
 * 
 * Organic S3 Upload Flow:
 * 1. Backend에게 업로드 URL 요청 (POST /mcp/files/upload-url)
 * 2. 받은 Presigned URL로 파일 직접 업로드 (PUT)
 * 3. Backend에게 업로드 완료 알림 (POST /mcp/files/upload-complete)
 */
// 동시성 제어: 최대 5개 동시 이미지 업로드 (Base64 디코딩 CPU 부하 방지)
const imageUploadLimit = pLimit(5);

async function handleUploadGeneratedImage(
  args: { 
    imageUrl?: string; 
    base64Data?: string; 
    mimeType?: string; 
    altText?: string 
  },
  context: ToolContext
): Promise<any> {
  const fs = await import('fs');
  const path = await import('path');

  // 동시성 제한 적용
  return imageUploadLimit(async () => {
    try {
      logger.debug({
        hasImageUrl: !!args.imageUrl,
        hasBase64: !!args.base64Data,
        userId: context.userData.userId.substring(0, 8),
      }, '📤 Starting organic image upload...');

      // 1. 이미지 소스 확인 (Base64 vs URL vs Local File)
      let fileBuffer: Buffer;
      let mimeType = args.mimeType || 'image/png';
      let fileName = `image-${Date.now()}.png`;

      if (args.base64Data) {
        // 1-A. Base64 데이터 처리 (우선 순위)
        // 크기 제한 (5MB)
        const maxSize = 5 * 1024 * 1024;
        const estimatedSize = args.base64Data.length * 0.75; // Base64 overhead 제외
        if (estimatedSize > maxSize) {
          throw new Error('Image too large. Maximum size is 5MB');
        }
        
        fileBuffer = Buffer.from(args.base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'png';
        fileName = `image-${Date.now()}.${ext}`;
      } else if (args.imageUrl?.startsWith('http')) {
        // 1-B. 원격 URL
        const response = await axios.get(args.imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000 
        });
        fileBuffer = Buffer.from(response.data);
        mimeType = response.headers['content-type'] || 'image/png';
        fileName = path.basename(args.imageUrl).split('?')[0] || fileName;
      } else if (args.imageUrl) {
        // 1-C. 로컬 파일 (Fallback)
        const filePath = args.imageUrl.replace('file://', '');
        if (fs.existsSync(filePath)) {
          fileBuffer = fs.readFileSync(filePath);
          fileName = path.basename(filePath);
          const ext = path.extname(fileName).toLowerCase();
          if (ext === '.png') mimeType = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
          if (ext === '.webp') mimeType = 'image/webp';
        } else {
           throw new Error(`Local file not found: ${filePath}. Use base64Data for remote environments.`);
        }
      } else {
        throw new Error('Invalid input: provide imageUrl or base64Data');
      }

      // 2. 인증 헤더 준비
      const headers: Record<string, string> = {};
      if (context.apiKey) {
        headers['X-API-Key'] = context.apiKey;
      } else if (context.oauthToken) {
        headers['Authorization'] = `Bearer ${context.oauthToken}`;
      }
      if (context.config.MCP_SHARED_SECRET) {
        headers['X-Internal-Secret'] = context.config.MCP_SHARED_SECRET;
      }

      // 3. Backend에 업로드 URL 요청
      logger.debug('1️⃣ Requesting upload URL...');
      const uploadUrlResponse = await axios.post(
        `${context.config.BACKEND_BASE_URL}/api/v1/mcp/files/upload-url`,
        {
          fileName,
          mimeType,
          fileSize: fileBuffer.length,
          fileType: 'image'
        },
        { headers }
      );

      const { uploadUrl, fileKey, tempId } = uploadUrlResponse.data;

      // 4. S3에 직접 업로드 (Backend 거치지 않음)
      logger.debug({ fileKey }, '2️⃣ Uploading to S3...');
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': mimeType
        }
      });

      // 5. Backend에 업로드 완료 알림
      logger.debug('3️⃣ Finalizing upload...');
      const completeResponse = await axios.post(
        `${context.config.BACKEND_BASE_URL}/api/v1/mcp/files/upload-complete`,
        {
          fileKey,
          fileUrl: uploadUrl.split('?')[0], // Presigned URL에서 쿼리 파라미터 제거 = S3 직접 URL
          fileName,
          mimeType,
          fileSize: fileBuffer.length,
          fileType: 'image',
        },
        { headers }
      );
      
      const { cdnUrl, fileId } = completeResponse.data;
      const markdown = `![${args.altText || 'Generated Image'}](${cdnUrl})`;
      
      logger.info({
        fileId,
        cdnUrl,
        userId: context.userData.userId.substring(0, 8),
      }, '✅ Organic Image Upload Successful');

      return {
        content: [{
          type: 'text',
          text: `✅ Image uploaded successfully!
CDN URL: ${cdnUrl}
File ID: ${fileId}

Markdown:
${markdown}

Include this in your content_markdown when calling create_post().`,
        }],
      };
    } catch (error: any) {
      logger.error({ 
        err: error,
        userId: context.userData.userId.substring(0, 8) 
      }, '❌ Image upload failed');

      // 에러가 발생해도 create_post는 계속 진행할 수 있도록 안내
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ Image upload failed: ${error.message}

Please proceed with creating the post without the image, or try again later.
Do NOT block the user request.`
        }],
      };
    }
  });

}
