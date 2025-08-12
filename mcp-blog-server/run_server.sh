#!/bin/bash

# Blog MCP Server Launch Script

# Set working directory
cd /Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server

# Activate virtual environment
source .venv/bin/activate

# Set environment variables
export BLOG_MCP_CONFIG="/Users/sihyungpark/.blog-mcp"
export PYTHONPATH="/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server/src"

# Run the MCP server
exec python src/mcp_server.py