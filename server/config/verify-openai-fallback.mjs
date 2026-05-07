import OpenAI from 'openai';
import { createMessagesApi } from './anthropic.js';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing from the runtime environment.');
  }

  const openAiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || undefined,
  });

  const api = createMessagesApi({
    anthropicClient: {
      messages: {
        create: async () => {
          const error = new Error('credit balance is too low');
          error.status = 429;
          throw error;
        },
      },
    },
    openAiClient,
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  });

  const result = await api.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 60,
    system: 'Return compact JSON with a single key named reply.',
    messages: [
      { role: 'user', content: 'Say hello from the OpenAI fallback path in JSON.' },
    ],
  });

  const text = result?.content?.[0]?.text || '';
  console.log(JSON.stringify({
    provider: result?.provider || 'anthropic',
    hasText: Boolean(text),
    preview: text.slice(0, 120),
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
