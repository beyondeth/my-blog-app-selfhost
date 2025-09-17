const { Client } = require('pg');
require('dotenv').config();

async function deleteBlock() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(
      "DELETE FROM user_blocks WHERE blocker_id = 'b7eadfd4-4d45-4d00-94e3-0bed40ea9086' AND blocked_id = '9312f395-16c0-4506-b302-42302887a20f'"
    );
    console.log('Block record deleted:', result.rowCount, 'rows');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteBlock();