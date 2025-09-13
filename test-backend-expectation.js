// This simulates what the backend expects

const crypto = require('crypto');

// Test values
const method = 'POST';
const uri_client = '/mcp/posts';  // What client thinks
const uri_backend = '/api/v1/mcp/posts';  // What backend receives
const keyId = 'akid_47f82a21352ec75f391a41100e5f490d';
const timestamp = '1234567890';
const nonce = 'test123';
const body = '{"title":"Test","content_markdown":"# Test","tags":["test"]}';
const secret = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

// Calculate signatures
const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

// Client signature (using wrong URI)
const message_client = [method, uri_client, keyId, timestamp, nonce, bodyHash].join(':');
const signature_client = crypto.createHmac('sha256', secret).update(message_client).digest('hex');

// Backend expects (using full URI)
const message_backend = [method, uri_backend, keyId, timestamp, nonce, bodyHash].join(':');
const signature_backend = crypto.createHmac('sha256', secret).update(message_backend).digest('hex');

console.log('=== SIGNATURE MISMATCH ANALYSIS ===\n');
console.log('Client generates:');
console.log('  URI:', uri_client);
console.log('  Message:', message_client);
console.log('  Signature:', signature_client);

console.log('\nBackend expects:');
console.log('  URI:', uri_backend);
console.log('  Message:', message_backend);
console.log('  Signature:', signature_backend);

console.log('\nMatch?', signature_client === signature_backend);
console.log('\nFIX: Client must use "/api/v1/mcp/posts" when generating signature!');