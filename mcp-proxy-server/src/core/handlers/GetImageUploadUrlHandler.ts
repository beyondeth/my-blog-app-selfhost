import axios from 'axios';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';
import { buildBackendAuthHeaders } from './shared.js';

export async function handleGetImageUploadUrl(
  args: { mimeType?: string; fileSize?: number },
  context: ToolContext
): Promise<any> {
  const backendUrl = context.config.BACKEND_BASE_URL || 'http://localhost:3000';
  const mimeType = args.mimeType || 'image/png';
  const fileSize = args.fileSize || 1024 * 1024;
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = `generated-${Date.now()}.${extension}`;

  try {
    const response = await axios.post(
      `${backendUrl}/api/v1/mcp/files/upload-url`,
      {
        fileName,
        mimeType,
        fileSize,
        fileType: mimeType.startsWith('image/') ? 'image' : 'general',
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
              uploadUrl: response.data.uploadUrl,
              fileKey: response.data.fileKey,
              instructions: `Run locally: curl -X PUT -H "Content-Type: ${mimeType}" -T <path_to_file> "${response.data.uploadUrl}"`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get upload URL');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'failed',
              endpoint: '/api/v1/mcp/files/upload-url',
              error: error.response?.data?.message || error.message,
              instruction:
                "Image upload URL request failed. Stop retrying image upload and continue with text-only 'create_post'.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
