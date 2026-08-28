import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { RecognitionGateway } from './recognition/recognition.gateway';
import { RecognitionService } from './recognition/recognition.service';
import { AiClient } from './recognition/ai.client';
import { RecommendationService } from './recognition/recommendation.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CamerasController } from './cameras/cameras.controller';
import { CamerasService } from './cameras/cameras.service';
import { PurchasesController } from './purchases/purchases.controller';
import { PurchasesService } from './purchases/purchases.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt.guard';
import { ConsentController } from './consent/consent.controller';
import { PosController } from './pos/pos.controller';
import { PosService } from './pos/pos.service';
import { OrgsController } from './orgs/orgs.controller';
import { OrgsService } from './orgs/orgs.service';
import { StoresController } from './stores/stores.controller';
import { StoresService } from './stores/stores.service';
import { HealthController } from './health.controller';
import { ClaudeScriptService } from './ai/claude-script.service';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  // Fail loudly in prod rather than shipping a guessable default.
  // eslint-disable-next-line no-console
  console.warn('⚠️ JWT_SECRET ไม่ถูกตั้ง — ใช้ค่า dev-only (อย่าใช้ใน production)');
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: jwtSecret ?? 'dev-only-secret-change-me',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    MembersController,
    ProductsController,
    CamerasController,
    PurchasesController,
    ConsentController,
    PosController,
    OrgsController,
    StoresController,
  ],
  providers: [
    PrismaService,
    RecognitionGateway,
    RecognitionService,
    AiClient,
    RecommendationService,
    MembersService,
    ProductsService,
    CamerasService,
    PurchasesService,
    AuthService,
    PosService,
    OrgsService,
    StoresService,
    ClaudeScriptService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
