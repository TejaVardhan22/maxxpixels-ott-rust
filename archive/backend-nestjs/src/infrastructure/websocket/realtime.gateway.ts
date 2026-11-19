import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly redisService: RedisService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        (client.handshake.query?.token as string);

      if (!rawToken) {
        client.join('public:broadcast');
        return;
      }

      const secret = process.env.JWT_SECRET || 'MaxxOttSuperSecretKeyForJwtSigningMustBeAtLeast256BitsLong2026!';
      const decoded = jwt.verify(rawToken, secret) as any;
      const userId = decoded.userId || decoded.sub;

      if (userId) {
        client.data.userId = userId;
        client.data.roles = decoded.roles || [];
        await client.join(`user:${userId}`);
        await client.join('public:broadcast');

        if (Array.isArray(decoded.roles) && decoded.roles.some((r: string) => r.includes('ADMIN'))) {
          await client.join('room:admins');
        }
        await this.redisService.set(`ws:presence:${userId}`, { socketId: client.id, connectedAt: Date.now() }, 3600);
      }
    } catch (err: any) {
      this.logger.debug(`WebSocket anonymous/expired connection (${client.id}): ${err.message}`);
      client.join('public:broadcast');
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    if (client.data?.userId) {
      await this.redisService.del(`ws:presence:${client.data.userId}`);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string },
  ): Promise<{ event: string; data: any }> {
    const requestedRoom = payload?.room || '';
    // Prevent unauthorized users from joining admin or another user's private room
    if (requestedRoom.startsWith('room:admins')) {
      const roles: string[] = client.data?.roles || [];
      if (!roles.some((r) => r.includes('ADMIN'))) {
        return { event: 'error', data: { message: 'Forbidden room' } };
      }
    }
    if (requestedRoom.startsWith('user:') && requestedRoom !== `user:${client.data?.userId}`) {
      return { event: 'error', data: { message: 'Cannot join another user room' } };
    }

    await client.join(requestedRoom);
    return { event: 'joined_room', data: { room: requestedRoom } };
  }

  @SubscribeMessage('playback_ping')
  async handlePlaybackPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { contentId?: number; positionSeconds?: number },
  ): Promise<{ event: string; data: any }> {
    return {
      event: 'playback_pong',
      data: {
        userId: client.data?.userId || null,
        contentId: payload?.contentId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  emitToUser(userId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, data);
    }
  }

  emitToAdmins(event: string, data: any): void {
    if (this.server) {
      this.server.to('room:admins').emit(event, data);
    }
  }

  broadcast(event: string, data: any): void {
    if (this.server) {
      this.server.to('public:broadcast').emit(event, data);
    }
  }
}

