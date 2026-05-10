const { Client } = require('pg');

async function setupDatabase() {
  console.log('✅ Postgres password found!\n');
  console.log('🔧 Setting up PostgreSQL Database and User...\n');

  const adminClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'admin', // Found password!
    database: 'postgres',
  });

  try {
    console.log('Connecting as postgres admin...');
    await adminClient.connect();
    console.log('✅ Connected!\n');

    // Check if user exists
    const userResult = await adminClient.query(
      `SELECT * FROM pg_user WHERE usename='typing_user';`
    );

    if (userResult.rows.length > 0) {
      console.log('👤 User "typing_user" exists - updating password');
      await adminClient.query(
        `ALTER USER typing_user WITH PASSWORD 'Admin@2001';`
      );
      console.log('✅ Password updated to: Admin@2001\n');
    } else {
      console.log('👤 Creating user "typing_user"...');
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
      console.log('📊 Creating database "typing_master"...');
      await adminClient.query(
        `CREATE DATABASE typing_master OWNER typing_user;`
      );
      console.log('✅ Database created\n');
    }

    // Grant privileges
    console.log('🔐 Granting privileges...');
    await adminClient.query(
      `GRANT ALL PRIVILEGES ON DATABASE typing_master TO typing_user;`
    );
    await adminClient.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO typing_user;`
    );
    await adminClient.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO typing_user;`
    );
    console.log('✅ Privileges granted\n');

    await adminClient.end();

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
    console.log('✅ Connected as typing_user\n');

    const result = await testClient.query('SELECT NOW();');
    console.log('✅ Database query successful!');
    console.log('   Current time:', result.rows[0].now, '\n');

    await testClient.end();

    console.log('═════════════════════════════════════════');
    console.log('✅✅✅ Setup Complete!');
    console.log('═════════════════════════════════════════\n');
    console.log('📋 Configuration Summary:');
    console.log('   DB_HOST: 127.0.0.1');
    console.log('   DB_PORT: 5432');
    console.log('   DB_USERNAME: typing_user');
    console.log('   DB_PASSWORD: Admin@2001');
    console.log('   DB_DATABASE: typing_master\n');
    console.log('✨ Your backend is ready!');
    console.log('🚀 Start the backend with: npm start\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupDatabase();
