/**
 * Mixpanel analytics utilities with explicit consent gating.
 *
 * Tracking stays disabled until analytics consent is granted.
 */

import mixpanelBrowser from 'mixpanel-browser';

let isInitialized = false;
let isDisabled = false;
let consentGranted = false;

function getMixpanelToken() {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
}

function safeMixpanelCall(name: string, fn: () => void) {
  try {
    fn();
  } catch (error) {
    console.error(`[Mixpanel] ${name} failed:`, error);
  }
}

function initMixpanelInstance() {
  if (typeof window === 'undefined' || isInitialized || isDisabled || !consentGranted) {
    return;
  }

  const token = getMixpanelToken();
  if (!token) {
    isDisabled = true;
    console.warn(
      'Mixpanel token is missing. Set NEXT_PUBLIC_MIXPANEL_TOKEN to enable analytics.',
    );
    return;
  }

  try {
    mixpanelBrowser.init(token, {
      debug: process.env.NODE_ENV === 'development',
      persistence: 'localStorage',
      ignore_dnt: false,
      track_pageview: false,
      opt_out_tracking_by_default: true,
    });

    isInitialized = true;
  } catch (error) {
    isDisabled = true;
    console.error('Mixpanel initialization failed:', error);
  }
}

// Legacy layout callers may request initialization before consent is known.
// Keep that call harmless; actual initialization remains consent-gated.
export async function initMixpanel(): Promise<void> {
  initMixpanelInstance();
}

export function setMixpanelConsent(granted: boolean) {
  consentGranted = granted;

  if (typeof window === 'undefined' || isDisabled) {
    return;
  }

  if (!granted) {
    if (isInitialized) {
      safeMixpanelCall('opt_out_tracking', () => {
        mixpanelBrowser.opt_out_tracking();
      });
    }
    return;
  }

  initMixpanelInstance();

  if (isInitialized) {
    safeMixpanelCall('opt_in_tracking', () => {
      mixpanelBrowser.opt_in_tracking();
    });
  }
}

export function isMixpanelInitialized(): boolean {
  return isInitialized;
}

function canTrack() {
  return consentGranted && isInitialized && !isDisabled;
}

export const mixpanel = {
  track: (eventName: string, properties?: Record<string, any>) => {
    if (!canTrack()) {
      return;
    }

    safeMixpanelCall('track', () => {
      mixpanelBrowser.track(eventName, properties);
    });
  },

  identify: async (userId: string) => {
    if (!canTrack()) {
      return;
    }

    safeMixpanelCall('identify', () => {
      mixpanelBrowser.identify(userId);
    });
  },

  people: {
    set: async (properties: Record<string, any>) => {
      if (!canTrack()) {
        return;
      }

      safeMixpanelCall('people.set', () => {
        mixpanelBrowser.people.set(properties);
      });
    },

    increment: async (property: string, value: number = 1) => {
      if (!canTrack()) {
        return;
      }

      safeMixpanelCall('people.increment', () => {
        mixpanelBrowser.people.increment(property, value);
      });
    },
  },

  trackPageView: async (pageName?: string) => {
    if (!canTrack()) {
      return;
    }

    safeMixpanelCall('track_pageview', () => {
      mixpanelBrowser.track_pageview(pageName ? { page: pageName } : undefined);
    });
  },

  reset: async () => {
    if (!isInitialized || isDisabled) {
      return;
    }

    safeMixpanelCall('reset', () => {
      mixpanelBrowser.reset();
    });
  },

  timeEvent: async (eventName: string) => {
    if (!canTrack()) {
      return;
    }

    safeMixpanelCall('time_event', () => {
      mixpanelBrowser.time_event(eventName);
    });
  },
};

export type AnalyticsEvent =
  | { name: 'User Signup'; properties: { method: 'email' | 'google' | 'github' | 'kakao' } }
  | { name: 'User Login'; properties: { method: 'email' | 'google' | 'github' | 'kakao' } }
  | { name: 'User Logout'; properties?: Record<string, any> }
  | { name: 'Post Created'; properties: { categoryId?: string; tags?: string[]; wordCount?: number } }
  | { name: 'Post Viewed'; properties: { postId: string; slug: string } }
  | { name: 'Post Liked'; properties: { postId: string } }
  | { name: 'Post Bookmarked'; properties: { postId: string } }
  | { name: 'Post Shared'; properties: { postId: string; platform?: string } }
  | { name: 'Comment Created'; properties: { postId: string; parentId?: string } }
  | { name: 'Comment Liked'; properties: { commentId: string } }
  | { name: 'Search Performed'; properties: { query: string; resultsCount: number } }
  | { name: 'DM Sent'; properties: { receiverId: string } }
  | { name: 'Settings Updated'; properties: { section: string } }
  | { name: 'Theme Changed'; properties: { theme: 'light' | 'dark' } };

export const trackEvent = <T extends AnalyticsEvent>(event: T) => {
  mixpanel.track(event.name, event.properties);
};

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).mixpanel = mixpanel;
}
