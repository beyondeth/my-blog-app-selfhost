import { SecureAPIKeyAuth } from "./auth.js";
import crypto from "crypto"; // Still needed for randomBytes

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  blogSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export class BlogAPIClient {
  constructor(private auth: SecureAPIKeyAuth) {}

  public async createPost(
    title: string,
    markdownContent: string,
    tags?: string[]
  ): Promise<BlogPost> {
    /** Create a new blog post via MCP endpoint with HMAC authentication for AI tracking */
    const apiKeyId = this.auth.getApiKeyId();
    if (!apiKeyId) {
      throw new Error("API key ID not configured");
    }

    const urlPath = `/mcp/posts`;
    const fullUri = `/api/v1${urlPath}`; // Backend expects full path including /api/v1
    const method = "POST";
    const body = JSON.stringify({
      title,
      content_markdown: markdownContent, // Backend handles HTML conversion
      tags: tags || [],
    });

    // Generate security parameters
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");

    // Generate HMAC signature using auth's unified method
    const signature = this.auth.generateHmacSignature(method, fullUri, timestamp, nonce, body);

    const response = await fetch(`${this.auth.apiUrl}${urlPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": apiKeyId,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "X-MCP-Client": "mcp-typescript", // Identify as MCP client for tracking
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create post (HTTP ${response.status}): ${errorText}`);
    }

    return response.json() as Promise<BlogPost>;
  }

}