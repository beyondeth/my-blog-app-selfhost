import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId?: string;
  organizationId?: string;
}

/** Keeps request-scoped correlation data available to services without passing it through every method. */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run({ ...context }, callback);
  }

  get(): RequestContext {
    return this.storage.getStore() || {};
  }

  update(context: RequestContext): void {
    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, context);
    }
  }
}
