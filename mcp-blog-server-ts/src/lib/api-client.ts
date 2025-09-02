import { SecureAPIKeyAuth } from "./auth.js";

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
    /** Create a new blog post via API */
    if (!this.auth.accessToken) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await fetch(`${this.auth.apiUrl}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
      body: JSON.stringify({
        title,
        content_markdown: markdownContent, // Backend handles HTML conversion
        tags: tags || [],
      }),
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
}