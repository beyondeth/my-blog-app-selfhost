import { SecureAPIKeyAuth } from "./auth.js";
import * as crypto from "crypto";

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

  /**
   * Generate HMAC-SHA256 signature for MCP endpoints (Complex/Secure method)
   * API Secret is never transmitted - only the signature
   * Must match backend's createSecureSignature exactly
   */
  private generateHmacSignature(
    method: string,
    uri: string,
    timestamp: string,
    nonce: string,
    body: string
  ): string {
    // Get API key ID and secret from environment
    const apiKeyId = process.env["BLOG_API_KEY_ID"];
    const apiKeySecret = process.env["BLOG_API_KEY_SECRET"];
    if (!apiKeyId || !apiKeySecret) {
      throw new Error("API key ID or secret not configured");
    }

    // 1. Create body hash (same as backend)
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    
    // 2. Create message to sign - MUST match backend exactly
    // Backend format: method:uri:keyId:timestamp:nonce:bodyHash
    const message = [
      method,
      uri,
      apiKeyId,
      timestamp,
      nonce,
      bodyHash
    ].join(':');
    
    // 3. Generate HMAC signature with Secret
    const signature = crypto
      .createHmac("sha256", apiKeySecret)
      .update(message)
      .digest("hex");
    
    // Enhanced debug logging for troubleshooting
    console.log('MCP Client Signature Debug (DETAILED):', {
      method,
      uri,
      keyId: apiKeyId,
      timestamp,
      nonce,
      body: body.substring(0, 200),
      bodyHash,
      fullMessage: message,
      signature,
      secretPrefix: apiKeySecret.substring(0, 10) + '...',
    });
    
    return signature;
  }

  public async createPost(
    title: string,
    markdownContent: string,
    tags?: string[]
  ): Promise<BlogPost> {
    /** Create a new blog post via MCP endpoint with HMAC authentication for AI tracking */
    const apiKeyId = process.env["BLOG_API_KEY_ID"];
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

    // Generate HMAC signature using complex AWS V4 style
    // IMPORTANT: Use full URI path that backend will receive
    const signature = this.generateHmacSignature(method, fullUri, timestamp, nonce, body);

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