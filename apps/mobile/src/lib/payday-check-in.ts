export type PaydayCheckInValidation =
  | { ok: true; everydayRemaining: number }
  | { ok: false; error: string };

/**
 * Client-side guard for a deliberately manual planning check-in. The database
 * repeats these checks against the owner's active plan before saving.
 */
export function validatePaydayCheckIn(input: {
  planId: string | null | undefined;
  plannedEveryday: number;
  everydayRemaining: number | null;
}): PaydayCheckInValidation {
  if (!input.planId) return { ok: false, error: 'Choose an active payday plan before checking in.' };
  if (!Number.isFinite(input.plannedEveryday) || input.plannedEveryday <= 0) {
    return { ok: false, error: 'Add an everyday-spending amount to this plan before checking in.' };
  }
  if (input.everydayRemaining === null || !Number.isFinite(input.everydayRemaining) || input.everydayRemaining < 0) {
    return { ok: false, error: 'Enter the everyday money left as a valid amount.' };
  }
  if (input.everydayRemaining > input.plannedEveryday) {
    return {
      ok: false,
      error: 'Everyday money left cannot be more than the amount planned.',
    };
  }
  return { ok: true, everydayRemaining: input.everydayRemaining };
}
