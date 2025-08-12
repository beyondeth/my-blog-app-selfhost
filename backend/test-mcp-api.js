// Test script for MCP API endpoints
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// Test data
const testUser = {
  email: 'mcp-test@example.com',
  password: 'Test123!@#',
  username: 'mcptestuser',
};

const testBlog = {
  name: 'MCP Test Blog',
  slug: 'mcp-test-blog',
  description: 'A test blog for MCP integration',
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMcpApi() {
  let jwtToken;
  let userId;
  let blogId;
  let apiKey;
  
  try {
    console.log('🚀 Starting MCP API test...\n');
    
    // 1. Register user
    console.log('1️⃣ Registering test user...');
    try {
      const registerRes = await axios.post(`${API_BASE_URL}/api/v1/auth/register`, testUser);
      console.log('✅ User registered successfully');
      jwtToken = registerRes.data.access_token;
      userId = registerRes.data.user.id;
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️ User already exists, logging in instead...');
        const loginRes = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });
        jwtToken = loginRes.data.access_token;
        userId = loginRes.data.user.id;
        console.log('✅ Logged in successfully');
        console.log('   JWT Token:', jwtToken ? jwtToken.substring(0, 20) + '...' : 'NOT RECEIVED');
        console.log('   User ID:', userId);
      } else {
        throw error;
      }
    }
    
    // 2. Create blog
    console.log('\n2️⃣ Creating test blog...');
    try {
      const blogRes = await axios.post(
        `${API_BASE_URL}/api/v1/blogs`,
        testBlog,
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      blogId = blogRes.data.id;
      console.log(`✅ Blog created: ${blogRes.data.name} (${blogRes.data.slug})`);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️ Blog already exists, fetching existing blog...');
        const blogsRes = await axios.get(`${API_BASE_URL}/api/v1/blogs/my-blogs`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        const existingBlog = blogsRes.data.find(b => b.slug === testBlog.slug);
        if (existingBlog) {
          blogId = existingBlog.id;
          console.log(`✅ Using existing blog: ${existingBlog.name}`);
        } else {
          throw new Error('Could not find existing blog');
        }
      } else {
        throw error;
      }
    }
    
    // 3. Create API key
    console.log('\n3️⃣ Creating API key...');
    const apiKeyRes = await axios.post(
      `${API_BASE_URL}/api/v1/api-keys`,
      {
        name: 'MCP Test Key',
        description: 'API key for MCP testing',
        blogId: blogId,
      },
      {
        headers: { Authorization: `Bearer ${jwtToken}` },
      }
    );
    apiKey = apiKeyRes.data.plainKey;
    console.log(`✅ API key created: ${apiKey.substring(0, 10)}...`);
    
    // 4. Test MCP endpoints with API key
    console.log('\n4️⃣ Testing MCP endpoints with API key...\n');
    
    // Test blog info
    console.log('📝 Getting blog info...');
    const blogInfoRes = await axios.get(`${API_BASE_URL}/mcp/blog`, {
      headers: { 'x-api-key': apiKey },
    });
    console.log(`✅ Blog info: ${JSON.stringify(blogInfoRes.data, null, 2)}`);
    
    // Test API status
    console.log('\n📊 Checking API status...');
    const statusRes = await axios.get(`${API_BASE_URL}/mcp/status`, {
      headers: { 'x-api-key': apiKey },
    });
    console.log(`✅ API status: ${JSON.stringify(statusRes.data, null, 2)}`);
    
    // Create a post
    console.log('\n✍️ Creating a test post...');
    const postRes = await axios.post(
      `${API_BASE_URL}/mcp/posts`,
      {
        title: 'Test Post from MCP',
        content: '# Hello from MCP!\n\nThis is a test post created via the MCP API.',
        category: 'Testing',
        tags: ['mcp', 'api', 'test'],
      },
      {
        headers: { 'x-api-key': apiKey },
      }
    );
    const postId = postRes.data.id;
    console.log(`✅ Post created: ${postRes.data.title} (ID: ${postId})`);
    
    // List posts
    console.log('\n📚 Listing posts...');
    const postsRes = await axios.get(`${API_BASE_URL}/mcp/posts`, {
      headers: { 'x-api-key': apiKey },
    });
    console.log(`✅ Found ${postsRes.data.total} posts`);
    postsRes.data.posts.forEach(post => {
      console.log(`   - ${post.title} (${post.publishedAt})`);
    });
    
    // Update the post
    console.log('\n✏️ Updating the post...');
    const updateRes = await axios.put(
      `${API_BASE_URL}/mcp/posts/${postId}`,
      {
        title: 'Updated Test Post from MCP',
        content: '# Updated!\n\nThis post has been updated via the MCP API.',
      },
      {
        headers: { 'x-api-key': apiKey },
      }
    );
    console.log(`✅ Post updated: ${updateRes.data.title}`);
    
    // Delete the post
    console.log('\n🗑️ Deleting the post...');
    await axios.delete(`${API_BASE_URL}/mcp/posts/${postId}`, {
      headers: { 'x-api-key': apiKey },
    });
    console.log('✅ Post deleted successfully');
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📌 You can use this API key with the MCP server:');
    console.log(`   API Key: ${apiKey}`);
    console.log(`   Blog Slug: ${testBlog.slug}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testMcpApi();