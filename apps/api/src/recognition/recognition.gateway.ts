import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RecognitionService } from './recognition.service';
import type { FrameMessage } from '@smart-cam/shared-types';

@WebSocketGateway({ cors: { origin: '*' }, path: '/ws' })
export class RecognitionGateway {
  private readonly logger = new Logger(RecognitionGateway.name);
  private busy = new Map<string, boolean>();

  @WebSocketServer() server!: Server;

  constructor(private readonly svc: RecognitionService) {}

  handleConnection(client: Socket) {
    this.logger.log(`socket connect: ${client.id}`);
  }
  handleDisconnect(client: Socket) {
    this.busy.delete(client.id);
    this.logger.log(`socket disconnect: ${client.id}`);
  }

  @SubscribeMessage('frame')
  async onFrame(@ConnectedSocket() client: Socket, @MessageBody() body: FrameMessage) {
    if (this.busy.get(client.id)) return; // drop if previous still running
    this.busy.set(client.id, true);
    try {
      const { message, primaryEmbedding } = await this.svc.recognizeFrameWithEmbedding(
        body.imageBase64,
        body.frameId,
      );
      if (primaryEmbedding) this.svc.rememberEmbedding(client.id, primaryEmbedding);
      client.emit('recognition', message);
    } catch (e) {
      this.logger.error((e as Error).message);
      client.emit('recognition_error', { message: (e as Error).message });
    } finally {
      this.busy.set(client.id, false);
    }
  }

  @SubscribeMessage('capture_embedding')
  onCaptureEmbedding(@ConnectedSocket() client: Socket) {
    const embedding = this.svc.getLastEmbedding(client.id);
    client.emit('captured_embedding', { embedding: embedding ?? null });
  }
}
