import { NestFactory } from "@nestjs/core";
import { Role } from "../common/enums/role.enum";
import type { UsersService as UsersServiceType } from "../users/users.service";

type AdminPromotionUsersService = Pick<
  UsersServiceType,
  "findByEmail" | "update"
>;

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

export async function promoteExistingUser(
  usersService: AdminPromotionUsersService,
  email: string,
): Promise<"already-admin" | "promoted"> {
  const user = await usersService.findByEmail(email);

  if (!user) {
    throw new Error(
      `No active user found for ${email}. Sign in once with that account, then run admin:promote again.`,
    );
  }

  if (user.isDeleted || !user.isActive) {
    throw new Error(
      `The account for ${email} is deleted or inactive and cannot be promoted.`,
    );
  }

  if (!user.isEmailVerified) {
    throw new Error(
      `The account for ${email} is not email-verified and cannot be promoted.`,
    );
  }

  if (user.role === Role.ADMIN) {
    return "already-admin";
  }

  await usersService.update(user.id, { role: Role.ADMIN } as any);
  return "promoted";
}

async function main(): Promise<void> {
  const email = (getOption("--email") || process.env.ADMIN_EMAIL)?.trim();

  if (!email) {
    throw new Error(
      "Usage: pnpm admin:promote -- --email existing-user@example.com",
    );
  }

  const [{ AppModule }, { UsersService }] = await Promise.all([
    import("../app.module"),
    import("../users/users.service"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const result = await promoteExistingUser(app.get(UsersService), email);
    console.log(
      result === "already-admin"
        ? `Admin account already ready: ${email}`
        : `Admin role granted: ${email}`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
