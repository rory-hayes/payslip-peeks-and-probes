import { describe, expect, it } from 'vitest';
import { PUBLIC_SUPABASE_CONFIG, resolvePublicSupabaseConfig } from './public-config';

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  return JSON.parse(atob(base64)) as Record<string, unknown>;
}

describe('public Supabase browser configuration', () => {
  it('keeps the committed fallback scoped to the intended low-privilege project', () => {
    const payload = decodeJwtPayload(PUBLIC_SUPABASE_CONFIG.publishableKey);

    expect(PUBLIC_SUPABASE_CONFIG.url).toBe(`https://${PUBLIC_SUPABASE_CONFIG.projectId}.supabase.co`);
    expect(payload.ref).toBe(PUBLIC_SUPABASE_CONFIG.projectId);
    expect(payload.role).toBe('anon');
    expect(PUBLIC_SUPABASE_CONFIG.publishableKey).not.toMatch(/service[_-]?role|secret/i);
  });

  it('lets an owned host override both public values together', () => {
    expect(resolvePublicSupabaseConfig({
      VITE_SUPABASE_URL: ' https://example.supabase.co ',
      VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_example ',
    })).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('uses the reviewed public fallback when Lovable omits build variables', () => {
    expect(resolvePublicSupabaseConfig({})).toEqual({
      url: PUBLIC_SUPABASE_CONFIG.url,
      publishableKey: PUBLIC_SUPABASE_CONFIG.publishableKey,
    });
  });

  it('fails closed for partial, invalid, or elevated host overrides', () => {
    expect(() => resolvePublicSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    })).toThrow(/must be provided together/i);

    expect(() => resolvePublicSupabaseConfig({
      VITE_SUPABASE_URL: 'http://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    })).toThrow(/low-privilege/i);

    expect(() => resolvePublicSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-in-a-browser',
    })).toThrow(/low-privilege/i);
  });
});
