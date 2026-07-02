import http from 'http';
import app from './app';
import sequelize from './config/db';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { initSocket } from './socket';
import { logger } from './utils/logger';

// Register models so associations exist before any query runs.
import './modules/user/model/user.model';
import './modules/auth/model/session.model';
import './modules/friend/model/friend-request.model';
import './modules/friend/model/friendship.model';
import './modules/movie/model/movie.model';
import './modules/room/model/room.model';
import './modules/room/model/room-member.model';
import './modules/room/model/video-progress.model';
import './modules/chat/model/chat-message.model';
import './modules/chat/model/message-reaction.model';
import './modules/notification/model/notification.model';
import './modules/call/model/call-history.model';
import './modules/call/model/call-participant.model';
import './modules/admin/model/activity-log.model';

const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  await sequelize.authenticate();
  logger.info('✅ PostgreSQL connected via Sequelize');

  await connectRedis();
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`🚀 Server running at http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${(err as Error).message}`);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await sequelize.close();
    process.exit(0);
  });
  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});
