export type MissingAppConnectionState = {
  body: string;
  showSample: boolean;
  title: string;
};

/**
 * Keep local builds diagnostic without exposing infrastructure language in a
 * customer-facing release that was accidentally built without public config.
 */
export function getMissingAppConnectionState(
  isDevelopment: boolean,
): MissingAppConnectionState {
  if (isDevelopment) {
    return {
      title: 'This development build needs its app connection.',
      body: 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the mobile environment, then rebuild the app.',
      showSample: true,
    };
  }

  return {
    title: 'This version isn’t ready to open your account.',
    body: 'Please update Payslip Insights from the App Store. If no update is available, contact support@payslipinsights.com.',
    showSample: false,
  };
}
