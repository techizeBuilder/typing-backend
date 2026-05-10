const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🔧 PostgreSQL Setup Wizard\n');
  
  const postgresPass = await prompt(
    'Enter postgres admin password (or press Enter if unsure): '
  );

  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: postgresPass || undefined,
    database: 'postgres',
  });

  try {
    console.log('\n⏳ Connecting as postgres...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Create or update typing_user
    console.log('Setting up typing_user...');
    
    // First check if user exists
    const userCheck = await client.query(
      "SELECT usename FROM pg_user WHERE usename = 'typing_user';"
    );

    if (userCheck.rows.length > 0) {
      console.log('  User typing_user exists, updating password...');
      await client.query("ALTER USER typing_user WITH PASSWORD 'Admin@2001';");
    } else {
      console.log('  Creating user typing_user...');
      await client.query(
        "CREATE USER typing_user WITH PASSWORD 'Admin@2001';"
      );
    }
    console.log('✅ User setup complete\n');

    // Create or verify database
    console.log('Setting up typing_master database...');
    
    const dbCheck = await client.query(
      "SELECT datname FROM pg_database WHERE datname = 'typing_master';"
    );

    if (dbCheck.rows.length === 0) {
      console.log('  Creating database typing_master...');
      await client.query('CREATE DATABASE typing_master OWNER typing_user;');
    } else {
      console.log('  Database typing_master already exists');
    }
    console.log('✅ Database setup complete\n');

    // Grant privileges
    console.log('Granting privileges...');
    await client.query('GRANT ALL PRIVILEGES ON DATABASE typing_master TO typing_user;');
    console.log('✅ Privileges granted\n');

    await client.end();

    // Test connection with typing_user
    console.log('Testing connection with typing_user...');
    const testClient = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: 'typing_user',
      password: 'Admin@2001',
      database: 'typing_master',
    });

    await testClient.connect();
    const result = await testClient.query('SELECT NOW();');
    console.log('✅ Success! Connection test passed\n');
    console.log('Current database time:', result.rows[0].now);
    await testClient.end();

    console.log('\n✅✅✅ Setup Complete! Ready to start NestJS backend.');
    console.log('Run: npm start\n');

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
