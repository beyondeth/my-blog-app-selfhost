const jwt = require('jsonwebtoken');

const payload = {
  sub: '2b17dd33-f170-4f03-bbb0-f19e0895f9fd', // luticek88's ID
  id: '2b17dd33-f170-4f03-bbb0-f19e0895f9fd',
  email: 'luticek88@gmail.com',
  username: 'luticek88',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
};

const secret = 'your-super-secret-jwt-key-change-in-production';
const token = jwt.sign(payload, secret);

console.log(token);
