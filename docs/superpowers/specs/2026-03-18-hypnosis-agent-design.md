# Hypnosis Agent — Design Spec

## Overview

Add a Hypnosis feature to the NLP Training Tool that conducts an adaptive intake conversation and generates ElevenLabs-ready self-hypnosis scripts using NLP techniques from the knowledge base.

## Goals

1. Adaptive intake chat that calibrates question depth to goal complexity
2. Generate self-hypnosis scripts with proper session structure (induction, deepener, change work, future pacing, emergence)
3. Scripts formatted with SSML `<break>` tags for precise pacing in ElevenLabs
4. Weave NLP patterns throughout (Milton Model, embedded commands, meta program matching, metaphor)

## Non-Goals

- ElevenLabs API integration (next step, not this spec)
- Saving scripts to database or localStorage
- Practitioner scripts (self-hypnosis only)

## Architecture

**New files:**
- `src/pages/Hypnosis.tsx` — Hypnosis page with welcome, intake chat, and script display states
- `server/routes/hypnosis.js` — Backend routes for intake chat and script generation
- `server/data/prompts/hypnotist.txt` — System prompt for the hypnosis agent

**Modified files:**
- `src/App.tsx` — Add `/hypnosis` route
- `src/components/Layout.tsx` — Add "Hypnosis" nav item
- `server/index.js` — Register `/api/hypnosis` routes

**Reused:**
- `src/components/Chat.tsx` — Reused for intake conversation (no coaching panel)
- `src/services/api.ts` — Add hypnosis API methods

## Agent Behavior

### Intake Phase

The agent operates conversationally, one question at a time. It assesses goal complexity from the first response and calibrates depth:

**Simple goals** (sleep, relaxation, focus) — 3-4 questions:
- What's the goal/desired outcome?
- What's your current experience with this?
- Any preferred imagery or settings (beach, forest, etc.)?

**Moderate goals** (confidence, motivation, habit change) — 5-7 questions:
- Above, plus:
- What emotions come up around this?
- What have you tried before?
- When/where does this show up most?
- What would it look like when this is resolved?

**Complex goals** (phobias, deep patterns) — 8-10 questions:
- Above, plus:
- When did this first start?
- What was happening in your life then?
- Is there a purpose this pattern has served?
- What would you need to let go of for this to change?

The agent uses NLP during intake — presuppositions in questions, calibrating representational systems (V/A/K) from the user's language, building rapport through pacing.

After sufficient information, the agent says: "I have everything I need. Generating your personalized hypnosis script now..." and triggers script generation.

### Script Generation Phase

The agent generates a complete hypnotic script. Structure depends on recommended length:

**Short script** (5-10 min spoken, ~800-1500 words):
1. Brief induction
2. Change work (suggestions, embedded commands, reframing)
3. Emergence

**Full session** (15-25 min spoken, ~2500-4000 words):
1. Pre-talk / setting the frame
2. Induction (matched to user's primary representational system)
3. Deepener
4. Change work (embedded commands, metaphor, reframing, timeline techniques)
5. Future pacing
6. Emergence

The agent recommends short or full based on goal complexity, but the user can request a preference during intake.

### NLP Integration

The hypnotist system prompt includes the full NLP knowledge base. The agent weaves in:
- **Milton Model patterns** throughout — presuppositions, mind reading, cause & effect, complex equivalence, tag questions, conversational postulates, etc.
- **Embedded commands** using the 2-1 pattern (two setup words, one command word) from Quantum Linguistics
- **Meta program matching** — adapts language to the user's direction filter (toward/away), chunk size, relationship filter, etc. based on intake responses
- **Metaphor** structured per the Metaphor Outline from the Master Practitioner Manual
- **Double binds** for deepening ("You can relax even deeper now, or your unconscious mind can do it for you")
- **Utilization** of anything the user mentioned during intake

## Script Formatting (ElevenLabs)

### SSML Tags

```xml
<break time="1s"/>    <!-- Short pause: between sentences, after commands -->
<break time="2s"/>    <!-- Medium pause: between sections, after suggestions -->
<break time="3s"/>    <!-- Long pause: induction deepening, letting suggestions land -->
<break time="5s"/>    <!-- Extended pause: deep trance, visualization setup -->
```

### Formatting Rules

- Clean flowing prose — no markdown, no headers, no bullets, no bracketed stage directions
- SSML `<break>` tags placed inline at pause points
- Ellipses (`...`) within sentences for trailing hypnotic phrasing
- Embedded commands structured naturally (no visual formatting — cadence does the work)
- Paragraphs separated by `<break time="2s"/>` for section transitions
- Everything in the output is speakable text (plus SSML tags)

### Example Output

```
And as you settle into this comfortable position... you can allow your eyes to close... whenever they feel ready to close.

<break time="2s"/>

That's right. And with each breath you take... you can begin to notice... how your body becomes more and more relaxed. <break time="1s"/> More comfortable with every exhale.

<break time="3s"/>

And I wonder if you've already begun to notice... that feeling of heaviness... in your hands... or perhaps in your feet. <break time="1s"/> Because your unconscious mind already knows... exactly how to relax deeply now.

<break time="2s"/>
```

## Backend API

### Claude Response Format (readyToGenerate Signal)

The `hypnotist.txt` system prompt instructs Claude to always respond in JSON format during intake:

```json
{"reply": "Your conversational response here", "readyToGenerate": false}
```

When Claude determines it has enough context, it sets `readyToGenerate: true`. The backend parses this JSON (with fallback extraction like the existing routes) and passes both fields to the frontend. The `hypnotist.txt` prompt uses the `{{CONTENT}}` placeholder to receive the full NLP knowledge base, matching the existing prompt-loading convention.

### Token Limits

- `/api/hypnosis/chat`: `max_tokens: 1024` (short conversational replies)
- `/api/hypnosis/generate`: `max_tokens: 8192` (full-session scripts can be 2500-4000 words / ~5000+ tokens)

### POST /api/hypnosis/chat

Intake conversation. Sends the full message history each call. The agent decides when it has enough info and signals readiness.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "I want to sleep better" }
  ]
}
```

**Response:**
```json
{
  "reply": "I'd love to help you with that. When you think about your sleep right now, what's the main challenge — is it falling asleep, staying asleep, or the quality of rest you're getting?",
  "readyToGenerate": false
}
```

When `readyToGenerate` is true, the frontend calls the generate endpoint.

### POST /api/hypnosis/generate

Generates the full script based on the intake conversation.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "I want to sleep better" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "Falling asleep, my mind races" },
    ...
  ]
}
```

**Response:**
```json
{
  "title": "Deep Restful Sleep",
  "duration": "full",
  "estimatedMinutes": 20,
  "script": "And as you settle into this comfortable position..."
}
```

## UI Flow

### Hypnosis page — 3 states:

**1. Welcome**
- Brief description: "Create personalized self-hypnosis scripts powered by NLP. The agent will ask a few questions about your goal, then generate a custom script formatted for ElevenLabs audio generation."
- "Start Session" button

**2. Intake Chat**
- Reuses Chat component with `coached={false}`
- No coaching sidebar
- Agent asks questions one at a time
- When the agent signals `readyToGenerate`, show a "Generate Script" button (manual trigger — user confirms before the longer generation call)
- "Cancel" button returns to welcome

**3. Script Display**
- Script title (large heading)
- Duration badge ("Full Session — ~20 min" or "Short — ~8 min")
- Script text rendered in a readable format:
  - `<break>` tags shown as subtle visual pause indicators (e.g., small dots or a thin line)
  - Clean typography optimized for reading/review
- "Copy Script" button — copies raw text with SSML tags to clipboard
- "New Session" button — returns to welcome

## Navigation

Add "Hypnosis" as the 5th nav item in the sidebar, between Practice and Reference. Use Unicode `✦` (four-pointed star) as the icon to match the existing geometric icon style:
- Dashboard (◉)
- Learn (◈)
- Practice (◇)
- **Hypnosis (✦)**
- Reference (◆)

### Script Rendering Safety

SSML `<break>` tags in the script output must be parsed and rendered safely — use a custom parser/regex replacement to convert tags to styled React elements. Do not use `dangerouslySetInnerHTML`.

## Error Handling

- Claude API failures during intake: show retry button, preserve chat history (same pattern as Practice)
- Script generation failure: show error with retry button, don't lose the intake conversation
- Script too long for clipboard: unlikely at 4000 words, but gracefully handle
