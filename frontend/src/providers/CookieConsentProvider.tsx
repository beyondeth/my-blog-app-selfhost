'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearLegacyConsentCookie,
  CONSENT_POLICY_VERSION,
  createKlaroConfig,
  syncCookieConsentAudit,
} from '@/lib/consent';
import { useLocaleContext } from '@/providers/LocaleProvider';

type CookieConsentContextValue = {
  ready: boolean;
  analyticsEnabled: boolean;
  consentConfirmed: boolean;
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocaleContext();
  const [ready, setReady] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const klaroModuleRef = useRef<any>(null);
  const klaroConfigRef = useRef<Record<string, unknown> | null>(null);
  const consentWatcherRef = useRef<{ update: (manager: any, name: string, data: any) => void } | null>(null);

  const syncFromManager = useCallback((manager: any) => {
    setAnalyticsEnabled(Boolean(manager?.getConsent?.('analytics')));
    setConsentConfirmed(Boolean(manager?.confirmed));
  }, []);

  useEffect(() => {
    let disposed = false;
    setReady(false);

    clearLegacyConsentCookie();

    const initializeConsentManager = async () => {
      try {
        // @ts-expect-error Klaro does not publish TypeScript declarations.
        const klaroModule = await import('klaro/dist/klaro.js');
        if (disposed) {
          return;
        }

        const klaroConfig = createKlaroConfig(locale);
        klaroModuleRef.current = klaroModule;
        klaroConfigRef.current = klaroConfig;

        klaroModule.setup(klaroConfig);
        const manager = klaroModule.getManager(klaroConfig);
        syncFromManager(manager);

        const watcher = {
          update(nextManager: any, name: string, data: any) {
            if (name === 'saveConsents') {
              syncFromManager(nextManager);
              void syncCookieConsentAudit({
                analyticsEnabled: Boolean(nextManager?.getConsent?.('analytics')),
                policyVersion: CONSENT_POLICY_VERSION,
                decisionSource: typeof data?.type === 'string' ? data.type : 'klaro',
              });
              return;
            }

            if (name === 'consents' || name === 'applyConsents') {
              syncFromManager(nextManager);
            }
          },
        };

        manager.watch(watcher);
        consentWatcherRef.current = watcher;
      } catch (error) {
        console.error('[CookieConsentProvider] Failed to initialize Klaro:', error);
      } finally {
        if (!disposed) {
          setReady(true);
        }
      }
    };

    void initializeConsentManager();

    return () => {
      disposed = true;
      const klaroModule = klaroModuleRef.current;
      const klaroConfig = klaroConfigRef.current;
      const watcher = consentWatcherRef.current;
      const manager = klaroModule?.getManager?.(klaroConfig);

      if (manager && watcher) {
        manager.unwatch(watcher);
      }

      consentWatcherRef.current = null;
    };
  }, [locale, syncFromManager]);

  const openPreferences = useCallback(() => {
    const klaroModule = klaroModuleRef.current;
    const klaroConfig = klaroConfigRef.current;

    if (!klaroModule || !klaroConfig) {
      return;
    }

    klaroModule.show(klaroConfig, true);
  }, []);

  const value = useMemo<CookieConsentContextValue>(() => ({
    ready,
    analyticsEnabled,
    consentConfirmed,
    openPreferences,
  }), [analyticsEnabled, consentConfirmed, openPreferences, ready]);

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  }

  return context;
}
