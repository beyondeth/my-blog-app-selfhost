'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/providers/CookieConsentProvider';
import { setMixpanelConsent } from '@/lib/mixpanel';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    __cbGaLoaded?: boolean;
    __cbGaConfigured?: boolean;
  }
}

function ensureGtagBase() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
}

function loadGoogleTag(measurementId: string) {
  if (typeof window === 'undefined' || window.__cbGaLoaded) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-codebase-ga="${measurementId}"]`,
    );

    if (existingScript) {
      window.__cbGaLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.dataset.codebaseGa = measurementId;
    script.onload = () => {
      window.__cbGaLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Analytics'));
    document.head.appendChild(script);
  });
}

export function AnalyticsBootstrap() {
  const { analyticsEnabled } = useCookieConsent();

  useEffect(() => {
    ensureGtagBase();
  }, []);

  useEffect(() => {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    setMixpanelConsent(analyticsEnabled);

    if (!measurementId) {
      return;
    }

    ensureGtagBase();

    if (!analyticsEnabled) {
      window.gtag?.('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
      return;
    }

    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = false;

    loadGoogleTag(measurementId)
      .then(() => {
        window.gtag?.('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'granted',
        });

        if (!window.__cbGaConfigured) {
          window.gtag?.('js', new Date());
          window.gtag?.('config', measurementId, {
            anonymize_ip: true,
          });
          window.__cbGaConfigured = true;
        }
      })
      .catch((error) => {
        console.error('[AnalyticsBootstrap] Google Analytics bootstrap failed:', error);
      });
  }, [analyticsEnabled]);

  return null;
}
