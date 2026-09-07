// Vision OCR for Ask screenshot attachments.
// Uses Anthropic (then OpenAI) directly so the shared LLM wrapper does not
// strip the image or force a JSON-object contract that drops the pixels.

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64_CHARS = 3_500_000;

function hasUsableKey(value) {
  return Boolean(value && !String(value).includes('placeholder') && !String(value).includes('your_'));
}

export function parseAskImage(body) {
  const image = body && body.image;
  if (!image) return null;
  let mime = String(image.mime || '').toLowerCase().trim();
  let data = String(image.data || '').replace(/\s/g, '');
  const dataUrl = data.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    if (!mime) mime = dataUrl[1].toLowerCase();
    data = dataUrl[2];
  }
  if (!ALLOWED.has(mime)) {
    throw Object.assign(new Error('Use a PNG, JPEG, or WebP screenshot.'), { status: 400 });
  }
  if (!data || data.length < 80) {
    throw Object.assign(new Error('That image is empty.'), { status: 400 });
  }
  if (data.length > MAX_BASE64_CHARS) {
    throw Object.assign(new Error('That screenshot is too large — crop it and try again.'), { status: 400 });
  }
  return { mime, data };
}

export function parseExtractedText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.text === 'string') return parsed.text.trim();
  } catch {
    /* plain text from Claude is fine */
  }
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(unfenced);
    if (parsed && typeof parsed.text === 'string') return parsed.text.trim();
  } catch {
    /* keep going */
  }
  return text;
}

function anthropicPayload(mime, data) {
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: 'Extract every readable line from the screenshot in reading order. Preserve speaker labels if visible. Do not summarize or interpret. Respond with JSON only: {"text":"..."}',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data } },
        { type: 'text', text: 'Extract the text from this screenshot.' },
      ],
    }],
  };
}

async function extractViaAnthropic(mime, data, fetchFn) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!hasUsableKey(key)) return null;
  const res = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthropicPayload(mime, data)),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic vision HTTP ${res.status}: ${errText.slice(0, 240)}`);
  }
  const json = await res.json();
  const raw = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parseExtractedText(raw);
}

async function extractViaOpenAI(mime, data, fetchFn) {
  const key = process.env.OPENAI_API_KEY;
  if (!hasUsableKey(key)) return null;
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1-mini';
  const res = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract every readable line from the screenshot in reading order. Preserve speaker labels if visible. Do not summarize. JSON: {"text":"..."}',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } },
            { type: 'text', text: 'Extract the text from this screenshot.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI vision HTTP ${res.status}: ${errText.slice(0, 240)}`);
  }
  const json = await res.json();
  return parseExtractedText(json.choices?.[0]?.message?.content);
}

export async function extractScreenshotText(image, { fetchFn = fetch } = {}) {
  if (!image) return '';
  const errors = [];
  try {
    const text = await extractViaAnthropic(image.mime, image.data, fetchFn);
    if (text) return text;
  } catch (err) {
    errors.push(err.message);
  }
  try {
    const text = await extractViaOpenAI(image.mime, image.data, fetchFn);
    if (text) return text;
  } catch (err) {
    errors.push(err.message);
  }
  const composed = new Error(errors.length ? errors.join(' | ') : 'No vision provider is configured.');
  composed.status = 503;
  throw composed;
}

export function screenshotChunk(text) {
  const body = String(text || '').trim();
  if (!body) return null;
  return {
    source: 'screenshot:upload',
    filename: 'Uploaded screenshot',
    text: body,
    score: 1,
  };
}
