# Coach Context — Read.ai Transcripts

This directory contains program call transcripts that provide context for the AI coach (Ask/Chat/Sessions).

## Directory Structure

```
coach-context/
├── README.md
└── transcripts/
    ├── YYYY-MM-DD.json   (daily transcript files)
    └── ...
```

## Transcript File Schema

**File naming**: `transcripts/YYYY-MM-DD.json` (e.g. `transcripts/2026-10-24.json`)

**Format**: JSON array of meeting objects

```json
[
  {
    "meeting_id": "string",
    "title": "string",
    "start_time": "ISO-8601 datetime",
    "participants": ["string", "..."],
    "program": "We Level Up" | "Inner World Mastery" | "Mastering Influence" | "Legacy Leaders",
    "summary": "string (brief meeting summary)",
    "transcript_text": "string (full transcript)"
  }
]
```

### Field Descriptions

- **meeting_id**: Unique identifier from Read.ai (required)
- **title**: Meeting title/topic (required)
- **start_time**: ISO-8601 formatted datetime (e.g. `2026-10-24T14:30:00Z`) (required)
- **participants**: Array of participant names (required, can be empty)
- **program**: One of the four program names (required, case-sensitive)
- **summary**: Brief meeting summary (optional, but recommended)
- **transcript_text**: Full meeting transcript (required)

### Valid Program Names

1. `"We Level Up"`
2. `"Inner World Mastery"`
3. `"Mastering Influence"`
4. `"Legacy Leaders"`

## Nightly Job Integration

The nightly Read.ai sync job should:

1. **Fetch transcripts** from Read.ai MCP connector for the previous day
2. **Write file** to `coach-context/transcripts/YYYY-MM-DD.json`
3. **Commit** to the `main` branch with message: `feat: Add Read.ai transcripts for YYYY-MM-DD`
4. **Push** to origin

Example workflow:
```bash
# From repo root
echo '[{...}]' > coach-context/transcripts/2026-10-24.json
git add coach-context/transcripts/2026-10-24.json
git commit -m "feat: Add Read.ai transcripts for 2026-10-24"
git push origin main
```

## Data Privacy

- Transcripts are **server-side only** — never exposed to the client
- Transcript text is retrieved and included in AI prompts only when relevant to the user's question
- Token limits are applied to prevent context overflow
- Only relevant excerpts (not full transcripts) are included in prompts

## AI Coach Integration

When a user asks a question, the AI coach:
1. Retrieves relevant transcript excerpts based on lexical matching
2. Includes them in the prompt alongside library sources and conversation memory
3. Labels them as "PROGRAM CONTEXT" in the system prompt
4. Limits total token usage to stay within model constraints

The coach treats program transcripts as authoritative teaching material, similar to library sources.
