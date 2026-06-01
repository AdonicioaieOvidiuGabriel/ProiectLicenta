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
  const [rows] = await pool.query("SELECT nivel_studii, COUNT(*) AS cnt FROM topics WHERE facultatea = 'FIM' GROUP BY nivel_studii ORDER BY cnt DESC");
  console.log(rows);
  const [samples] = await pool.query("SELECT id, nivel_studii, titlu_tema, specializari FROM topics WHERE facultatea = 'FIM' LIMIT 20");
  console.log('--- SAMPLE ---');
  console.table(samples.map(r => ({ id: r.id, nivel_studii: r.nivel_studii, specializari: r.specializari, titlu_tema: r.titlu_tema }))); 
  await pool.end();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
