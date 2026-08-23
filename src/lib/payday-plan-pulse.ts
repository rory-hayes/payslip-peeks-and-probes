export type PaydayPlanPulseKind = 'first-check-in' | 'check-in-due' | 'current-check-in';

export interface PaydayPlanPulseState {
  cadenceDays: number;
  kind: PaydayPlanPulseKind;
  lastCheckedInAt: string | null;
}

interface PaydayPlanPulseInput {
  daysUntilNextPayday: number | null;
  everydayCheckedInAt: string | null;
  everydayRemaining: number | null;
  everydaySpending: number;
  now?: Date;
  payFrequency?: string | null;
}

const DAY_IN_MILLISECONDS = 86_400_000;

function calendarDayNumber(value: Date): number | null {
  if (!Number.isFinite(value.getTime())) return null;
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_IN_MILLISECONDS;
}

export function paydayPlanPulseCadenceDays(payFrequency?: string | null): number {
  // Someone paid weekly has a shorter planning window, so a mid-cycle check-in
  // should arrive sooner. This remains an in-product prompt, not a notification.
  return payFrequency === 'weekly' ? 3 : 7;
}

/**
 * Decides whether an active plan benefits from a manual check-in. It never
 * interprets a person’s account balance or starts any provider work.
 */
export function getPaydayPlanPulseState({
  daysUntilNextPayday,
  everydayCheckedInAt,
  everydayRemaining,
  everydaySpending,
  now = new Date(),
  payFrequency,
}: PaydayPlanPulseInput): PaydayPlanPulseState | null {
  if (!Number.isFinite(everydaySpending) || everydaySpending <= 0) return null;
  if (daysUntilNextPayday === null || daysUntilNextPayday < 1) return null;

  const cadenceDays = paydayPlanPulseCadenceDays(payFrequency);
  const checkedInDay = everydayCheckedInAt ? calendarDayNumber(new Date(everydayCheckedInAt)) : null;
  const hasValidSavedCheckIn = Number.isFinite(everydayRemaining)
    && everydayRemaining !== null
    && everydayRemaining >= 0
    && everydayRemaining <= everydaySpending
    && checkedInDay !== null;

  // A partial or legacy check-in should not look like a balance. Ask the
  // person for a fresh manual value instead.
  if (!hasValidSavedCheckIn) {
    return { cadenceDays, kind: 'first-check-in', lastCheckedInAt: null };
  }

  const today = calendarDayNumber(now);
  if (today === null || today - checkedInDay >= cadenceDays) {
    return { cadenceDays, kind: 'check-in-due', lastCheckedInAt: everydayCheckedInAt };
  }

  return { cadenceDays, kind: 'current-check-in', lastCheckedInAt: everydayCheckedInAt };
}
