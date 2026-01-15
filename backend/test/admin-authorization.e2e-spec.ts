import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { UsersService } from "../src/users/users.service";
import { AuthService } from "../src/auth/auth.service";
import { Role } from "../src/common/enums/role.enum";

describe("Admin Authorization (E2E)", () => {
  let app: INestApplication;
  let usersService: UsersService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    usersService = moduleFixture.get(UsersService);
    authService = moduleFixture.get(AuthService);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it("should reject dashboard access for non-admin users with 403", async () => {
    const uniqueId = `authz_${Date.now()}`;
    const email = `${uniqueId}@example.com`;
    const password = "SecurePass123!";

    const user = await usersService.create({
      email,
      username: uniqueId,
      role: Role.USER,
      isEmailVerified: true,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    });
    await usersService.updatePassword(user.id, password);

    const authResponse = await authService.login({ email, password });

    await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${authResponse.access_token}`)
      .expect(403);

    await usersService.remove(user.id);
  });
});
