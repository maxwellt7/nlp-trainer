function hasUsableKey(value) {
  return Boolean(value && String(value).trim() && !String(value).includes('your_') && !String(value).includes('placeholder'));
}

export function buildRuntimeHealthPayload({ clerkEnabled, env = process.env } = {}) {
  return {
    status: 'ok',
    auth: Boolean(clerkEnabled),
    runtime: {
      commit:
        env.RAILWAY_GIT_COMMIT_SHA ||
        env.RAILWAY_GIT_COMMIT ||
        env.GITHUB_SHA ||
        env.VERCEL_GIT_COMMIT_SHA ||
        env.SOURCE_VERSION ||
        null,
      openAiConfigured: hasUsableKey(env.OPENAI_API_KEY),
      openAiFallbackModel: env.OPENAI_FALLBACK_MODEL || env.OPENAI_MODEL || 'gpt-4.1-mini',
      geminiConfigured: hasUsableKey(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
      geminiFallbackModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
      llamaConfigured: hasUsableKey(env.LLAMA_API_KEY),
      llamaFallbackModel: env.LLAMA_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      llamaBaseUrl: env.LLAMA_BASE_URL || 'https://api.together.xyz/v1',
      pineconeEnabled: env.ENABLE_PINECONE === 'true' && hasUsableKey(env.PINECONE_API_KEY) && Boolean(env.PINECONE_INDEX_KNOWLEDGE),
      pineconeIndex: env.PINECONE_INDEX_KNOWLEDGE || null,
      dropboxConfigured:
        (hasUsableKey(env.DROPBOX_REFRESH_TOKEN) && hasUsableKey(env.DROPBOX_APP_KEY) && hasUsableKey(env.DROPBOX_APP_SECRET)) ||
        hasUsableKey(env.DROPBOX_ACCESS_TOKEN),
      dropboxAuthMode:
        (hasUsableKey(env.DROPBOX_REFRESH_TOKEN) && hasUsableKey(env.DROPBOX_APP_KEY) && hasUsableKey(env.DROPBOX_APP_SECRET))
          ? 'refresh_token'
          : (hasUsableKey(env.DROPBOX_ACCESS_TOKEN) ? 'static_token_legacy' : 'unconfigured'),
      dropboxFolder: typeof env.DROPBOX_KNOWLEDGE_FOLDER === 'string' ? env.DROPBOX_KNOWLEDGE_FOLDER : null,
    },
  };
}
