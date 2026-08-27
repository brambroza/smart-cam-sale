import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const origin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : true;
  const app = await NestFactory.create(AppModule, { cors: { origin, credentials: true } });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`🚀 API listening on http://localhost:${port}`);
}
bootstrap();
