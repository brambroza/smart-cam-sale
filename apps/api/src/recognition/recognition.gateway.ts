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
import { OrgsService } from '../orgs/orgs.service';
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
    private readonly orgs: OrgsService,
  ) {}

  /** Rooms are namespaced per org SERVER-SIDE — a client can never join
   *  another org's channel by guessing its name. */
  private room(client: Socket, channel: string) {
    return `ch:${(client.data as { orgId?: string }).orgId}:${channel}`;
  }

  private orgOf(client: Socket): string {
    return (client.data as { orgId?: string }).orgId ?? 'org_default';
  }

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
        (client.data as Record<string, unknown>).orgId = payload.orgId;
        (client.data as Record<string, unknown>).cameraEnabled =
          await this.orgs.isCameraEnabled(payload.orgId);
        this.logger.log(
          `socket connect (staff:${payload.username} org:${payload.orgId}): ${client.id}`,
        );
        return;
      } catch {
        this.logger.warn(`socket rejected — invalid JWT: ${client.id}`);
        client.disconnect(true);
        return;
      }
    }

    // Bridges authenticate with their org's bridgeToken (legacy env value was
    // adopted onto the default org at startup).
    const org = await this.orgs.resolveBridgeToken(bridgeToken);
    if (org) {
      (client.data as Record<string, unknown>).isBridge = true;
      (client.data as Record<string, unknown>).orgId = org.orgId;
      this.logger.log(`socket connect (bridge org:${org.orgId}): ${client.id}`);
      return;
    }

    this.logger.warn(`socket rejected — no credentials: ${client.id}`);
    client.disconnect(true);
  }
  handleDisconnect(client: Socket) {
    this.busy.delete(client.id);
    this.logger.log(`socket disconnect: ${client.id}`);
  }

  /** Viewer consoles join a channel to receive frames+results from a bridge. */
  @SubscribeMessage('join_channel')
  onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() body: { channel: string }) {
    const room = this.room(client, body.channel);
    client.join(room);
    this.logger.log(`socket ${client.id} joined ${room}`);
    client.emit('joined_channel', { channel: body.channel });
  }

  @SubscribeMessage('leave_channel')
  onLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody() body: { channel: string }) {
    client.leave(this.room(client, body.channel));
  }

  @SubscribeMessage('frame')
  async onFrame(@ConnectedSocket() client: Socket, @MessageBody() body: BridgeFrameMessage) {
    if (this.busy.get(client.id)) return; // drop if previous still running
    // Lite tier: the org bought phone-lookup, not camera recognition
    if ((client.data as { cameraEnabled?: boolean }).cameraEnabled === false) {
      client.emit('recognition_error', {
        message: 'แพ็กเกจ Lite ไม่รวมกล้อง — ใช้ค้นหาด้วยเบอร์โทร หรืออัปเกรดแพ็กเกจ',
      });
      return;
    }
    this.busy.set(client.id, true);
    try {
      const orgId = this.orgOf(client);

      // Relay the frame to viewer consoles BEFORE recognition — the live view
      // must not go dark while the AI service is cold-starting or slow.
      if (body.channel && body.broadcastFrame) {
        this.server.to(this.room(client, body.channel)).emit('camera_frame', {
          channel: body.channel,
          imageBase64: body.imageBase64,
          ts: body.ts,
        });
      }

      const { message, primaryEmbedding } = await this.svc.recognizeFrameWithEmbedding(
        body.imageBase64,
        body.frameId,
        orgId,
      );
      if (primaryEmbedding) {
        this.svc.rememberEmbedding(client.id, primaryEmbedding);
        // channel cache is org-prefixed so viewer consoles can only reach
        // embeddings captured inside their own org
        if (body.channel)
          this.svc.rememberChannelEmbedding(`${orgId}:${body.channel}`, primaryEmbedding);
      }

      // Reply to the sender (webcam console or bridge)
      client.emit('recognition', message);

      // Bridge mode: fan out the recognition result to viewers (the frame
      // itself was already relayed above, ahead of the AI round-trip)
      if (body.channel) {
        this.server.to(this.room(client, body.channel)).emit('recognition', message);
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
      ? this.svc.getLastChannelEmbedding(`${this.orgOf(client)}:${body.channel}`)
      : this.svc.getLastEmbedding(client.id);
    client.emit('captured_embedding', { embedding: embedding ?? null });
  }
}
