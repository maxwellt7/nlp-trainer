// Multi-call hypnosis script generation.
//
// A single LLM call tends to under-deliver on length even when the prompt asks
// for 2500-4000 words — outputs around 600-900 words come back consistently
// (~5 minute audio). To hit the 15-20 minute target, we generate the script
// in four sequential segments. Each call only owns ~5 minutes of content and
// reads the previous segments verbatim so transitions stay coherent.
//
// The first segment is also responsible for returning the script-level
// metadata (title, sessionSummary, keyThemes). Subsequent segments only
// return their script chunk.

export const SEGMENT_PLAN = [
  {
    name: 'intro_induction',
    label: 'Pre-talk & Induction',
    targetWords: 700,
    targetMinutes: 5,
    cover:
      'Section 1 (pre-talk: name today\'s insight from the chat, frame why this session matters, make change feel emotionally safe and inevitable) and Section 2 (induction: pace present-moment experience, match the user\'s primary rep system, light eye/breath fixation).',
    nextHint: 'After this segment a deepener and belief reframe will follow — leave the listener softening and ready to descend.',
    expectsMetadata: true,
  },
  {
    name: 'deepener_belief',
    label: 'Deepener & Belief Reframe (first half of change work)',
    targetWords: 700,
    targetMinutes: 5,
    cover:
      'Section 3 (deepener: fractionation or staircase/elevator metaphor for clear progressive descent) and the FIRST half of Section 4 (change work): surface the limiting belief named in the chat and begin pressure-testing it with Milton Model patterns and 1-2 embedded commands.',
    nextHint: 'After this segment, identity-level suggestions and the first future-pacing horizon will follow — end with the listener at maximum trance depth, ready for identity work.',
    expectsMetadata: false,
  },
  {
    name: 'identity_future_setup',
    label: 'Identity Shift & First Future-Pacing Horizon',
    targetWords: 700,
    targetMinutes: 5,
    cover:
      'The SECOND half of Section 4 (change work): identity-level suggestions, prediction errors delivered to the unconscious, belief-bridge language increasing internal safety. Then begin Section 5 (future pacing) with the FIRST horizon only: later today / the next time the trigger appears.',
    nextHint: 'After this segment, two more future-pacing horizons and the emergence will follow — leave the listener vividly inhabiting their near-future self.',
    expectsMetadata: false,
  },
  {
    name: 'future_emergence',
    label: 'Extended Future Pacing & Emergence',
    targetWords: 700,
    targetMinutes: 5,
    cover:
      'The remaining horizons of Section 5 (next challenging moment + emerging future self, vivid multi-sensory) and Section 6 (emergence: counting up 1-5, integration suggestions tied to real situations from the chat, post-hypnotic anchors, return to alertness with steadier forward-moving cadence).',
    nextHint: 'This is the FINAL segment — the listener must end fully alert, integrated, and oriented to their day.',
    expectsMetadata: false,
  },
];

function buildSegmentInstruction({ segIndex, totalSegs, segPlan, prevScripts }) {
  const prevContext = prevScripts.length > 0
    ? `\n\nPREVIOUS SEGMENTS ALREADY GENERATED (do NOT repeat — continue smoothly from the end of the last one):\n---BEGIN PREVIOUS---\n${prevScripts.join('\n\n')}\n---END PREVIOUS---\n`
    : '';

  const metadataField = segPlan.expectsMetadata
    ? '"title": "Short evocative title", "sessionSummary": "2-3 sentence summary of what was discussed and what the script addresses", "keyThemes": ["theme1","theme2"], '
    : '';

  return `
Generate ONLY segment ${segIndex} of ${totalSegs} of the personalized hypnosis script: "${segPlan.label}".

This segment must cover: ${segPlan.cover}

Target length: ${segPlan.targetWords} words (~${segPlan.targetMinutes} minutes spoken at hypnotic pace).
Continuity: ${segPlan.nextHint}
${prevContext}
RULES:
- Use the user's exact phrases, imagery, and emotionally charged wording from the chat throughout.
- Include SSML <break> tags appropriate to this segment's pacing (induction = denser/longer pauses; emergence = lighter, forward-moving).
- Speakable text plus SSML only — no markdown, no headers, no stage directions, no bracketed labels.
- DO NOT recap or summarize what came before. Continue the trance from where the previous segment left off.
${segIndex === 1 ? '- Begin the session — no greeting, no "welcome to this session" filler. Drop straight in.' : ''}
${segIndex === totalSegs ? '- End fully alert, eyes open, oriented to the day. No fade-out, no extra prose after emergence.' : ''}

Respond in JSON: { ${metadataField}"script": "the segment text with SSML break tags only" }
`.trim();
}

/**
 * Generate the full hypnosis script in chunks.
 *
 * @param {Object} args
 * @param {string} args.systemPrompt — full system prompt (with all dynamic context already injected)
 * @param {Array<{role: string, content: string}>} args.apiMessages — the coaching conversation
 * @param {(payload: object) => Promise<{content:[{text:string}]}>} args.llm — anthropic.messages.create-shaped function
 * @param {(text:string) => any} args.parseJson — JSON parser/repair helper
 * @param {string} [args.model] — Claude model
 * @param {number} [args.maxTokensPerSegment] — defaults to 4096
 * @param {Array} [args.segmentPlan] — override for tests
 * @returns {Promise<{title:string, sessionSummary:string, keyThemes:string[], script:string, segments:string[], estimatedMinutes:number}>}
 */
export async function generateChunkedScript({
  systemPrompt,
  apiMessages,
  llm,
  parseJson,
  model = 'claude-sonnet-4-20250514',
  maxTokensPerSegment = 4096,
  segmentPlan = SEGMENT_PLAN,
}) {
  const segments = [];
  const metadata = { title: 'Hypnosis Script', sessionSummary: '', keyThemes: [] };
  let totalMinutes = 0;

  for (let i = 0; i < segmentPlan.length; i += 1) {
    const segPlan = segmentPlan[i];
    const segIndex = i + 1;
    const segInstruction = buildSegmentInstruction({
      segIndex,
      totalSegs: segmentPlan.length,
      segPlan,
      prevScripts: segments,
    });

    const response = await llm({
      model,
      max_tokens: maxTokensPerSegment,
      system: systemPrompt,
      messages: [
        ...apiMessages,
        { role: 'user', content: segInstruction },
      ],
    });

    const text = response?.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = parseJson(text);
    } catch (err) {
      // Treat the entire response as the segment text if JSON parsing fails — better
      // than aborting a 4-call generation halfway through.
      console.warn(`[hypnosis] segment ${segIndex} JSON parse failed, using raw text:`, err.message);
      parsed = { script: text };
    }

    if (segPlan.expectsMetadata) {
      if (parsed.title) metadata.title = parsed.title;
      if (parsed.sessionSummary) metadata.sessionSummary = parsed.sessionSummary;
      if (Array.isArray(parsed.keyThemes)) metadata.keyThemes = parsed.keyThemes;
    }

    const segmentText = String(parsed.script || '').trim();
    if (!segmentText) {
      throw new Error(`Hypnosis segment ${segIndex} (${segPlan.name}) returned empty script`);
    }
    segments.push(segmentText);
    totalMinutes += segPlan.targetMinutes;
  }

  const script = segments.join('\n\n');
  return {
    title: metadata.title,
    sessionSummary: metadata.sessionSummary,
    keyThemes: metadata.keyThemes,
    script,
    segments,
    estimatedMinutes: totalMinutes,
  };
}
