import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfiguredVoices, resolveVoiceSelection } from './audio-voices.js';

const voiceEnv = {
  ELEVENLABS_VOICE_ID: '4tRn1lSkEn13EVTuqb0g',
  ELEVENLABS_VOICE_ID_SERAFINA: '4tRn1lSkEn13EVTuqb0g',
  ELEVENLABS_VOICE_ID_SILAS_VANE: 'NYkjXRso4QIcgWakN1Cr',
  ELEVENLABS_VOICE_ID_VANE: 'cymHWdiF8WjUCg6vvFxx',
};

test('getConfiguredVoices returns the named catalog and marks the configured default voice', () => {
  const { voices, defaultVoiceId } = getConfiguredVoices(voiceEnv);

  assert.equal(defaultVoiceId, '4tRn1lSkEn13EVTuqb0g');
  assert.deepEqual(voices, [
    {
      id: '4tRn1lSkEn13EVTuqb0g',
      key: 'serafina',
      label: 'Serafina',
      description: 'Warm feminine guide',
      isDefault: true,
    },
    {
      id: 'NYkjXRso4QIcgWakN1Cr',
      key: 'silas_vane',
      label: 'Silas Vane',
      description: 'Grounded masculine guide',
      isDefault: false,
    },
    {
      id: 'cymHWdiF8WjUCg6vvFxx',
      key: 'vane',
      label: 'Vane',
      description: 'Dark cinematic guide',
      isDefault: false,
    },
  ]);
});

test('resolveVoiceSelection uses an allowed requested voice and falls back to the default for unknown ids', () => {
  const selected = resolveVoiceSelection('NYkjXRso4QIcgWakN1Cr', voiceEnv);
  assert.equal(selected.id, 'NYkjXRso4QIcgWakN1Cr');
  assert.equal(selected.label, 'Silas Vane');

  const fallback = resolveVoiceSelection('unknown-voice', voiceEnv);
  assert.equal(fallback.id, '4tRn1lSkEn13EVTuqb0g');
  assert.equal(fallback.label, 'Serafina');
});

test('getConfiguredVoices ignores a stale generic default voice id that is not present in the named catalog', () => {
  const staleEnv = {
    ...voiceEnv,
    ELEVENLABS_VOICE_ID: 'fCxG8OHm4STbIsWe4aT9',
  };

  const { voices, defaultVoiceId } = getConfiguredVoices(staleEnv);

  assert.equal(defaultVoiceId, '4tRn1lSkEn13EVTuqb0g');
  assert.equal(voices[0]?.isDefault, true);
  assert.equal(voices.find((voice) => voice.label === 'Serafina')?.isDefault, true);
});
