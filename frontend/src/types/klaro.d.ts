declare module 'klaro/dist/klaro.js' {
  export type KlaroConfig = Record<string, unknown>;

  export type KlaroWatcher = {
    update: (manager: KlaroManager, name: string, data: unknown) => void;
  };

  export type KlaroManager = {
    confirmed: boolean;
    getConsent: (name: string) => boolean;
    watch: (watcher: KlaroWatcher) => void;
    unwatch: (watcher: KlaroWatcher) => void;
  };

  export function setup(config: KlaroConfig): void;
  export function getManager(config: KlaroConfig): KlaroManager;
  export function show(config: KlaroConfig, modal?: boolean): void;
}
