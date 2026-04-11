const VOICE_CATALOG = [
  {
    key: 'serafina',
    label: 'Serafina',
    description: 'Warm feminine guide',
    envVar: 'ELEVENLABS_VOICE_ID_SERAFINA',
    fallbackId: '4tRn1lSkEn13EVTuqb0g',
  },
  {
    key: 'silas_vane',
    label: 'Silas Vane',
    description: 'Grounded masculine guide',
    envVar: 'ELEVENLABS_VOICE_ID_SILAS_VANE',
    fallbackId: 'NYkjXRso4QIcgWakN1Cr',
  },
  {
    key: 'vane',
    label: 'Vane',
    description: 'Dark cinematic guide',
    envVar: 'ELEVENLABS_VOICE_ID_VANE',
    fallbackId: 'cymHWdiF8WjUCg6vvFxx',
  },
];

function normalizeVoiceId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getConfiguredVoices(env = process.env) {
  const configuredDefault = normalizeVoiceId(env.ELEVENLABS_VOICE_ID);

  const voices = VOICE_CATALOG.map((voice) => {
    const id = normalizeVoiceId(env[voice.envVar]) || voice.fallbackId;
    return {
      id,
      key: voice.key,
      label: voice.label,
      description: voice.description,
      isDefault: configuredDefault ? configuredDefault === id : false,
    };
  }).filter((voice, index, allVoices) => {
    return voice.id && allVoices.findIndex((candidate) => candidate.id === voice.id) === index;
  });

  const defaultVoiceId = configuredDefault || voices[0]?.id || '4tRn1lSkEn13EVTuqb0g';

  const normalizedVoices = voices.map((voice, index) => ({
    ...voice,
    isDefault: voice.id === defaultVoiceId || (!voices.some((candidate) => candidate.isDefault) && index === 0 && voice.id === defaultVoiceId),
  }));

  return {
    voices: normalizedVoices,
    defaultVoiceId,
  };
}

export function resolveVoiceSelection(requestedVoiceId, env = process.env) {
  const { voices, defaultVoiceId } = getConfiguredVoices(env);
  const normalizedRequested = normalizeVoiceId(requestedVoiceId);

  if (normalizedRequested) {
    const requestedVoice = voices.find((voice) => voice.id === normalizedRequested);
    if (requestedVoice) {
      return requestedVoice;
    }
  }

  return voices.find((voice) => voice.id === defaultVoiceId) || voices[0] || {
    id: defaultVoiceId,
    key: 'serafina',
    label: 'Serafina',
    description: 'Warm feminine guide',
    isDefault: true,
  };
}
