import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

// ── Value Hierarchy ──

export function getValueHierarchy(userId) {
  return db.prepare('SELECT * FROM value_hierarchy WHERE user_id = ? ORDER BY rank ASC').all(userId).map(v => ({
    ...v,
    raw_items: safeJsonParse(v.raw_items, []),
  }));
}

export function upsertValue(userId, { value_name, rank, raw_items, pure_expression, distorted_expression, origin_story, behavioral_commitment, purity_score, confidence, source }) {
  // Check if value already exists for this user
  const existing = db.prepare('SELECT id FROM value_hierarchy WHERE user_id = ? AND LOWER(value_name) = LOWER(?)').get(userId, value_name);

  if (existing) {
    const updates = [];
    const params = [];
    if (rank !== undefined) { updates.push('rank = ?'); params.push(rank); }
    if (raw_items !== undefined) { updates.push('raw_items = ?'); params.push(JSON.stringify(raw_items)); }
    if (pure_expression !== undefined) { updates.push('pure_expression = ?'); params.push(pure_expression); }
    if (distorted_expression !== undefined) { updates.push('distorted_expression = ?'); params.push(distorted_expression); }
    if (origin_story !== undefined) { updates.push('origin_story = ?'); params.push(origin_story); }
    if (behavioral_commitment !== undefined) { updates.push('behavioral_commitment = ?'); params.push(behavioral_commitment); }
    if (purity_score !== undefined) { updates.push('purity_score = ?'); params.push(purity_score); }
    if (confidence !== undefined) { updates.push('confidence = ?'); params.push(confidence); }
    if (source !== undefined) { updates.push('source = ?'); params.push(source); }
    updates.push("updated_at = datetime('now')");

    if (updates.length > 0) {
      db.prepare(`UPDATE value_hierarchy SET ${updates.join(', ')} WHERE id = ?`).run(...params, existing.id);
    }
    return existing.id;
  } else {
    const id = `val-${uuid()}`;
    db.prepare(`INSERT INTO value_hierarchy (id, user_id, value_name, rank, raw_items, pure_expression, distorted_expression, origin_story, behavioral_commitment, purity_score, confidence, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, value_name, rank || 99,
      JSON.stringify(raw_items || []),
      pure_expression || '', distorted_expression || '', origin_story || '', behavioral_commitment || '',
      purity_score || 5.0, confidence || 0.1, source || 'inferred'
    );
    return id;
  }
}

export function removeValue(userId, valueId) {
  db.prepare('DELETE FROM value_hierarchy WHERE id = ? AND user_id = ?').run(valueId, userId);
}

// ── Value Evidence ──

export function addValueEvidence(userId, { value_id, session_id, evidence_type, quote, interpretation, expression }) {
  const id = `evi-${uuid()}`;
  db.prepare(`INSERT INTO value_evidence (id, user_id, value_id, session_id, evidence_type, quote, interpretation, expression)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, userId, value_id, session_id || null, evidence_type, quote || '', interpretation || '', expression || 'unknown'
  );

  // Update confidence on the value based on evidence count
  if (value_id) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM value_evidence WHERE value_id = ?').get(value_id);
    const newConfidence = Math.min(10, (count?.cnt || 1) * 0.5);
    db.prepare('UPDATE value_hierarchy SET confidence = ? WHERE id = ?').run(newConfidence, value_id);
  }

  return id;
}

export function getValueEvidence(userId, valueId) {
  return db.prepare('SELECT * FROM value_evidence WHERE user_id = ? AND value_id = ? ORDER BY created_at DESC').all(userId, valueId);
}

// ── Value Conflicts ──

export function addValueConflict(userId, { value_a_id, value_b_id, conflict_type, description }) {
  // Check for existing conflict between these two values
  const existing = db.prepare(
    'SELECT id FROM value_conflicts WHERE user_id = ? AND ((value_a_id = ? AND value_b_id = ?) OR (value_a_id = ? AND value_b_id = ?))'
  ).get(userId, value_a_id, value_b_id, value_b_id, value_a_id);

  if (existing) {
    db.prepare('UPDATE value_conflicts SET description = ?, conflict_type = ? WHERE id = ?').run(description, conflict_type, existing.id);
    return existing.id;
  }

  const id = `conf-${uuid()}`;
  db.prepare(`INSERT INTO value_conflicts (id, user_id, value_a_id, value_b_id, conflict_type, description)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, value_a_id, value_b_id, conflict_type || 'direct', description || '');
  return id;
}

export function getValueConflicts(userId) {
  return db.prepare(`
    SELECT vc.*, 
      va.value_name as value_a_name, va.rank as value_a_rank,
      vb.value_name as value_b_name, vb.rank as value_b_rank
    FROM value_conflicts vc
    LEFT JOIN value_hierarchy va ON vc.value_a_id = va.id
    LEFT JOIN value_hierarchy vb ON vc.value_b_id = vb.id
    WHERE vc.user_id = ?
    ORDER BY vc.created_at DESC
  `).all(userId);
}

// ── Identity Scoring Engine ──

export function calculateIdentityScore(userId) {
  const values = getValueHierarchy(userId);
  const conflicts = getValueConflicts(userId);
  const allEvidence = db.prepare('SELECT * FROM value_evidence WHERE user_id = ?').all(userId);
  const sessions = db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?').get(userId);
  const totalSessions = sessions?.cnt || 0;

  // 1. Value Clarity: How many values identified with reasonable confidence
  const highConfValues = values.filter(v => v.confidence >= 3);
  const valueClarityRaw = highConfValues.length >= 7 ? 10 : (highConfValues.length / 7) * 10;
  const valueClarity = Math.round(valueClarityRaw * 10) / 10;

  // 2. Value Alignment: Ratio of pure evidence to total evidence
  const pureEvidence = allEvidence.filter(e => e.expression === 'pure').length;
  const distortedEvidence = allEvidence.filter(e => e.expression === 'distorted').length;
  const totalEvidence = pureEvidence + distortedEvidence;
  const valueAlignment = totalEvidence > 0 ? Math.round((pureEvidence / totalEvidence) * 100) / 10 : 5.0;

  // 3. Hierarchy Stability: Based on how often values have been reranked (fewer changes = more stable)
  // Approximated by confidence consistency across values
  const avgConfidence = values.length > 0 ? values.reduce((s, v) => s + v.confidence, 0) / values.length : 0;
  const hierarchyStability = Math.min(10, Math.round(avgConfidence * 10) / 10);

  // 4. Purity Ratio: Average purity score across all values
  const purityRatio = values.length > 0
    ? Math.round((values.reduce((s, v) => s + v.purity_score, 0) / values.length) * 10) / 10
    : 5.0;

  // 5. Conflict Awareness: Having identified conflicts is actually good (awareness)
  const resolvedConflicts = conflicts.filter(c => c.resolved).length;
  const totalConflicts = conflicts.length;
  const conflictAwareness = totalConflicts > 0
    ? Math.round(((totalConflicts * 0.3 + resolvedConflicts * 0.7) / Math.max(totalConflicts, 3)) * 100) / 10
    : totalSessions > 5 ? 2.0 : 5.0; // Low if many sessions but no conflicts identified

  // 6. Worthiness Independence: Tracked from profile data and session patterns
  // Approximated by distorted patterns related to external validation
  const externalPatterns = allEvidence.filter(e =>
    e.evidence_type === 'worthiness_external' || e.interpretation?.toLowerCase().includes('external validation')
  ).length;
  const internalPatterns = allEvidence.filter(e =>
    e.evidence_type === 'worthiness_internal' || e.interpretation?.toLowerCase().includes('internal')
  ).length;
  const worthinessIndependence = (internalPatterns + externalPatterns) > 0
    ? Math.round((internalPatterns / (internalPatterns + externalPatterns)) * 100) / 10
    : 5.0;

  // 7. Decision Speed: Tracked from how quickly sessions resolve to clarity
  // Approximated by average session length (fewer exchanges = faster decisions)
  const decisionSpeed = totalSessions > 3 ? Math.min(10, 5 + (totalSessions * 0.2)) : 5.0;

  // 8. Congruence Score: Overall alignment composite
  const congruenceScore = Math.round(
    ((valueClarity * 0.15) + (valueAlignment * 0.2) + (hierarchyStability * 0.1) +
     (purityRatio * 0.2) + (conflictAwareness * 0.1) + (worthinessIndependence * 0.15) +
     (decisionSpeed * 0.1)) * 10
  ) / 10;

  // Overall identity score
  const overallIdentityScore = Math.round(congruenceScore * 10) / 10;

  // Save the score
  const id = `iscore-${uuid()}`;
  const dateKey = new Date().toISOString().split('T')[0];

  // Check if we already have a score for today
  const existing = db.prepare('SELECT id FROM identity_scores WHERE user_id = ? AND date_key = ?').get(userId, dateKey);
  if (existing) {
    db.prepare(`UPDATE identity_scores SET 
      value_clarity = ?, value_alignment = ?, hierarchy_stability = ?, purity_ratio = ?,
      conflict_awareness = ?, worthiness_independence = ?, decision_speed = ?,
      congruence_score = ?, overall_identity_score = ?
      WHERE id = ?`).run(
      valueClarity, valueAlignment, hierarchyStability, purityRatio,
      conflictAwareness, worthinessIndependence, decisionSpeed,
      congruenceScore, overallIdentityScore, existing.id
    );
  } else {
    db.prepare(`INSERT INTO identity_scores (id, user_id, date_key, value_clarity, value_alignment, hierarchy_stability, purity_ratio, conflict_awareness, worthiness_independence, decision_speed, congruence_score, overall_identity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, dateKey, valueClarity, valueAlignment, hierarchyStability, purityRatio,
      conflictAwareness, worthinessIndependence, decisionSpeed, congruenceScore, overallIdentityScore
    );
  }

  return {
    value_clarity: valueClarity,
    value_alignment: valueAlignment,
    hierarchy_stability: hierarchyStability,
    purity_ratio: purityRatio,
    conflict_awareness: conflictAwareness,
    worthiness_independence: worthinessIndependence,
    decision_speed: decisionSpeed,
    congruence_score: congruenceScore,
    overall_identity_score: overallIdentityScore,
    values_discovered: values.length,
    high_confidence_values: highConfValues.length,
    total_evidence: allEvidence.length,
    total_conflicts: totalConflicts,
    resolved_conflicts: resolvedConflicts,
  };
}

export function getIdentityScoreHistory(userId, limit = 30) {
  return db.prepare('SELECT * FROM identity_scores WHERE user_id = ? ORDER BY date_key DESC LIMIT ?').all(userId, limit);
}

// ── Identity Statements ──

export function upsertIdentityStatement(userId, { statement_type, content, confidence }) {
  const existing = db.prepare('SELECT id, version FROM identity_statements WHERE user_id = ? AND statement_type = ? ORDER BY version DESC LIMIT 1').get(userId, statement_type);

  const id = `stmt-${uuid()}`;
  const version = existing ? existing.version + 1 : 1;

  db.prepare(`INSERT INTO identity_statements (id, user_id, statement_type, content, confidence, version)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, statement_type, content, confidence || 0.5, version);
  return id;
}

export function getIdentityStatements(userId) {
  // Get the latest version of each statement type
  return db.prepare(`
    SELECT * FROM identity_statements WHERE user_id = ? AND id IN (
      SELECT id FROM identity_statements i2 
      WHERE i2.user_id = identity_statements.user_id AND i2.statement_type = identity_statements.statement_type
      ORDER BY version DESC LIMIT 1
    )
    ORDER BY statement_type
  `).all(userId);
}

// ── Build prompt context for the AI ──

export function buildIdentityContext(userId) {
  const values = getValueHierarchy(userId);
  const conflicts = getValueConflicts(userId);
  const statements = getIdentityStatements(userId);
  const score = calculateIdentityScore(userId);

  if (values.length === 0 && statements.length === 0) {
    return 'No value hierarchy or identity data yet. Begin passively extracting values from what the user discusses — what matters to them, what frustrates them, what excites them, what they choose and why.';
  }

  let context = '## USER IDENTITY & VALUES PROFILE\n\n';

  if (values.length > 0) {
    context += '### Value Hierarchy (discovered from conversations)\n';
    values.forEach(v => {
      context += `${v.rank}. **${v.value_name}** (confidence: ${v.confidence}/10, purity: ${v.purity_score}/10)\n`;
      if (v.pure_expression) context += `   Pure: ${v.pure_expression}\n`;
      if (v.distorted_expression) context += `   Distorted: ${v.distorted_expression}\n`;
    });
    context += '\n';
  }

  if (conflicts.length > 0) {
    context += '### Active Value Conflicts\n';
    conflicts.forEach(c => {
      context += `- ${c.value_a_name} vs ${c.value_b_name} (${c.conflict_type}): ${c.description}\n`;
    });
    context += '\n';
  }

  if (statements.length > 0) {
    context += '### Identity Statements\n';
    statements.forEach(s => {
      context += `- ${s.statement_type}: "${s.content}" (confidence: ${s.confidence})\n`;
    });
    context += '\n';
  }

  context += `### Identity Score: ${score.overall_identity_score}/10\n`;
  context += `Value Clarity: ${score.value_clarity} | Alignment: ${score.value_alignment} | Stability: ${score.hierarchy_stability} | Purity: ${score.purity_ratio}\n`;
  context += `Conflict Awareness: ${score.conflict_awareness} | Worthiness Independence: ${score.worthiness_independence}\n\n`;

  context += '### Coaching Directives Based on Identity Data\n';
  if (score.value_clarity < 4) {
    context += '- LOW VALUE CLARITY: Ask questions that surface what matters. "What felt most important about that?" "What would you lose if that went away?"\n';
  }
  if (score.value_alignment < 5) {
    context += '- LOW ALIGNMENT: User\'s behavior doesn\'t match stated values. Gently surface the gap: "You said X matters most, but it sounds like Y got the priority here. What happened?"\n';
  }
  if (score.purity_ratio < 5) {
    context += '- HIGH DISTORTION: Many values are being met through distorted vehicles. Look for external validation patterns, worthiness tax, and survival mechanisms.\n';
  }
  if (score.worthiness_independence < 5) {
    context += '- EXTERNAL WORTHINESS: User relies on external markers. Help them see the quality behind the vehicle: "What does that achievement actually prove about you?"\n';
  }

  return context;
}

// ── Process AI-detected values from chat ──

export function processValueDetections(userId, sessionId, detections) {
  if (!detections || !Array.isArray(detections)) return;

  for (const detection of detections) {
    if (!detection.value_name) continue;

    // Upsert the value
    const valueId = upsertValue(userId, {
      value_name: detection.value_name,
      rank: detection.rank,
      pure_expression: detection.pure_expression,
      distorted_expression: detection.distorted_expression,
      purity_score: detection.purity_score,
      confidence: detection.confidence,
      source: 'inferred',
    });

    // Add evidence
    if (detection.quote || detection.interpretation) {
      addValueEvidence(userId, {
        value_id: valueId,
        session_id: sessionId,
        evidence_type: detection.evidence_type || 'conversation',
        quote: detection.quote || '',
        interpretation: detection.interpretation || '',
        expression: detection.expression || 'unknown',
      });
    }

    // Add conflict if detected
    if (detection.conflicts_with) {
      const conflictValue = db.prepare('SELECT id FROM value_hierarchy WHERE user_id = ? AND LOWER(value_name) = LOWER(?)').get(userId, detection.conflicts_with);
      if (conflictValue) {
        addValueConflict(userId, {
          value_a_id: valueId,
          value_b_id: conflictValue.id,
          conflict_type: detection.conflict_type || 'direct',
          description: detection.conflict_description || '',
        });
      }
    }
  }
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
