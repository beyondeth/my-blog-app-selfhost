import * as path from "path";
import {
  compareMigrationIdentities,
  inspectMigrationDirectory,
  MigrationIdentity,
  validateIdentityFields,
  validateManifestRuntime,
  validateMigrationInventory,
} from "../../scripts/check-migrations";
import {
  MIGRATION_MANIFEST,
  MIGRATION_TIMESTAMP_TIE_ALLOWLIST,
  ORDERED_MIGRATIONS,
} from "./migration-manifest";

function identity(
  fileName: string,
  className: string,
  timestamp: number,
): MigrationIdentity {
  return {
    fileName,
    className,
    effectiveName: className,
    timestamp,
  };
}

describe("migration release manifest", () => {
  it("covers every source migration and only the approved timestamp ties", () => {
    const source = inspectMigrationDirectory(path.resolve(__dirname), ".ts");

    expect(source.errors).toEqual([]);
    expect(source.identities).toHaveLength(160);
    expect(
      validateManifestRuntime(MIGRATION_MANIFEST, ORDERED_MIGRATIONS),
    ).toEqual([]);
    expect(
      validateMigrationInventory(
        source.identities,
        MIGRATION_MANIFEST,
        MIGRATION_TIMESTAMP_TIE_ALLOWLIST,
      ),
    ).toEqual([]);
  });

  it("rejects a new timestamp tie that is not allowlisted", () => {
    const migrations = [
      identity("1806000000000-First", "First1806000000000", 1806000000000),
      identity("1806000000000-Second", "Second1806000000000", 1806000000000),
    ];
    const manifest = migrations.map(({ fileName, className }) => ({
      fileName,
      className,
    }));

    expect(validateMigrationInventory(migrations, manifest, {})).toContain(
      "Timestamp 1806000000000 is duplicated but not allowlisted: First1806000000000, Second1806000000000",
    );
  });

  it("rejects an approved tie in a different order", () => {
    const migrations = [
      identity("1806000000000-First", "First1806000000000", 1806000000000),
      identity("1806000000000-Second", "Second1806000000000", 1806000000000),
    ];
    const manifest = migrations.map(({ fileName, className }) => ({
      fileName,
      className,
    }));

    expect(
      validateMigrationInventory(migrations, manifest, {
        "1806000000000": ["Second1806000000000", "First1806000000000"],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("order differs from allowlist"),
        expect.stringContaining("does not exactly match manifest"),
      ]),
    );
  });

  it("rejects missing and duplicate manifest entries", () => {
    const migration = identity(
      "1806000000000-Only",
      "Only1806000000000",
      1806000000000,
    );
    const duplicatedEntry = {
      fileName: migration.fileName,
      className: migration.className,
    };

    expect(
      validateMigrationInventory(
        [migration],
        [duplicatedEntry, duplicatedEntry],
        {},
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Manifest contains duplicate file"),
        expect.stringContaining("Manifest contains duplicate class"),
        expect.stringContaining("duplicated but not allowlisted"),
      ]),
    );

    expect(validateMigrationInventory([migration], [], {})).toContain(
      "Source migration is missing from manifest: 1806000000000-Only",
    );
  });

  it("rejects filename, class, and declared-name timestamp mismatches", () => {
    expect(
      validateIdentityFields(
        "1806000000000-Example",
        "Example1806000000001",
        "Renamed1806000000002",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("filename timestamp"),
        expect.stringContaining("class timestamp does not match"),
        expect.stringContaining("declared name"),
      ]),
    );
  });

  it("rejects source/dist identity differences", () => {
    const source = [
      identity("1806000000000-Example", "Example1806000000000", 1806000000000),
    ];
    const compiled = [
      identity("1806000000000-Example", "Changed1806000000000", 1806000000000),
      identity(
        "1806100000000-OnlyInDist",
        "OnlyInDist1806100000000",
        1806100000000,
      ),
    ];

    expect(compareMigrationIdentities(source, compiled)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("source/dist runtime identity mismatch"),
        expect.stringContaining("Compiled-only migration"),
      ]),
    );
  });
});
