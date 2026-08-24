export function normalizeCdnBaseUrl(
  configuredValue: string | null | undefined,
): string {
  const value = configuredValue?.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return "";
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${pathname === "/" ? "" : pathname}`;
  } catch {
    return "";
  }
}
