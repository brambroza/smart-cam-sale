import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { RecognitionGateway } from './recognition/recognition.gateway';
import { RecognitionService } from './recognition/recognition.service';
import { AiClient } from './recognition/ai.client';
import { RecommendationService } from './recognition/recommendation.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, MembersController],
  providers: [
    PrismaService,
    RecognitionGateway,
    RecognitionService,
    AiClient,
    RecommendationService,
    MembersService,
  ],
})
export class AppModule {}
