const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupDatabase() {
  console.log('🔧 Setting up PostgreSQL Database and User...\n');

  const postgresPassword = await prompt(
    'Enter PostgreSQL postgres password (press Enter if none): '
  );

  const adminClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: postgresPassword || undefined,
    database: 'postgres',
  });

  try {
    console.log('\nConnecting as postgres admin...');
    await adminClient.connect();
    console.log('✅ Connected as postgres\n');

    // Check if user exists
    const userResult = await adminClient.query(
      `SELECT * FROM pg_user WHERE usename='typing_user';`
    );

    if (userResult.rows.length > 0) {
      console.log('👤 User "typing_user" already exists');
      console.log('   Resetting password to: Admin@2001\n');

      await adminClient.query(
        `ALTER USER typing_user WITH PASSWORD 'Admin@2001';`
      );
      console.log('✅ Password updated\n');
    } else {
      console.log('👤 User "typing_user" does not exist');
      console.log('   Creating user...\n');

      await adminClient.query(
        `CREATE USER typing_user WITH PASSWORD 'Admin@2001';`
      );
      console.log('✅ User created\n');
    }

    // Check if database exists
    const dbResult = await adminClient.query(
      `SELECT datname FROM pg_database WHERE datname='typing_master';`
    );

    if (dbResult.rows.length > 0) {
      console.log('📊 Database "typing_master" already exists');
    } else {
      console.log('📊 Database "typing_master" does not exist');
      console.log('   Creating database...\n');

      await adminClient.query(`CREATE DATABASE typing_master OWNER typing_user;`);
      console.log('✅ Database created\n');
    }

    // Grant privileges
    console.log('🔐 Granting privileges...');
    await adminClient.query(
      `GRANT ALL PRIVILEGES ON DATABASE typing_master TO typing_user;`
    );
    console.log('✅ Privileges granted\n');

    // Test connection with new user
    console.log('Testing connection with typing_user credentials...\n');
    const testClient = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: 'typing_user',
      password: 'Admin@2001',
      database: 'typing_master',
    });

    await testClient.connect();
    console.log('✅ Successfully connected as typing_user\n');

    const result = await testClient.query('SELECT NOW();');
    console.log('✅ Database query successful!');
    console.log('   Current time:', result.rows[0].now, '\n');

    await testClient.end();
    console.log('✅✅✅ Setup complete! Database is ready.\n');
    console.log('📌 Credentials saved in .env:');
    console.log('   DB_USERNAME: typing_user');
    console.log('   DB_PASSWORD: Admin@2001\n');
    console.log('You can now start your NestJS backend with: npm start');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. PostgreSQL is not running');
    console.error('2. Wrong postgres password');
    console.error('3. PostgreSQL not accessible at 127.0.0.1:5432');
  } finally {
    rl.close();
    await adminClient.end();
  }
}

setupDatabase();
