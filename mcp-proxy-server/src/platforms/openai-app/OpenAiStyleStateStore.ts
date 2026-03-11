import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';

export type SelectedStyleState = {
  styleId: string;
  selectedAt: number;
  styleBrief?: string;
};

export type PendingStyleSelectionState = {
  nonces: Array<{ nonce: string; issuedAt: number }>;
};

export type StyleFlowState = {
  startedAt: number;
  styleConfirmedAt?: number;
};

const KEY_PREFIX = 'mcp-openai:style';
const MAX_PENDING_NONCES = 200;

function toTtlSeconds(ttlMs: number): number {
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

export class OpenAiStyleStateStore {
  constructor(private readonly redis: Redis) {}

  private selectedKey(userId: string): string {
    return `${KEY_PREFIX}:selected:${userId}`;
  }

  private pendingKey(userId: string): string {
    return `${KEY_PREFIX}:pending:${userId}`;
  }

  private flowKey(userId: string): string {
    return `${KEY_PREFIX}:flow:${userId}`;
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  private parsePendingNonces(raw: string | null, ttlMs: number): Array<{ nonce: string; issuedAt: number }> {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as PendingStyleSelectionState;
      const current = parsed?.nonces || [];
      const now = Date.now();
      return current.filter((item) => now - item.issuedAt <= ttlMs);
    } catch {
      return [];
    }
  }

  private async mutatePendingNonces<T>(
    userId: string,
    ttlMs: number,
    mutator: (fresh: Array<{ nonce: string; issuedAt: number }>) => {
      next: Array<{ nonce: string; issuedAt: number }>;
      result: T;
    }
  ): Promise<T> {
    const key = this.pendingKey(userId);
    const ttlSeconds = toTtlSeconds(ttlMs);

    for (let attempt = 0; attempt < 5; attempt++) {
      await this.redis.watch(key);
      const raw = await this.redis.get(key);
      const fresh = this.parsePendingNonces(raw, ttlMs);
      const { next, result } = mutator(fresh);
      const normalizedNext = next.slice(-MAX_PENDING_NONCES);
      const multi = this.redis.multi();

      if (normalizedNext.length === 0) {
        multi.del(key);
      } else {
        multi.setex(key, ttlSeconds, JSON.stringify({ nonces: normalizedNext }));
      }

      const execResult = await multi.exec();
      if (execResult !== null) {
        return result;
      }
    }

    throw new Error('Failed to update OpenAI style nonce state');
  }

  async getSelectedStyle(userId: string): Promise<SelectedStyleState | null> {
    return this.getJson<SelectedStyleState>(this.selectedKey(userId));
  }

  async setSelectedStyle(
    userId: string,
    state: SelectedStyleState,
    ttlMs: number
  ): Promise<void> {
    await this.redis.setex(
      this.selectedKey(userId),
      toTtlSeconds(ttlMs),
      JSON.stringify(state)
    );
  }

  async clearSelectedStyle(userId: string): Promise<void> {
    await this.redis.del(this.selectedKey(userId));
  }

  async updateSelectedStyleBrief(
    userId: string,
    styleBrief: string,
    ttlMs: number
  ): Promise<SelectedStyleState | null> {
    const current = await this.getSelectedStyle(userId);
    if (!current) {
      return null;
    }
    const next = { ...current, styleBrief };
    await this.setSelectedStyle(userId, next, ttlMs);
    return next;
  }

  async getStyleFlow(userId: string): Promise<StyleFlowState | null> {
    return this.getJson<StyleFlowState>(this.flowKey(userId));
  }

  async setStyleFlow(userId: string, state: StyleFlowState, ttlMs: number): Promise<void> {
    await this.redis.setex(
      this.flowKey(userId),
      toTtlSeconds(ttlMs),
      JSON.stringify(state)
    );
  }

  async clearStyleFlow(userId: string): Promise<void> {
    await this.redis.del(this.flowKey(userId));
  }

  async resetConfirmedStyle(userId: string): Promise<void> {
    await this.redis.del(this.selectedKey(userId), this.flowKey(userId));
  }

  async confirmStyleSelection(
    userId: string,
    state: {
      styleId: string;
      selectedAt: number;
      styleBrief?: string;
      startedAt?: number;
    },
    ttlMs: number
  ): Promise<void> {
    const currentFlow = await this.getStyleFlow(userId);
    const startedAt = state.startedAt || currentFlow?.startedAt || state.selectedAt;
    const multi = this.redis.multi();

    multi.setex(
      this.flowKey(userId),
      toTtlSeconds(ttlMs),
      JSON.stringify({
        startedAt,
        styleConfirmedAt: state.selectedAt,
      } satisfies StyleFlowState)
    );
    multi.setex(
      this.selectedKey(userId),
      toTtlSeconds(ttlMs),
      JSON.stringify({
        styleId: state.styleId,
        selectedAt: state.selectedAt,
        styleBrief: state.styleBrief,
      } satisfies SelectedStyleState)
    );
    multi.del(this.pendingKey(userId));
    await multi.exec();
  }

  async getFreshPendingNonces(
    userId: string,
    ttlMs: number
  ): Promise<Array<{ nonce: string; issuedAt: number }>> {
    const raw = await this.redis.get(this.pendingKey(userId));
    const fresh = this.parsePendingNonces(raw, ttlMs);
    if (fresh.length === 0) {
      await this.redis.del(this.pendingKey(userId));
    }
    return fresh;
  }

  async setPendingNonces(
    userId: string,
    nonces: Array<{ nonce: string; issuedAt: number }>,
    ttlMs: number
  ): Promise<void> {
    if (nonces.length === 0) {
      await this.redis.del(this.pendingKey(userId));
      return;
    }
    await this.redis.setex(
      this.pendingKey(userId),
      toTtlSeconds(ttlMs),
      JSON.stringify({ nonces })
    );
  }

  async createStyleSelectionNonce(userId: string, ttlMs: number): Promise<string> {
    return this.mutatePendingNonces(userId, ttlMs, (fresh) => {
      const nonce = randomUUID();
      return {
        next: [...fresh.slice(-(MAX_PENDING_NONCES - 1)), { nonce, issuedAt: Date.now() }],
        result: nonce,
      };
    });
  }

  async getOrCreateStyleSelectionNonce(userId: string, ttlMs: number): Promise<string> {
    return this.mutatePendingNonces(userId, ttlMs, (fresh) => {
      if (fresh.length > 0) {
        return {
          next: fresh.slice(-MAX_PENDING_NONCES),
          result: fresh[fresh.length - 1].nonce,
        };
      }
      const nonce = randomUUID();
      return {
        next: [{ nonce, issuedAt: Date.now() }],
        result: nonce,
      };
    });
  }

  async consumeStyleSelectionNonce(
    userId: string,
    nonce: string,
    ttlMs: number
  ): Promise<boolean> {
    return this.mutatePendingNonces(userId, ttlMs, (fresh) => {
      const exists = fresh.some((item) => item.nonce === nonce);
      return {
        next: exists ? fresh.filter((item) => item.nonce !== nonce) : fresh,
        result: exists,
      };
    });
  }

  async clearPendingNonces(userId: string): Promise<void> {
    await this.redis.del(this.pendingKey(userId));
  }

  async clearAll(userId: string): Promise<void> {
    await this.redis.del(this.selectedKey(userId), this.flowKey(userId), this.pendingKey(userId));
  }
}
