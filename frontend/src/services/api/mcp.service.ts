import { defaultApiClient } from '@/lib/api/client';

export interface McpApiKey {
  id: string;
  keyHint: string;
  name: string;
  blogId: string;
  blogName: string;
  isActive: boolean;
  requestCount: number;
  postsCreated: number;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateMcpApiKeyRequest {
  blogId: string;
  name: string;
}

export interface CreateMcpApiKeyResponse {
  apiKey: string;
  keyHint: string;
  expiresAt: string;
}

export interface RevealMcpApiKeyResponse {
  apiKey: string;
  keyHint: string;
  name: string;
}

interface ApiListResponse<T> {
  data: T;
}

export async function listMcpApiKeys(): Promise<McpApiKey[]> {
  const response = await defaultApiClient.get<ApiListResponse<McpApiKey[]>>(
    '/mcp/keys',
  );
  return response.data ?? [];
}

export async function createMcpApiKey(
  payload: CreateMcpApiKeyRequest,
): Promise<CreateMcpApiKeyResponse> {
  const response = await defaultApiClient.post<
    ApiListResponse<CreateMcpApiKeyResponse>
  >('/mcp/keys', payload);
  return response.data;
}

export async function deleteMcpApiKey(keyId: string): Promise<void> {
  await defaultApiClient.delete(`/mcp/keys/${keyId}`);
}

export async function revealMcpApiKey(
  keyId: string,
): Promise<RevealMcpApiKeyResponse> {
  const response = await defaultApiClient.get<
    ApiListResponse<RevealMcpApiKeyResponse>
  >(`/mcp/keys/${keyId}/reveal`);
  return response.data;
}
