import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFunctionResponse, verifySupabaseDeployment } from './verify-supabase-deployment.mjs';

test('classifies the Supabase missing-function response separately from a deployed function error', () => {
  assert.equal(classifyFunctionResponse(404, '{"code":"NOT_FOUND","message":"Requested function was not found"}'), 'missing');
  assert.equal(classifyFunctionResponse(401, '{"error":"Unauthorized"}'), 'present');
  assert.equal(classifyFunctionResponse(405, 'Method Not Allowed'), 'present');
  assert.equal(classifyFunctionResponse(500, 'provider error'), 'present');
});

test('verifies all required function routes without sending a mutating request', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    const functionName = url.split('/').pop();
    if (functionName === 'missing') {
      return new Response('{"code":"NOT_FOUND","message":"Requested function was not found"}', { status: 404 });
    }
    return new Response('', { status: 200 });
  };

  const verification = await verifySupabaseDeployment({
    baseUrl: 'https://example.supabase.co/',
    publishableKey: 'browser-key',
    functionNames: ['present', 'missing'],
    fetchImpl: fakeFetch,
  });

  assert.deepEqual(verification.missing, ['missing']);
  assert.deepEqual(verification.unreachable, []);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ options }) => options.method === 'OPTIONS'));
  assert.ok(calls.every(({ options }) => !('body' in options)));
});
