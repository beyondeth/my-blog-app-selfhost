#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

function parseEnvironment(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

function requireExisting(source, name) {
  const value = source.get(name)?.trim();
  if (!value) {
    throw new Error(`Source environment is missing ${name}`);
  }
  return value;
}

function composeValue(name, value) {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(
      `${name} contains a line break or NUL byte and cannot be rendered`,
    );
  }
  if (/^[A-Za-z0-9_./:@,+%=-]*$/.test(value)) return value;
  if (value.includes("'")) {
    throw new Error(`${name} contains an unsupported single quote`);
  }
  return `'${value}'`;
}

const sourcePath = readArgument("--source");
const outputPath = readArgument("--output");
const templatePath = resolve(
  new URL("../.env.production.example", import.meta.url).pathname,
);

const source = parseEnvironment(readFileSync(sourcePath, "utf8"));
const template = readFileSync(templatePath, "utf8");
const hex = (bytes) => randomBytes(bytes).toString("hex");
const base64 = (bytes) => randomBytes(bytes).toString("base64");
const password = () => randomBytes(36).toString("base64url");

const inheritedNames = [
  "OCI_NAMESPACE",
  "AWS_S3_ACCESS_KEY_ID",
  "AWS_S3_SECRET_ACCESS_KEY",
  "CLOUDFLARE_ZONE_ID",
  "CLOUDFLARE_API_TOKEN",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "KAKAO_CLIENT_ID",
  "KAKAO_CLIENT_SECRET",
];

const replacements = new Map(
  inheritedNames.map((name) => [
    name,
    composeValue(name, requireExisting(source, name)),
  ]),
);

replacements.set("JWT_SECRET", hex(32));
replacements.set("JWT_REFRESH_SECRET", hex(32));
replacements.set("SESSION_SECRET", hex(32));
replacements.set("UPLOAD_INTENT_SECRET", hex(32));
replacements.set("MCP_SHARED_SECRET", hex(32));
replacements.set("METRICS_AUTH_TOKEN", hex(32));
replacements.set("EMAIL_VERIFICATION_HASH_SECRET", hex(32));
replacements.set("IP_ENCRYPTION_KEY", base64(32));
replacements.set("IP_ENCRYPTION_SALT", hex(32));
replacements.set("DB_PASSWORD", password());
replacements.set("REDIS_PASSWORD", hex(24));
replacements.set(
  "REDIS_URL",
  `redis://:${replacements.get("REDIS_PASSWORD")}@redis:6379/0`,
);
replacements.set("GF_SECURITY_ADMIN_PASSWORD", password());

for (const name of ["NEXT_PUBLIC_MIXPANEL_TOKEN", "NEXT_PUBLIC_GA_MEASUREMENT_ID"]) {
  replacements.set(name, composeValue(name, source.get(name)?.trim() || ""));
}

const backupAccessKey =
  source.get("BACKUP_S3_ACCESS_KEY_ID") ||
  replacements.get("AWS_S3_ACCESS_KEY_ID");
const backupSecretKey =
  source.get("BACKUP_S3_SECRET_ACCESS_KEY") ||
  replacements.get("AWS_S3_SECRET_ACCESS_KEY");
replacements.set(
  "BACKUP_S3_ACCESS_KEY_ID",
  composeValue("BACKUP_S3_ACCESS_KEY_ID", backupAccessKey),
);
replacements.set(
  "BACKUP_S3_SECRET_ACCESS_KEY",
  composeValue("BACKUP_S3_SECRET_ACCESS_KEY", backupSecretKey),
);

const rendered = template
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !replacements.has(match[1])) return line;
    return `${match[1]}=${replacements.get(match[1])}`;
  })
  .join("\n");

const unresolved = rendered
  .split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=CHANGE_ME/.test(line));
if (unresolved.length > 0) {
  throw new Error(
    `Unresolved production settings: ${unresolved
      .map((line) => line.split("=", 1)[0])
      .join(", ")}`,
  );
}

writeFileSync(outputPath, `${rendered.trimEnd()}\n`, { mode: 0o600 });
chmodSync(outputPath, 0o600);

console.log(`Rendered production environment: ${outputPath}`);
if (!source.has("BACKUP_S3_ACCESS_KEY_ID")) {
  console.log(
    "Backup uploads currently reuse the OCI media credential; replace them with a backup-only customer secret when available.",
  );
}
