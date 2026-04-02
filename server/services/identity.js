import db from '../db/index.js';
import { randomUUID } from 'crypto';

/**
 * Process value detections from the AI coaching response.
 * Upserts values, adds evidence, detects conflicts, and recalculates scores.
 */
export function processValueDetections(userId, sessionId, valueDetections) {
  if (!valueDetections || !Array.isArray(valueDetections) || valueDetections.length === 0) return;

  for (const vd of valueDetections) {
    if (!vd.value_name) continue;
    const name = vd.value_name.toLowerCase().trim();

    const existing = db.prepare('SELECT * FROM values_detected WHERE user_id = ? AND value_name = ?').get(userId, name);

    if (existing) {
      const newConfidence = Math.min(1.0, existing.confidence + (vd.confidence || 0.1) * 0.3);
      const newPurity = vd.purity_score != null
        ? (existing.purity_score * existing.evidence_count + vd.purity_score) / (existing.evidence_count + 1)
        : existing.purity_score;
      const newExpression = vd.expression || existing.expression;

      db.prepare(`
        UPDATE values_detected SET
          confidence = ?, purity_score = ?, expression = ?,
          pure_expression = COALESCE(NULLIF(?, ''), pure_expression),
          distorted_expression = COALESCE(NULLIF(?, ''), distorted_expression),
          evidence_count = evidence_count + 1,
          last_updated = datetime('now')
        WHERE user_id = ? AND value_name = ?
      `).run(
        newConfidence, newPurity, newExpression,
        vd.pure_expression || '', vd.distorted_expression || '',
        userId, name
      );
    } else {
      db.prepare(`
        INSERT INTO values_detected (id, user_id, value_name, rank, confidence, purity_score, expression, pure_expression, distorted_expression)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), userId, name,
        vd.rank || null,
        vd.confidence || 0.5,
        vd.purity_score || 5.0,
        vd.expression || 'mixed',
        vd.pure_expression || '',
        vd.distorted_expression || ''
      );
    }

    // Add evidence record
    if (vd.quote || vd.interpretation) {
      db.prepare(`
        INSERT INTO value_evidence (id, user_id, value_name, session_id, evidence_type, quote, interpretation)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), userId, name, sessionId,
        vd.evidence_type || 'conversation',
        vd.quote || '',
        vd.interpretation || ''
      );
    }

    // Process conflicts
    if (vd.conflicts_with && vd.conflict_type) {
      const conflictWith = vd.conflicts_with.toLowerCase().trim();
      const [a, b] = [name, conflictWith].sort();
      const existingConflict = db.prepare(
        'SELECT * FROM value_conflicts WHERE user_id = ? AND value_a = ? AND value_b = ?'
      ).get(userId, a, b);

      if (!existingConflict) {
        db.prepare(`
          INSERT INTO value_conflicts (id, user_id, value_a, value_b, conflict_type, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), userId, a, b, vd.conflict_type || 'direct', vd.conflict_description || '');
      }
    }
  }

  recalculateScores(userId);
}

/**
 * Process identity statements from the AI coaching response.
 */
export function processIdentityStatements(userId, sessionId, statements) {
  if (!statements || !Array.isArray(statements) || statements.length === 0) return;

  for (const stmt of statements) {
    if (!stmt.content || !stmt.statement_type) continue;

    const existing = db.prepare(
      'SELECT * FROM identity_statements WHERE user_id = ? AND content = ? AND statement_type = ?'
    ).get(userId, stmt.content, stmt.statement_type);

    if (existing) {
      const newConf = Math.min(1.0, existing.confidence + 0.1);
      db.prepare('UPDATE identity_statements SET confidence = ? WHERE id = ?').run(newConf, existing.id);
    } else {
      db.prepare(`
        INSERT INTO identity_statements (id, user_id, statement_type, content, confidence, session_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), userId, stmt.statement_type, stmt.content, stmt.confidence || 0.5, sessionId);
    }
  }
}

/**
 * Recalculate the 8-dimension identity score.
 */
function recalculateScores(userId) {
  const values = db.prepare('SELECT * FROM values_detected WHERE user_id = ? ORDER BY confidence DESC').all(userId);
  const conflicts = db.prepare('SELECT * FROM value_conflicts WHERE user_id = ? AND resolved = 0').all(userId);
  const statements = db.prepare('SELECT * FROM identity_statements WHERE user_id = ? AND active = 1').all(userId);

  if (values.length === 0) return;

  const highConfValues = values.filter(v => v.confidence >= 0.6).length;
  const valueClarity = Math.min(10, (highConfValues / 5) * 10);

  const avgConfidence = values.reduce((sum, v) => sum + v.confidence, 0) / values.length;
  const valueAlignment = avgConfidence * 10;

  const rankedValues = values.filter(v => v.rank != null).length;
  const hierarchyStability = values.length > 0 ? (rankedValues / values.length) * 10 : 0;

  const avgPurity = values.reduce((sum, v) => sum + v.purity_score, 0) / values.length;
  const purityRatio = avgPurity;

  const conflictAwareness = Math.min(10, conflicts.length * 2.5);

  const empowering = statements.filter(s => s.statement_type === 'empowering_belief' || s.statement_type === 'core_identity').length;
  const limiting = statements.filter(s => s.statement_type === 'limiting_belief' || s.statement_type === 'worthiness_pattern').length;
  const total = empowering + limiting;
  const worthinessIndependence = total > 0 ? (empowering / total) * 10 : 5;

  const clearValues = values.filter(v => v.confidence >= 0.7 && v.expression === 'pure').length;
  const decisionSpeed = Math.min(10, (clearValues / 3) * 10);

  const overallCongruence = (
    valueClarity * 0.15 + valueAlignment * 0.15 + hierarchyStability * 0.1 +
    purityRatio * 0.2 + conflictAwareness * 0.1 + worthinessIndependence * 0.15 +
    decisionSpeed * 0.15
  );

  const existing = db.prepare('SELECT * FROM identity_scores WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`
      UPDATE identity_scores SET
        value_clarity = ?, value_alignment = ?, hierarchy_stability = ?,
        purity_ratio = ?, conflict_awareness = ?, worthiness_independence = ?,
        decision_speed = ?, overall_congruence = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(valueClarity, valueAlignment, hierarchyStability, purityRatio, conflictAwareness, worthinessIndependence, decisionSpeed, overallCongruence, userId);
  } else {
    db.prepare(`
      INSERT INTO identity_scores (user_id, value_clarity, value_alignment, hierarchy_stability,
        purity_ratio, conflict_awareness, worthiness_independence, decision_speed, overall_congruence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, valueClarity, valueAlignment, hierarchyStability, purityRatio, conflictAwareness, worthinessIndependence, decisionSpeed, overallCongruence);
  }
}

/**
 * Get the full identity profile for a user.
 */
export function getIdentityProfile(userId) {
  const values = db.prepare('SELECT * FROM values_detected WHERE user_id = ? ORDER BY confidence DESC').all(userId);
  const conflicts = db.prepare('SELECT * FROM value_conflicts WHERE user_id = ? AND resolved = 0').all(userId);
  const statements = db.prepare('SELECT * FROM identity_statements WHERE user_id = ? AND active = 1 ORDER BY confidence DESC').all(userId);
  const scores = db.prepare('SELECT * FROM identity_scores WHERE user_id = ?').get(userId);

  return {
    values,
    conflicts,
    statements,
    scores: scores || {
      value_clarity: 0, value_alignment: 0, hierarchy_stability: 0,
      purity_ratio: 0, conflict_awareness: 0, worthiness_independence: 0,
      decision_speed: 0, overall_congruence: 0,
    },
  };
}

/**
 * Get value evidence for a specific value.
 */
export function getValueEvidence(userId, valueName) {
  return db.prepare(
    'SELECT * FROM value_evidence WHERE user_id = ? AND value_name = ? ORDER BY detected_at DESC LIMIT 20'
  ).all(userId, valueName.toLowerCase().trim());
}

/**
 * Build identity context string for prompt injection.
 */
export function buildIdentityContext(userId) {
  const profile = getIdentityProfile(userId);
  if (profile.values.length === 0) return 'No identity data yet — this is a new user. Listen for values, beliefs, and identity statements.';

  let ctx = '### Detected Values (ranked by confidence):\n';
  for (const v of profile.values.slice(0, 10)) {
    ctx += `- ${v.value_name}: confidence=${v.confidence.toFixed(2)}, purity=${v.purity_score.toFixed(1)}/10, expression=${v.expression}`;
    if (v.pure_expression) ctx += ` | Pure: "${v.pure_expression}"`;
    if (v.distorted_expression) ctx += ` | Distorted: "${v.distorted_expression}"`;
    ctx += '\n';
  }

  if (profile.conflicts.length > 0) {
    ctx += '\n### Active Value Conflicts:\n';
    for (const c of profile.conflicts) {
      ctx += `- ${c.value_a} vs ${c.value_b} (${c.conflict_type}): ${c.description}\n`;
    }
  }

  if (profile.statements.length > 0) {
    ctx += '\n### Identity Statements:\n';
    for (const s of profile.statements.slice(0, 10)) {
      ctx += `- [${s.statement_type}] "${s.content}" (confidence: ${s.confidence.toFixed(2)})\n`;
    }
  }

  const sc = profile.scores;
  ctx += `\n### Identity Scores:\n`;
  ctx += `Value Clarity: ${sc.value_clarity.toFixed(1)}/10 | Alignment: ${sc.value_alignment.toFixed(1)}/10 | `;
  ctx += `Purity: ${sc.purity_ratio.toFixed(1)}/10 | Congruence: ${sc.overall_congruence.toFixed(1)}/10\n`;

  return ctx;
}
