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
  title: '오라클 주가 36% 급등 - Stargate 프로젝트',
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
console.log('Signature:', signature);

// curl 명령어 실행
const { exec } = require('child_process');
const curlCmd = `curl -X POST http://localhost:3000/api/v1/mcp/posts \
  -H "Content-Type: application/json" \
  -H "X-API-Key-ID: ${keyId}" \
  -H "X-Timestamp: ${timestamp}" \
  -H "X-Nonce: ${nonce}" \
  -H "X-Signature: ${signature}" \
  -H "X-MCP-Client: test-script" \
  -d '${body}'`;

console.log('\nExecuting curl command...');
exec(curlCmd, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Response:', stdout);
  if (stderr) console.error('Stderr:', stderr);
});