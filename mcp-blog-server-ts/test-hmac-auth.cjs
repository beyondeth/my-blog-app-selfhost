const crypto = require('crypto');

// API 키 정보
const apiKeyId = 'akid_9920609538de2d66c62765b112f9c740';
const apiKeySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const apiUrl = 'http://localhost:3000';

// HMAC 서명 생성
function createHmacSignature(method, uri, timestamp, nonce, body, secret) {
  // 1. Create Canonical Request
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
  
  console.log('Canonical Request:', canonicalRequest);
  
  // 2. Create String to Sign
  const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
  
  console.log('String to Sign:', stringToSign);
  
  // 3. Create signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
  
  console.log('Generated Signature:', signature);
  
  return signature;
}

async function testAuthentication() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const body = JSON.stringify({
    apiKeyId: apiKeyId,
    timestamp,
    nonce,
  });
  
  const signature = createHmacSignature(
    'POST',
    '/mcp/auth/verify',
    timestamp,
    nonce,
    body,
    apiKeySecret
  );
  
  console.log('\n=== 인증 요청 ===');
  console.log('API Key ID:', apiKeyId);
  console.log('Timestamp:', timestamp);
  console.log('Nonce:', nonce);
  console.log('Signature:', signature);
  console.log('Body:', body);
  
  try {
    const response = await fetch(`${apiUrl}/mcp/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-Id': apiKeyId,
        'X-API-Signature': signature,
        'X-API-Timestamp': timestamp,
        'X-API-Nonce': nonce,
      },
      body: body,
    });
    
    console.log('\n=== 서버 응답 ===');
    console.log('Status:', response.status);
    
    const responseText = await response.text();
    console.log('Response:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\n✅ 인증 성공!');
      console.log('Blog:', data.blog);
      return data;
    } else {
      console.log('\n❌ 인증 실패');
    }
  } catch (error) {
    console.error('\n❌ 요청 실패:', error.message);
  }
}

// 테스트 실행
testAuthentication();