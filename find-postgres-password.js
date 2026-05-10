const { Client } = require('pg');

const commonPasswords = [
  'postgres',
  'password',
  'admin',
  'Admin@2001',
  '123456',
  'password123',
  'admin123',
  '',
  null,
];

async function tryPassword(password) {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: password === null ? undefined : password,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS! Postgres password is: "${password}"`);
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Trying common passwords for postgres user...\n');

  for (const password of commonPasswords) {
    const displayPass = password === null ? '(empty)' : password === '' ? '(empty string)' : password;
    process.stdout.write(`Trying "${displayPass}"... `);
    
    if (await tryPassword(password)) {
      console.log('\nSetup wizard can now proceed!');
      process.exit(0);
    } else {
      console.log('❌');
    }
  }

  console.log('\n❌ None of the common passwords worked.\n');
  console.log('You need to reset the postgres password manually.');
  console.log('Run this command in PowerShell (as Administrator):');
  console.log('');
  console.log('  $env:PGPASSWORD = "postgres"');
  console.log('  & "D:\\Software\\PostgreSQL\\17\\bin\\pg_ctl.exe" -D "D:\\Software\\PostgreSQL\\17\\data" restart');
  console.log('');
  console.log('Or reinstall PostgreSQL and set a known password for postgres user.');
  process.exit(1);
}

main();
