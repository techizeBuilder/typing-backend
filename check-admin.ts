import { createConnection } from 'typeorm';
import { User } from './src/entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkAdmin() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'typing_app_db',
    entities: [User],
    synchronize: false,
  });

  const userRepo = connection.getRepository(User);
  const admin = await userRepo.findOneBy({ user_id: 'admin' });

  if (admin) {
    console.log('Admin user found:', {
      user_id: admin.user_id,
      status: admin.status,
      role: admin.role,
      password_hash: admin.password_hash
    });
    
    // reset password to admin123
    admin.password_hash = await bcrypt.hash('admin123', 10);
    admin.status = 'Active' as any;
    await userRepo.save(admin);
    console.log('Password reset to admin123 and status set to Active.');
  } else {
    console.log('Admin user NOT found!');
  }

  await connection.close();
}

checkAdmin().catch(console.error);
