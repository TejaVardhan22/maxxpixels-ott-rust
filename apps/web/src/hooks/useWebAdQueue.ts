'use client';
import { useAdQueue, type UseAdQueueReturn } from '@ott/shared';

interface Options {
  videoId: number;
  categoryId?: string;
}

export function useWebAdQueue({ videoId, categoryId }: Options): UseAdQueueReturn {
  return useAdQueue({ videoId, categoryId, device: 'web' });
}
