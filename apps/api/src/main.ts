import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // "*" combined with credentials:true is rejected by browsers — reflect the
  // request origin instead (origin: true) in that case.
  const raw = process.env.CORS_ORIGIN?.trim();
  const origin = !raw || raw === '*' ? true : raw.split(',').map((s) => s.trim());
  const app = await NestFactory.create(AppModule, { cors: { origin, credentials: true } });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`🚀 API listening on http://localhost:${port}`);
}
bootstrap();
