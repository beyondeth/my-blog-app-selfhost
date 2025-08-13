const crypto = require('crypto');
const fetch = require('node-fetch');

// 테스트 설정
const API_URL = 'http://localhost:3000/api/v1';
const MCP_URL = 'http://localhost:3000/mcp';

// API 키 정보 (실제 테스트 시 실제 키로 교체 필요)
const API_KEY = 'sk_your_actual_api_key_here'; // 실제 API 키로 교체
const API_KEY_ID = 'your_api_key_id_here'; // 실제 API 키 ID로 교체

/**
 * HMAC 서명 생성
 */
function generateHMACSignature(signingSecret, timestamp, nonce, keyId) {
  const message = `${timestamp}:${nonce}:${keyId}`;
  return crypto
    .createHmac('sha256', signingSecret)
    .update(message)
    .digest('hex');
}

/**
 * 평문 API 키로 테스트 (기존 방식)
 */
async function testPlainApiKey() {
  console.log('\n=== Testing Plain API Key Authentication ===');
  
  try {
    const response = await fetch(`${MCP_URL}/status`, {
      headers: {
        'x-api-key': API_KEY
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Plain API key auth successful:', data);
    } else {
      console.log('❌ Plain API key auth failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * HMAC 서명으로 테스트 (새로운 방식)
 */
async function testHMACSignature() {
  console.log('\n=== Testing HMAC Signature Authentication ===');
  
  // 서명 시크릿은 API 키 발급 시 받은 값 (여기서는 API 키를 사용)
  const signingSecret = API_KEY; // 실제로는 별도의 서명 시크릿 사용
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = generateHMACSignature(signingSecret, timestamp, nonce, API_KEY_ID);

  console.log('Timestamp:', timestamp);
  console.log('Nonce:', nonce);
  console.log('Signature:', signature);
  console.log('Key ID:', API_KEY_ID);

  try {
    const response = await fetch(`${MCP_URL}/status`, {
      headers: {
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
        'x-api-key-id': API_KEY_ID
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ HMAC signature auth successful:', data);
    } else {
      console.log('❌ HMAC signature auth failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 2단계 인증 테스트
 */
async function testTwoFactorAuth() {
  console.log('\n=== Testing Two-Factor Authentication ===');
  
  const credentials = {
    email: 'test@example.com', // 실제 사용자 이메일로 교체
    password: 'test123' // 실제 패스워드로 교체
  };

  try {
    const response = await fetch(`${MCP_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(credentials)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Two-factor auth successful:', data);
    } else {
      console.log('❌ Two-factor auth failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// 메인 실행 함수
async function main() {
  console.log('Starting MCP Authentication Tests...\n');
  console.log('⚠️  Note: Replace API_KEY and API_KEY_ID with actual values before running!');
  
  // 평문 API 키 테스트
  await testPlainApiKey();
  
  // HMAC 서명 테스트
  await testHMACSignature();
  
  // 2단계 인증 테스트
  await testTwoFactorAuth();
  
  console.log('\n=== Tests Complete ===');
}

// 테스트 실행
main().catch(console.error);