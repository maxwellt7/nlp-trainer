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

function normalizeLlamaResponse(response) {
  const rawContent = response?.choices?.[0]?.message?.content;
  const text = normalizeContentToString(rawContent);

  return {
    content: [{ text }],
    usage: {
      input_tokens: response?.usage?.prompt_tokens ?? 0,
      output_tokens: response?.usage?.completion_tokens ?? 0,
    },
    provider: 'llama',
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

function toGeminiPayload(request) {
  const contents = [];

  for (const message of request.messages ?? []) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: normalizeContentToString(message.content) }],
    });
  }

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens,
      // Same JSON contract as the OpenAI fallback above.
      responseMimeType: 'application/json',
    },
  };

  if (request.system) {
    payload.systemInstruction = {
      parts: [{ text: normalizeContentToString(request.system) }],
    };
  }

  return payload;
}

function normalizeGeminiResponse(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim();

  return {
    content: [{ text }],
    usage: {
      input_tokens: response?.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response?.usageMetadata?.candidatesTokenCount ?? 0,
    },
    provider: 'gemini',
  };
}

class GeminiClient {
  constructor({ apiKey, model = 'gemini-2.5-flash' }) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(payload) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`Gemini API error ${response.status}: ${text.slice(0, 500)}`);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  }
}

export function createMessagesApi({ anthropicClient, openAiClient, geminiClient, llamaClient, fallbackModel, llamaModel }) {
  const resolvedFallbackModel = fallbackModel || process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const resolvedLlamaModel = llamaModel || process.env.LLAMA_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

  const callOpenAi = async (request) => {
    const openAiResponse = await openAiClient.chat.completions.create(toOpenAiPayload(request, resolvedFallbackModel));
    return normalizeOpenAiResponse(openAiResponse);
  };

  const callGemini = async (request) => {
    const geminiResponse = await geminiClient.generateContent(toGeminiPayload(request));
    return normalizeGeminiResponse(geminiResponse);
  };

  const callLlama = async (request) => {
    const llamaResponse = await llamaClient.chat.completions.create(toOpenAiPayload(request, resolvedLlamaModel));
    return normalizeLlamaResponse(llamaResponse);
  };

  const tryGemini = async (request, priorError) => {
    if (!geminiClient) {
      if (!llamaClient) throw priorError;
      console.warn('[LLM] Falling back to Llama:', priorError.message);
      return await callLlama(request);
    }
    try {
      return await callGemini(request);
    } catch (geminiError) {
      if (!llamaClient) throw geminiError;
      console.warn('[LLM] Gemini fallback failed, falling back to Llama:', geminiError.message);
      return await callLlama(request);
    }
  };

  return {
    async create(request) {
      if (!anthropicClient) {
        if (!openAiClient && !geminiClient && !llamaClient) {
          throw new Error('No LLM provider is configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or LLAMA_API_KEY.');
        }

        if (openAiClient) {
          try {
            return await callOpenAi(request);
          } catch (openAiError) {
            return await tryGemini(request, openAiError);
          }
        }

        if (geminiClient) {
          try {
            return await callGemini(request);
          } catch (geminiError) {
            if (!llamaClient) throw geminiError;
            console.warn('[LLM] Gemini failed, falling back to Llama:', geminiError.message);
            return await callLlama(request);
          }
        }

        return await callLlama(request);
      }

      try {
        return await anthropicClient.messages.create(request);
      } catch (error) {
        if (!shouldFallbackToOpenAI(error) || (!openAiClient && !geminiClient && !llamaClient)) {
          throw error;
        }

        if (openAiClient) {
          try {
            console.warn('[LLM] Anthropic unavailable, falling back to OpenAI:', error.message);
            return await callOpenAi(request);
          } catch (openAiError) {
            return await tryGemini(request, openAiError);
          }
        }

        console.warn('[LLM] Anthropic unavailable, falling back to Gemini/Llama:', error.message);
        return await tryGemini(request, error);
      }
    },
  };
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const llamaKey = process.env.LLAMA_API_KEY;

if (!hasUsableKey(anthropicKey)) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set or is a placeholder. Anthropic-backed chat will fall back to OpenAI/Gemini/Llama when configured.');
}

if (!hasUsableKey(openAiKey)) {
  console.warn('WARNING: OPENAI_API_KEY is not set or is a placeholder. OpenAI fallback is unavailable until a valid key is provided.');
}

if (!hasUsableKey(geminiKey)) {
  console.warn('WARNING: GEMINI_API_KEY is not set or is a placeholder. Gemini fallback is unavailable until a valid key is provided.');
}

if (!hasUsableKey(llamaKey)) {
  console.warn('WARNING: LLAMA_API_KEY is not set or is a placeholder. Llama fallback is unavailable until a valid key is provided.');
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

const geminiClient = hasUsableKey(geminiKey)
  ? new GeminiClient({
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    })
  : null;

// Together AI is the default Llama host — it exposes an OpenAI-compatible API,
// so we reuse the OpenAI SDK with a different baseURL. Swap LLAMA_BASE_URL to
// point at Groq (https://api.groq.com/openai/v1), Fireworks, or an HF Inference
// Provider without code changes.
const llamaClient = hasUsableKey(llamaKey)
  ? new OpenAI({
      apiKey: llamaKey,
      baseURL: process.env.LLAMA_BASE_URL || 'https://api.together.xyz/v1',
    })
  : null;

const anthropic = {
  messages: createMessagesApi({
    anthropicClient,
    openAiClient,
    geminiClient,
    llamaClient,
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    llamaModel: process.env.LLAMA_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  }),
};

export { normalizeOpenAiResponse, normalizeGeminiResponse, normalizeLlamaResponse, shouldFallbackToOpenAI, GeminiClient };
export default anthropic;
