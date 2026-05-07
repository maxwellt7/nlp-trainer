import test from 'node:test';
import assert from 'node:assert/strict';

test('buildRuntimeHealthPayload reports commit, auth state, and OpenAI fallback readiness', async () => {
  const mod = await import('./runtime-health.js');

  assert.equal(typeof mod.buildRuntimeHealthPayload, 'function');

  const payload = mod.buildRuntimeHealthPayload({
    clerkEnabled: true,
    env: {
      RAILWAY_GIT_COMMIT_SHA: '0df6bba16f8a6716afcf2a263e1f33e5af284636',
      OPENAI_API_KEY: 'sk-test-123',
      OPENAI_FALLBACK_MODEL: 'gpt-4.1-mini',
    },
  });

  assert.deepEqual(payload, {
    status: 'ok',
    auth: true,
    runtime: {
      commit: '0df6bba16f8a6716afcf2a263e1f33e5af284636',
      openAiConfigured: true,
      openAiFallbackModel: 'gpt-4.1-mini',
    },
  });
});

test('buildRuntimeHealthPayload omits false confidence when commit or OpenAI key are missing', async () => {
  const mod = await import('./runtime-health.js');

  const payload = mod.buildRuntimeHealthPayload({
    clerkEnabled: false,
    env: {},
  });

  assert.deepEqual(payload, {
    status: 'ok',
    auth: false,
    runtime: {
      commit: null,
      openAiConfigured: false,
      openAiFallbackModel: 'gpt-4.1-mini',
    },
  });
});
