import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';

export type SelectedStyleState = {
  styleId: string;
  selectedAt: number;
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

  async getFreshPendingNonces(
    userId: string,
    ttlMs: number
  ): Promise<Array<{ nonce: string; issuedAt: number }>> {
    const current =
      (await this.getJson<PendingStyleSelectionState>(this.pendingKey(userId)))?.nonces || [];
    const now = Date.now();
    const fresh = current.filter((item) => now - item.issuedAt <= ttlMs);
    if (fresh.length !== current.length) {
      await this.setPendingNonces(userId, fresh, ttlMs);
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
    const fresh = await this.getFreshPendingNonces(userId, ttlMs);
    const nonce = randomUUID();
    const next = [...fresh.slice(-(MAX_PENDING_NONCES - 1)), { nonce, issuedAt: Date.now() }];
    await this.setPendingNonces(userId, next, ttlMs);
    return nonce;
  }

  async getOrCreateStyleSelectionNonce(userId: string, ttlMs: number): Promise<string> {
    const fresh = await this.getFreshPendingNonces(userId, ttlMs);
    if (fresh.length > 0) {
      await this.setPendingNonces(userId, fresh.slice(-MAX_PENDING_NONCES), ttlMs);
      return fresh[fresh.length - 1].nonce;
    }
    return this.createStyleSelectionNonce(userId, ttlMs);
  }

  async consumeStyleSelectionNonce(
    userId: string,
    nonce: string,
    ttlMs: number
  ): Promise<boolean> {
    const fresh = await this.getFreshPendingNonces(userId, ttlMs);
    const exists = fresh.some((item) => item.nonce === nonce);
    if (!exists) {
      return false;
    }
    const remaining = fresh.filter((item) => item.nonce !== nonce);
    await this.setPendingNonces(userId, remaining, ttlMs);
    return true;
  }

  async clearPendingNonces(userId: string): Promise<void> {
    await this.redis.del(this.pendingKey(userId));
  }

  async clearAll(userId: string): Promise<void> {
    await this.redis.del(this.selectedKey(userId), this.flowKey(userId), this.pendingKey(userId));
  }
}
