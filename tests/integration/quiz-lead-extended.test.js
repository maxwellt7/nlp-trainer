/**
 * Integration tests — POST /api/quiz/lead (full funnel path)
 *
 * Strategy: build a thin Express app that mounts the real quiz router, backed by
 * the real shared sql.js DB (same instance the handler uses).  We intercept
 * outbound fetch calls so no real CAPI / GHL network traffic is made.
 *
 * Each test inserts unique rows (unique email prefix), verifies real DB state
 * via db.prepare() queries, then cleans up in a `finally` block.
 *
 * Run:
 *   LEAD_TOKEN_HMAC_SECRET=test-lead-secret-32-chars-padded!! \
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-padded! \
 *   META_CAPI_TOKEN=test-capi-token-integration \
 *   GHL_API_KEY=test-ghl-key \
 *   node --test tests/integration/quiz-lead-extended.test.js
 */

// ── Env setup — MUST be before any module imports ────────────────────────────

process.env.LEAD_TOKEN_HMAC_SECRET =
  process.env.LEAD_TOKEN_HMAC_SECRET || 'test-lead-secret-32-chars-padded!!';
process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || 'test-unsub-secret-32-chars-padded!';

// CAPI: set the token BEFORE quiz.js is imported so that the module-level
// CAPI_TOKEN constant picks it up.  If quiz.js was already cached (same process
// as another test file) the token may already be set — that is fine.
process.env.META_CAPI_TOKEN =
  process.env.META_CAPI_TOKEN || 'test-capi-token-integration-xxxxxxxxxxxx';

// GHL: set a non-empty key so handleQuizLead actually calls ghlFetch
process.env.GHL_API_KEY       = process.env.GHL_API_KEY       || 'test-ghl-key-integration';
process.env.GHL_CF_Q9_FEAR    = process.env.GHL_CF_Q9_FEAR    || 'test-field-id-q9-fear';
process.env.GHL_CF_PATTERN_SCORES = process.env.GHL_CF_PATTERN_SCORES || 'test-field-id-pattern';

process.env.RESEND_API_KEY      = process.env.RESEND_API_KEY      || 'test-resend-key';
process.env.RESEND_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'test@example.com';

// ── Imports ──────────────────────────────────────────────────────────────────

import test, { before, after } from 'node:test';
import assert     from 'node:assert/strict';
import http       from 'node:http';
import crypto     from 'node:crypto';
import express    from 'express';

import db                            from '../../server/db/index.js';
import quizRouter                    from '../../server/routes/quiz.js';
import { verifyLeadToken }           from '../../server/middleware/tokens.js';

// ── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/quiz', quizRouter);

// ── HTTP test helpers ─────────────────────────────────────────────────────────

let server;
let serverPort;

async function startServer() {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  serverPort = server.address().port;
}

async function stopServer() {
  if (server) await new Promise(resolve => server.close(resolve));
}

function postLead(body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const bodyBuf = Buffer.from(bodyStr);
    const req = http.request({
      hostname: '127.0.0.1',
      port:     serverPort,
      path:     '/api/quiz/lead',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': bodyBuf.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function cleanupByEmail(email) {
  try {
    const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get(email);
    if (lead) {
      db.prepare('DELETE FROM quiz_email_sends WHERE quiz_lead_id = ?').run(lead.id);
      db.prepare('DELETE FROM quiz_leads WHERE id = ?').run(lead.id);
    }
  } catch (_) {}
}

function cleanupByEmailLike(prefix) {
  try {
    const leads = db.prepare(`SELECT id FROM quiz_leads WHERE email LIKE ?`).all(`${prefix}%`);
    for (const lead of leads) {
      db.prepare('DELETE FROM quiz_email_sends WHERE quiz_lead_id = ?').run(lead.id);
      db.prepare('DELETE FROM quiz_leads WHERE id = ?').run(lead.id);
    }
  } catch (_) {}
}

// ── SHA-256 helper (mirrors quiz.js hashForMeta) ──────────────────────────────

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ── fetch stub infrastructure ─────────────────────────────────────────────────

const _realFetch = globalThis.fetch;

function stubFetch(handler) {
  globalThis.fetch = async (url, opts) => handler(url, opts);
}

function restoreFetch() {
  globalThis.fetch = _realFetch;
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

before(startServer);
after(stopServer);

// ── Tests ─────────────────────────────────────────────────────────────────────

test('1. Full funnel payload → all 14 columns populated + 6 send rows queued',
  { concurrency: false },
  async () => {
    const email = `integ-t1-${Date.now()}@example.com`;

    // Stub fetch to swallow CAPI + GHL calls without failing
    stubFetch(async (url) => {
      return {
        ok:   true,
        json: async () => ({ events_received: 1, contact: { id: 'fake-ghl-id' } }),
      };
    });

    try {
      const res = await postLead({
        email,
        name:           'Integration Tester',
        score:          9,
        tier:           'high',
        answers:        { q1: 'a', q2: 'b' },
        pattern_scores: { A: 3, B: 2, C: 4, D: 1 },
        result_program: 'over-preparer',
        depth_score:    8,
        depth_band:     'deep-rooted',
        q2_style:       'analytical',
        q9_fear:        'not being enough',
        utm:            { source: 'fb', medium: 'paid', campaign: 'align-q2', content: 'v1' },
        sourceUrl:      'https://align.sovereignty.app/start',
        fbp:            'fb.1.111.222',
        fbc:            'fb.1.333.444',
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.equal(typeof res.body.lead_id, 'number');
      assert.equal(typeof res.body.lead_token, 'string');

      // Verify all 14 new columns are populated in quiz_leads
      const lead = db.prepare('SELECT * FROM quiz_leads WHERE email = ?').get(email);
      assert.ok(lead, 'lead row must exist');
      assert.equal(lead.email,          email);
      assert.equal(lead.name,           'Integration Tester');
      assert.equal(lead.score,          9);
      assert.equal(lead.tier,           'high');
      assert.equal(lead.result_program, 'over-preparer');
      assert.equal(lead.depth_score,    8);
      assert.equal(lead.depth_band,     'deep-rooted');
      assert.equal(lead.q2_style,       'analytical');
      assert.equal(lead.q9_fear,        'not being enough');
      assert.deepEqual(JSON.parse(lead.pattern_scores), { A: 3, B: 2, C: 4, D: 1 });
      assert.equal(lead.utm_source,     'fb');
      assert.equal(lead.utm_medium,     'paid');
      assert.equal(lead.utm_campaign,   'align-q2');
      assert.equal(lead.utm_content,    'v1');
      assert.ok(lead.gate_at, 'gate_at must be set');

      // Verify 6 send rows queued with correct email_nums and statuses
      const sends = db.prepare(
        'SELECT * FROM quiz_email_sends WHERE quiz_lead_id = ? ORDER BY email_num ASC',
      ).all(lead.id);

      assert.equal(sends.length, 6, 'Expected exactly 6 quiz_email_sends rows');

      const emailNums = sends.map(s => s.email_num);
      assert.deepEqual(emailNums, [1, 2, 3, 4, 5, 6], 'email_nums must be 1..6');

      for (const s of sends) {
        assert.equal(s.status, 'queued', `send ${s.email_num}: status must be queued`);
        assert.ok(s.scheduled_for, `send ${s.email_num}: scheduled_for must be set`);
      }

      // Scheduled times must be strictly increasing
      const times = sends.map(s => new Date(s.scheduled_for.replace(' ', 'T') + 'Z').getTime());
      for (let i = 1; i < times.length; i++) {
        assert.ok(times[i] > times[i - 1], `send ${i + 1} must be scheduled after send ${i}`);
      }
    } finally {
      restoreFetch();
      cleanupByEmail(email);
    }
  },
);

test('2. CAPI Lead event fired with correct hashed email + content_name',
  { concurrency: false },
  async () => {
    const email = `integ-t2-${Date.now()}@example.com`;

    const capiCalls = [];

    stubFetch(async (url, opts) => {
      if (url.includes('/events?access_token=')) {
        capiCalls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, json: async () => ({ events_received: 1 }) };
      }
      // GHL calls
      return { ok: true, json: async () => ({ contact: { id: 'ghl-id' } }) };
    });

    try {
      const res = await postLead({
        email,
        name:           'CAPI Tester',
        pattern_scores: { A: 1, B: 2, C: 3, D: 4 },
        result_program: 'self-censor',
        depth_score:    5,
        depth_band:     'established',
        fbp:            'fb.1.aaa.bbb',
        fbc:            'fb.1.ccc.ddd',
        sourceUrl:      'https://align.sovereignty.app/start',
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      // Wait briefly to allow the async CAPI call that runs inside the handler
      // (sendCapiEvent is awaited in the handler, so it should be done)
      assert.equal(capiCalls.length, 1, 'Exactly one CAPI call must have been made');

      const capiBody = capiCalls[0].body;
      assert.ok(Array.isArray(capiBody.data), 'CAPI body must have data array');
      assert.equal(capiBody.data.length, 1, 'CAPI data must have exactly one event');

      const event = capiBody.data[0];
      assert.equal(event.event_name, 'Lead', 'CAPI event_name must be "Lead"');

      // Email must be SHA-256 hashed (lowercase)
      const expectedHash = sha256(email.toLowerCase().trim());
      assert.ok(
        Array.isArray(event.user_data.em) && event.user_data.em[0] === expectedHash,
        'CAPI user_data.em must be [sha256(email)]',
      );

      // content_name must be 'Alignment Assessment Email'
      assert.equal(
        event.custom_data?.content_name,
        'Alignment Assessment Email',
        'CAPI custom_data.content_name must be "Alignment Assessment Email"',
      );
    } finally {
      restoreFetch();
      cleanupByEmail(email);
    }
  },
);

test('3. GHL handleQuizLead called with funnel tags + custom fields',
  { concurrency: false },
  async () => {
    const email = `integ-t3-${Date.now()}@example.com`;

    const ghlCalls = [];

    stubFetch(async (url, opts) => {
      if (url.includes('/events?access_token=')) {
        // CAPI
        return { ok: true, json: async () => ({ events_received: 1 }) };
      }
      if (url.includes('services.leadconnectorhq.com')) {
        ghlCalls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
        // First call is findContactByEmail (GET /contacts/?...)
        if (opts.method === 'GET' || !opts.method) {
          return { ok: true, json: async () => ({ contacts: [] }) };
        }
        // POST /contacts/ or POST /contacts/{id}/tags
        return { ok: true, json: async () => ({ contact: { id: 'ghl-contact-123' } }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    try {
      const res = await postLead({
        email,
        name:           'GHL Tags Tester',
        pattern_scores: { A: 5, B: 1, C: 3, D: 1 },
        result_program: 'self-censor',
        depth_score:    7,
        depth_band:     'deep-rooted',
        q9_fear:        'being rejected',
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      // GHL calls are async fire-and-forget — wait a tick for them to complete
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Find the upsert call (POST /contacts/)
      const upsertCall = ghlCalls.find(c =>
        c.url.includes('/contacts/') && c.method === 'POST' && c.body?.email === email,
      );
      assert.ok(upsertCall, `GHL upsert call not found. Calls: ${JSON.stringify(ghlCalls.map(c => ({url: c.url, method: c.method})))}`);

      // The funnel tags ['funnel:align', 'program:self-censor', 'depth:deep-rooted'] are added
      // via a separate addTags() call to POST /contacts/{id}/tags — NOT in the upsert body.
      // The upsert body contains only the base tags ['quiz-completed', 'quiz-lead', ...].
      // Collect ALL tags seen across the upsert body AND the dedicated /tags POST calls.
      const upsertTags = upsertCall.body.tags || [];
      const tagPostCalls = ghlCalls.filter(c =>
        c.url.includes('/tags') && c.method === 'POST' && c.body?.tags,
      );
      const tagsFromTagCalls = tagPostCalls.flatMap(c => c.body.tags);
      const allTags = [...upsertTags, ...tagsFromTagCalls];

      assert.ok(
        allTags.includes('funnel:align'),
        `funnel:align must appear in GHL tags. allTags: ${JSON.stringify(allTags)}`,
      );
      assert.ok(
        allTags.includes('program:self-censor'),
        `program:self-censor must appear in GHL tags. allTags: ${JSON.stringify(allTags)}`,
      );
      assert.ok(
        allTags.includes('depth:deep-rooted'),
        `depth:deep-rooted must appear in GHL tags. allTags: ${JSON.stringify(allTags)}`,
      );

      // Custom fields must include q9_fear + pattern_scores values
      const customFields = upsertCall.body.customFields || [];
      const q9Entry     = customFields.find(f => f.id === process.env.GHL_CF_Q9_FEAR);
      const patEntry    = customFields.find(f => f.id === process.env.GHL_CF_PATTERN_SCORES);

      assert.ok(q9Entry,  'customFields must include q9_fear entry');
      assert.equal(q9Entry.field_value, 'being rejected');
      assert.ok(patEntry, 'customFields must include pattern_scores entry');
    } finally {
      restoreFetch();
      cleanupByEmail(email);
    }
  },
);

test('4. Returned lead_token verifies correctly',
  { concurrency: false },
  async () => {
    const email = `integ-t4-${Date.now()}@example.com`;

    stubFetch(async (url) => {
      if (url.includes('/events?access_token=')) {
        return { ok: true, json: async () => ({ events_received: 1 }) };
      }
      return { ok: true, json: async () => ({ contact: { id: 'x' }, contacts: [] }) };
    });

    try {
      const res = await postLead({
        email,
        name:           'Token Tester',
        pattern_scores: { A: 2, B: 3, C: 1, D: 4 },
        result_program: 'loop',
        depth_score:    5,
        depth_band:     'established',
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
      assert.equal(typeof res.body.lead_id, 'number', 'response must include lead_id');
      assert.equal(typeof res.body.lead_token, 'string', 'response must include lead_token');

      const { lead_id, lead_token } = res.body;

      const payload = verifyLeadToken(lead_token);
      assert.ok(payload !== null, 'lead_token must verify successfully');
      assert.equal(payload.lead_id, lead_id, 'token payload.lead_id must match response lead_id');
      assert.ok(
        typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000),
        'token exp must be a future unix timestamp',
      );
    } finally {
      restoreFetch();
      cleanupByEmail(email);
    }
  },
);

test('5. Transaction rollback on intentional failure — no lead or sends persist',
  { concurrency: false },
  async () => {
    // We simulate a transaction rollback by temporarily breaking the DB
    // from inside the transaction.  The approach: monkey-patch db.transaction
    // to inject a failure after the quiz_leads INSERT but before the
    // quiz_email_sends inserts complete.
    //
    // Because the route handler catches the tx error and returns 500, we
    // expect a 500 response AND zero rows in both tables.

    const email = `integ-t5-${Date.now()}@example.com`;

    stubFetch(async () => ({ ok: true, json: async () => ({ events_received: 1, contact: { id: 'x' } }) }));

    // Patch db.transaction to throw after quiz_leads INSERT
    const originalTransaction = db.transaction.bind(db);
    let patchCount = 0;
    db.transaction = function(fn) {
      if (patchCount === 0) {
        patchCount++;
        // Use real transaction infrastructure but inject failure via a wrapped txDb
        return originalTransaction((txDb) => {
          const wrappedTxDb = {
            prepare(sql) {
              const stmt = txDb.prepare(sql);
              return {
                run(...params) {
                  // Allow the quiz_leads INSERT (first run call), then blow up
                  if (sql.includes('quiz_email_sends')) {
                    throw new Error('Injected test failure in quiz_email_sends INSERT');
                  }
                  return stmt.run(...params);
                },
                get: (...params) => stmt.get(...params),
                all: (...params) => stmt.all ? stmt.all(...params) : [],
              };
            },
          };
          return fn(wrappedTxDb);
        });
      }
      return originalTransaction(fn);
    };

    try {
      const res = await postLead({
        email,
        name:           'Rollback Tester',
        pattern_scores: { A: 1, B: 1, C: 1, D: 7 },
        result_program: 'loop',
        depth_score:    3,
        depth_band:     'surface',
      });

      assert.equal(res.status, 500, `Expected 500 on tx failure, got ${res.status}`);

      // No quiz_leads row
      const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get(email);
      assert.equal(lead, undefined, 'quiz_leads row must not exist after rollback');

      // No quiz_email_sends rows for any leads with this email
      const sends = db.prepare(
        'SELECT qes.* FROM quiz_email_sends qes JOIN quiz_leads ql ON ql.id = qes.quiz_lead_id WHERE ql.email = ?'
      ).all(email);
      assert.equal(sends.length, 0, 'quiz_email_sends rows must not exist after rollback');
    } finally {
      db.transaction = originalTransaction;
      restoreFetch();
      cleanupByEmail(email); // no-op if rollback succeeded
    }
  },
);

test('6. Legacy payload path — 1 lead row with NULL funnel columns, 0 send rows, no lead_token',
  { concurrency: false },
  async () => {
    const email = `integ-t6-${Date.now()}@example.com`;

    const capiCalls = [];
    const ghlCalls  = [];

    stubFetch(async (url, opts) => {
      if (url.includes('/events?access_token=')) {
        capiCalls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, json: async () => ({ events_received: 1 }) };
      }
      if (url.includes('services.leadconnectorhq.com')) {
        ghlCalls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
        if (opts.method === 'GET' || !opts.method) {
          return { ok: true, json: async () => ({ contacts: [] }) };
        }
        return { ok: true, json: async () => ({ contact: { id: 'ghl-legacy-id' } }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    try {
      const res = await postLead({
        // Legacy fields ONLY — no funnel fields
        email,
        name:      'Legacy User',
        score:     5,
        tier:      'mid',
        answers:   { q1: 'a', q2: 'b' },
        sourceUrl: 'https://start.sovereignty.app/quiz',
        fbp:       'fb.1.111.222',
        fbc:       'fb.1.333.444',
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      // Response shape: { success: true } — no lead_id, no lead_token
      assert.equal(res.body.success, true, 'response.success must be true');
      assert.equal(res.body.lead_id,    undefined, 'legacy response must not include lead_id');
      assert.equal(res.body.lead_token, undefined, 'legacy response must not include lead_token');

      // 1 quiz_leads row inserted
      const allLeads = db.prepare('SELECT * FROM quiz_leads WHERE email = ?').all(email);
      assert.equal(allLeads.length, 1, 'Expected exactly 1 quiz_leads row on legacy path');

      const lead = allLeads[0];
      assert.equal(lead.email,          email);
      assert.equal(lead.name,           'Legacy User');

      // Funnel columns must be NULL
      assert.equal(lead.pattern_scores, null, 'pattern_scores must be NULL on legacy path');
      assert.equal(lead.result_program, null, 'result_program must be NULL on legacy path');
      assert.equal(lead.depth_score,    null, 'depth_score must be NULL on legacy path');
      assert.equal(lead.depth_band,     null, 'depth_band must be NULL on legacy path');
      assert.equal(lead.gate_at,        null, 'gate_at must be NULL on legacy path');

      // 0 quiz_email_sends rows
      const sends = db.prepare(
        'SELECT * FROM quiz_email_sends WHERE quiz_lead_id = ?',
      ).all(lead.id);
      assert.equal(sends.length, 0, 'Expected 0 quiz_email_sends rows on legacy path');

      // CAPI fired
      assert.equal(capiCalls.length, 1, 'CAPI must fire on legacy path too');

      // GHL called — wait for fire-and-forget to settle
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 50));

      const ghlUpsert = ghlCalls.find(c =>
        c.url.includes('/contacts/') && c.method === 'POST' && c.body?.email === email,
      );
      assert.ok(ghlUpsert, 'GHL upsert call must be made on legacy path');

      // GHL call must NOT include funnel tags
      const tags = ghlUpsert.body.tags || [];
      assert.ok(!tags.includes('funnel:align'),   'legacy path must not include funnel:align tag');
      assert.ok(!tags.some(t => t.startsWith('program:')), 'legacy path must not include program: tag');
      assert.ok(!tags.some(t => t.startsWith('depth:')),   'legacy path must not include depth: tag');
    } finally {
      restoreFetch();
      cleanupByEmail(email);
    }
  },
);

// ── (teardown is handled by the `after` hook above) ───────────────────────────
