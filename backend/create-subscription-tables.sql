-- Create enum types
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'canceled', 'expired', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('posts', 'blogs', 'comments', 'images');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  tier subscription_tier NOT NULL UNIQUE,
  description TEXT,
  pricing JSONB NOT NULL DEFAULT '{"monthly": 0, "yearly": 0, "currency": "KRW"}',
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  billing_cycle billing_cycle,
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'KRW',
  payment_subscription_id VARCHAR(255),
  payment_customer_id VARCHAR(255),
  auto_renew BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_provider VARCHAR(50),
  transaction_id VARCHAR(255),
  refunded_amount DECIMAL(10, 2),
  refund_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  resource_type resource_type NOT NULL,
  resource_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, resource_type, period_start, period_end)
);

-- Add subscription fields to users table if not exists
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_customer_id VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_subscription_id VARCHAR(255);
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'users table does not exist, skipping column additions';
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

-- Insert subscription plans
INSERT INTO subscription_plans (
  name, display_name, tier, description,
  pricing, features, limits, is_active, sort_order
) VALUES
(
  'Free Plan',
  'Free',
  'free',
  '개인 블로그를 시작하기에 완벽한 무료 플랜',
  '{"monthly": 0, "yearly": 0, "currency": "KRW"}'::jsonb,
  '{"maxPostsPerMonth": 10, "maxBlogCount": 1, "analytics": "none", "removeAds": false, "exportData": false, "scheduledPosts": false}'::jsonb,
  '{}'::jsonb,
  true,
  0
),
(
  'Starter Plan',
  'Starter',
  'starter',
  '취미 블로거와 콘텐츠 크리에이터를 위한 플랜',
  '{"monthly": 9000, "yearly": 90000, "currency": "KRW"}'::jsonb,
  '{"maxPostsPerMonth": 50, "maxBlogCount": 1, "analytics": "basic", "removeAds": true, "exportData": true, "scheduledPosts": true}'::jsonb,
  '{}'::jsonb,
  true,
  1
),
(
  'Pro Plan',
  'Pro',
  'pro',
  '전문 블로거와 비즈니스를 위한 프리미엄 플랜',
  '{"monthly": 19000, "yearly": 190000, "currency": "KRW"}'::jsonb,
  '{"maxPostsPerMonth": -1, "maxBlogCount": 1, "analytics": "advanced", "removeAds": true, "exportData": true, "scheduledPosts": true}'::jsonb,
  '{}'::jsonb,
  true,
  2
) ON CONFLICT (tier) DO NOTHING;