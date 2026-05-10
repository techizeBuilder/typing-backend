import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './src/entities/user.entity';

// Load environment variables
dotenv.config();

console.log('🔍 Checking Registered Users...\n');

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

    // Get all users
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({
      select: [
        'id',
        'name', 
        'phone',
        'user_id',
        'role',
        'status',
        'category',
        'city',
        'state',
        'created_at'
      ],
      order: {
        created_at: 'DESC'
      }
    });

    console.log(`📊 Total Registered Users: ${users.length}\n`);

    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log('👥 User List:');
      console.log('='.repeat(100));
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   User ID: ${user.user_id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Category: ${user.category || 'Not Set'}`);
        console.log(`   Location: ${user.city || 'N/A'}, ${user.state || 'N/A'}`);
        console.log(`   Registered: ${user.created_at.toLocaleDateString()}`);
        console.log('-'.repeat(50));
      });

      // Summary by role
      const roleCount = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n📈 Users by Role:');
      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
      });

      // Summary by status
      const statusCount = users.reduce((acc, user) => {
        acc[user.status] = (acc[user.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n📊 Users by Status:');
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }

    await AppDataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database Connection Failed:', error.message);
    process.exit(1);
  });