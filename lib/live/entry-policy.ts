import { InputError } from '../account-rules.ts';
import type { LiveMode } from './security.ts';

// Enable only with server-side fund reservation and verified payout settlement.
// A working game server alone does not make a match a paid match.
export const paidPlay = {
  enabled: false,
  reason: 'Cash matches are unavailable until deposits and payouts are connected. Practice is free.',
} as const;

export function assertEntryEnabled(mode: LiveMode) {
  if (mode !== 'practice' && !paidPlay.enabled)
    throw new InputError(paidPlay.reason, 503);
}
