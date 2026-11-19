import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  openTimeoutMs?: number;
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    public readonly name: string,
    private readonly failureThreshold = 5,
    private readonly openTimeoutMs = 30000,
  ) {
    this.logger = new Logger(`CircuitBreaker:${name}`);
  }

  async execute<T>(action: () => Promise<T>, fallback?: (err: Error) => Promise<T> | T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.openTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit '${this.name}' transitioning from OPEN to HALF_OPEN`);
      } else {
        const openErr = new Error(`CircuitBreaker '${this.name}' is OPEN`);
        if (fallback) {
          return fallback(openErr);
        }
        throw openErr;
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.onFailure(error);
      if (fallback) {
        return fallback(error);
      }
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN || this.failureCount > 0) {
      this.failureCount = 0;
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold && this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit '${this.name}' tripped to OPEN after ${this.failureCount} failures. Last error: ${error.message}`,
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export class CircuitBreakerRegistry {
  private static readonly breakers = new Map<string, CircuitBreaker>();

  static getOrCreate(
    name: string,
    thresholdOrOpts: number | CircuitBreakerOptions = 5,
    openTimeoutMs = 30000,
  ): CircuitBreaker {
    let cb = this.breakers.get(name);
    if (!cb) {
      const threshold =
        typeof thresholdOrOpts === 'number'
          ? thresholdOrOpts
          : thresholdOrOpts.failureThreshold ?? 5;
      const timeout =
        typeof thresholdOrOpts === 'number'
          ? openTimeoutMs
          : thresholdOrOpts.resetTimeoutMs ?? thresholdOrOpts.openTimeoutMs ?? openTimeoutMs;
      cb = new CircuitBreaker(name, threshold, timeout);
      this.breakers.set(name, cb);
    }
    return cb;
  }

  static getAllStates(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.breakers.entries()) {
      out[k] = v.getState();
    }
    return out;
  }
}
