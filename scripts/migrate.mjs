import { readFile } from 'node:fs/promises';
import { getPool } from '../lib/db.js';
const pool = getPool();
try {
  await pool.query(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  console.log('Database schema ready. Existing records preserved; new databases start empty.');
} finally { await pool.end(); }
