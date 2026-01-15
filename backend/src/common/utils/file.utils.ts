import { v4 as uuidv4 } from "uuid";
import * as path from "path";

/**
 * 파일 확장자 추출
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * MIME 타입에서 확장자 추출
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
  };

  return mimeToExt[mimeType] || ".bin";
}

/**
 * UUID 기반 파일명 생성
 * @param originalName 원본 파일명
 * @param mimeType MIME 타입
 * @param fileType 파일 타입 (image, document, etc.)
 * @returns UUID 기반 파일명
 */
export function generateUuidFileName(
  originalName: string,
  mimeType: string,
  fileType: string = "general",
): string {
  const uuid = uuidv4();
  const extension =
    getFileExtension(originalName) || getExtensionFromMimeType(mimeType);

  // 파일명 형식: {uuid}{extension}
  return `${uuid}${extension}`;
}

/**
 * S3 키 생성 (폴더 구조 포함) - Legacy v1
 * @deprecated Use generateS3KeyV2 for new uploads
 * @param fileName UUID 파일명
 * @param fileType 파일 타입
 * @returns S3 키
 */
export function generateS3Key(
  fileName: string,
  fileType: string = "general",
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `uploads/${fileType}/${year}/${month}/${fileName}`;
}

/**
 * S3 키 생성 V2 - 개선된 폴더 구조 (Medium 스타일)
 * @param context 업로드 컨텍스트 정보
 * @param fileName 원본 파일명
 * @param mimeType MIME 타입
 * @returns S3 키
 */
export function generateS3KeyV2(
  context: {
    type: "post" | "profile" | "blog" | "media" | "system";
    userId?: string;
    blogId?: string;
    purpose?: string; // avatar, cover, logo, banner, favicon 등
  },
  fileName: string,
  mimeType: string,
): string {
  const uuid = uuidv4().substring(0, 8);
  const timestamp = Date.now();
  const extension =
    getFileExtension(fileName) || getExtensionFromMimeType(mimeType);

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  switch (context.type) {
    case "post":
      // 포스트 이미지: content/users/{userId}/posts/{yyyy}/{MM}/{uuid}.ext
      return `content/users/${context.userId}/posts/${year}/${month}/${uuid}${extension}`;

    case "profile":
      // 프로필 이미지: content/profiles/{userId}/{purpose}_{timestamp}_{uuid}.ext
      const profileType = context.purpose || "avatar";
      return `content/profiles/${context.userId}/${profileType}_${timestamp}_${uuid}${extension}`;

    case "blog":
      // 블로그 브랜딩: content/blogs/{blogId}/{purpose}_{timestamp}_{uuid}.ext
      const assetType = context.purpose || "logo";
      return `content/blogs/${context.blogId}/${assetType}_${timestamp}_${uuid}${extension}`;

    case "system":
      // 시스템 자산: system/{purpose}/{uuid}.ext
      const systemType = context.purpose || "assets";
      return `system/${systemType}/${uuid}${extension}`;

    default:
      // 기타 미디어: content/users/{userId}/media/{yyyy}/{MM}/{uuid}.ext
      return `content/users/${context.userId}/media/${year}/${month}/${uuid}${extension}`;
  }
}

/**
 * 기존 S3 키를 새 구조로 변환 (마이그레이션용)
 * @param oldKey 기존 S3 키
 * @param context 새 컨텍스트 정보
 * @returns 새 S3 키
 */
export function migrateS3Key(
  oldKey: string,
  context: {
    type: "post" | "profile" | "blog" | "media";
    userId?: string;
    blogId?: string;
    purpose?: string;
  },
): string {
  const fileName = extractFileNameFromS3Key(oldKey);
  const extension = getFileExtension(fileName);
  const mimeType = getMimeTypeFromExtension(extension);

  return generateS3KeyV2(context, fileName, mimeType);
}

/**
 * 확장자로부터 MIME 타입 추정
 */
function getMimeTypeFromExtension(extension: string): string {
  const extToMime: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return extToMime[extension.toLowerCase()] || "application/octet-stream";
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 이미지 MIME 타입 검증
 */
export function isImageMimeType(mimeType: string): boolean {
  const imageMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  return imageMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * 파일 MIME 타입 검증
 */
export function validateMimeType(
  mimeType: string,
  allowedTypes: string[],
): boolean {
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * 안전한 파일명 생성 (특수문자 제거)
 */
export function sanitizeFileName(fileName: string): string {
  // 확장자 분리
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);

  // 특수문자 제거 및 공백을 하이픈으로 변경
  const sanitized = name
    .replace(/[^a-zA-Z0-9가-힣\s-_]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `${sanitized}${ext}`;
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(
  size: number,
  maxSize: number = 10 * 1024 * 1024,
): boolean {
  return size <= maxSize;
}

/**
 * 이미지 파일 검증 (크기 + MIME 타입)
 */
export function validateImageFile(
  file: { size: number; type: string },
  maxSize: number = 10 * 1024 * 1024,
): { valid: boolean; error?: string } {
  // MIME 타입 검증
  if (!isImageMimeType(file.type)) {
    return {
      valid: false,
      error: `지원하지 않는 이미지 형식입니다. (${file.type})`,
    };
  }

  // 파일 크기 검증
  if (!validateFileSize(file.size, maxSize)) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`,
    };
  }

  return { valid: true };
}

/**
 * S3 키에서 파일명 추출
 */
export function extractFileNameFromS3Key(s3Key: string): string {
  return s3Key.split("/").pop() || s3Key;
}

/**
 * S3 키에서 파일 타입 추출
 */
export function extractFileTypeFromS3Key(s3Key: string): string {
  const parts = s3Key.split("/");
  if (parts.length >= 2 && parts[0] === "uploads") {
    return parts[1];
  }
  return "general";
}
