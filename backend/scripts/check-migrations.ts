#!/usr/bin/env ts-node
import * as fs from "fs";
import * as path from "path";
import {
  MIGRATION_MANIFEST,
  MIGRATION_TIMESTAMP_TIE_ALLOWLIST,
  MigrationConstructor,
  MigrationManifestEntry,
  ORDERED_MIGRATIONS,
} from "../src/migrations/migration-manifest";

const TIMESTAMP_SUFFIX = /(\d{13})$/;

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (message: string) =>
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  success: (message: string) =>
    console.log(`${colors.green}✓${colors.reset} ${message}`),
  error: (message: string) =>
    console.error(`${colors.red}✗${colors.reset} ${message}`),
  section: (message: string) =>
    console.log(`\n${colors.cyan}═══ ${message} ═══${colors.reset}`),
};

interface MigrationInstance {
  name?: string;
}

interface InspectableMigrationConstructor {
  new (): MigrationInstance;
  name: string;
  prototype: {
    up?: unknown;
    down?: unknown;
  };
}

export interface MigrationIdentity {
  fileName: string;
  className: string;
  declaredName?: string;
  effectiveName: string;
  timestamp: number;
}

export interface InspectionResult {
  identities: MigrationIdentity[];
  errors: string[];
}

interface CompiledManifestModule {
  MIGRATION_MANIFEST: readonly MigrationManifestEntry[];
  MIGRATION_TIMESTAMP_TIE_ALLOWLIST: Readonly<
    Record<string, readonly string[]>
  >;
  ORDERED_MIGRATIONS: MigrationConstructor[];
}

function timestampFrom(value: string): number | undefined {
  const match = value.match(TIMESTAMP_SUFFIX);
  return match ? Number(match[1]) : undefined;
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function validateIdentityFields(
  fileName: string,
  className: string,
  declaredName?: string,
): string[] {
  const errors: string[] = [];
  const fileTimestampMatch = fileName.match(/^(\d{13})-/);
  const fileTimestamp = fileTimestampMatch
    ? Number(fileTimestampMatch[1])
    : undefined;
  const classTimestamp = timestampFrom(className);
  const declaredTimestamp = declaredName
    ? timestampFrom(declaredName)
    : classTimestamp;

  if (fileTimestamp === undefined) {
    errors.push(`${fileName}: filename must start with a 13-digit timestamp`);
  }

  if (classTimestamp === undefined) {
    errors.push(
      `${fileName}: class ${className} has no 13-digit timestamp suffix`,
    );
  }

  if (declaredName && declaredTimestamp === undefined) {
    errors.push(
      `${fileName}: declared name ${declaredName} has no 13-digit timestamp suffix`,
    );
  }

  if (
    fileTimestamp !== undefined &&
    classTimestamp !== undefined &&
    fileTimestamp !== classTimestamp
  ) {
    errors.push(
      `${fileName}: filename timestamp ${fileTimestamp} does not match class ${className}`,
    );
  }

  if (
    classTimestamp !== undefined &&
    declaredTimestamp !== undefined &&
    classTimestamp !== declaredTimestamp
  ) {
    errors.push(
      `${fileName}: class timestamp does not match declared name ${declaredName}`,
    );
  }

  if (declaredName && declaredName !== className) {
    errors.push(
      `${fileName}: declared name ${declaredName} does not match class ${className}`,
    );
  }

  return errors;
}

export function inspectMigrationDirectory(
  directory: string,
  extension: ".ts" | ".js",
): InspectionResult {
  const identities: MigrationIdentity[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(directory)) {
    return {
      identities,
      errors: [`Migration directory does not exist: ${directory}`],
    };
  }

  const migrationFilePattern = new RegExp(`^\\d{13}-.+\\${extension}$`);
  const files = fs
    .readdirSync(directory)
    .filter((file) => migrationFilePattern.test(file))
    .sort();

  for (const file of files) {
    const fullPath = path.join(directory, file);
    let moduleExports: Record<string, unknown>;

    try {
      moduleExports = require(fullPath) as Record<string, unknown>;
    } catch (error) {
      errors.push(
        `${file}: failed to load (${error instanceof Error ? error.message : String(error)})`,
      );
      continue;
    }

    const migrationClasses = Object.values(moduleExports).filter(
      (value): value is InspectableMigrationConstructor =>
        typeof value === "function" &&
        typeof (value as InspectableMigrationConstructor).prototype?.up ===
          "function" &&
        typeof (value as InspectableMigrationConstructor).prototype?.down ===
          "function",
    );

    if (migrationClasses.length !== 1) {
      errors.push(
        `${file}: expected exactly one exported migration class, found ${migrationClasses.length}`,
      );
      continue;
    }

    const migrationClass = migrationClasses[0];
    let instance: MigrationInstance;

    try {
      instance = new migrationClass();
    } catch (error) {
      errors.push(
        `${file}: failed to instantiate ${migrationClass.name} (${error instanceof Error ? error.message : String(error)})`,
      );
      continue;
    }

    const fileName = file.slice(0, -extension.length);
    const declaredName =
      typeof instance.name === "string" && instance.name.length > 0
        ? instance.name
        : undefined;
    const effectiveName = declaredName ?? migrationClass.name;
    const timestamp = timestampFrom(effectiveName);

    errors.push(
      ...validateIdentityFields(fileName, migrationClass.name, declaredName),
    );

    if (timestamp !== undefined) {
      identities.push({
        fileName,
        className: migrationClass.name,
        declaredName,
        effectiveName,
        timestamp,
      });
    }
  }

  return { identities, errors };
}

export function validateManifestRuntime(
  manifest: readonly MigrationManifestEntry[],
  migrations: MigrationConstructor[],
): string[] {
  const errors: string[] = [];

  if (manifest.length !== migrations.length) {
    errors.push(
      `Manifest has ${manifest.length} entries but runtime loaded ${migrations.length} migrations`,
    );
  }

  manifest.forEach((entry, index) => {
    const migration = migrations[index];
    if (!migration) return;

    let instance: MigrationInstance;
    try {
      instance = new migration();
    } catch (error) {
      errors.push(
        `${entry.fileName}: runtime constructor failed (${error instanceof Error ? error.message : String(error)})`,
      );
      return;
    }

    const effectiveName = instance.name ?? migration.name;
    if (
      migration.name !== entry.className ||
      effectiveName !== entry.className
    ) {
      errors.push(
        `${entry.fileName}: manifest expects ${entry.className}, runtime loaded ${migration.name}/${effectiveName}`,
      );
    }
  });

  return errors;
}

export function validateMigrationInventory(
  identities: MigrationIdentity[],
  manifest: readonly MigrationManifestEntry[],
  tieAllowlist: Readonly<Record<string, readonly string[]>>,
): string[] {
  const errors: string[] = [];
  const identityByFile = new Map<string, MigrationIdentity>();
  const effectiveNames = new Set<string>();

  for (const identity of identities) {
    if (identityByFile.has(identity.fileName)) {
      errors.push(`Duplicate source file identity: ${identity.fileName}`);
    }
    identityByFile.set(identity.fileName, identity);

    if (effectiveNames.has(identity.effectiveName)) {
      errors.push(
        `Duplicate runtime migration name: ${identity.effectiveName}`,
      );
    }
    effectiveNames.add(identity.effectiveName);
  }

  const manifestFiles = new Set<string>();
  const manifestClasses = new Set<string>();
  const timestampGroups = new Map<string, string[]>();
  let previousTimestamp: number | undefined;

  for (const entry of manifest) {
    if (manifestFiles.has(entry.fileName)) {
      errors.push(`Manifest contains duplicate file: ${entry.fileName}`);
    }
    manifestFiles.add(entry.fileName);

    if (manifestClasses.has(entry.className)) {
      errors.push(`Manifest contains duplicate class: ${entry.className}`);
    }
    manifestClasses.add(entry.className);

    const identity = identityByFile.get(entry.fileName);
    if (!identity) {
      errors.push(`Manifest entry has no source migration: ${entry.fileName}`);
      continue;
    }

    if (identity.className !== entry.className) {
      errors.push(
        `${entry.fileName}: manifest class ${entry.className} does not match source ${identity.className}`,
      );
    }

    if (
      previousTimestamp !== undefined &&
      identity.timestamp < previousTimestamp
    ) {
      errors.push(
        `${entry.fileName}: manifest timestamp ${identity.timestamp} is before ${previousTimestamp}`,
      );
    }
    previousTimestamp = identity.timestamp;

    const key = String(identity.timestamp);
    const group = timestampGroups.get(key) ?? [];
    group.push(identity.effectiveName);
    timestampGroups.set(key, group);
  }

  for (const identity of identities) {
    if (!manifestFiles.has(identity.fileName)) {
      errors.push(
        `Source migration is missing from manifest: ${identity.fileName}`,
      );
    }
  }

  for (const [timestamp, classNames] of timestampGroups) {
    if (classNames.length < 2) continue;

    const allowed = tieAllowlist[timestamp];
    if (!allowed) {
      errors.push(
        `Timestamp ${timestamp} is duplicated but not allowlisted: ${classNames.join(", ")}`,
      );
    } else if (!arraysEqual(classNames, allowed)) {
      errors.push(
        `Timestamp ${timestamp} order differs from allowlist: ${classNames.join(", ")}`,
      );
    }
  }

  for (const [timestamp, allowed] of Object.entries(tieAllowlist)) {
    const actual = timestampGroups.get(timestamp);
    if (!actual || actual.length < 2) {
      errors.push(`Timestamp tie allowlist entry is stale: ${timestamp}`);
    } else if (!arraysEqual(actual, allowed)) {
      errors.push(
        `Timestamp ${timestamp} allowlist does not exactly match manifest`,
      );
    }
  }

  return errors;
}

export function compareMigrationIdentities(
  source: MigrationIdentity[],
  compiled: MigrationIdentity[],
): string[] {
  const errors: string[] = [];
  const compiledByFile = new Map(
    compiled.map((identity) => [identity.fileName, identity]),
  );
  const sourceFiles = new Set(source.map((identity) => identity.fileName));

  for (const sourceIdentity of source) {
    const compiledIdentity = compiledByFile.get(sourceIdentity.fileName);
    if (!compiledIdentity) {
      errors.push(`Compiled migration is missing: ${sourceIdentity.fileName}`);
      continue;
    }

    if (
      sourceIdentity.className !== compiledIdentity.className ||
      sourceIdentity.effectiveName !== compiledIdentity.effectiveName ||
      sourceIdentity.timestamp !== compiledIdentity.timestamp
    ) {
      errors.push(
        `${sourceIdentity.fileName}: source/dist runtime identity mismatch`,
      );
    }
  }

  for (const compiledIdentity of compiled) {
    if (!sourceFiles.has(compiledIdentity.fileName)) {
      errors.push(`Compiled-only migration: ${compiledIdentity.fileName}`);
    }
  }

  return errors;
}

export class MigrationChecker {
  private readonly sourceDirectory = path.resolve(
    __dirname,
    "../src/migrations",
  );

  private readonly compiledDirectory = path.resolve(
    __dirname,
    "../dist/src/migrations",
  );

  run(): string[] {
    log.section("Migration release validation");

    const source = inspectMigrationDirectory(this.sourceDirectory, ".ts");
    log.info(`Found ${source.identities.length} source migrations`);

    const errors = [
      ...source.errors,
      ...validateManifestRuntime(MIGRATION_MANIFEST, ORDERED_MIGRATIONS),
      ...validateMigrationInventory(
        source.identities,
        MIGRATION_MANIFEST,
        MIGRATION_TIMESTAMP_TIE_ALLOWLIST,
      ),
    ];

    const compiled = inspectMigrationDirectory(this.compiledDirectory, ".js");
    if (compiled.errors.length === 0) {
      log.info(`Found ${compiled.identities.length} compiled migrations`);
    }
    errors.push(
      ...compiled.errors,
      ...compareMigrationIdentities(source.identities, compiled.identities),
    );

    const compiledManifestPath = path.join(
      this.compiledDirectory,
      "migration-manifest.js",
    );
    if (fs.existsSync(compiledManifestPath)) {
      try {
        const compiledManifest = require(
          compiledManifestPath,
        ) as CompiledManifestModule;
        errors.push(
          ...validateManifestRuntime(
            compiledManifest.MIGRATION_MANIFEST,
            compiledManifest.ORDERED_MIGRATIONS,
          ),
        );

        if (
          JSON.stringify(compiledManifest.MIGRATION_MANIFEST) !==
          JSON.stringify(MIGRATION_MANIFEST)
        ) {
          errors.push("Source/dist manifest entries differ");
        }

        if (
          JSON.stringify(compiledManifest.MIGRATION_TIMESTAMP_TIE_ALLOWLIST) !==
          JSON.stringify(MIGRATION_TIMESTAMP_TIE_ALLOWLIST)
        ) {
          errors.push("Source/dist timestamp tie allowlists differ");
        }
      } catch (error) {
        errors.push(
          `Failed to load compiled migration manifest: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      errors.push(
        `Compiled migration manifest is missing: ${compiledManifestPath}`,
      );
    }

    if (errors.length > 0) {
      errors.forEach(log.error);
      log.error(`Migration validation failed with ${errors.length} error(s)`);
    } else {
      log.success(
        `${source.identities.length} migrations and 9 approved timestamp ties are deterministic`,
      );
    }

    return errors;
  }
}

function main() {
  try {
    const errors = new MigrationChecker().run();
    if (errors.length > 0) process.exitCode = 1;
  } catch (error) {
    log.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
