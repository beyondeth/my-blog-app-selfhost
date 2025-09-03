#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Environment variables for authentication
process.env.BLOG_API_KEY_ID = 'akid_9920609538de2d66c62765b112f9c740';
process.env.BLOG_API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
process.env.BLOG_API_URL = 'http://localhost:3000/api/v1';

async function postAllMarkdownFiles() {
  const postsDir = '/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server/posts';
  
  console.log('📚 Starting batch auto-posting...');
  console.log('===================================\n');
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const results = [];
  
  try {
    // Get all MD files
    const files = await fs.readdir(postsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`📁 Found ${mdFiles.length} markdown files\n`);
    
    // Load the MCP module
    const { SecureAPIKeyAuth } = await import('/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server-ts/dist/lib/auth.js');
    const { readMarkdownFile, extractMetadata } = await import('/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server-ts/dist/lib/filesystem.js');
    
    // Initialize auth
    const auth = new SecureAPIKeyAuth();
    const authResult = await auth.authenticate();
    
    if (!authResult) {
      console.error('❌ Authentication failed');
      return;
    }
    
    console.log('✅ Authentication successful');
    console.log(`📝 Blog: ${auth.blogInfo?.name || 'Unknown'}`);
    console.log(`🔗 Slug: ${auth.blogInfo?.slug || 'Unknown'}\n`);
    
    // Process each file
    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i];
      const filePath = path.join(postsDir, file);
      const fileStartTime = Date.now();
      
      console.log(`[${i + 1}/${mdFiles.length}] Processing: ${file}`);
      
      try {
        // Read and parse the markdown file
        const content = await readMarkdownFile(filePath);
        const metadata = extractMetadata(content);
        
        // Check if already posted (simple check based on filename pattern)
        if (file.includes('20250902_')) {
          console.log('  ⏭️  Skipping (already posted today)\n');
          skipCount++;
          results.push({ file, status: 'skipped', time: 0 });
          continue;
        }
        
        // Create the post
        const response = await fetch(`${auth.apiUrl}/posts/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            title: metadata.title || file.replace('.md', '').replace(/_/g, ' '),
            content: content,
            published: true,
            commentsEnabled: true,
            blogId: auth.blogId,
            tags: metadata.tags || []
          })
        });
        
        const fileTime = Date.now() - fileStartTime;
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ Posted successfully (${fileTime}ms)`);
          console.log(`  🔗 Slug: ${data.slug}\n`);
          successCount++;
          results.push({ file, status: 'success', time: fileTime, slug: data.slug });
        } else {
          const error = await response.text();
          console.log(`  ❌ Failed: ${error.substring(0, 100)} (${fileTime}ms)\n`);
          failCount++;
          results.push({ file, status: 'failed', time: fileTime, error });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        const fileTime = Date.now() - fileStartTime;
        console.log(`  ❌ Error: ${error.message} (${fileTime}ms)\n`);
        failCount++;
        results.push({ file, status: 'error', time: fileTime, error: error.message });
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
  
  // Final report
  const totalTime = Date.now() - startTime;
  const avgTime = successCount > 0 ? Math.round(results
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + r.time, 0) / successCount) : 0;
  
  console.log('\n=====================================');
  console.log('📊 BATCH POSTING COMPLETE');
  console.log('=====================================');
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`⚡ Avg Time per Post: ${avgTime}ms`);
  console.log('=====================================\n');
  
  // Show failed files if any
  if (failCount > 0) {
    console.log('Failed files:');
    results.filter(r => r.status === 'failed' || r.status === 'error')
      .forEach(r => console.log(`  - ${r.file}: ${r.error?.substring(0, 50)}`));
  }
}

// Run the batch posting
postAllMarkdownFiles().catch(console.error);