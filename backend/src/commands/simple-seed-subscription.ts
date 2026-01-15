import { DataSource } from "typeorm";
import { SubscriptionTier } from "../common/enums/subscription.enum";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function seed() {
  // Create direct database connection
  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [],
    synchronize: false,
  });

  await dataSource.initialize();

  console.log("🌱 시작: 구독 플랜 시드 데이터 생성...\n");

  try {
    // Check if plans already exist
    const existingPlans = await dataSource.query(
      `SELECT * FROM subscription_plans WHERE tier IN ('free', 'starter', 'pro')`,
    );

    if (existingPlans.length > 0) {
      console.log(
        "⚠️  구독 플랜이 이미 존재합니다. 기존 데이터를 유지합니다.\n",
      );
      return;
    }

    // Free Plan
    await dataSource.query(`
      INSERT INTO subscription_plans (
        id, name, display_name, tier, description,
        pricing, features, limits, is_active, sort_order,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Free Plan',
        'Free',
        'free',
        '개인 블로그를 시작하기에 완벽한 무료 플랜',
        '{"monthly": 0, "yearly": 0, "currency": "KRW"}'::jsonb,
        '{"maxPostsPerMonth": 10, "maxBlogCount": 1, "analytics": "none", "removeAds": false, "exportData": false, "scheduledPosts": false}'::jsonb,
        '{}'::jsonb,
        true,
        0,
        NOW(),
        NOW()
      )
    `);
    console.log("✅ Free 플랜 생성 완료");

    // Starter Plan
    await dataSource.query(`
      INSERT INTO subscription_plans (
        id, name, display_name, tier, description,
        pricing, features, limits, is_active, sort_order,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Starter Plan',
        'Starter',
        'starter',
        '취미 블로거와 콘텐츠 크리에이터를 위한 플랜',
        '{"monthly": 9000, "yearly": 90000, "currency": "KRW"}'::jsonb,
        '{"maxPostsPerMonth": 50, "maxBlogCount": 1, "analytics": "basic", "removeAds": true, "exportData": true, "scheduledPosts": true}'::jsonb,
        '{}'::jsonb,
        true,
        1,
        NOW(),
        NOW()
      )
    `);
    console.log("✅ Starter 플랜 생성 완료");

    // Pro Plan
    await dataSource.query(`
      INSERT INTO subscription_plans (
        id, name, display_name, tier, description,
        pricing, features, limits, is_active, sort_order,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Pro Plan',
        'Pro',
        'pro',
        '전문 블로거와 비즈니스를 위한 프리미엄 플랜',
        '{"monthly": 19000, "yearly": 190000, "currency": "KRW"}'::jsonb,
        '{"maxPostsPerMonth": -1, "maxBlogCount": 1, "analytics": "advanced", "removeAds": true, "exportData": true, "scheduledPosts": true}'::jsonb,
        '{}'::jsonb,
        true,
        2,
        NOW(),
        NOW()
      )
    `);
    console.log("✅ Pro 플랜 생성 완료");

    console.log("\n🎉 구독 플랜 시드 데이터 생성 완료!");

    // Show created plans
    const plans = await dataSource.query(`
      SELECT tier, name,
             (pricing->>'monthly')::int as monthly_price,
             (pricing->>'yearly')::int as yearly_price,
             features->'maxPostsPerMonth' as max_posts
      FROM subscription_plans
      ORDER BY sort_order
    `);

    console.log("\n📋 생성된 플랜:");
    console.table(plans);
  } catch (error) {
    console.error("❌ 시드 생성 중 오류 발생:", error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Run the seed
seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
