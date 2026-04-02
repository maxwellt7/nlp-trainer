import { Router } from 'express';
import { ensureDefaultUser } from '../services/profile.js';
import { getIdentityProfile, getValueEvidence } from '../services/identity.js';

const router = Router();

// GET / — full identity profile (values, conflicts, statements, scores)
router.get('/', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const profile = getIdentityProfile(userId);
    res.json(profile);
  } catch (error) {
    console.error('Identity profile error:', error.message);
    res.status(500).json({ error: 'Failed to get identity profile' });
  }
});

// GET /values/:name/evidence — evidence for a specific value
router.get('/values/:name/evidence', (req, res) => {
  try {
    const userId = ensureDefaultUser();
    const evidence = getValueEvidence(userId, req.params.name);
    res.json({ evidence });
  } catch (error) {
    console.error('Value evidence error:', error.message);
    res.status(500).json({ error: 'Failed to get value evidence' });
  }
});

export default router;
