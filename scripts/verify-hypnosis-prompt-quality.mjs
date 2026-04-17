import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message + `\nMissing snippet: ${needle}`);
  }
}

function assertMatches(haystack, regex, message) {
  if (!regex.test(haystack)) {
    throw new Error(message + `\nMissing pattern: ${regex}`);
  }
}

const promptPath = join(process.cwd(), 'server/data/prompts/daily-coach.txt');
const prompt = readFileSync(promptPath, 'utf8');

const requiredChecks = [
  () => assertIncludes(prompt, 'STRUCTURE (Full Session, 15-25 min, 2500-4000 words):', 'Prompt must define a full-session architecture.'),
  () => assertIncludes(prompt, '1. Pre-talk / setting the frame', 'Prompt must include a pre-talk stage.'),
  () => assertIncludes(prompt, '2. Induction — matched to user\'s primary representational system', 'Prompt must include a personalized induction stage.'),
  () => assertIncludes(prompt, '3. Deepener — fractionation or staircase/elevator metaphors', 'Prompt must include a deepener stage.'),
  () => assertIncludes(prompt, '5. Future pacing — vivid, multi-sensory description of life with the change integrated', 'Prompt must include future pacing.'),
  () => assertIncludes(prompt, '6. Emergence — gentle, counting up, positive integration suggestions', 'Prompt must include emergence.'),
  () => assertIncludes(prompt, 'Use the user\'s exact phrases, imagery, and emotionally charged wording from the chat throughout the script', 'Prompt must require tight utilization of the user\'s own language.'),
  () => assertIncludes(prompt, 'Each major section must have a distinct pacing strategy and different pause density', 'Prompt must require section-level pause strategy instead of generic SSML sprinkling.'),
  () => assertIncludes(prompt, 'Induction and deepener should contain more pauses than emergence', 'Prompt must explicitly vary pause density across sections.'),
  () => assertIncludes(prompt, 'Use at least 8 Milton Model patterns across the full script', 'Prompt must require meaningful Milton Model density.'),
  () => assertIncludes(prompt, 'Include at least 3 embedded commands that land on identity, safety, or action', 'Prompt must require embedded commands with therapeutic targets.'),
  () => assertIncludes(prompt, 'Include at least 2 post-hypnotic suggestions tied to real-world cues from the conversation', 'Prompt must require real post-hypnotic integration.'),
  () => assertIncludes(prompt, 'Avoid generic spa-like relaxation language unless it directly matches the user\'s own style and experience', 'Prompt must explicitly reject bland generic hypnosis prose.'),
  () => assertIncludes(prompt, 'The script must feel progressively deeper, more specific, and more inevitable from beginning to end', 'Prompt must require progressive trance and inevitability.'),
  () => assertMatches(prompt, /Prediction Errors delivered to the unconscious mind/i, 'Prompt must retain prediction-error-based change work.'),
  () => assertMatches(prompt, /Gravitropic-then-Phototropic sequencing/i, 'Prompt must retain roots-before-reaching change sequencing.'),
];

for (const check of requiredChecks) {
  check();
}

console.log('Prompt quality checks passed.');
