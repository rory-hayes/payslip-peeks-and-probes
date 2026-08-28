import { describe, expect, it } from 'vitest';
import { getMissingAppConnectionState } from './app-connection-state';

describe('missing mobile app connection state', () => {
  it('keeps the development build diagnostic and allows the local sample', () => {
    const state = getMissingAppConnectionState(true);

    expect(state.showSample).toBe(true);
    expect(state.body).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(state.body).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });

  it('fails safely and non-technically in a customer release', () => {
    const state = getMissingAppConnectionState(false);

    expect(state.showSample).toBe(false);
    expect(state.title).toBe('This version isn’t ready to open your account.');
    expect(state.body).toContain('support@payslipinsights.com');
    expect(`${state.title} ${state.body}`).not.toMatch(/supabase|environment variable|publishable key/i);
  });
});
