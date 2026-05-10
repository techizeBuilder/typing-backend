const { Client } = require('pg');

async function testConnection() {
  console.log('🔗 Testing PostgreSQL Connection...\n');
  console.log('Connection Details:');
  console.log('  Host: 127.0.0.1');
  console.log('  Port: 5432');
  console.log('  User: typing_user');
  console.log('  Database: typing_master\n');

  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'typing_user',
    password: 'Admin@2001',
    database: 'typing_master',
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connection Successful!\n');

    // Run test query
    const result = await client.query('SELECT NOW() as current_time;');
    console.log('✅ Query Result:');
    console.log(`   Current Time: ${result.rows[0].current_time}\n`);

    // Get database info
    const dbInfo = await client.query(
      `SELECT datname, pg_database.datdba, pg_user.usename 
       FROM pg_database 
       JOIN pg_user ON pg_database.datdba = pg_user.usesysid 
       WHERE datname = 'typing_master';`
    );
    console.log('✅ Database Info:');
    console.log(`   Database: ${dbInfo.rows[0].datname}`);
    console.log(`   Owner: ${dbInfo.rows[0].usename}\n`);

    // Get tables count
    const tables = await client.query(
      `SELECT COUNT(*) as table_count 
       FROM information_schema.tables 
       WHERE table_schema = 'public';`
    );
    console.log(`✅ Tables in database: ${tables.rows[0].table_count}\n`);

    console.log('✅✅✅ ALL TESTS PASSED! Database is ready for NestJS.\n');
    console.log('Run: npm start');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed!\n');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if PostgreSQL service is running');
    console.error('2. Verify credentials in .env file');
    console.error('3. Ensure database "typing_master" exists');
    console.error('4. Ensure user "typing_user" exists with password "Admin@2001"');
    process.exit(1);
  }
}

testConnection();
