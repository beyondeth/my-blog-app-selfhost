const crypto = require('crypto');

const apiKeyId = 'akid_9920609538de2d66c62765b112f9c740';
const apiKeySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const baseUrl = 'http://localhost:3000/api/v1';

function generateHmacSignature(method, uri, timestamp, nonce, body) {
  // 1. Create body hash
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

  // 2. Create message to sign - MUST match backend exactly
  // Backend format: method:uri:keyId:timestamp:nonce:bodyHash
  const message = [
    method,
    uri,
    apiKeyId,
    timestamp,
    nonce,
    bodyHash
  ].join(':');

  // 3. Generate HMAC signature with Secret
  const signature = crypto
    .createHmac('sha256', apiKeySecret)
    .update(message)
    .digest('hex');

  return signature;
}

async function testReadPost() {
  const slug = 'test-markdown-1757701925571';
  const uri = `/api/v1/mcp/posts/read/${slug}`;
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const body = '';

  const signature = generateHmacSignature('GET', uri, timestamp, nonce, body);

  console.log('Reading post:', slug);
  console.log('URI:', uri);

  const response = await fetch(baseUrl + `/mcp/posts/read/${slug}`, {
    method: 'GET',
    headers: {
      'x-api-key-id': apiKeyId,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-mcp-client': 'test-client'
    }
  });

  const result = await response.json();

  console.log('\n=== Response Status ===');
  console.log('Status:', response.status);

  if (response.status !== 200) {
    console.log('Error:', result);
    return;
  }

  console.log('\n=== Post Fields ===');
  console.log('Title:', result.title);
  console.log('Slug:', result.slug);
  console.log('Has content_markdown:', result.content_markdown ? 'YES' : 'NO');
  console.log('Has content (HTML):', result.content ? 'YES' : 'NO');

  if (result.content_markdown) {
    console.log('\n=== Markdown Content (first 200 chars) ===');
    console.log(result.content_markdown.substring(0, 200));
  } else {
    console.log('\n⚠️  content_markdown field is NOT included in the response!');
  }

  if (result.content) {
    console.log('\n=== HTML Content (first 300 chars) ===');
    console.log(result.content.substring(0, 300));
  }
}

testReadPost().catch(console.error);