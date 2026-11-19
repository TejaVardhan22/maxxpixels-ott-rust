import { registerAs } from '@nestjs/config';

export const EVENT_TOPICS = {
  TELEMETRY_HEARTBEAT: 'ott.telemetry.heartbeat',
  CONTENT_VIEWS: 'ott.content.views',
  NOTIFICATION_DISPATCH: 'ott.notifications.dispatch',
  PAYMENT_WEBHOOK: 'ott.payments.razorpay',
  TELEMETRY_HEARTBEAT_DLQ: 'ott.telemetry.heartbeat.dlq',
  CONTENT_VIEWS_DLQ: 'ott.content.views.dlq',
  NOTIFICATION_DISPATCH_DLQ: 'ott.notifications.dispatch.dlq',
  PAYMENT_WEBHOOK_DLQ: 'ott.payments.razorpay.dlq',
} as const;

export const KAFKA_TOPICS = EVENT_TOPICS;

export default registerAs('kafka', () => ({
  enabled: process.env.EVENT_BUS_ENABLED !== 'false' && process.env.KAFKA_ENABLED !== 'false',
  topics: EVENT_TOPICS,
}));

