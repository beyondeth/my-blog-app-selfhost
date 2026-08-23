import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const renderer = join(scriptsDirectory, "render-aigory-production-env.mjs");

const requiredSource = `
OCI_NAMESPACE=testnamespace
AWS_S3_ACCESS_KEY_ID=media-access-key
AWS_S3_SECRET_ACCESS_KEY=media-secret-key
CLOUDFLARE_ZONE_ID=zone-id
CLOUDFLARE_API_TOKEN=cloudflare-token
SMTP_HOST=smtp.example.com
SMTP_USER=mailer@example.com
SMTP_PASS='P@ss word!$'
GOOGLE_CLIENT_ID=google-client-id
GOOGLE_CLIENT_SECRET=google-client-secret
GITHUB_CLIENT_ID=github-client-id
GITHUB_CLIENT_SECRET=github-client-secret
KAKAO_CLIENT_ID=kakao-client-id
KAKAO_CLIENT_SECRET=kakao-client-secret
NEXT_PUBLIC_MIXPANEL_TOKEN=mixpanel-token
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST
`;

test("renders a complete owner-only production environment", () => {
  const directory = mkdtempSync(join(tmpdir(), "aigory-env-test-"));
  try {
    const source = join(directory, "source.env");
    const output = join(directory, "production.env");
    writeFileSync(source, requiredSource);

    execFileSync(process.execPath, [
      renderer,
      "--source",
      source,
      "--output",
      output,
    ]);

    const rendered = readFileSync(output, "utf8");
    assert.doesNotMatch(rendered, /^[A-Za-z_][A-Za-z0-9_]*=CHANGE_ME/m);
    assert.match(rendered, /^NEXT_PUBLIC_SITE_URL=https:\/\/aigory\.com$/m);
    assert.match(rendered, /^SMTP_PASS='P@ss word!\$'$/m);
    assert.match(rendered, /^REDIS_URL=redis:\/\/:.+@redis:6379\/0$/m);
    assert.match(rendered, /^IP_ENCRYPTION_KEY=[A-Za-z0-9+/]{43}=$/m);
    assert.equal(statSync(output).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fails closed when an inherited credential is missing", () => {
  const directory = mkdtempSync(join(tmpdir(), "aigory-env-test-"));
  try {
    const source = join(directory, "source.env");
    const output = join(directory, "production.env");
    writeFileSync(source, requiredSource.replace(/^SMTP_PASS=.*$/m, ""));

    const result = spawnSync(
      process.execPath,
      [renderer, "--source", source, "--output", output],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SMTP_PASS/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
