import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // CORS must be registered BEFORE static assets.
  // Express runs middleware in registration order — if static assets come first,
  // they send the response before CORS headers are added, and the browser blocks
  // cross-origin audio/image requests silently.
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
    credentials: true,
  });

  // Use __dirname so the path is correct regardless of working directory.
  // Nest compiles src/ into dist/src/, so:
  //   dist/src/main.js  → __dirname = .../backend/dist/src
  //   go up TWO levels  → .../backend/uploads  ✓
  const uploadsPath = join(__dirname, '..', '..', 'uploads');

  // Serve at /uploads/ for direct localhost access
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
  // Also serve at /api/uploads/ so nginx (which only proxies /api/*) can reach it
  app.useStaticAssets(uploadsPath, { prefix: '/api/uploads/' });

  const port = process.env.PORT || 3012;
  await app.listen(port);

  console.log(`--- TYPING APP BACKEND STARTED ON PORT ${port} ---`);
  console.log(`--- Uploads path: ${uploadsPath} ---`);
  console.log(`--- API: http://localhost:${port}/api ---`);
  console.log(`--- Static (direct): http://localhost:${port}/uploads/ ---`);
  console.log(`--- Static (proxy):  http://localhost:${port}/api/uploads/ ---`);
}
bootstrap();
