/**
 * GoHighLevel API Service
 * Handles contact creation, tag management, opportunity tracking,
 * and pipeline stage updates for the Alignment Engine funnel.
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Static custom field IDs — hardcoded IDs that are always available.
// Align-funnel fields whose IDs are provided via env vars are resolved at call time
// (see getCustomFields()) so that tests can set env vars after module load.
const STATIC_CUSTOM_FIELDS = {
  quiz_score: 'BsVf8712q9W0rXwEaGjb',
  quiz_archetype: '2vBvHSkMmV3s7Gj22Atr',
  quiz_completion_date: 'rSrvCHlmICQuwHxhcM6i',
  clerk_user_id: 'e0L3rPRZWlzNPdqWn7xv',
  signup_date: 'SFAdxFBVIl7gpqEgU9hh',
  subscription_plan: '6KJ0Dw5fKk8wkwVIIPd1',
  subscription_status: 'rdnx57mjfZFPkCDVrUDN',
  lead_source: 'PIXlymXDBILG5OYkMLUb',
  sessions_completed: 'vJnjEw4EMiVSU7Ts9F0g',
  last_active_date: 'xr2co9ebBlzUb8nIRRHC',
};

/**
 * Returns the full custom-fields map, reading env-var-backed IDs at call time.
 *
 * All IDs are the GHL internal field IDs (alphanumeric strings visible in GHL's
 * Settings → Custom Fields UI and in the Contact API response's `customFields` array).
 *
 * Align-funnel additions (A.5):
 *   q9_fear        — must be pre-created in GHL as a "Single Line Text" field
 *                    named "Q9 Fear" (or similar). Set GHL_CF_Q9_FEAR from GHL UI once created.
 *   pattern_scores — must be pre-created as a "Multi-Line Text" (or "Text Area") field
 *                    named "Pattern Scores". Set GHL_CF_PATTERN_SCORES from GHL UI once created.
 */
function getCustomFields() {
  return {
    ...STATIC_CUSTOM_FIELDS,
    // Align-funnel custom fields — resolved at call time so env vars set after module
    // load (e.g. in tests) are picked up correctly.
    q9_fear: process.env.GHL_CF_Q9_FEAR || '',
    pattern_scores: process.env.GHL_CF_PATTERN_SCORES || '',
  };
}

// Config — read at call time (see getConfig()) so tests can set env vars after module load.
function getConfig() {
  return {
    apiKey: process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '5aJWX4BRf7medN5RImNo',
    pipelineId: process.env.GHL_PIPELINE_ID || '1qqZSQ7AlOLthuqlbPX9',
    stages: {
      quiz_lead: process.env.GHL_STAGE_QUIZ_LEAD || 'bd784975-1a3d-43b8-a10f-d8fd6e1f893f',
      signed_up: process.env.GHL_STAGE_SIGNED_UP || '5f36d393-1641-47f0-9936-2b042a158878',
      subscribed: process.env.GHL_STAGE_SUBSCRIBED || 'bdb19dd0-2609-4de3-a1e5-471c603cfa56',
      churned: process.env.GHL_STAGE_CHURNED || 'ed85b2f0-a1bd-4eba-897e-b10ba0d60136',
    },
  };
}

function isConfigured() {
  return !!getConfig().apiKey;
}

async function ghlFetch(endpoint, options = {}) {
  const { apiKey } = getConfig();
  if (!apiKey) {
    console.log('[GHL] Skipping — no API key configured');
    return null;
  }

  const url = `${GHL_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[GHL] ${options.method || 'GET'} ${endpoint} failed:`, data);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`[GHL] ${endpoint} error:`, err.message);
    return null;
  }
}

// ── Contact Management ──

/**
 * Find a contact by email
 */
async function findContactByEmail(email) {
  const { locationId } = getConfig();
  const result = await ghlFetch(
    `/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`,
    { method: 'GET' }
  );
  if (result && result.contacts && result.contacts.length > 0) {
    return result.contacts[0];
  }
  return null;
}

/**
 * Create or update a contact in GHL
 */
async function upsertContact({ email, name, phone, tags, customFields, source }) {
  if (!email) return null;

  const { locationId } = getConfig();
  const CUSTOM_FIELDS = getCustomFields();

  // Check if contact exists
  let contact = await findContactByEmail(email);

  const body = {
    locationId,
    email,
  };

  if (name) {
    const parts = name.trim().split(/\s+/);
    body.firstName = parts[0];
    if (parts.length > 1) body.lastName = parts.slice(1).join(' ');
  }
  if (phone) body.phone = phone;
  if (source) body.source = source;
  if (tags && tags.length > 0) body.tags = tags;

  // Map custom fields — skip fields whose ID is not yet configured (empty string or missing)
  // so that unset env-var-backed field IDs don't produce invalid `{ id: '' }` entries
  // that cause GHL to return 422 and silently fail the entire contact creation.
  if (customFields) {
    body.customFields = Object.entries(customFields)
      .filter(([_, v]) => v !== undefined && v !== null)
      .filter(([key]) => !!CUSTOM_FIELDS[key])
      .map(([key, value]) => ({
        id: CUSTOM_FIELDS[key],
        field_value: String(value),
      }));
  }

  if (contact) {
    // Update existing contact.
    // GHL v2 PUT /contacts/{id} rejects `locationId` in the body (422 Unprocessable Entity).
    // The contact ID in the URL already scopes the request to the right location.
    // Also strip `tags` here — tag merge behavior on PUT is unreliable; we add tags
    // explicitly via the dedicated /contacts/{id}/tags endpoint instead.
    const { locationId: _locationId, tags: tagsToAdd, ...updateBody } = body;
    const result = await ghlFetch(`/contacts/${contact.id}`, {
      method: 'PUT',
      body: JSON.stringify(updateBody),
    });
    if (tagsToAdd && tagsToAdd.length > 0) {
      await addTags(contact.id, tagsToAdd);
    }
    return result?.contact || contact;
  } else {
    // Create new contact
    const result = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return result?.contact || null;
  }
}

/**
 * Add tags to a contact
 */
async function addTags(contactId, tags) {
  return ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}

/**
 * Remove tags from a contact
 */
async function removeTags(contactId, tags) {
  return ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'DELETE',
    body: JSON.stringify({ tags }),
  });
}

// ── Opportunity / Pipeline Management ──

/**
 * Create an opportunity in the pipeline
 */
async function createOpportunity(contactId, { stageId, name, monetaryValue, status }) {
  const { locationId, pipelineId } = getConfig();
  return ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify({
      pipelineId,
      locationId,
      pipelineStageId: stageId,
      contactId,
      name: name || 'Alignment Engine Lead',
      status: status || 'open',
      monetaryValue: monetaryValue || 0,
    }),
  });
}

/**
 * Find opportunities for a contact
 */
async function findOpportunities(contactId) {
  const { locationId, pipelineId } = getConfig();
  const result = await ghlFetch(
    `/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&contact_id=${contactId}`,
    { method: 'GET' }
  );
  return result?.opportunities || [];
}

/**
 * Update an opportunity's stage and/or value
 */
async function updateOpportunity(opportunityId, { stageId, monetaryValue, status }) {
  const body = {};
  if (stageId) body.pipelineStageId = stageId;
  if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;
  if (status) body.status = status;

  return ghlFetch(`/opportunities/${opportunityId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ── High-Level Funnel Actions ──

/**
 * Build the list of funnel-specific tags to apply when the Align funnel fields are present.
 *
 * Returns an empty array when `result_program` is absent (legacy caller path) so that
 * backwards-compatibility is preserved.
 *
 * Valid values:
 *   result_program: 'over-preparer' | 'self-censor' | 'invisible-ceiling' | 'loop'
 *   depth_band:     'surface' | 'established' | 'deep-rooted'
 *
 * @param {{ result_program?: string, depth_band?: string }} fields
 * @returns {string[]}
 */
export function buildFunnelTags({ result_program, depth_band } = {}) {
  // Guard: only add funnel tags when the new funnel is the caller.
  if (!result_program) return [];

  const tags = ['funnel:align', `program:${result_program.toLowerCase()}`];

  if (depth_band) {
    tags.push(`depth:${depth_band.toLowerCase()}`);
  }

  return tags;
}

/**
 * Build the custom-fields object for the funnel-specific fields.
 *
 * Returns null when neither field is present so the caller can skip the update.
 *
 * @param {{ q9_fear?: string, pattern_scores?: object|string }} fields
 * @returns {object|null}
 */
export function buildFunnelCustomFields({ q9_fear, pattern_scores } = {}) {
  const fields = {};

  if (q9_fear != null) {
    fields.q9_fear = String(q9_fear);
  }

  if (pattern_scores != null) {
    fields.pattern_scores =
      typeof pattern_scores === 'string'
        ? pattern_scores
        : JSON.stringify(pattern_scores);
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Handle quiz lead: create contact, tag, create opportunity at Quiz Lead stage.
 *
 * When called from the Align funnel, the four additional fields may be present:
 *   - result_program  → adds 'funnel:align' + 'program:{result_program}' tags
 *   - depth_band      → adds 'depth:{depth_band}' tag (only when result_program is also set)
 *   - q9_fear         → stored as GHL custom field
 *   - pattern_scores  → stored as GHL custom field (JSON-stringified)
 *
 * Legacy callers (old start.sovereignty.app quiz) pass none of the four new fields;
 * their behavior is unchanged.
 */
async function handleQuizLead({ email, name, score, tier, answers, result_program, depth_band, q9_fear, pattern_scores }) {
  if (!isConfigured()) return null;

  console.log(`[GHL] Processing quiz lead: ${email}`);

  // Build base custom fields shared by all callers.
  const customFields = {
    quiz_score: score,
    quiz_archetype: tier,
    quiz_completion_date: new Date().toISOString().split('T')[0],
    lead_source: 'Quiz Funnel',
  };

  // Merge funnel-specific custom fields when present.
  const funnelCustomFields = buildFunnelCustomFields({ q9_fear, pattern_scores });
  if (funnelCustomFields) {
    Object.assign(customFields, funnelCustomFields);
  }

  const contact = await upsertContact({
    email,
    name,
    tags: ['quiz-completed', 'quiz-lead', 'email-nurture-active'],
    customFields,
    source: 'Alignment Assessment Quiz',
  });

  if (!contact) return null;

  // Add archetype-specific tag (legacy + new funnel).
  if (tier) {
    const archetypeTag = `${tier.toLowerCase()}-archetype`;
    await addTags(contact.id, [archetypeTag]);
  }

  // Add funnel-specific tags when the Align funnel is the caller.
  const funnelTags = buildFunnelTags({ result_program, depth_band });
  if (funnelTags.length > 0) {
    await addTags(contact.id, funnelTags);
  }

  // Create opportunity at Quiz Lead stage
  await createOpportunity(contact.id, {
    stageId: getConfig().stages.quiz_lead,
    name: `${name || email} — Quiz Lead`,
    monetaryValue: 0,
  });

  console.log(`[GHL] Quiz lead created: ${contact.id}`);
  return contact;
}

/**
 * Handle signup: update contact, move opportunity to Signed Up stage
 */
async function handleSignup({ email, clerkUserId, name }) {
  if (!isConfigured()) return null;

  console.log(`[GHL] Processing signup: ${email}`);

  const contact = await upsertContact({
    email,
    name,
    tags: ['signed-up', 'free-trial'],
    customFields: {
      clerk_user_id: clerkUserId,
      signup_date: new Date().toISOString().split('T')[0],
      subscription_status: 'free-trial',
    },
  });

  if (!contact) return null;

  // Remove quiz-lead tag (they've progressed)
  await removeTags(contact.id, ['quiz-lead']);

  // Find and update existing opportunity, or create new one
  const opportunities = await findOpportunities(contact.id);
  if (opportunities.length > 0) {
    await updateOpportunity(opportunities[0].id, {
      stageId: getConfig().stages.signed_up,
    });
  } else {
    await createOpportunity(contact.id, {
      stageId: getConfig().stages.signed_up,
      name: `${name || email} — Signed Up`,
      monetaryValue: 0,
    });
  }

  console.log(`[GHL] Signup processed: ${contact.id}`);
  return contact;
}

/**
 * Handle subscription: update contact, move opportunity to Subscribed stage with $19 value
 */
async function handleSubscription({ email, plan, amount }) {
  if (!isConfigured()) return null;

  console.log(`[GHL] Processing subscription: ${email}`);

  const contact = await upsertContact({
    email,
    tags: ['subscribed', 'purchased', 'alignment-engine-paid'],
    customFields: {
      subscription_plan: plan || '$19/mo',
      subscription_status: 'active',
    },
  });

  if (!contact) return null;

  // Remove free-trial tag
  await removeTags(contact.id, ['free-trial']);

  // Update opportunity
  const opportunities = await findOpportunities(contact.id);
  if (opportunities.length > 0) {
    await updateOpportunity(opportunities[0].id, {
      stageId: getConfig().stages.subscribed,
      monetaryValue: amount || 19,
    });
  } else {
    await createOpportunity(contact.id, {
      stageId: getConfig().stages.subscribed,
      name: `${email} — Subscribed`,
      monetaryValue: amount || 19,
    });
  }

  console.log(`[GHL] Subscription processed: ${contact.id}`);
  return contact;
}

/**
 * Handle churn: update contact, move opportunity to Churned stage
 */
async function handleChurn({ email }) {
  if (!isConfigured()) return null;

  console.log(`[GHL] Processing churn: ${email}`);

  const contact = await upsertContact({
    email,
    tags: ['churned'],
    customFields: {
      subscription_status: 'churned',
    },
  });

  if (!contact) return null;

  await removeTags(contact.id, ['subscribed', 'free-trial']);

  const opportunities = await findOpportunities(contact.id);
  if (opportunities.length > 0) {
    await updateOpportunity(opportunities[0].id, {
      stageId: getConfig().stages.churned,
      status: 'lost',
    });
  }

  console.log(`[GHL] Churn processed: ${contact.id}`);
  return contact;
}

/**
 * Update engagement data for a contact
 */
async function updateEngagement({ email, sessionsCompleted, lastActiveDate }) {
  if (!isConfigured()) return null;

  return upsertContact({
    email,
    customFields: {
      sessions_completed: sessionsCompleted,
      last_active_date: lastActiveDate || new Date().toISOString().split('T')[0],
    },
  });
}

// buildFunnelTags and buildFunnelCustomFields are exported inline (export function ...).
export {
  isConfigured,
  handleQuizLead,
  handleSignup,
  handleSubscription,
  handleChurn,
  updateEngagement,
  upsertContact,
  addTags,
  removeTags,
  findContactByEmail,
};
