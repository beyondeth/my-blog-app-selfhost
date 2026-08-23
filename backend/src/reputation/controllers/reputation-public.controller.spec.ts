import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { ReputationPublicController } from "./reputation-public.controller";

describe("ReputationPublicController release contract", () => {
  it("keeps the public level endpoint available without a session", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ReputationPublicController)).toBe(
      true,
    );
  });
});
