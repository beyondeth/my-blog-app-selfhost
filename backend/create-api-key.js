const crypto = require('crypto');
const bcrypt = require('bcrypt');

// 준비된 API Key 정보
const keyId = 'akid_9920609538de2d66c62765b112f9c740';
const keySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';

// 사용자와 블로그 정보 (기존 데이터에서 가져옴)
const userId = '9312f395-16c0-4506-b302-42302887a20f';
const blogId = '680e2e91-2578-4b3a-a96d-90d047165e94';

async function createApiKey() {
  // keySecret 해시
  const hashedSecret = await bcrypt.hash(keySecret, 10);
  
  // signingSecret 암호화
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || 'default-encryption-key-for-dev',
    'salt',
    32
  );
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(keySecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // IV + authTag + encrypted를 합쳐서 저장
  const encryptedSecret = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  
  console.log('API Key Creation Data:');
  console.log('======================');
  console.log('keyId:', keyId);
  console.log('keySecret (hashed):', hashedSecret);
  console.log('signingSecret (encrypted):', encryptedSecret);
  console.log('userId:', userId);
  console.log('blogId:', blogId);
  
  // SQL 쿼리 생성
  const sql = `
INSERT INTO api_keys (
  id,
  "keyId",
  "keySecret",
  "signingSecret",
  name,
  "userId",
  "blogId",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  '${crypto.randomUUID()}',
  '${keyId}',
  '${hashedSecret}',
  '${encryptedSecret}',
  'MCP Server Key',
  '${userId}',
  '${blogId}',
  true,
  NOW(),
  NOW()
);`;

  console.log('\nSQL Query:');
  console.log(sql);
}

createApiKey().catch(console.error);