import test from 'node:test';
import assert from 'node:assert/strict';

const anthropicRequest = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 512,
  system: 'You are a coaching assistant.',
  messages: [
    { role: 'user', content: 'Help me process what happened today.' },
  ],
};

test('createMessagesApi uses Anthropic successfully when the primary provider works', async () => {
  const mod = await import('./anthropic.js');

  assert.equal(typeof mod.createMessagesApi, 'function');

  const anthropicResponse = {
    content: [{ text: '{"reply":"Anthropic reply"}' }],
    usage: { input_tokens: 12, output_tokens: 18 },
  };

  let openAiCalled = false;
  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => anthropicResponse,
      },
    },
    openAiClient: {
      chat: {
        completions: {
          create: async () => {
            openAiCalled = true;
            throw new Error('OpenAI should not be called when Anthropic succeeds');
          },
        },
      },
    },
    fallbackModel: 'gpt-4.1-mini',
  });

  const result = await api.create(anthropicRequest);

  assert.deepEqual(result, anthropicResponse);
  assert.equal(openAiCalled, false);
});

test('createMessagesApi falls back to OpenAI when Anthropic is rate limited or out of credits', async () => {
  const mod = await import('./anthropic.js');

  assert.equal(typeof mod.createMessagesApi, 'function');

  let openAiPayload = null;
  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          const error = new Error('credit balance is too low');
          error.status = 429;
          throw error;
        },
      },
    },
    openAiClient: {
      chat: {
        completions: {
          create: async (payload) => {
            openAiPayload = payload;
            return {
              choices: [
                {
                  message: {
                    content: '{"reply":"OpenAI fallback reply"}',
                  },
                },
              ],
              usage: {
                prompt_tokens: 21,
                completion_tokens: 34,
              },
            };
          },
        },
      },
    },
    fallbackModel: 'gpt-4.1-mini',
  });

  const result = await api.create(anthropicRequest);

  assert.deepEqual(openAiPayload, {
    model: 'gpt-4.1-mini',
    max_tokens: 512,
    messages: [
      { role: 'system', content: 'You are a coaching assistant.' },
      { role: 'user', content: 'Help me process what happened today.' },
    ],
    response_format: { type: 'json_object' },
  });
  assert.deepEqual(result, {
    content: [{ text: '{"reply":"OpenAI fallback reply"}' }],
    usage: { input_tokens: 21, output_tokens: 34 },
    provider: 'openai',
  });
});

test('createMessagesApi falls back to Gemini when both Anthropic and OpenAI fail', async () => {
  const mod = await import('./anthropic.js');

  let geminiPayload = null;
  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          const error = new Error('rate limit exceeded');
          error.status = 429;
          throw error;
        },
      },
    },
    openAiClient: {
      chat: {
        completions: {
          create: async () => {
            throw new Error('OpenAI is also unavailable');
          },
        },
      },
    },
    geminiClient: {
      generateContent: async (payload) => {
        geminiPayload = payload;
        return {
          candidates: [
            { content: { parts: [{ text: '{"reply":"Gemini fallback reply"}' }] } },
          ],
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22 },
        };
      },
    },
    fallbackModel: 'gpt-4.1-mini',
  });

  const result = await api.create(anthropicRequest);

  assert.deepEqual(geminiPayload, {
    contents: [
      { role: 'user', parts: [{ text: 'Help me process what happened today.' }] },
    ],
    generationConfig: {
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
    systemInstruction: { parts: [{ text: 'You are a coaching assistant.' }] },
  });
  assert.deepEqual(result, {
    content: [{ text: '{"reply":"Gemini fallback reply"}' }],
    usage: { input_tokens: 11, output_tokens: 22 },
    provider: 'gemini',
  });
});

test('createMessagesApi falls back directly to Gemini when no OpenAI client is configured', async () => {
  const mod = await import('./anthropic.js');

  let geminiCalled = false;
  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          const error = new Error('credit balance is too low');
          error.status = 429;
          throw error;
        },
      },
    },
    openAiClient: null,
    geminiClient: {
      generateContent: async () => {
        geminiCalled = true;
        return {
          candidates: [{ content: { parts: [{ text: '{"reply":"gemini only"}' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 },
        };
      },
    },
    fallbackModel: 'gpt-4.1-mini',
  });

  const result = await api.create(anthropicRequest);

  assert.equal(geminiCalled, true);
  assert.equal(result.provider, 'gemini');
});

test('createMessagesApi falls back to Llama when Anthropic, OpenAI, and Gemini all fail', async () => {
  const mod = await import('./anthropic.js');

  let llamaPayload = null;
  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          const error = new Error('rate limit exceeded');
          error.status = 429;
          throw error;
        },
      },
    },
    openAiClient: {
      chat: {
        completions: {
          create: async () => {
            throw new Error('OpenAI also down');
          },
        },
      },
    },
    geminiClient: {
      generateContent: async () => {
        throw new Error('Gemini also down');
      },
    },
    llamaClient: {
      chat: {
        completions: {
          create: async (payload) => {
            llamaPayload = payload;
            return {
              choices: [{ message: { content: '{"reply":"Llama fallback reply"}' } }],
              usage: { prompt_tokens: 42, completion_tokens: 84 },
            };
          },
        },
      },
    },
    fallbackModel: 'gpt-4.1-mini',
    llamaModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  });

  const result = await api.create(anthropicRequest);

  assert.deepEqual(llamaPayload, {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    max_tokens: 512,
    messages: [
      { role: 'system', content: 'You are a coaching assistant.' },
      { role: 'user', content: 'Help me process what happened today.' },
    ],
    response_format: { type: 'json_object' },
  });
  assert.deepEqual(result, {
    content: [{ text: '{"reply":"Llama fallback reply"}' }],
    usage: { input_tokens: 42, output_tokens: 84 },
    provider: 'llama',
  });
});

test('createMessagesApi falls back directly to Llama when only Llama is configured', async () => {
  const mod = await import('./anthropic.js');

  let llamaCalled = false;
  const api = mod.createMessagesApi({
    anthropicClient: null,
    openAiClient: null,
    geminiClient: null,
    llamaClient: {
      chat: {
        completions: {
          create: async () => {
            llamaCalled = true;
            return {
              choices: [{ message: { content: '{"reply":"llama only"}' } }],
              usage: { prompt_tokens: 3, completion_tokens: 5 },
            };
          },
        },
      },
    },
    fallbackModel: 'gpt-4.1-mini',
    llamaModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  });

  const result = await api.create(anthropicRequest);

  assert.equal(llamaCalled, true);
  assert.equal(result.provider, 'llama');
});

test('createMessagesApi rethrows non-fallback Anthropic errors', async () => {
  const mod = await import('./anthropic.js');

  assert.equal(typeof mod.createMessagesApi, 'function');

  const expectedError = new Error('socket hang up');
  expectedError.status = 500;

  const api = mod.createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          throw expectedError;
        },
      },
    },
    openAiClient: {
      chat: {
        completions: {
          create: async () => {
            throw new Error('OpenAI should not be called for non-fallback errors');
          },
        },
      },
    },
    fallbackModel: 'gpt-4.1-mini',
  });

  await assert.rejects(() => api.create(anthropicRequest), (error) => error === expectedError);
});
