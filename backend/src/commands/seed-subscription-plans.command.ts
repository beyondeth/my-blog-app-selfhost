import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SubscriptionPlanSeeder } from "../subscription/seeders/subscription-plan.seeder";

/**
 * 구독 플랜 시드 커맨드
 * 실행: npm run seed:subscription-plans
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    console.log("🚀 Starting subscription plan seeding...\n");

    const seeder = app.get(SubscriptionPlanSeeder);

    // 인자 확인
    const command = process.argv[2];

    if (command === "--clear") {
      // 기존 데이터 삭제
      await seeder.clear();
    } else {
      // 시드 데이터 생성
      await seeder.seed();

      console.log(
        '\n📌 Note: Use "npm run seed:subscription-plans -- --clear" to clear all plans',
      );
    }

    console.log("\n✨ Done!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
