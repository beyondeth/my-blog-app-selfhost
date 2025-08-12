#!/usr/bin/env python3
"""MCP Server for Blog Management"""
import os
import sys
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime

# MCP imports
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, Resource

# Local imports
from blog_client import BlogClient
from markdown_handler import MarkdownHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)

class BlogMCPServer:
    def __init__(self):
        self.server = Server("blog-mcp")
        self.blog_client = None
        self.markdown_handler = MarkdownHandler()
        self.setup_handlers()
        
    def setup_handlers(self):
        """Setup MCP server handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List available tools"""
            return [
                Tool(
                    name="create_post",
                    description="Create a new blog post from markdown content or file",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Post title"},
                            "content": {"type": "string", "description": "Markdown content"},
                            "file_path": {"type": "string", "description": "Path to markdown file (alternative to content)"},
                            "category": {"type": "string", "description": "Post category", "default": "general"},
                            "tags": {"type": "array", "items": {"type": "string"}, "description": "Post tags"},
                            "status": {"type": "string", "enum": ["draft", "published"], "default": "draft"}
                        },
                        "required": []
                    }
                ),
                Tool(
                    name="publish_post",
                    description="Publish a draft post",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "post_id": {"type": "integer", "description": "Post ID to publish"}
                        },
                        "required": ["post_id"]
                    }
                ),
                Tool(
                    name="update_post",
                    description="Update an existing blog post",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "post_id": {"type": "integer", "description": "Post ID to update"},
                            "title": {"type": "string", "description": "New title"},
                            "content": {"type": "string", "description": "New content"},
                            "category": {"type": "string", "description": "New category"},
                            "tags": {"type": "array", "items": {"type": "string"}, "description": "New tags"},
                            "status": {"type": "string", "enum": ["draft", "published"]}
                        },
                        "required": ["post_id"]
                    }
                ),
                Tool(
                    name="list_posts",
                    description="List blog posts",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "status": {"type": "string", "enum": ["draft", "published", "all"], "default": "all"},
                            "limit": {"type": "integer", "description": "Number of posts to retrieve", "default": 10}
                        }
                    }
                ),
                Tool(
                    name="get_post",
                    description="Get a single blog post",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "post_id": {"type": "integer", "description": "Post ID"}
                        },
                        "required": ["post_id"]
                    }
                ),
                Tool(
                    name="delete_post",
                    description="Delete a blog post",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "post_id": {"type": "integer", "description": "Post ID to delete"}
                        },
                        "required": ["post_id"]
                    }
                ),
                Tool(
                    name="save_markdown",
                    description="Save blog post as markdown file",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "post_id": {"type": "integer", "description": "Post ID to save"},
                            "file_path": {"type": "string", "description": "Path where to save the file"}
                        },
                        "required": ["post_id", "file_path"]
                    }
                )
            ]
            
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool calls"""
            try:
                # Ensure blog client is initialized
                if not self.blog_client:
                    self.blog_client = BlogClient()
                    await self.blog_client.__aenter__()
                    
                if name == "create_post":
                    result = await self.handle_create_post(arguments)
                elif name == "publish_post":
                    result = await self.handle_publish_post(arguments)
                elif name == "update_post":
                    result = await self.handle_update_post(arguments)
                elif name == "list_posts":
                    result = await self.handle_list_posts(arguments)
                elif name == "get_post":
                    result = await self.handle_get_post(arguments)
                elif name == "delete_post":
                    result = await self.handle_delete_post(arguments)
                elif name == "save_markdown":
                    result = await self.handle_save_markdown(arguments)
                else:
                    result = f"Unknown tool: {name}"
                    
                return [TextContent(type="text", text=str(result))]
                
            except Exception as e:
                logger.error(f"Error handling tool {name}: {e}")
                return [TextContent(type="text", text=f"Error: {str(e)}")]
                
    async def handle_create_post(self, args: Dict[str, Any]) -> str:
        """Handle create_post tool"""
        try:
            # Get content from file or direct input
            if 'file_path' in args:
                file_path = args['file_path']
                if not os.path.exists(file_path):
                    return f"File not found: {file_path}"
                    
                metadata, content = self.markdown_handler.parse_markdown_file(file_path)
                title = args.get('title', metadata['title'])
                category = args.get('category', metadata.get('category', 'general'))
                tags = args.get('tags', metadata.get('tags', []))
                status = args.get('status', metadata.get('status', 'draft'))
            else:
                content = args.get('content', '')
                if not content:
                    return "Error: Either content or file_path must be provided"
                    
                # Parse content for metadata
                metadata, body = self.markdown_handler.parse_markdown_content(content)
                title = args.get('title', metadata['title'])
                content = body
                category = args.get('category', metadata.get('category', 'general'))
                tags = args.get('tags', metadata.get('tags', []))
                status = args.get('status', metadata.get('status', 'draft'))
                
            # Create post via API
            post = await self.blog_client.create_post(
                title=title,
                content=content,
                tags=tags,
                category=category,
                status=status
            )
            
            if post:
                result = f"✅ Post created successfully!\n"
                result += f"ID: {post['id']}\n"
                result += f"Title: {post['title']}\n"
                result += f"Status: {post['status']}\n"
                result += f"URL: {self.blog_client.api_url}/posts/{post.get('slug', post['id'])}"
                return result
            else:
                return "❌ Failed to create post"
                
        except Exception as e:
            logger.error(f"Error creating post: {e}")
            return f"Error creating post: {str(e)}"
            
    async def handle_publish_post(self, args: Dict[str, Any]) -> str:
        """Handle publish_post tool"""
        post_id = args.get('post_id')
        if not post_id:
            return "Error: post_id is required"
            
        success = await self.blog_client.publish_post(post_id)
        if success:
            return f"✅ Post {post_id} published successfully!"
        else:
            return f"❌ Failed to publish post {post_id}"
            
    async def handle_update_post(self, args: Dict[str, Any]) -> str:
        """Handle update_post tool"""
        post_id = args.get('post_id')
        if not post_id:
            return "Error: post_id is required"
            
        updates = {}
        if 'title' in args:
            updates['title'] = args['title']
        if 'content' in args:
            updates['content'] = args['content']
        if 'category' in args:
            updates['category'] = args['category']
        if 'tags' in args:
            updates['tags'] = args['tags']
        if 'status' in args:
            updates['status'] = args['status']
            
        if not updates:
            return "Error: No updates provided"
            
        post = await self.blog_client.update_post(post_id, updates)
        if post:
            return f"✅ Post {post_id} updated successfully!"
        else:
            return f"❌ Failed to update post {post_id}"
            
    async def handle_list_posts(self, args: Dict[str, Any]) -> str:
        """Handle list_posts tool"""
        status = args.get('status', 'all')
        limit = args.get('limit', 10)
        
        if status == 'all':
            status = None
            
        posts = await self.blog_client.get_posts(status=status, limit=limit)
        
        if not posts:
            return "No posts found"
            
        result = f"📝 Found {len(posts)} posts:\n\n"
        for post in posts:
            result += f"• [{post['id']}] {post['title']}\n"
            result += f"  Status: {post['status']}\n"
            result += f"  Category: {post.get('category', 'N/A')}\n"
            result += f"  Created: {post.get('createdAt', 'N/A')}\n\n"
            
        return result
        
    async def handle_get_post(self, args: Dict[str, Any]) -> str:
        """Handle get_post tool"""
        post_id = args.get('post_id')
        if not post_id:
            return "Error: post_id is required"
            
        post = await self.blog_client.get_post(post_id)
        if not post:
            return f"Post {post_id} not found"
            
        result = f"📄 Post Details:\n\n"
        result += f"ID: {post['id']}\n"
        result += f"Title: {post['title']}\n"
        result += f"Status: {post['status']}\n"
        result += f"Category: {post.get('category', 'N/A')}\n"
        result += f"Tags: {', '.join(post.get('tags', []))}\n"
        result += f"Created: {post.get('createdAt', 'N/A')}\n"
        result += f"Published: {post.get('publishedAt', 'N/A')}\n\n"
        result += f"Content:\n{post.get('content', '')[:500]}..."
        
        return result
        
    async def handle_delete_post(self, args: Dict[str, Any]) -> str:
        """Handle delete_post tool"""
        post_id = args.get('post_id')
        if not post_id:
            return "Error: post_id is required"
            
        success = await self.blog_client.delete_post(post_id)
        if success:
            return f"✅ Post {post_id} deleted successfully!"
        else:
            return f"❌ Failed to delete post {post_id}"
            
    async def handle_save_markdown(self, args: Dict[str, Any]) -> str:
        """Handle save_markdown tool"""
        post_id = args.get('post_id')
        file_path = args.get('file_path')
        
        if not post_id:
            return "Error: post_id is required"
        if not file_path:
            return "Error: file_path is required"
            
        # Get post from API
        post = await self.blog_client.get_post(post_id)
        if not post:
            return f"Post {post_id} not found"
            
        # Prepare metadata
        metadata = {
            'title': post['title'],
            'slug': post.get('slug'),
            'category': post.get('category', 'general'),
            'tags': post.get('tags', []),
            'status': post['status'],
            'date': post.get('publishedAt', post.get('createdAt'))
        }
        
        # Save as markdown
        success = self.markdown_handler.create_markdown_file(
            metadata=metadata,
            content=post['content'],
            file_path=file_path
        )
        
        if success:
            return f"✅ Post saved to {file_path}"
        else:
            return f"❌ Failed to save post to {file_path}"
            
    async def run(self):
        """Run the MCP server"""
        try:
            async with stdio_server() as (read_stream, write_stream):
                await self.server.run(
                    read_stream,
                    write_stream,
                    InitializationOptions(
                        server_name="blog-mcp",
                        server_version="0.3.0",
                        capabilities={}
                    )
                )
        except Exception as e:
            logger.error(f"Error in server run: {e}")
            raise
            
    async def cleanup(self):
        """Cleanup resources"""
        if self.blog_client:
            await self.blog_client.__aexit__(None, None, None)

def main():
    """Main entry point"""
    try:
        # Load environment variables
        from dotenv import load_dotenv
        config_dir = os.getenv('BLOG_MCP_CONFIG', os.path.expanduser('~/.blog-mcp'))
        env_file = os.path.join(config_dir, '.env')
        
        if os.path.exists(env_file):
            load_dotenv(env_file)
            logger.info(f"Loaded environment from {env_file}")
        else:
            logger.warning(f"No .env file found at {env_file}")
            
        # Create and run server
        server = BlogMCPServer()
        logger.info("Starting Blog MCP Server...")
        
        # Run server
        asyncio.run(server.run())
        
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()