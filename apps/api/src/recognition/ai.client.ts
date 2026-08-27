import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface AiFace {
  bbox: { x: number; y: number; width: number; height: number };
  embedding: number[];
  age: number;
  gender: 'male' | 'female';
  det_score: number;
}

@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly baseUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

  async analyze(imageBase64: string): Promise<AiFace[]> {
    try {
      const { data } = await axios.post<{ faces: AiFace[] }>(
        `${this.baseUrl}/analyze`,
        { image: imageBase64 },
        { timeout: 5000 },
      );
      return data.faces;
    } catch (err) {
      const e = err as Error;
      this.logger.warn(`AI service failed: ${e.message}`);
      return [];
    }
  }
}
