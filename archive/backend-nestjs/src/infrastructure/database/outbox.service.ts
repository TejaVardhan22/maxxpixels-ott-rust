import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, LessThanOrEqual } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
  ) {}

  /**
   * Enqueues an event inside an active database transaction (Transactional Outbox Pattern)
   * or directly onto the outbox_events table if no transactional EntityManager is supplied.
   */
  async enqueue(
    params: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      topic: string;
      payload: Record<string, any>;
    },
    manager?: EntityManager,
  ): Promise<OutboxEvent> {
    const repo = manager ? manager.getRepository(OutboxEvent) : this.outboxRepo;
    const event = repo.create({
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      topic: params.topic,
      payload: params.payload,
      status: 'PENDING',
      retryCount: 0,
      nextAttemptAt: new Date(),
    });
    return repo.save(event);
  }

  /**
   * Fetches a batch of pending outbox events ready for async relay/dispatch.
   */
  async fetchPendingBatch(limit = 50): Promise<OutboxEvent[]> {
    return this.outboxRepo.find({
      where: [
        { status: 'PENDING', nextAttemptAt: LessThanOrEqual(new Date()) },
        { status: 'RETRY', nextAttemptAt: LessThanOrEqual(new Date()) },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markPublished(id: number): Promise<void> {
    await this.outboxRepo.update(id, {
      status: 'PUBLISHED',
      processedAt: new Date(),
    });
  }

  async markFailed(event: OutboxEvent, errorMsg: string, maxRetries = 5): Promise<void> {
    const nextRetry = (event.retryCount || 0) + 1;
    if (nextRetry >= maxRetries) {
      await this.outboxRepo.update(event.id, {
        status: 'DLQ',
        retryCount: nextRetry,
        errorMessage: errorMsg.slice(0, 1000),
        processedAt: new Date(),
      });
      this.logger.error(`Outbox event ${event.id} (${event.topic}) moved to DLQ after ${nextRetry} retries: ${errorMsg}`);
    } else {
      const backoffMs = Math.min(60000, Math.pow(2, nextRetry) * 1000);
      await this.outboxRepo.update(event.id, {
        status: 'RETRY',
        retryCount: nextRetry,
        errorMessage: errorMsg.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + backoffMs),
      });
    }
  }
}

