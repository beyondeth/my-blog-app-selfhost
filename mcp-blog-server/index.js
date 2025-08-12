#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// MCP Server for Blog API
const server = new Server(
  {
    name: 'mcp-blog-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Store API configuration
let apiConfig = {
  baseUrl: process.env.BLOG_API_URL || 'http://localhost:3000',
  apiKey: process.env.BLOG_API_KEY || '',
};

// Tool: Configure API
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'configure_api',
        description: 'Configure the blog API settings',
        inputSchema: {
          type: 'object',
          properties: {
            baseUrl: {
              type: 'string',
              description: 'Base URL of the blog API',
            },
            apiKey: {
              type: 'string',
              description: 'API key for authentication',
            },
          },
          required: ['apiKey'],
        },
      },
      {
        name: 'create_post',
        description: 'Create a new blog post',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the blog post',
            },
            content: {
              type: 'string',
              description: 'Content of the blog post (supports Markdown)',
            },
            category: {
              type: 'string',
              description: 'Category of the post',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Tags for the post',
            },
            thumbnail: {
              type: 'string',
              description: 'URL of the thumbnail image',
            },
          },
          required: ['title', 'content'],
        },
      },
      {
        name: 'list_posts',
        description: 'List blog posts',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
            },
            limit: {
              type: 'number',
              description: 'Number of posts per page (default: 10)',
            },
          },
        },
      },
      {
        name: 'update_post',
        description: 'Update an existing blog post',
        inputSchema: {
          type: 'object',
          properties: {
            postId: {
              type: 'string',
              description: 'ID of the post to update',
            },
            title: {
              type: 'string',
              description: 'New title of the blog post',
            },
            content: {
              type: 'string',
              description: 'New content of the blog post',
            },
            category: {
              type: 'string',
              description: 'New category',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'New tags',
            },
          },
          required: ['postId'],
        },
      },
      {
        name: 'delete_post',
        description: 'Delete a blog post',
        inputSchema: {
          type: 'object',
          properties: {
            postId: {
              type: 'string',
              description: 'ID of the post to delete',
            },
          },
          required: ['postId'],
        },
      },
      {
        name: 'get_blog_info',
        description: 'Get blog information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'configure_api': {
        if (args.baseUrl) {
          apiConfig.baseUrl = args.baseUrl;
        }
        if (args.apiKey) {
          apiConfig.apiKey = args.apiKey;
        }
        return {
          content: [
            {
              type: 'text',
              text: `API configured successfully. Base URL: ${apiConfig.baseUrl}`,
            },
          ],
        };
      }

      case 'create_post': {
        if (!apiConfig.apiKey) {
          throw new Error('API key not configured. Use configure_api first.');
        }

        const response = await axios.post(
          `${apiConfig.baseUrl}/mcp/posts`,
          {
            title: args.title,
            content: args.content,
            category: args.category,
            tags: args.tags,
            thumbnail: args.thumbnail,
          },
          {
            headers: {
              'x-api-key': apiConfig.apiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Post created successfully!\nID: ${response.data.id}\nTitle: ${response.data.title}\nSlug: ${response.data.slug}`,
            },
          ],
        };
      }

      case 'list_posts': {
        if (!apiConfig.apiKey) {
          throw new Error('API key not configured. Use configure_api first.');
        }

        const response = await axios.get(`${apiConfig.baseUrl}/mcp/posts`, {
          params: {
            page: args.page || 1,
            limit: args.limit || 10,
          },
          headers: {
            'x-api-key': apiConfig.apiKey,
          },
        });

        const posts = response.data.posts.map(
          (post) => `- ${post.title} (${post.publishedAt})`
        ).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${response.data.total} posts:\n${posts}`,
            },
          ],
        };
      }

      case 'update_post': {
        if (!apiConfig.apiKey) {
          throw new Error('API key not configured. Use configure_api first.');
        }

        const updateData = {};
        if (args.title) updateData.title = args.title;
        if (args.content) updateData.content = args.content;
        if (args.category) updateData.category = args.category;
        if (args.tags) updateData.tags = args.tags;

        const response = await axios.put(
          `${apiConfig.baseUrl}/mcp/posts/${args.postId}`,
          updateData,
          {
            headers: {
              'x-api-key': apiConfig.apiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Post updated successfully!\nID: ${response.data.id}\nTitle: ${response.data.title}`,
            },
          ],
        };
      }

      case 'delete_post': {
        if (!apiConfig.apiKey) {
          throw new Error('API key not configured. Use configure_api first.');
        }

        await axios.delete(
          `${apiConfig.baseUrl}/mcp/posts/${args.postId}`,
          {
            headers: {
              'x-api-key': apiConfig.apiKey,
            },
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Post ${args.postId} deleted successfully!`,
            },
          ],
        };
      }

      case 'get_blog_info': {
        if (!apiConfig.apiKey) {
          throw new Error('API key not configured. Use configure_api first.');
        }

        const response = await axios.get(`${apiConfig.baseUrl}/mcp/blog`, {
          headers: {
            'x-api-key': apiConfig.apiKey,
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Blog Info:\nName: ${response.data.name}\nSlug: ${response.data.slug}\nDescription: ${response.data.description}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Blog Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});