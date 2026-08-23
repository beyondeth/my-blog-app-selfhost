import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import { validateProductionEnvironment } from "../config/environment.config";

function required(name: string, fallbackName?: string): string {
  const value =
    process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createOciClient(
  accessKeyName: string,
  secretKeyName: string,
  fallback = false,
): S3Client {
  const region = process.env.AWS_REGION || "ap-singapore-1";
  const namespace = required("OCI_NAMESPACE");
  return new S3Client({
    region,
    endpoint: `https://${namespace}.compat.objectstorage.${region}.oraclecloud.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: required(
        accessKeyName,
        fallback ? "AWS_S3_ACCESS_KEY_ID" : undefined,
      ),
      secretAccessKey: required(
        secretKeyName,
        fallback ? "AWS_S3_SECRET_ACCESS_KEY" : undefined,
      ),
    },
  });
}

async function main(): Promise<void> {
  validateProductionEnvironment(process.env);

  const mediaBucket = required("AWS_S3_BUCKET");
  await createOciClient(
    "AWS_S3_ACCESS_KEY_ID",
    "AWS_S3_SECRET_ACCESS_KEY",
  ).send(new HeadBucketCommand({ Bucket: mediaBucket }));
  console.log(`OCI media bucket access verified: ${mediaBucket}`);

  const backupBucket = required("BACKUP_S3_BUCKET");
  await createOciClient(
    "BACKUP_S3_ACCESS_KEY_ID",
    "BACKUP_S3_SECRET_ACCESS_KEY",
    true,
  ).send(new HeadBucketCommand({ Bucket: backupBucket }));
  console.log(`OCI backup bucket access verified: ${backupBucket}`);

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpTransport = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: smtpPort,
    secure:
      process.env.SMTP_SECURE === "true" ||
      (process.env.SMTP_SECURE === undefined && smtpPort === 465),
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
    },
  });
  await smtpTransport.verify();
  smtpTransport.close();
  console.log("SMTP authentication verified");
}

main().catch((error) => {
  console.error(
    `Production integration preflight failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
