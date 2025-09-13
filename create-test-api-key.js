const crypto = require('crypto');

async function createApiKey() {
  // First authenticate to get a token
  const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'luticek88@gmail.com',
      password: '123123',
    }),
  });

  if (!loginResponse.ok) {
    console.error('Login failed:', await loginResponse.text());
    return;
  }

  const { accessToken } = await loginResponse.json();
  console.log('✅ Logged in successfully');

  // Create API key
  const apiKeyResponse = await fetch('http://localhost:3000/api/v1/api-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Test MCP Key',
    }),
  });

  if (!apiKeyResponse.ok) {
    console.error('API key creation failed:', await apiKeyResponse.text());
    return;
  }

  const apiKey = await apiKeyResponse.json();
  console.log('\n✅ API Key Created Successfully!');
  console.log('====================================');
  console.log('Key ID:', apiKey.keyId);
  console.log('Secret:', apiKey.keySecret);
  console.log('Plain Key:', apiKey.plainApiKey);
  console.log('====================================');
  console.log('\nUse these values for testing:');
  console.log(`const apiKeyId = '${apiKey.keyId}';`);
  console.log(`const apiKeySecret = '${apiKey.keySecret}';`);
}

createApiKey().catch(console.error);