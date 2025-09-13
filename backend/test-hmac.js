const crypto = require('crypto');

// API Key 정보 (실제 값)
const keyId = 'akid_9920609538de2d66c62765b112f9c740';
const keySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';

// 테스트 데이터
const method = 'POST';
const uri = '/api/v1/mcp/posts';
const timestamp = Date.now().toString();
const nonce = crypto.randomBytes(16).toString('hex');
const body = JSON.stringify({
  title: '오라클(Oracle) 주가 36% 급등: 트럼프의 5000억 달러 AI 프로젝트 \"Stargate\" 발표',
  content_markdown: '테스트 콘텐츠',
  tags: ['oracle', 'ai', 'stargate']
});

// Body hash 생성
const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

// 서명 메시지 생성
const message = [
  method,
  uri,
  keyId,
  timestamp,
  nonce,
  bodyHash
].join(':');

// HMAC 서명 생성
const signature = crypto
  .createHmac('sha256', keySecret)
  .update(message)
  .digest('hex');

console.log('테스트 HMAC 서명 생성');
console.log('========================');
console.log('Method:', method);
console.log('URI:', uri);
console.log('Key ID:', keyId);
console.log('Timestamp:', timestamp);
console.log('Nonce:', nonce);
console.log('Body (first 100 chars):', body.substring(0, 100));
console.log('Body Hash:', bodyHash);
console.log('Message:', message);
console.log('Signature:', signature);
console.log('Key Secret (first 10 chars):', keySecret.substring(0, 10) + '...');

// curl 명령어 생성
console.log('\n테스트 curl 명령어:');
console.log(`curl -X POST http://localhost:3000/api/v1/mcp/posts \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key-ID: ${keyId}" \\
  -H "X-Timestamp: ${timestamp}" \\
  -H "X-Nonce: ${nonce}" \\
  -H "X-Signature: ${signature}" \\
  -H "X-MCP-Client: test-script" \\
  -d '${body}'`);