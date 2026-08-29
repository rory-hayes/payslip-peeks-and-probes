import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchProductionAuthSettings,
  productionAuthSettingIssues,
} from './lib/supabase-auth-readiness.mjs';

test('accepts a production email flow that requires verification', () => {
  assert.deepEqual(productionAuthSettingIssues({
    disable_signup: false,
    external: { email: true },
    mailer_autoconfirm: false,
  }), []);
});

test('blocks disabled sign-up, disabled email auth, and automatic confirmation', () => {
  assert.deepEqual(productionAuthSettingIssues({
    disable_signup: true,
    external: { email: false },
    mailer_autoconfirm: true,
  }), [
    'Production email sign-up is disabled in Supabase Auth.',
    'Production email authentication is disabled in Supabase Auth.',
    'Disable Supabase email auto-confirm so a new account must prove control of its email address.',
  ]);
});

test('reads public Auth settings without sending a user credential', async () => {
  let request;
  const result = await fetchProductionAuthSettings({
    baseUrl: 'https://project.supabase.co/',
    publishableKey: 'public-browser-key',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({
        disable_signup: false,
        external: { email: true },
        mailer_autoconfirm: false,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  assert.equal(request.url, 'https://project.supabase.co/auth/v1/settings');
  assert.deepEqual(request.init.headers, { apikey: 'public-browser-key' });
  assert.equal(request.init.method, undefined);
  assert.equal(result.error, null);
  assert.equal(result.settings.mailer_autoconfirm, false);
});

test('reports an unavailable Auth settings endpoint without throwing', async () => {
  const result = await fetchProductionAuthSettings({
    baseUrl: 'https://project.supabase.co',
    publishableKey: 'public-browser-key',
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  });

  assert.equal(result.settings, null);
  assert.equal(result.error, 'Supabase Auth settings returned HTTP 503.');
});
