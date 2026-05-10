import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Testing App-Style Connection (Individual Params)...\n');

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
  ssl: false,
});

AppDataSource.initialize()
  .then(async () => {
    console.log('✅ App-Style Connection: SUCCESS');

    const result = await AppDataSource.query('SELECT NOW()');
    console.log('✅ Query Result:', result[0]);

    await AppDataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ App-Style Connection: FAILED');
    console.error('Full Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Stack:', error.stack);
    process.exit(1);
  });