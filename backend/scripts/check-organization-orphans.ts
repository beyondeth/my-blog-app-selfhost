#!/usr/bin/env ts-node

import { AppDataSource } from "../src/data-source";

type OrganizationLink = {
  table: string;
  required: boolean;
};

const links: OrganizationLink[] = [
  { table: "blogs", required: true },
  { table: "files", required: true },
  { table: "mcp_api_keys", required: true },
  { table: "communities", required: true },
  { table: "file_contexts", required: true },
  { table: "videos", required: true },
  { table: "audit_logs", required: false },
  { table: "outbox_events", required: false },
];

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict");
  const dataSource = AppDataSource;
  let hasRequiredOrphans = false;
  let hasScopeMismatches = false;
  const availableLinks = new Set<string>();

  await dataSource.initialize();

  try {
    console.log("Organization link report");

    for (const link of links) {
      const [column] = await dataSource.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'organizationId'
        `,
        [link.table],
      );

      if (!column) {
        console.log(
          `- ${link.table}: organizationId column not found (migration pending)`,
        );
        if (link.required) {
          hasRequiredOrphans = true;
        }
        continue;
      }

      availableLinks.add(link.table);

      const [result] = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${link.table}" WHERE "organizationId" IS NULL`,
      );
      const count = Number(result?.count || 0);
      const status = count === 0 ? "ok" : "orphaned";

      console.log(
        `- ${link.table}: ${status}=${count} required=${link.required}`,
      );

      if (link.required && count > 0) {
        hasRequiredOrphans = true;
      }
    }

    if (availableLinks.has("mcp_api_keys") && availableLinks.has("blogs")) {
      const [mcpMismatch] = await dataSource.query(`
        SELECT COUNT(*)::int AS count
        FROM "mcp_api_keys" k
        INNER JOIN "blogs" b ON b."id" = k."blogId"
        WHERE k."organizationId" IS DISTINCT FROM b."organizationId"
      `);
      console.log(
        `- mcp_api_keys/blog scope mismatches=${Number(mcpMismatch?.count || 0)}`,
      );
      hasScopeMismatches ||= Number(mcpMismatch?.count || 0) > 0;
    }

    if (availableLinks.has("file_contexts") && availableLinks.has("files")) {
      const [fileContextMismatch] = await dataSource.query(`
        SELECT COUNT(*)::int AS count
        FROM "file_contexts" c
        INNER JOIN "files" f ON f."context_id" = c."id"
        WHERE c."organizationId" IS DISTINCT FROM f."organizationId"
      `);
      console.log(
        `- file_contexts/files scope mismatches=${Number(fileContextMismatch?.count || 0)}`,
      );
      hasScopeMismatches ||= Number(fileContextMismatch?.count || 0) > 0;
    }

    const [organizationTables] = await dataSource.query(`
      SELECT
        to_regclass('public.organizations') IS NOT NULL AS organizations_ready,
        to_regclass('public.organization_members') IS NOT NULL AS members_ready
    `);

    if (
      availableLinks.has("blogs") &&
      organizationTables?.organizations_ready &&
      organizationTables?.members_ready
    ) {
      const [blogMembershipMismatch] = await dataSource.query(`
        SELECT COUNT(*)::int AS count
        FROM "blogs" b
        LEFT JOIN "organization_members" m
          ON m."organizationId" = b."organizationId"
         AND m."userId" = b."userId"
         AND m."status" = 'active'
        WHERE b."organizationId" IS NOT NULL AND m."id" IS NULL
      `);
      console.log(
        `- blogs/owner membership mismatches=${Number(blogMembershipMismatch?.count || 0)}`,
      );
      hasScopeMismatches ||= Number(blogMembershipMismatch?.count || 0) > 0;
    }

    if (strict && (hasRequiredOrphans || hasScopeMismatches)) {
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
