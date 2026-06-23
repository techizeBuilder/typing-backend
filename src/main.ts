import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Raise request body-size limits. Express/Nest default to 100kb, which rejects
  // larger chapter payloads (long steno dictation passages) with 413 "Payload
  // Too Large". Note: steno AUDIO is uploaded via multipart (Multer, streamed to
  // disk) so it is not bound by these JSON limits — but on the LIVE server the
  // nginx reverse proxy enforces its own `client_max_body_size` (default 1MB),
  // which is the usual cause of a 413 on audio upload. See DEPLOYMENT_GUIDE.md.
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true });

  app.setGlobalPrefix('api');

  // CORS must be registered BEFORE static assets.
  // Express runs middleware in registration order — if static assets come first,
  // they send the response before CORS headers are added, and the browser blocks
  // cross-origin audio/image requests silently.
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:4173',
    'https://typing.techizebuilder.com',
    'http://typing.techizebuilder.com',
  ];
  app.enableCors({
    // Function form so we can also allow the packaged Electron desktop app.
    // It loads its UI from a file:// URL, so its requests arrive with either no
    // Origin header (origin === undefined) or the opaque Origin "null" — neither
    // of which can be expressed in a plain whitelist array.
    origin: (origin, callback) => {
      if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
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
