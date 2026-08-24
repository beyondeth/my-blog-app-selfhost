import assert from 'node:assert/strict';
import test from 'node:test';
import { createKlaroConfig } from '../src/lib/consent.ts';
import {
  detectPreferredLocale,
  extractLocaleFromPathname,
  localizePath,
} from '../src/lib/i18n/config.ts';
import { hasPendingImageUpload } from '../src/editor/utils/pending-image-upload.ts';
import { getProductContent } from '../src/app/product/product-content.ts';

test('selects the supported locale with the highest Accept-Language weight', () => {
  assert.equal(detectPreferredLocale('en-US;q=0.7, ko-KR;q=0.9'), 'ko');
  assert.equal(detectPreferredLocale('ko-KR;q=0.4, en;q=0.8'), 'en');
  assert.equal(detectPreferredLocale('ja-JP, fr;q=0.8'), 'en');
});

test('localizes only explicitly localized routes', () => {
  assert.equal(localizePath('/product', 'ko'), '/ko/product');
  assert.equal(localizePath('/en/product?from=header', 'ko'), '/ko/product?from=header');
  assert.equal(localizePath('/settings/profile', 'ko'), '/settings/profile');

  assert.deepEqual(extractLocaleFromPathname('/ko/product'), {
    locale: 'ko',
    hasLocalePrefix: true,
    pathnameWithoutLocale: '/product',
  });
});

test('renders different product copy for English and Korean', () => {
  assert.equal(getProductContent('en').primaryCta, 'Start writing');
  assert.equal(getProductContent('ko').primaryCta, '글쓰기 시작');
  assert.notEqual(getProductContent('en').heroTitle, getProductContent('ko').heroTitle);
});

test('provides complete locale-specific Klaro labels and service text', () => {
  const english = createKlaroConfig('en');
  const korean = createKlaroConfig('ko');

  assert.equal(english.lang, 'en');
  assert.equal(korean.lang, 'ko');
  assert.equal(korean.translations.ko.consentModal.title, '개인정보 설정');
  assert.equal(korean.translations.ko.privacyPolicy.name, '개인정보처리방침');
  assert.equal(korean.translations.ko.purposes.functional.title, '필수 기능');
  assert.equal(korean.translations.ko.purposes.analytics.title, '이용 분석');
  assert.equal(korean.services[0].translations.ko.title, '필수 쿠키');
  assert.equal(english.translations.en.purposes.functional.title, 'Essential operations');
  assert.equal(english.translations.en.purposes.analytics.title, 'Analytics');
  assert.equal(english.services[1].translations.en.title, 'Analytics cookies');
  assert.equal(JSON.stringify(korean).includes('[missing translation'), false);
});

test('detects unresolved rich-editor image upload placeholders before save', () => {
  assert.equal(
    hasPendingImageUpload('<p>Before</p><div data-type="image-upload"></div>'),
    true,
  );
  assert.equal(
    hasPendingImageUpload('<figure><img src="https://cdn.example/image.webp"></figure>'),
    false,
  );
});
