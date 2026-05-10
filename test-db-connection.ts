import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Checking Database Connection...\n');
console.log('Database Configuration:');
console.log(`  Host: ${process.env.DB_HOST}`);
console.log(`  Port: ${process.env.DB_PORT}`);
console.log(`  Username: ${process.env.DB_USERNAME}`);
console.log(`  Database: ${process.env.DB_DATABASE}`);
console.log('');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'typing_app_db',
  synchronize: false,
  logging: false,
});

AppDataSource.initialize()
  .then(async () => {
    console.log('✅ Database Connection: SUCCESS');
    console.log('✅ TypeORM Initialized Successfully\n');

    // Test query
    const result = await AppDataSource.query('SELECT NOW()');
    console.log('✅ Query Test Result:', result[0]);
    console.log('\n✅ All tests passed! Database is connected and working.');

    await AppDataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database Connection: FAILED');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. PostgreSQL server is not running');
    console.error('  2. Invalid database credentials');
    console.error('  3. Database does not exist');
    console.error('  4. Network/connectivity issue');
    process.exit(1);
  });
