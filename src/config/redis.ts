import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Redis is optional. When REDIS_URL is unset the app runs without caching
 * and Socket.io runs on the in-memory adapter (single instance only).
 */
let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export async function connectRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not set — running without Redis');
    return;
  }
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  await redis.connect();
  logger.info('✅ Redis connected');
}
