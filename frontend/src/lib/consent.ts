export const CONSENT_COOKIE_NAME = 'cb_consent_v2';
export const LEGACY_CONSENT_COOKIE_NAME = 'cb_consent_v1';
export const CONSENT_POLICY_VERSION = '2026-04-global-strict-v1';

type CookieConsentAuditPayload = {
  analyticsEnabled: boolean;
  policyVersion: string;
  decisionSource?: string;
};

function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  return configuredBaseUrl.replace(/\/+$/, '');
}

export function clearLegacyConsentCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LEGACY_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function createKlaroConfig() {
  return {
    version: 1,
    elementID: 'cb-klaro',
    storageMethod: 'cookie',
    cookieName: CONSENT_COOKIE_NAME,
    cookieExpiresAfterDays: 365,
    default: false,
    mustConsent: false,
    acceptAll: true,
    hideDeclineAll: false,
    noticeAsModal: false,
    noAutoLoad: false,
    groupByPurpose: false,
    disablePoweredBy: true,
    additionalClass: 'codebase-klaro',
    styling: {
      theme: ['light', 'bottom', 'wide'],
    },
    translations: {
      en: {
        privacyPolicyUrl: '/legal/privacy',
        consentNotice: {
          description:
            'Codebase uses essential cookies to keep the product secure and working. Optional analytics cookies help us understand product usage only if you explicitly allow them.',
          learnMore: 'Manage settings',
        },
        consentModal: {
          title: 'Privacy settings',
          description:
            'Choose whether Codebase can use optional analytics cookies. Essential cookies stay enabled because they are required for security, session integrity, and core product functionality.',
          privacyPolicy: {
            name: 'Privacy Policy',
            text: 'For more detail, read our {privacyPolicy}.',
          },
        },
        purposes: {
          functional: 'Essential operations',
          analytics: 'Analytics',
        },
        acceptAll: 'Allow analytics',
        acceptSelected: 'Save choices',
        decline: 'Use essential only',
        ok: 'Save choices',
        save: 'Save choices',
        close: 'Close',
        service: {
          disableAll: {
            title: 'Apply to all services',
            description: 'Enable or disable every optional service at once.',
          },
          required: {
            title: 'Always active',
            description: '',
          },
          purposes: 'Purpose',
          purpose: 'Purpose',
        },
        essential: {
          title: 'Essential cookies',
          description:
            'Required for authentication, security controls, consent storage, and core site functionality. This category is always active.',
        },
        analytics: {
          title: 'Analytics cookies',
          description:
            'Allows Google Analytics and Mixpanel only after explicit opt-in. These tools stay disabled until you consent.',
        },
      },
    },
    services: [
      {
        name: 'essential',
        title: 'Essential cookies',
        required: true,
        purposes: ['functional'],
      },
      {
        name: 'analytics',
        title: 'Analytics cookies',
        default: false,
        purposes: ['analytics'],
        cookies: [
          /^_ga$/,
          /^_ga_.*/,
          /^_gid$/,
          /^_gat.*/,
          /^mp_.*_mixpanel$/,
          /^__mp_opt_in_out_.*/,
        ],
      },
    ],
  };
}

export async function syncCookieConsentAudit(payload: CookieConsentAuditPayload) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/cookie-consent`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analyticsEnabled: payload.analyticsEnabled,
        policyVersion: payload.policyVersion,
        source: payload.decisionSource || 'klaro',
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return;
    }

    if (!response.ok) {
      console.warn('[Consent] Failed to sync cookie consent audit:', response.status);
    }
  } catch (error) {
    console.warn('[Consent] Cookie consent audit sync failed:', error);
  }
}
