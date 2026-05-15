/**
 * GoHighLevel API Service
 * Handles contact creation, tag management, opportunity tracking,
 * and pipeline stage updates for the Alignment Engine funnel.
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Config — loaded from env vars (set in Railway)
const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '5aJWX4BRf7medN5RImNo';

// Pipeline & Stage IDs
const PIPELINE_ID = process.env.GHL_PIPELINE_ID || '1qqZSQ7AlOLthuqlbPX9';
const STAGES = {
  quiz_lead: process.env.GHL_STAGE_QUIZ_LEAD || 'bd784975-1a3d-43b8-a10f-d8fd6e1f893f',
  signed_up: process.env.GHL_STAGE_SIGNED_UP || '5f36d393-1641-47f0-9936-2b042a158878',
  subscribed: process.env.GHL_STAGE_SUBSCRIBED || 'bdb19dd0-2609-4de3-a1e5-471c603cfa56',
  churned: process.env.GHL_STAGE_CHURNED || 'ed85b2f0-a1bd-4eba-897e-b10ba0d60136',
};

// Custom field IDs
const CUSTOM_FIELDS = {
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

function isConfigured() {
  return !!GHL_API_KEY;
}

async function ghlFetch(endpoint, options = {}) {
  if (!isConfigured()) {
    console.log('[GHL] Skipping — no API key configured');
    return null;
  }

  const url = `${GHL_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${GHL_API_KEY}`,
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
  const result = await ghlFetch(
    `/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(email)}`,
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

  // Check if contact exists
  let contact = await findContactByEmail(email);

  const body = {
    locationId: GHL_LOCATION_ID,
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

  // Map custom fields
  if (customFields) {
    body.customFields = Object.entries(customFields)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([key, value]) => ({
        id: CUSTOM_FIELDS[key],
        field_value: String(value),
      }));
  }

  if (contact) {
    // Update existing contact
    const result = await ghlFetch(`/contacts/${contact.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
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
  return ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify({
      pipelineId: PIPELINE_ID,
      locationId: GHL_LOCATION_ID,
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
  const result = await ghlFetch(
    `/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${PIPELINE_ID}&contact_id=${contactId}`,
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
 * Handle quiz lead: create contact, tag, create opportunity at Quiz Lead stage
 */
async function handleQuizLead({ email, name, score, tier, answers }) {
  if (!isConfigured()) return null;

  console.log(`[GHL] Processing quiz lead: ${email}`);

  const contact = await upsertContact({
    email,
    name,
    tags: ['quiz-completed', 'quiz-lead', 'email-nurture-active'],
    customFields: {
      quiz_score: score,
      quiz_archetype: tier,
      quiz_completion_date: new Date().toISOString().split('T')[0],
      lead_source: 'Quiz Funnel',
    },
    source: 'Alignment Assessment Quiz',
  });

  if (!contact) return null;

  // Add archetype-specific tag
  if (tier) {
    const archetypeTag = `${tier.toLowerCase()}-archetype`;
    await addTags(contact.id, [archetypeTag]);
  }

  // Create opportunity at Quiz Lead stage
  await createOpportunity(contact.id, {
    stageId: STAGES.quiz_lead,
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
      stageId: STAGES.signed_up,
    });
  } else {
    await createOpportunity(contact.id, {
      stageId: STAGES.signed_up,
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
    tags: ['subscribed'],
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
      stageId: STAGES.subscribed,
      monetaryValue: amount || 19,
    });
  } else {
    await createOpportunity(contact.id, {
      stageId: STAGES.subscribed,
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
      stageId: STAGES.churned,
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
