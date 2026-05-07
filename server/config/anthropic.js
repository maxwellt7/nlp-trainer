import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true });

function hasUsableKey(value) {
  return Boolean(value && !value.includes('placeholder'));
}

function normalizeContentToString(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object') {
          if (typeof item.text === 'string') {
            return item.text;
          }

          if (item.type === 'text' && typeof item.text === 'string') {
            return item.text;
          }
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return String(content ?? '');
}

function normalizeOpenAiResponse(response) {
  const rawContent = response?.choices?.[0]?.message?.content;
  const text = normalizeContentToString(rawContent);

  return {
    content: [{ text }],
    usage: {
      input_tokens: response?.usage?.prompt_tokens ?? 0,
      output_tokens: response?.usage?.completion_tokens ?? 0,
    },
    provider: 'openai',
  };
}

function shouldFallbackToOpenAI(error) {
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const message = String(
    error?.message ??
    error?.error?.message ??
    error?.cause?.message ??
    ''
  ).toLowerCase();

  if (status === 429) {
    return true;
  }

  return [
    'credit balance',
    'insufficient credit',
    'rate limit',
    'quota',
    'overloaded',
    'capacity',
    'api key',
  ].some((term) => message.includes(term));
}

function toOpenAiPayload(request, fallbackModel) {
  const messages = [];

  if (request.system) {
    messages.push({ role: 'system', content: normalizeContentToString(request.system) });
  }

  for (const message of request.messages ?? []) {
    if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') {
      continue;
    }

    messages.push({
      role: message.role,
      content: normalizeContentToString(message.content),
    });
  }

  return {
    model: fallbackModel,
    max_tokens: request.max_tokens,
    messages,
    // All current callers ask Claude for JSON in their system prompts.
    // Force OpenAI to honor that contract — without this, gpt-4.1-mini
    // returns prose, JSON parse fails, and downstream flags like
    // readyToGenerate silently default to false.
    response_format: { type: 'json_object' },
  };
}

export function createMessagesApi({ anthropicClient, openAiClient, fallbackModel }) {
  const resolvedFallbackModel = fallbackModel || process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  return {
    async create(request) {
      if (!anthropicClient) {
        if (!openAiClient) {
          throw new Error('No LLM provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
        }

        const openAiResponse = await openAiClient.chat.completions.create(toOpenAiPayload(request, resolvedFallbackModel));
        return normalizeOpenAiResponse(openAiResponse);
      }

      try {
        return await anthropicClient.messages.create(request);
      } catch (error) {
        if (!openAiClient || !shouldFallbackToOpenAI(error)) {
          throw error;
        }

        console.warn('[LLM] Anthropic unavailable, falling back to OpenAI:', error.message);
        const openAiResponse = await openAiClient.chat.completions.create(toOpenAiPayload(request, resolvedFallbackModel));
        return normalizeOpenAiResponse(openAiResponse);
      }
    },
  };
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;

if (!hasUsableKey(anthropicKey)) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set or is a placeholder. Anthropic-backed chat will fall back to OpenAI when configured.');
}

if (!hasUsableKey(openAiKey)) {
  console.warn('WARNING: OPENAI_API_KEY is not set or is a placeholder. OpenAI fallback is unavailable until a valid key is provided.');
}

const anthropicClient = hasUsableKey(anthropicKey)
  ? new Anthropic({ apiKey: anthropicKey })
  : null;

const openAiClient = hasUsableKey(openAiKey)
  ? new OpenAI({
      apiKey: openAiKey,
      baseURL: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || undefined,
    })
  : null;

const anthropic = {
  messages: createMessagesApi({
    anthropicClient,
    openAiClient,
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  }),
};

export { normalizeOpenAiResponse, shouldFallbackToOpenAI };
export default anthropic;
