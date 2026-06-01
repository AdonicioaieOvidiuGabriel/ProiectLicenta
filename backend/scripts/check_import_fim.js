import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { createMysqlPool, isMysqlConfigured } from '../db/mysqlTopics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  if (!isMysqlConfigured(process.env)) {
    throw new Error('MySQL env vars missing in backend/.env');
  }
  const pool = createMysqlPool(process.env);
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM topics WHERE source_file = ?', ['Teme-Licenta-Disertatie-2023-2024b.pdf']);
  console.log(rows[0]);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
