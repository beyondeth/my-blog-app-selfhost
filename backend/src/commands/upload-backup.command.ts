import { createReadStream, realpathSync, statSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string, fallbackName?: string): string {
  const value =
    process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const [inputPath, objectKey] = process.argv.slice(2);
  if (!inputPath || !objectKey) {
    throw new Error("Usage: upload-backup <file> <object-key>");
  }

  const resolvedPath = realpathSync(inputPath);
  if (!resolvedPath.startsWith("/backup/")) {
    throw new Error("Backup input must be mounted below /backup");
  }
  if (!/^postgres\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+$/.test(objectKey)) {
    throw new Error("Invalid backup object key");
  }

  const bucket = required("BACKUP_S3_BUCKET");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("Invalid backup bucket name");
  }

  const region = process.env.AWS_REGION || "ap-singapore-1";
  const namespace = required("OCI_NAMESPACE");
  const endpoint =
    process.env.BACKUP_S3_ENDPOINT ||
    `https://${namespace}.compat.objectstorage.${region}.oraclecloud.com`;
  const file = statSync(resolvedPath);
  if (!file.isFile() || file.size === 0) {
    throw new Error("Backup file is empty or invalid");
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: required(
        "BACKUP_S3_ACCESS_KEY_ID",
        "AWS_S3_ACCESS_KEY_ID",
      ),
      secretAccessKey: required(
        "BACKUP_S3_SECRET_ACCESS_KEY",
        "AWS_S3_SECRET_ACCESS_KEY",
      ),
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(resolvedPath),
      ContentLength: file.size,
      ContentType: objectKey.endsWith(".sha256")
        ? "text/plain; charset=utf-8"
        : "application/octet-stream",
      ServerSideEncryption: "AES256",
    }),
  );

  console.log(`Uploaded backup object: s3://${bucket}/${objectKey}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
