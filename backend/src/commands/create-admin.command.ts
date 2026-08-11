import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { AuthProvider } from "../users/entities/user.entity";
import { Role } from "../common/enums/role.enum";
import { UsersService } from "../users/users.service";
import { BlogsService } from "../blogs/blogs.service";

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function createSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug.length >= 3 ? slug.slice(0, 50) : "admin-blog";
}

async function ensureBlog(blogsService: BlogsService, user: any): Promise<void> {
  if (user.blog) return;

  const emailPrefix = user.email.split("@")[0];
  const baseSlug = createSlug(user.username || emailPrefix);
  let slug = baseSlug;

  while (!(await blogsService.checkSlugAvailability(slug))) {
    slug = `${baseSlug.slice(0, 44)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await blogsService.create(
    {
      slug,
      name: user.username || emailPrefix,
      description: `${user.username || emailPrefix}님의 블로그입니다.`,
    },
    user,
  );
}

async function main(): Promise<void> {
  const email = getOption("--email") || process.env.ADMIN_EMAIL;
  const password = getOption("--password") || process.env.ADMIN_PASSWORD;
  const username =
    getOption("--username") || process.env.ADMIN_USERNAME || "admin";

  if (!email || !password) {
    throw new Error(
      "Usage: pnpm admin:create -- --email admin@example.com --password 'StrongPassword123!' [--username admin]",
    );
  }

  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error(
      "Password must be at least 8 characters and include lowercase, uppercase, and a number.",
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const usersService = app.get(UsersService);
    const blogsService = app.get(BlogsService);
    let user = await usersService.findByEmailIncludingDeleted(email);

    if (!user) {
      user = await usersService.create({
        email,
        username,
        password,
        authProvider: AuthProvider.LOCAL,
        isEmailVerified: true,
        isActive: true,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      } as any);
    }

    if (user.role !== Role.ADMIN || !user.isEmailVerified || !user.isActive) {
      user = await usersService.update(user.id, {
        role: Role.ADMIN,
        isEmailVerified: true,
        isActive: true,
      } as any);
    }

    await ensureBlog(blogsService, user);
    console.log(`Admin account ready: ${email}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
