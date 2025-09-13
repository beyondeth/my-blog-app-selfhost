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

  public async getPost(postId: string): Promise<BlogPost> {
    /** Get a specific blog post */
    if (!this.auth.accessToken) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await fetch(`${this.auth.apiUrl}/posts/${postId}`, {
      headers: {
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get post (HTTP ${response.status})`);
    }

    return response.json() as Promise<BlogPost>;
  }

  public async updatePost(
    postId: string,
    title?: string,
    markdownContent?: string,
    tags?: string[]
  ): Promise<BlogPost> {
    /** Update an existing blog post */
    if (!this.auth.accessToken) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (markdownContent !== undefined) updateData.content_markdown = markdownContent;
    if (tags !== undefined) updateData.tags = tags;

    const response = await fetch(`${this.auth.apiUrl}/posts/${postId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update post (HTTP ${response.status})`);
    }

    return response.json() as Promise<BlogPost>;
  }

  public async deletePost(postId: string): Promise<void> {
    /** Delete a blog post */
    if (!this.auth.accessToken) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await fetch(`${this.auth.apiUrl}/posts/${postId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete post (HTTP ${response.status})`);
    }
  }

  public async listPosts(): Promise<BlogPost[]> {
    /** List all posts for the authenticated blog */
    if (!this.auth.accessToken || !this.auth.blogId) {
      throw new Error("Not authenticated or blog not identified.");
    }

    const response = await fetch(`${this.auth.apiUrl}/posts?blogId=${this.auth.blogId}`, {
      headers: {
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list posts (HTTP ${response.status})`);
    }

    return response.json() as Promise<BlogPost[]>;
  }

  public async readPosts(page: number = 1, limit: number = 10, search?: string): Promise<any> {
    /** Read public posts and your own private posts with HMAC authentication */
    // Check API key configuration
    const apiKeyId = process.env["BLOG_API_KEY_ID"];
    if (!apiKeyId) {
      throw new Error("API key ID not configured");
    }

    let urlPath = `/mcp/posts/read?page=${page}&limit=${limit}`;
    if (search) {
      urlPath += `&search=${encodeURIComponent(search)}`;
    }

    // Generate security parameters
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const method = "GET";
    const body = ""; // Empty body for GET request

    // Generate HMAC signature
    const signature = this.generateHmacSignature(method, urlPath, timestamp, nonce, body);

    const response = await fetch(`${this.auth.apiUrl}${urlPath}`, {
      headers: {
        "X-API-Key-ID": apiKeyId,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "X-MCP-Client": "mcp-typescript", // Identify as MCP client
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to read posts (HTTP ${response.status}): ${errorText}`);
    }

    return response.json();
  }

  public async readPost(slug: string): Promise<any> {
    /** Read a specific post by slug with HMAC authentication */
    // Check API key configuration
    const apiKeyId = process.env["BLOG_API_KEY_ID"];
    if (!apiKeyId) {
      throw new Error("API key ID not configured");
    }

    const urlPath = `/mcp/posts/read/${slug}`;
    
    // Generate security parameters
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const method = "GET";
    const body = ""; // Empty body for GET request

    // Generate HMAC signature
    const signature = this.generateHmacSignature(method, urlPath, timestamp, nonce, body);

    const response = await fetch(`${this.auth.apiUrl}${urlPath}`, {
      headers: {
        "X-API-Key-ID": apiKeyId,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "X-MCP-Client": "mcp-typescript", // Identify as MCP client
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to read post (HTTP ${response.status}): ${errorText}`);
    }

    return response.json();
  }
}