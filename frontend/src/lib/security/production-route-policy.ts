const HIDDEN_PAYMENT_PREFIXES = [
  '/pricing',
  '/account/subscription',
  '/mock-checkout',
] as const;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldHideProductionRoute(
  pathname: string,
  adminDebugEnabled = process.env.ADMIN_DEBUG_ENABLED === 'true',
): boolean {
  if (
    HIDDEN_PAYMENT_PREFIXES.some((prefix) =>
      matchesPathPrefix(pathname, prefix),
    )
  ) {
    return true;
  }

  return matchesPathPrefix(pathname, '/admin/debug') && !adminDebugEnabled;
}
