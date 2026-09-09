/** Paid play fails closed until market, identity and provider reviews are complete.
 * Demo balances are deliberately excluded from this contract. */
export type PaymentEligibility = {
  country: string | null;
  ageVerified: boolean;
  identityVerified: boolean;
  selfExcluded: boolean;
  providerApproved: boolean;
  allowedCountries: readonly string[];
};
export function paymentEligibility(v: PaymentEligibility) {
  if (v.selfExcluded)
    return { allowed: false, reason: 'Account excluded from paid play' };
  if (!v.country || !v.allowedCountries.includes(v.country))
    return {
      allowed: false,
      reason: 'Paid matches are not available in this location',
    };
  if (!v.ageVerified || !v.identityVerified)
    return { allowed: false, reason: 'Identity and age verification required' };
  if (!v.providerApproved)
    return { allowed: false, reason: 'Payment provider approval required' };
  return { allowed: true, reason: 'Eligible' };
}
export type LedgerEntry = { account: string; cents: number; currency: 'EUR' };
export function validateJournal(entries: LedgerEntry[]) {
  if (
    entries.length < 2 ||
    entries.length > 20 ||
    entries.some(
      (e) =>
        !e.account || e.currency !== 'EUR' || !Number.isSafeInteger(e.cents),
    ) ||
    entries.reduce((s, e) => s + e.cents, 0) !== 0
  )
    throw new Error(
      'Every money movement must have equal debits and credits in integer cents.',
    );
  return entries;
}
