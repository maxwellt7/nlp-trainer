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
    },
  };
}
