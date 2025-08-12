"""Blog API Client for MCP Server"""
import os
import json
import logging
from typing import Dict, Any, Optional, List
import aiohttp
from datetime import datetime
import html

logger = logging.getLogger(__name__)

class BlogClient:
    def __init__(self):
        self.api_url = os.getenv('BLOG_API_URL', 'http://localhost:3000')
        self.email = os.getenv('BLOG_EMAIL')
        self.password = os.getenv('BLOG_PASSWORD')
        self.cookies = None
        self.session = None
        
    async def __aenter__(self):
        """Async context manager entry"""
        # Create session with cookie jar
        jar = aiohttp.CookieJar()
        self.session = aiohttp.ClientSession(cookie_jar=jar)
        await self.login()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
            
    async def login(self) -> bool:
        """Login to blog API using cookie-based authentication"""
        if not self.email or not self.password:
            logger.error("Blog credentials not configured")
            return False
            
        try:
            url = f"{self.api_url}/api/v1/auth/login"
            payload = {
                "email": self.email,
                "password": self.password
            }
            
            async with self.session.post(url, json=payload) as response:
                if response.status in [200, 201]:
                    data = await response.json()
                    # Check if cookies were set
                    cookies = self.session.cookie_jar.filter_cookies(self.api_url)
                    if cookies:
                        logger.info(f"Successfully logged in as {self.email} with cookie-based auth")
                        return True
                    else:
                        logger.error(f"No cookies set in response")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"Login failed: {response.status} - {error_text}")
                    return False
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False
            
    def _get_headers(self) -> Dict[str, str]:
        """Get headers (cookies are handled automatically by session)"""
        headers = {"Content-Type": "application/json"}
        return headers
        
    async def create_post(self, title: str, content: str, tags: List[str] = None, 
                         category: str = "general", status: str = "draft") -> Optional[Dict[str, Any]]:
        """Create a new blog post"""
        try:
            url = f"{self.api_url}/api/v1/posts"
            
            # Ensure proper encoding
            title = self._ensure_utf8(title)
            content = self._ensure_utf8(content)
            
            # Only include fields that backend accepts
            payload = {
                "title": title,
                "content": content,
                "category": category,
                "tags": [self._ensure_utf8(tag) for tag in (tags or [])]
            }
            
            async with self.session.post(url, json=payload, headers=self._get_headers()) as response:
                if response.status in [200, 201]:
                    post = await response.json()
                    logger.info(f"Created post: {post.get('id')} - {post.get('title')}")
                    return post
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to create post: {response.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error creating post: {e}")
            return None
            
    async def update_post(self, post_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing blog post"""
        try:
            url = f"{self.api_url}/api/v1/posts/{post_id}"
            
            # Ensure proper encoding for text fields
            if 'title' in updates:
                updates['title'] = self._ensure_utf8(updates['title'])
            if 'content' in updates:
                updates['content'] = self._ensure_utf8(updates['content'])
            if 'tags' in updates:
                updates['tags'] = [self._ensure_utf8(tag) for tag in updates['tags']]
            
            async with self.session.patch(url, json=updates, headers=self._get_headers()) as response:
                if response.status == 200:
                    post = await response.json()
                    logger.info(f"Updated post: {post.get('id')} - {post.get('title')}")
                    return post
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to update post: {response.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error updating post: {e}")
            return None
            
    async def get_posts(self, status: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Get list of posts"""
        try:
            url = f"{self.api_url}/api/v1/posts"
            params = {"limit": limit}
            if status:
                params["status"] = status
                
            async with self.session.get(url, params=params, headers=self._get_headers()) as response:
                if response.status == 200:
                    data = await response.json()
                    posts = data.get('items', []) if isinstance(data, dict) else data
                    logger.info(f"Retrieved {len(posts)} posts")
                    return posts
                else:
                    logger.error(f"Failed to get posts: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error getting posts: {e}")
            return []
            
    async def get_post(self, post_id: int) -> Optional[Dict[str, Any]]:
        """Get a single post by ID"""
        try:
            url = f"{self.api_url}/api/v1/posts/{post_id}"
            
            async with self.session.get(url, headers=self._get_headers()) as response:
                if response.status == 200:
                    post = await response.json()
                    logger.info(f"Retrieved post: {post.get('id')} - {post.get('title')}")
                    return post
                else:
                    logger.error(f"Failed to get post: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error getting post: {e}")
            return None
            
    async def publish_post(self, post_id: int) -> bool:
        """Publish a draft post"""
        updates = {
            "status": "published",
            "publishedAt": datetime.now().isoformat()
        }
        result = await self.update_post(post_id, updates)
        return result is not None
        
    async def delete_post(self, post_id: int) -> bool:
        """Delete a post"""
        try:
            url = f"{self.api_url}/api/v1/posts/{post_id}"
            
            async with self.session.delete(url, headers=self._get_headers()) as response:
                if response.status in [200, 204]:
                    logger.info(f"Deleted post: {post_id}")
                    return True
                else:
                    logger.error(f"Failed to delete post: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Error deleting post: {e}")
            return False
    
    def _ensure_utf8(self, text: str) -> str:
        """Ensure text is properly encoded in UTF-8"""
        if not text:
            return text
        
        # Fix common encoding issues
        replacements = {
            '\u2019': "'",  # Right single quote
            '\u2018': "'",  # Left single quote  
            '\u201c': '"',  # Left double quote
            '\u201d': '"',  # Right double quote
            '\u2014': '—',  # Em dash
            '\u2013': '–',  # En dash
            '\u2026': '...',  # Ellipsis
            '\ufffd': '',  # Replacement character
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Ensure valid UTF-8
        try:
            text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        except Exception:
            pass
        
        return text
    
    async def create_and_publish_post(self, title: str, content: str, tags: List[str] = None,
                                    category: str = "general") -> Optional[Dict[str, Any]]:
        """Create and immediately publish a blog post"""
        # Create the post first
        post = await self.create_post(title, content, tags, category, "draft")
        
        if post and post.get('id'):
            # Publish it
            success = await self.publish_post(post['id'])
            if success:
                # Get the updated post
                return await self.get_post(post['id'])
        
        return post