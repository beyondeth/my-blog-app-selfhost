export function normalizeProxyFileKey(
  fileKey: string | string[] | undefined,
): string {
  if (Array.isArray(fileKey)) {
    return fileKey.join("/");
  }

  return typeof fileKey === "string" ? fileKey : "";
}
