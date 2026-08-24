import type { AppLocale } from '@/lib/i18n/config';

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

export function createKlaroConfig(locale: AppLocale) {
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
    lang: locale,
    styling: {
      theme: ['light', 'bottom', 'wide'],
    },
    translations: {
      en: {
        privacyPolicyUrl: '/legal/privacy',
        consentNotice: {
          title: 'Cookies and privacy',
          description:
            'Codebase uses essential cookies to keep the product secure and working. Optional analytics cookies help us understand product usage only if you explicitly allow them.',
          changeDescription: 'Your cookie settings have changed.',
          learnMore: 'Manage settings',
        },
        consentModal: {
          title: 'Privacy settings',
          description:
            'Choose whether Codebase can use optional analytics cookies. Essential cookies stay enabled because they are required for security, session integrity, and core product functionality.',
        },
        privacyPolicy: {
          name: 'Privacy Policy',
          text: 'For more detail, read our {privacyPolicy}.',
        },
        purposes: {
          functional: {
            title: 'Essential operations',
            description: 'Services required for security, sessions, and core product features.',
          },
          analytics: {
            title: 'Analytics',
            description: 'Optional services that measure product usage after explicit consent.',
          },
        },
        purposeItem: {
          service: 'service',
          services: 'services',
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
            description: 'This service is required for the site to work.',
          },
          optOut: {
            title: 'Opt-out service',
            description: 'This service loads by default. You can disable it here.',
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
      ko: {
        privacyPolicyUrl: '/legal/privacy',
        consentNotice: {
          title: '쿠키 및 개인정보 설정',
          description:
            'Codebase는 보안과 핵심 기능을 위해 필수 쿠키를 사용합니다. 선택 분석 쿠키는 명시적으로 허용한 경우에만 사용합니다.',
          changeDescription: '쿠키 설정이 변경되었습니다.',
          learnMore: '설정 관리',
        },
        consentModal: {
          title: '개인정보 설정',
          description:
            '선택 분석 쿠키 사용 여부를 정할 수 있습니다. 보안, 세션 유지, 핵심 기능에 필요한 필수 쿠키는 항상 활성화됩니다.',
        },
        privacyPolicy: {
          name: '개인정보처리방침',
          text: '자세한 내용은 {privacyPolicy}을 확인하세요.',
        },
        purposes: {
          functional: {
            title: '필수 기능',
            description: '보안, 세션 유지, 핵심 제품 기능에 필요한 서비스입니다.',
          },
          analytics: {
            title: '이용 분석',
            description: '명시적으로 동의한 뒤 제품 이용 현황을 측정하는 선택 서비스입니다.',
          },
        },
        purposeItem: {
          service: '서비스',
          services: '서비스',
        },
        acceptAll: '분석 쿠키 허용',
        acceptSelected: '선택 저장',
        decline: '필수 쿠키만 사용',
        ok: '선택 저장',
        save: '선택 저장',
        close: '닫기',
        service: {
          disableAll: {
            title: '모든 선택 서비스',
            description: '선택 서비스를 한 번에 켜거나 끕니다.',
          },
          required: {
            title: '항상 활성',
            description: '사이트 작동에 필요한 서비스입니다.',
          },
          optOut: {
            title: '거부 가능한 서비스',
            description: '기본으로 실행되는 서비스이며 여기에서 끌 수 있습니다.',
          },
          purposes: '목적',
          purpose: '목적',
        },
        essential: {
          title: '필수 쿠키',
          description:
            '로그인, 보안 설정, 동의 내역 저장, 핵심 사이트 기능에 필요합니다. 이 항목은 항상 활성화됩니다.',
        },
        analytics: {
          title: '분석 쿠키',
          description:
            '명시적으로 동의한 뒤에만 Google Analytics와 Mixpanel을 사용합니다. 동의 전에는 실행되지 않습니다.',
        },
      },
    },
    services: [
      {
        name: 'essential',
        required: true,
        purposes: ['functional'],
        translations: {
          en: {
            title: 'Essential cookies',
            description:
              'Required for authentication, security controls, consent storage, and core site functionality. This category is always active.',
          },
          ko: {
            title: '필수 쿠키',
            description:
              '로그인, 보안 설정, 동의 내역 저장, 핵심 사이트 기능에 필요합니다. 이 항목은 항상 활성화됩니다.',
          },
        },
      },
      {
        name: 'analytics',
        default: false,
        purposes: ['analytics'],
        translations: {
          en: {
            title: 'Analytics cookies',
            description:
              'Allows Google Analytics and Mixpanel only after explicit opt-in. These tools stay disabled until you consent.',
          },
          ko: {
            title: '분석 쿠키',
            description:
              '명시적으로 동의한 뒤에만 Google Analytics와 Mixpanel을 사용합니다. 동의 전에는 실행되지 않습니다.',
          },
        },
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
