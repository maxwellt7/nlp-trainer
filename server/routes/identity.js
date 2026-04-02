import { Router } from 'express';
import { ensureDefaultUser } from '../services/profile.js';
import {
  getValueHierarchy, upsertValue, removeValue,
  getValueEvidence, getValueConflicts,
  calculateIdentityScore, getIdentityScoreHistory,
  getIdentityStatements, upsertIdentityStatement,
} from '../services/identity.js';

const router = Router();

// GET /api/identity — full identity profile
router.get('/', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const values = getValueHierarchy(userId);
    const conflicts = getValueConflicts(userId);
    const score = calculateIdentityScore(userId);
    const statements = getIdentityStatements(userId);

    res.json({ values, conflicts, score, statements });
  } catch (error) {
    console.error('Identity fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch identity data' });
  }
});

// GET /api/identity/score/history — score history for charts
router.get('/score/history', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const limit = parseInt(req.query.limit) || 30;
    const history = getIdentityScoreHistory(userId, limit);
    res.json({ history });
  } catch (error) {
    console.error('Score history error:', error.message);
    res.status(500).json({ error: 'Failed to fetch score history' });
  }
});

// PUT /api/identity/values — manually add/update a value
router.put('/values', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const { value_name, rank, pure_expression, distorted_expression, behavioral_commitment, source } = req.body;
    if (!value_name) return res.status(400).json({ error: 'value_name is required' });

    const valueId = upsertValue(userId, {
      value_name, rank, pure_expression, distorted_expression, behavioral_commitment,
      source: source || 'explicit', confidence: 8.0,
    });

    res.json({ id: valueId, message: 'Value updated' });
  } catch (error) {
    console.error('Value upsert error:', error.message);
    res.status(500).json({ error: 'Failed to update value' });
  }
});

// DELETE /api/identity/values/:valueId
router.delete('/values/:valueId', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    removeValue(userId, req.params.valueId);
    res.json({ message: 'Value removed' });
  } catch (error) {
    console.error('Value delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete value' });
  }
});

// GET /api/identity/values/:valueId/evidence — evidence for a specific value
router.get('/values/:valueId/evidence', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const evidence = getValueEvidence(userId, req.params.valueId);
    res.json({ evidence });
  } catch (error) {
    console.error('Evidence fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

// PUT /api/identity/statements — add/update an identity statement
router.put('/statements', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const { statement_type, content, confidence } = req.body;
    if (!statement_type || !content) return res.status(400).json({ error: 'statement_type and content are required' });

    const id = upsertIdentityStatement(userId, { statement_type, content, confidence });
    res.json({ id, message: 'Statement updated' });
  } catch (error) {
    console.error('Statement upsert error:', error.message);
    res.status(500).json({ error: 'Failed to update statement' });
  }
});

export default router;
