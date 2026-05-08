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
      pineconeEnabled: env.ENABLE_PINECONE === 'true' && hasUsableKey(env.PINECONE_API_KEY) && Boolean(env.PINECONE_INDEX_KNOWLEDGE),
      pineconeIndex: env.PINECONE_INDEX_KNOWLEDGE || null,
      dropboxConfigured: hasUsableKey(env.DROPBOX_ACCESS_TOKEN),
      dropboxFolder: typeof env.DROPBOX_KNOWLEDGE_FOLDER === 'string' ? env.DROPBOX_KNOWLEDGE_FOLDER : null,
    },
  };
}
