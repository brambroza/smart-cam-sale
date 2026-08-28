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
import { AuthService } from '../auth/auth.service';
import type { FrameMessage } from '@smart-cam/shared-types';

interface BridgeFrameMessage extends FrameMessage {
  /** Channel name when the frame comes from a camera bridge (RTSP relay). */
  channel?: string;
  /** Bridge asks the server to rebroadcast the JPEG so viewer consoles can render it. */
  broadcastFrame?: boolean;
}

@WebSocketGateway({ cors: { origin: '*' }, path: '/ws' })
export class RecognitionGateway {
  private readonly logger = new Logger(RecognitionGateway.name);
  private busy = new Map<string, boolean>();

  @WebSocketServer() server!: Server;

  constructor(
    private readonly svc: RecognitionService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    // Two identities may connect: staff consoles (JWT) and camera bridges
    // (shared BRIDGE_TOKEN). Anything else is dropped before it can send
    // frames, join channels, or receive member data.
    const { token, bridgeToken } = (client.handshake.auth ?? {}) as {
      token?: string;
      bridgeToken?: string;
    };

    if (token) {
      try {
        const payload = await this.auth.verifyToken(token);
        (client.data as Record<string, unknown>).user = payload;
        this.logger.log(`socket connect (staff:${payload.username}): ${client.id}`);
        return;
      } catch {
        this.logger.warn(`socket rejected — invalid JWT: ${client.id}`);
        client.disconnect(true);
        return;
      }
    }

    const required = process.env.BRIDGE_TOKEN;
    if (bridgeToken && required && bridgeToken === required) {
      (client.data as Record<string, unknown>).isBridge = true;
      this.logger.log(`socket connect (bridge): ${client.id}`);
      return;
    }

    this.logger.warn(
      `socket rejected — no credentials: ${client.id}` +
        (bridgeToken && !required ? ' (bridge token sent but BRIDGE_TOKEN env not set)' : ''),
    );
    client.disconnect(true);
  }
  handleDisconnect(client: Socket) {
    this.busy.delete(client.id);
    this.logger.log(`socket disconnect: ${client.id}`);
  }

  /** Viewer consoles join a channel to receive frames+results from a bridge. */
  @SubscribeMessage('join_channel')
  onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() body: { channel: string }) {
    const room = `ch:${body.channel}`;
    client.join(room);
    this.logger.log(`socket ${client.id} joined ${room}`);
    client.emit('joined_channel', { channel: body.channel });
  }

  @SubscribeMessage('leave_channel')
  onLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody() body: { channel: string }) {
    client.leave(`ch:${body.channel}`);
  }

  @SubscribeMessage('frame')
  async onFrame(@ConnectedSocket() client: Socket, @MessageBody() body: BridgeFrameMessage) {
    if (this.busy.get(client.id)) return; // drop if previous still running
    this.busy.set(client.id, true);
    try {
      const { message, primaryEmbedding } = await this.svc.recognizeFrameWithEmbedding(
        body.imageBase64,
        body.frameId,
      );
      if (primaryEmbedding) {
        this.svc.rememberEmbedding(client.id, primaryEmbedding);
        if (body.channel) this.svc.rememberChannelEmbedding(body.channel, primaryEmbedding);
      }

      // Reply to the sender (webcam console or bridge)
      client.emit('recognition', message);

      // Bridge mode: fan out result + (optionally) the frame itself to viewers
      if (body.channel) {
        const room = `ch:${body.channel}`;
        this.server.to(room).emit('recognition', message);
        if (body.broadcastFrame) {
          this.server.to(room).emit('camera_frame', {
            channel: body.channel,
            imageBase64: body.imageBase64,
            ts: body.ts,
          });
        }
      }
    } catch (e) {
      this.logger.error((e as Error).message);
      client.emit('recognition_error', { message: (e as Error).message });
    } finally {
      this.busy.set(client.id, false);
    }
  }

  @SubscribeMessage('capture_embedding')
  onCaptureEmbedding(@ConnectedSocket() client: Socket, @MessageBody() body?: { channel?: string }) {
    // In bridge mode the embedding lives on the bridge's socket, not the viewer's.
    // Viewers pass channel; we look up the bridge socket registered for it.
    const embedding = body?.channel
      ? this.svc.getLastChannelEmbedding(body.channel)
      : this.svc.getLastEmbedding(client.id);
    client.emit('captured_embedding', { embedding: embedding ?? null });
  }
}
