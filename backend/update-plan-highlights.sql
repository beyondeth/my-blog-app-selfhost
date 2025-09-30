-- Free 플랜 highlights 업데이트 (1개 블로그 운영 삭제)
UPDATE subscription_plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{highlights}',
  '["MCP 자동포스팅 일 5건 / 월 30건", "무제한 일반 포스트 작성"]'::jsonb
)
WHERE tier = 'free';

-- Starter 플랜 highlights 업데이트 (1개 블로그 운영, 기본 분석 기능, 광고 제거, 데이터 내보내기 삭제)
UPDATE subscription_plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{highlights}',
  '["MCP 자동포스팅 일 10건 / 월 200건", "무제한 일반 포스트 작성"]'::jsonb
)
WHERE tier = 'starter';

-- Pro 플랜 highlights 업데이트 (1개 블로그 운영, 고급 분석 기능, 광고 제거, 데이터 내보내기, 예약 포스팅 삭제)
UPDATE subscription_plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{highlights}',
  '["MCP 자동포스팅 일 20건 / 월 400건", "무제한 일반 포스트 작성"]'::jsonb
)
WHERE tier = 'pro';