import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Fix CORS configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:4173',
      'https://typing.techizebuilder.com',
      'http://typing.techizebuilder.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  });

  // Use PORT from .env file (3012)
  const port = process.env.PORT || 3012;
  await app.listen(port);

  console.log(`--- TYPING APP BACKEND STARTED ON PORT ${port} ---`);
  console.log(`--- API Available at: http://localhost:${port}/api ---`);
  console.log(`--- Health Check: http://localhost:${port}/api/health ---`);
}
bootstrap();
