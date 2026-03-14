/**
 * Centralized utility for location and pricing detection
 */

export const isTunisiaLikely = () => {
  if (typeof window === 'undefined') return false;
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userLanguage = navigator.language;
  
  return (
    userTimezone === 'Africa/Tunis' || 
    userLanguage.includes('ar-TN') || 
    userLanguage.includes('fr-TN')
  );
};

export const shouldForceGlobal = () => {
  // @ts-ignore - import.meta.env is available in Vite
  return typeof import.meta !== 'undefined' && import.meta.env.VITE_ENABLE_LOCAL_PRICING === 'false';
};

export interface PricingLocation {
  country: string;
  currency: string;
  isLocalPricing: boolean;
}

/**
 * Resolves the appropriate pricing location based on environment, detection, and user plan
 */
export const resolvePricingLocation = (
  apiData: { country: string } | null,
  user: any | null
): PricingLocation => {
  const forceGlobal = shouldForceGlobal();
  const tunisiaLikely = isTunisiaLikely();
  
  // 1. Handle existing Pro users - stick to their payment provider's currency
  if (user?.plan === 'pro' && user?.paymentProvider) {
    if (user.paymentProvider === 'polar') {
      return { country: apiData?.country || 'US', currency: 'USD', isLocalPricing: false };
    } else if (user.paymentProvider === 'flouci') {
      return { country: 'TN', currency: 'DT', isLocalPricing: true };
    }
  }

  // 2. Respect Force Global flag
  if (forceGlobal) {
    return { country: apiData?.country || 'US', currency: 'USD', isLocalPricing: false };
  }

  // 3. Fallback to detection if API fails or returns US but browser says TN
  const detectedCountry = apiData?.country || (tunisiaLikely ? 'TN' : 'US');
  
  if (detectedCountry === 'TN' || (detectedCountry === 'US' && tunisiaLikely)) {
    return { country: 'TN', currency: 'DT', isLocalPricing: true };
  }

  return {
    country: detectedCountry,
    currency: 'USD',
    isLocalPricing: false
  };
};
