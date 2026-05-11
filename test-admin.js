const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  
  await client.connect();
  const result = await client.query('SELECT * FROM users WHERE user_id = $1', ['admin']);
  const isValid = await bcrypt.compare('admin123', result.rows[0].password_hash);
  console.log('Admin login test:', isValid ? '✅ SUCCESS' : '❌ FAILED');
  await client.end();
})();