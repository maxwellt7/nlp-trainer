import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

/**
 * GET /api/lesson-data/:filename
 * Serves lesson content JSON files from server/data/
 */
router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Sanitize filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Only allow JSON files
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Only JSON files are allowed' });
    }
    
    const filePath = join(__dirname, '..', 'data', filename);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Lesson data file not found' });
    }
    
    // Read and parse the JSON file
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    res.json(data);
  } catch (err) {
    console.error('Error serving lesson data:', err);
    res.status(500).json({ error: 'Failed to load lesson data' });
  }
});

export default router;
