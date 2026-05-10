const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'typing_app_db',
  password: '997Deepak@',
  port: 5432,
});

async function clearResults() {
  try {
    await pool.query('TRUNCATE TABLE results CASCADE;');
    console.log('Results table cleared successfully.');
  } catch (err) {
    console.error('Error clearing results table:', err);
  } finally {
    pool.end();
  }
}

clearResults();
