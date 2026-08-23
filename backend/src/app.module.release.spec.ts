import { readFileSync } from "fs";
import { join } from "path";

describe("AppModule production release surface", () => {
  it("keeps payment and subscription modules commented out", () => {
    const source = readFileSync(join(__dirname, "app.module.ts"), "utf8");

    expect(source).toContain(
      "// import { SubscriptionModule } from './subscription/subscription.module';",
    );
    expect(source).toContain(
      "// import { PaymentModule } from './payment/payment.module';",
    );
    expect(source).toContain(
      "// import { PaymentEventsModule } from './payment/payment-events.module';",
    );
    expect(source).toContain(
      "// import { SharedSubscriptionModule } from './shared/shared-subscription.module';",
    );
    expect(source).toContain(
      "// SubscriptionModule, // UsersModule 이후에 로드",
    );
    expect(source).toContain(
      "// PaymentModule, // 마지막에 로드 (이벤트 기반으로 다른 모듈과 통신)",
    );
  });
});
