import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './src/entities/user.entity';

// Load environment variables
dotenv.config();

console.log('🔍 Checking Users with Password Hashes...\n');
console.log('⚠️  WARNING: This shows password hashes for admin purposes only!\n');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  database: 'typing_master',
  entities: [User],
  synchronize: false,
  logging: false,
});

AppDataSource.initialize()
  .then(async () => {
    console.log('✅ Database Connected\n');

    // Get all users with passwords
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({
      order: {
        created_at: 'DESC'
      }
    });

    console.log(`📊 Total Users: ${users.length}\n`);

    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log('👥 Users with Credentials:');
      console.log('='.repeat(120));
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   User ID: ${user.user_id}`);
        console.log(`   Password Hash: ${user.password_hash.substring(0, 20)}...`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Father's Name: ${user.fathers_name || 'N/A'}`);
        console.log(`   City: ${user.city || 'N/A'}`);
        console.log(`   State: ${user.state || 'N/A'}`);
        console.log(`   Category: ${user.category || 'Not Set'}`);
        console.log(`   Registered: ${user.created_at.toLocaleDateString()}`);
        console.log('-'.repeat(80));
      });
    }

    await AppDataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database Connection Failed:', error.message);
    process.exit(1);
  });