import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'ott:',
  ttls: {
    public_settings: 900, // 15 min
    categories: 1800, // 30 min
    banners: 300, // 5 min
    sections: 300, // 5 min
    plans: 3600, // 1 hour
    vast_ads: 120, // 2 min
    analytics_dashboard: 300, // 5 min
  },
}));

