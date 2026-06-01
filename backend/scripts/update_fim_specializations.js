import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { createMysqlPool, isMysqlConfigured } from '../db/mysqlTopics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ABBR_MAP = {
  TCM: 'Tehnologia construcțiilor de maşini',
  IM: 'Inginerie mecanică',
  MCT: 'Mecatronică',
  AR: 'Autovehicule rutiere',
  IMCSSM: 'Ingineria şi managementul calităţii, sănătăţii şi securităţii în muncă',
  ETEM: 'Expertiză tehnică, evaluare economică şi management',
  'MEC-AC': 'Inginerie mecanică asistată de calculator'
};

function extractAbbrs(title) {
  // find all occurrences like '/IM', '/IM-TCM', 'Licență/TCM', 'Masterat/IMCSSM'
  const matches = [...(title.matchAll(/\/(\s*[A-Za-z0-9\-]+)*/g))].map(m => m[0]);
  const tokens = [];
  for (const m of matches) {
    const cleaned = m.replace('/', '').trim();
    if (!cleaned) continue;
    // split by non-alphanumeric (dash)
    const parts = cleaned.split(/[-,\/\\]+/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) tokens.push(p.toUpperCase());
  }
  return tokens;
}

function mapAbbrs(tokens) {
  const out = [];
  for (const t of tokens) {
    if (!t) continue;
    if (ABBR_MAP[t]) out.push(ABBR_MAP[t]);
    else {
      // normalize common variants
      const normalized = t.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (ABBR_MAP[normalized]) out.push(ABBR_MAP[normalized]);
      else out.push(t); // fallback to raw token
    }
  }
  return Array.from(new Set(out));
}

async function main() {
  if (!isMysqlConfigured(process.env)) {
    throw new Error('MySQL env vars missing in backend/.env');
  }
  const pool = createMysqlPool(process.env);

  const [rows] = await pool.query("SELECT id, titlu_tema, nivel_studii, specializari FROM topics WHERE facultatea = 'FIM'");

  let updated = 0;
  for (const r of rows) {
    const title = String(r.titlu_tema || '');
    const tokens = extractAbbrs(title);
    const specs = mapAbbrs(tokens);

    // build new title by removing trailing '/...' patterns and ' Licență/XYZ' occurrences
    let newTitle = title.replace(/\s*\/?\s*[A-Za-z0-9\-]+\s*$/g, '').trim();
    // also remove embedded patterns like 'Licență/TCM' or 'Masterat/IMCSSM'
    newTitle = newTitle.replace(/\b(Licență|Licenta|Masterat)\s*\/?\s*[A-Za-z0-9\-]+/gi, (m) => {
      return m.split('/')[0];
    }).trim();

    // If no specs found, keep empty array (means for all specializations)
    const specJson = JSON.stringify(specs || []);

    // Only update if different
    const existing = Array.isArray(r.specializari) ? JSON.stringify(r.specializari) : (r.specializari || '[]');
    if (existing !== specJson || (r.titlu_tema || '') !== newTitle) {
      await pool.execute('UPDATE topics SET specializari = ?, titlu_tema = ? WHERE id = ?', [specJson, newTitle || null, r.id]);
      updated += 1;
    }
  }

  console.log('Updated rows:', updated);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
