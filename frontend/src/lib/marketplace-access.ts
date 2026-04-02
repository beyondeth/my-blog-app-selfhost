export const MARKETPLACE_PURCHASE_PENDING_NOTICE = '구매 기능은 준비 중입니다.';

export function canAccessMarketplaceSellerTools(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}

export function canAccessMarketplacePurchase(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}
