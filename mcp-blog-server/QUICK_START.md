# MCP Blog Server - Quick Start Guide

## 🚀 Fixed Issues

### ✅ 1. **Content Formatting & Encoding**
- Added proper UTF-8 encoding throughout the pipeline
- Enhanced markdown processing with better code block preservation
- Fixed emoji and special character rendering (no more �)
- Improved HTML conversion with proper escaping

### ✅ 2. **Simplified Posting Workflow**
- New `easy_post.py` script - one command posting!
- Automatic login and session management
- Smart content enhancement for blog readability
- No more file deletion issues

### ✅ 3. **Content Quality Enhancement**
- Auto-adds engaging introductions
- Improves spacing and formatting
- Adds call-to-action sections
- Transforms technical content to be blog-friendly

## 📝 Quick Usage

### Super Simple Posting (NEW!)

```bash
# Post any markdown file
python easy_post.py your-post.md

# Auto-publish immediately
python easy_post.py your-post.md --publish

# Interactive mode (no file needed)
python easy_post.py
```

### Alternative Methods

```bash
# Using the improved original script
python post_to_blog.py

# Direct MCP server usage (for Claude Code)
python -m src.mcp_server
```

## 🔧 Configuration

Make sure your `.env` file has:
```
BLOG_API_URL=http://localhost:3000
BLOG_EMAIL=your-email@example.com
BLOG_PASSWORD=your-password
```

## 🎯 Key Improvements

### Markdown Handler (`src/markdown_handler.py`)
- **Enhanced markdown converter** with better extension support
- **UTF-8 encoding fixes** for all text processing
- **Code block preservation** to prevent formatting issues
- **Smart excerpt generation** that removes markdown syntax
- **Content enhancement** for blog-friendly output

### Blog Client (`src/blog_client.py`)
- **UTF-8 encoding enforcement** on all API calls
- **Character replacement** for problematic Unicode
- **Combined create & publish** method for efficiency
- **Better error handling** with detailed logging

### Easy Post Script (`easy_post.py`)
- **Zero-config operation** - reads from .env automatically
- **Interactive mode** for quick posts without files
- **Auto-enhancement** of content for readability
- **Single command** posting with optional auto-publish

## 📚 Examples

### Example 1: Technical Blog Post
```bash
# Create a technical post and enhance it automatically
echo "# My Technical Discovery

I found an interesting optimization technique...

\`\`\`python
def optimized_function():
    return 'fast!'
\`\`\`

This improved performance by 50%! 🚀" > tech-post.md

python easy_post.py tech-post.md --publish
```

### Example 2: Quick Note
```bash
# Interactive posting
python easy_post.py
# Enter title: Quick Tip: Python Async
# Enter content...
# Tags: python, async, tips
```

## 🐛 Troubleshooting

### If emojis still show as �
- Check your terminal encoding: `echo $LANG` (should show UTF-8)
- Ensure database is UTF-8: Check MySQL/PostgreSQL charset

### If code blocks are broken
- The new markdown handler preserves code blocks properly
- Use triple backticks with language hints: \`\`\`python

### If posting fails
- Check `.env` credentials
- Verify backend is running: `http://localhost:3000`
- Check logs: `python easy_post.py 2>&1 | tee post.log`

## 🎉 Success Metrics

With these fixes, you should see:
- ✅ Proper emoji rendering (🚀 not �)
- ✅ Clean code block formatting
- ✅ Single command posting
- ✅ Engaging, readable blog content
- ✅ No more manual steps or file issues

## 💡 Pro Tips

1. **Batch Processing**: 
   ```bash
   for file in posts/*.md; do
     python easy_post.py "$file" --publish
   done
   ```

2. **Template Usage**:
   Create a template with frontmatter for consistent posts

3. **Auto-enhance**:
   The script automatically adds introductions and CTAs

## 📞 Need Help?

The codebase is now much simpler and more robust. Key files:
- `easy_post.py` - Main posting script
- `src/markdown_handler.py` - Content processing
- `src/blog_client.py` - API communication

Happy blogging! 🎈