export const getTierInfo = (lifetimePoints) => {
  if (lifetimePoints >= 15000) return { tier: 'VIP', nextTier: 'MAX', nextTierReq: 15000 };
  if (lifetimePoints >= 10000) return { tier: 'GOLD', nextTier: 'VIP', nextTierReq: 15000 };
  if (lifetimePoints >= 5000) return { tier: 'SILVER', nextTier: 'GOLD', nextTierReq: 10000 };
  return { tier: 'BRONZE', nextTier: 'SILVER', nextTierReq: 5000 };
};
