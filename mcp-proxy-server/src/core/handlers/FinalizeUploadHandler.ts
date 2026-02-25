import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import { buildBackendAuthHeaders } from './shared.js';

export async function handleFinalizeUploadedImage(
  args: { fileKey?: string; mimeType?: string; fileSize?: number },
  context: ToolContext
): Promise<any> {
  if (!args.fileKey) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'failed',
              error: 'fileKey is required',
              instruction:
                "Missing fileKey. Stop image finalization and continue with text-only 'create_post'.",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';
  const fileUrl = `https://cdn.codebase.blog/${args.fileKey}`;
  const mimeType = args.mimeType || 'image/png';
  const fileSize = args.fileSize || 0;

  try {
    await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-complete`,
      {
        fileKey: args.fileKey,
        fileUrl,
        fileName: args.fileKey,
        mimeType,
        fileSize,
      },
      {
        headers: buildBackendAuthHeaders(context),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              publicUrl: fileUrl,
              descriptor: `![Generated Image](${fileUrl})`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to finalize upload');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'failed',
              endpoint: '/api/v1/mcp/files/upload-complete',
              error: error.response?.data?.message || error.message,
              instruction:
                "Image finalization failed. Stop retrying and continue with text-only 'create_post'.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
