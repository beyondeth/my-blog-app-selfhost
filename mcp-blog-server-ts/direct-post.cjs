#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const apiKeyId = 'akid_9920609538de2d66c62765b112f9c740';
const apiKeySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const apiUrl = 'http://localhost:3000/api/v1';

// Parse markdown file
function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const metadata = {
    title: 'Untitled',
    tags: []
  };
  let body = content;
  
  // Parse front matter
  if (content.startsWith('---')) {
    const parts = content.split('---', 3);
    if (parts.length >= 3) {
      const front = parts[1].trim();
      body = parts[2].trim();
      
      for (const line of front.split('\n')) {
        if (line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          
          if (key.trim() === 'title') {
            metadata.title = value.replace(/['"]/g, '');
          } else if (key.trim() === 'tags') {
            const tagStr = value.replace(/[\[\]]/g, '');
            metadata.tags = tagStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
          }
        }
      }
    }
  }
  
  // Extract title from first h1 if not in front matter
  if (metadata.title === 'Untitled') {
    const h1Match = body.match(/^#\s+(.+)$/m);
    if (h1Match) {
      metadata.title = h1Match[1];
    }
  }
  
  return { metadata, body };
}

// Create AWS-style signature
function createAwsStyleSignature(method, uri, timestamp, nonce, body = '', secret) {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
  return signature;
}

async function authenticate() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/auth/verify-api-key-id-secret';
  
  const body = JSON.stringify({
    keyId: apiKeyId,
    keySecret: apiKeySecret,
    timestamp,
    nonce,
  });
  
  const signature = createAwsStyleSignature(method, uri, timestamp, nonce, body, apiKeySecret);
  
  const response = await fetch(`${apiUrl}${uri}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key-ID': apiKeyId,
      'X-API-Signature': signature,
      'X-API-Timestamp': timestamp,
      'X-API-Nonce': nonce,
    },
    body,
  });
  
  const data = await response.json();
  
  if (response.ok && data.valid) {
    console.log('✅ Authentication successful');
    return {
      accessToken: data.sessionToken,
      blogInfo: data.blog
    };
  } else {
    throw new Error('Authentication failed');
  }
}

async function createPost(filePath, auth) {
  const { metadata, body } = parseMarkdown(filePath);
  
  console.log(`📝 Creating post: ${metadata.title}`);
  console.log(`🏷️ Tags: ${metadata.tags.join(', ')}`);
  
  const response = await fetch(`${apiUrl}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({
      title: metadata.title,
      content_markdown: body,
      tags: metadata.tags,
    }),
  });
  
  if (response.ok) {
    const post = await response.json();
    const postUrl = `http://localhost:3000/blog/${auth.blogInfo.slug}/posts/${post.slug}`;
    console.log(`✅ Post created successfully!`);
    console.log(`🔗 URL: ${postUrl}`);
    return post;
  } else {
    const error = await response.text();
    throw new Error(`Failed to create post: ${error}`);
  }
}

// Main execution
async function main() {
  const filePath = '/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server/posts/20250817_블로그_MCP_자동포스팅_시스템_아키텍처_분석_및_토큰_최적화_방안.md';
  
  console.log('🚀 Starting blog post creation...\n');
  
  try {
    // Authenticate
    const auth = await authenticate();
    console.log(`📝 Blog: ${auth.blogInfo.name}`);
    console.log(`🔗 Slug: ${auth.blogInfo.slug}\n`);
    
    // Create post
    await createPost(filePath, auth);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();