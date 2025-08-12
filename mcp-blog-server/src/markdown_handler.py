"""Markdown Handler for Blog Posts"""
import os
import re
import json
import logging
import html
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import frontmatter
import markdown
from markdown.extensions import codehilite, fenced_code, tables

logger = logging.getLogger(__name__)

class MarkdownHandler:
    def __init__(self):
        # Enhanced markdown converter with better code block support
        self.md_converter = markdown.Markdown(
            extensions=[
                'extra',
                'codehilite',
                'fenced_code',
                'tables',
                'nl2br',
                'sane_lists',
                'meta'
            ],
            extension_configs={
                'codehilite': {
                    'css_class': 'highlight',
                    'linenums': False,
                    'guess_lang': True
                },
                'fenced_code': {}
            }
        )
        
    def parse_markdown_file(self, file_path: str) -> Tuple[Dict[str, Any], str]:
        """Parse markdown file with frontmatter"""
        try:
            # Read with explicit UTF-8 encoding and error handling
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                # Use frontmatter.load directly with file handle
                post = frontmatter.load(f)
            
            # Fix encoding on the content
            post.content = self._fix_encoding(post.content)
                
            metadata = post.metadata
            content = post.content
            
            # Extract title from metadata or first H1
            title = metadata.get('title')
            if not title:
                h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                if h1_match:
                    title = h1_match.group(1)
                    # Remove the H1 from content if it's the title
                    content = re.sub(r'^#\s+.+\n?', '', content, count=1)
                else:
                    # Use filename as title
                    title = os.path.splitext(os.path.basename(file_path))[0]
                    title = title.replace('-', ' ').replace('_', ' ').title()
                    
            # Process metadata
            metadata['title'] = title
            metadata['slug'] = metadata.get('slug', self._create_slug(title))
            metadata['category'] = metadata.get('category', 'general')
            metadata['tags'] = metadata.get('tags', [])
            metadata['status'] = metadata.get('status', 'draft')
            # Create better excerpt
            excerpt = self._create_excerpt(content)
            metadata['excerpt'] = metadata.get('excerpt', excerpt)
            
            # Convert dates to ISO format
            if 'date' in metadata:
                metadata['publishedAt'] = self._format_date(metadata['date'])
            elif 'publishedAt' in metadata:
                metadata['publishedAt'] = self._format_date(metadata['publishedAt'])
                
            return metadata, content
            
        except Exception as e:
            logger.error(f"Error parsing markdown file {file_path}: {e}")
            raise
            
    def parse_markdown_content(self, content: str) -> Tuple[Dict[str, Any], str]:
        """Parse markdown content string with frontmatter"""
        try:
            post = frontmatter.loads(content)
            metadata = post.metadata
            body = post.content
            
            # Extract title from metadata or first H1
            title = metadata.get('title')
            if not title:
                h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
                if h1_match:
                    title = h1_match.group(1)
                    body = re.sub(r'^#\s+.+\n?', '', body, count=1)
                else:
                    title = "Untitled Post"
                    
            metadata['title'] = title
            metadata['slug'] = metadata.get('slug', self._create_slug(title))
            metadata['category'] = metadata.get('category', 'general')
            metadata['tags'] = metadata.get('tags', [])
            metadata['status'] = metadata.get('status', 'draft')
            # Create better excerpt
            excerpt = self._create_excerpt(body)
            metadata['excerpt'] = metadata.get('excerpt', excerpt)
            
            return metadata, body
            
        except Exception as e:
            # If no frontmatter, treat as plain markdown
            logger.info("No frontmatter found, treating as plain markdown")
            
            # Extract title from first H1
            title = "Untitled Post"
            h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            if h1_match:
                title = h1_match.group(1)
                content = re.sub(r'^#\s+.+\n?', '', content, count=1)
                
            metadata = {
                'title': title,
                'slug': self._create_slug(title),
                'category': 'general',
                'tags': [],
                'status': 'draft',
                'excerpt': self._create_excerpt(content)
            }
            
            return metadata, content
            
    def create_markdown_file(self, metadata: Dict[str, Any], content: str, file_path: str) -> bool:
        """Create a markdown file with frontmatter"""
        try:
            # Create frontmatter
            post = frontmatter.Post(content)
            post.metadata = metadata
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(frontmatter.dumps(post))
                
            logger.info(f"Created markdown file: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating markdown file {file_path}: {e}")
            return False
            
    def _create_slug(self, title: str) -> str:
        """Create URL-friendly slug from title"""
        slug = title.lower()
        # Remove special characters
        slug = re.sub(r'[^\w\s-]', '', slug)
        # Replace spaces with hyphens
        slug = re.sub(r'[-\s]+', '-', slug)
        # Remove leading/trailing hyphens
        slug = slug.strip('-')
        return slug
        
    def _format_date(self, date_value: Any) -> str:
        """Format date to ISO string"""
        if isinstance(date_value, str):
            return date_value
        elif isinstance(date_value, datetime):
            return date_value.isoformat()
        else:
            return datetime.now().isoformat()
            
    def convert_to_html(self, markdown_content: str) -> str:
        """Convert markdown to HTML with proper encoding"""
        # Fix encoding issues first
        markdown_content = self._fix_encoding(markdown_content)
        
        # Preserve code blocks
        markdown_content = self._preserve_code_blocks(markdown_content)
        
        # Convert to HTML
        html_content = self.md_converter.convert(markdown_content)
        
        # Post-process HTML for better display
        html_content = self._post_process_html(html_content)
        
        return html_content
        
    def extract_images(self, content: str) -> List[str]:
        """Extract image URLs from markdown content"""
        # Match markdown image syntax: ![alt](url)
        pattern = r'!\[.*?\]\((.*?)\)'
        images = re.findall(pattern, content)
        
        # Also match HTML img tags
        html_pattern = r'<img[^>]+src="([^"]+)"'
        images.extend(re.findall(html_pattern, content))
        
        return list(set(images))  # Remove duplicates
        
    def update_image_urls(self, content: str, url_mapping: Dict[str, str]) -> str:
        """Update image URLs in markdown content"""
        for old_url, new_url in url_mapping.items():
            # Replace in markdown syntax
            content = re.sub(
                r'(!\[.*?\]\()' + re.escape(old_url) + r'(\))',
                r'\1' + new_url + r'\2',
                content
            )
            # Replace in HTML img tags
            content = content.replace(f'src="{old_url}"', f'src="{new_url}"')
            
        return content
    
    def _fix_encoding(self, text: str) -> str:
        """Fix common encoding issues"""
        # Replace common problematic characters
        replacements = {
            '\u2019': "'",  # Right single quote
            '\u2018': "'",  # Left single quote
            '\u201c': '"',  # Left double quote
            '\u201d': '"',  # Right double quote
            '\u2014': '—',  # Em dash
            '\u2013': '–',  # En dash
            '\u2026': '...',  # Ellipsis
            '\u00a0': ' ',  # Non-breaking space
            '\ufffd': '',  # Replacement character
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Ensure emoji and special characters are preserved
        try:
            # Encode and decode to ensure valid UTF-8
            text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        except Exception:
            pass
        
        return text
    
    def _preserve_code_blocks(self, content: str) -> str:
        """Preserve code blocks from being mangled"""
        # Protect fenced code blocks
        code_block_pattern = r'```([\s\S]*?)```'
        
        def protect_code(match):
            code = match.group(1)
            # HTML encode the content to preserve it
            return f'```{html.escape(code, quote=False)}```'
        
        content = re.sub(code_block_pattern, protect_code, content)
        
        # Protect inline code
        inline_code_pattern = r'`([^`]+)`'
        
        def protect_inline(match):
            code = match.group(1)
            return f'`{html.escape(code, quote=False)}`'
        
        content = re.sub(inline_code_pattern, protect_inline, content)
        
        return content
    
    def _post_process_html(self, html_content: str) -> str:
        """Post-process HTML for better display"""
        # Ensure code blocks have proper formatting
        html_content = re.sub(
            r'<pre><code>([\s\S]*?)</code></pre>',
            lambda m: f'<pre><code>{html.unescape(m.group(1))}</code></pre>',
            html_content
        )
        
        # Add language class to code blocks if missing
        html_content = re.sub(
            r'<code>([\s\S]*?)</code>',
            r'<code class="language-text">\1</code>',
            html_content
        )
        
        return html_content
    
    def _create_excerpt(self, content: str, max_length: int = 200) -> str:
        """Create a clean excerpt from content"""
        # Remove markdown formatting
        excerpt = re.sub(r'#+ ', '', content)  # Remove headers
        excerpt = re.sub(r'\*\*([^*]+)\*\*', r'\1', excerpt)  # Remove bold
        excerpt = re.sub(r'\*([^*]+)\*', r'\1', excerpt)  # Remove italic
        excerpt = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', excerpt)  # Remove links
        excerpt = re.sub(r'`[^`]+`', '', excerpt)  # Remove inline code
        excerpt = re.sub(r'```[\s\S]*?```', '', excerpt)  # Remove code blocks
        excerpt = re.sub(r'\n+', ' ', excerpt)  # Replace newlines with spaces
        excerpt = re.sub(r'\s+', ' ', excerpt)  # Normalize whitespace
        excerpt = excerpt.strip()
        
        # Truncate to max length at word boundary
        if len(excerpt) > max_length:
            excerpt = excerpt[:max_length]
            last_space = excerpt.rfind(' ')
            if last_space > 0:
                excerpt = excerpt[:last_space]
            excerpt += '...'
        
        return excerpt
    
    def enhance_content_for_blog(self, content: str, metadata: Dict[str, Any]) -> str:
        """Transform technical content to be more blog-friendly"""
        # Add engaging introduction if missing
        if not content.startswith('#'):
            title = metadata.get('title', 'Blog Post')
            intro = f"# {title}\n\n"
            content = intro + content
        
        # Ensure proper spacing between sections
        content = re.sub(r'\n(#+)', r'\n\n\1', content)
        
        # Add call-to-action at the end if missing
        if not re.search(r'(결론|Conclusion|Summary|마무리)', content, re.IGNORECASE):
            content += "\n\n---\n\n💬 **여러분의 생각은 어떠신가요?** 댓글로 의견을 공유해주세요!\n"
        
        return content