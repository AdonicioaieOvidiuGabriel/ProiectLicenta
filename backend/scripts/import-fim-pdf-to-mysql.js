import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createMysqlPool, isMysqlConfigured, upsertTopics } from '../db/mysqlTopics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const LINES_PATH = '/tmp/fim_pdf_lines.txt';
const SOURCE_FILE = 'Teme-Licenta-Disertatie-2023-2024b.pdf';

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
  // Capture tokens like '/IM', '/IM-TCM' or 'Licență/TCM' or 'Masterat/IMCSSM'
  const tokens = [];
  // find trailing /... groups
  const slashMatches = [...title.matchAll(/\/(\s*[A-Za-z0-9\-]+(?:[-,\/\\][A-Za-z0-9\-]+)*)/g)];
  for (const m of slashMatches) {
    const cleaned = (m[1] || '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split(/[-,\/\\]+/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) tokens.push(p.toUpperCase());
  }

  // also capture patterns like 'Licență/TCM' or 'Masterat/IMCSSM'
  const levelMatches = [...title.matchAll(/(?:Licență|Licenta|Masterat)\s*\/?\s*([A-Za-z0-9\-]+)/gi)];
  for (const m of levelMatches) tokens.push((m[1] || '').toUpperCase());

  return Array.from(new Set(tokens.filter(Boolean)));
}

function mapAbbrs(tokens) {
  const out = [];
  for (const t of tokens) {
    if (!t) continue;
    // split compound tokens like 'IM-TCM' into parts
    if (/[\-_,\\\/]/.test(t)) {
      const parts = t.split(/[-_,\\\/]+/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        const up = p.toUpperCase();
        if (ABBR_MAP[up]) out.push(ABBR_MAP[up]);
        else {
          const norm = up.replace(/[^A-Z0-9]/g, '');
          if (ABBR_MAP[norm]) out.push(ABBR_MAP[norm]);
          else out.push(up);
        }
      }
      continue;
    }

    if (ABBR_MAP[t]) out.push(ABBR_MAP[t]);
    else {
      const normalized = t.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (ABBR_MAP[normalized]) out.push(ABBR_MAP[normalized]);
      else out.push(t);
    }
  }
  return Array.from(new Set(out));
}

function readLines() {
  if (!fs.existsSync(LINES_PATH)) {
    throw new Error(`${LINES_PATH} not found — run the PDF extraction step first`);
  }
  return fs
    .readFileSync(LINES_PATH, { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.replace(/^={2,}\s*PAGE.*$|^\d{1,3}:\s*/i, '').trim())
    .filter(Boolean);
}

function parse(lines) {
  const HEAD_RE = /^(?:\d+)\.\s+(Prof|Conf|Șef|Asist)\b/i;
  const PROF_RE = /^(?:\d+)\.\s+(.*)$/; // header lines like "1. Prof... NAME"
  const TOPIC_RE = /^(\d+)\.\s*(.*)$/;
  const LEVEL_RE = /(Licența|Licență|Licențã|Licenț|Licența\/[^\s,]+|Masterat|Masterat\/[^\s,]+|Licență\/[^\s,]+)/i;

  const topics = [];
  let currentProfessor = null;
  let profIndex = 0;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // detect professor header
    if (HEAD_RE.test(line) && PROF_RE.test(line)) {
      const m = PROF_RE.exec(line);
      currentProfessor = m[1].trim();
      profIndex += 1;
      continue;
    }

    // detect numbered topic
    const t = TOPIC_RE.exec(line);
    if (t && currentProfessor) {
      const num = Number(t[1]);
      let rest = t[2].trim();
      // preserve original rest for extracting abbreviations (may contain 'Licență/TCM')
      const originalRest = rest;

      // extract specialization tokens from the original title (e.g. '/IM', '/IM-TCM', 'Licență/TCM')
      const abbrs = extractAbbrs(originalRest);
      const specs = mapAbbrs(abbrs);

      // try to extract level at the end
      let level = '';
      const lv = LEVEL_RE.exec(rest);
      if (lv) {
        level = lv[0].replace(/\s+/g, ' ').trim();
        // remove level token from title
        rest = rest.replace(lv[0], '').trim();
      }

      // remove trailing /... tokens from title
      rest = rest.replace(/\s*\/?\s*[A-Za-z0-9\-]+(?:[-,\/\\][A-Za-z0-9\-]+)*\s*$/g, '').trim();
      // also remove embedded 'Licență/XYZ' or 'Masterat/XYZ' markers but keep the level word
      rest = rest.replace(/\b(Licență|Licenta|Masterat)\s*\/?\s*[A-Za-z0-9\-]+/gi, (m) => {
        return m.split('/')[0];
      }).trim();

      const id = `FIM-${String(profIndex).padStart(3,'0')}-${String(num).padStart(3,'0')}`;
      topics.push({
        id,
        facultatea: 'FIM',
        profesor: currentProfessor,
        nivel_studii: level || 'Licență',
        specializari: specs || [],
        titlu_tema: rest || '',
        descriere: null,
        sursa: SOURCE_FILE
      });
      continue;
    }

    // fallback: some titles are split on multiple lines — attach to last topic if present
    if (topics.length > 0) {
      const last = topics[topics.length - 1];
      // append continuation to title
      last.titlu_tema = (last.titlu_tema + ' ' + line).replace(/\s+/g, ' ').trim();
    }
  }

  // Post-process topics to catch specialization tokens that were on continuation lines
  for (const top of topics) {
    const combined = String(top.titlu_tema || '');
    const extraAbbrs = extractAbbrs(combined);
    const extraSpecs = mapAbbrs(extraAbbrs);
    // merge with existing
    const merged = Array.from(new Set([...(top.specializari || []), ...extraSpecs]));

    // clean title from any trailing tokens like '/IM' or 'Masterat/IMCSSM'
    let cleaned = combined.replace(/\s*\/?\s*[A-Za-z0-9\-]+(?:[-,\/\\][A-Za-z0-9\-]+)*\s*$/g, '').trim();
    cleaned = cleaned.replace(/\b(Licență|Licenta|Masterat)\s*\/?\s*[A-Za-z0-9\-]+/gi, (m) => m.split('/')[0]).trim();

    top.specializari = merged;
    top.titlu_tema = cleaned || top.titlu_tema;
  }

  return topics;
}

async function main() {
  if (!isMysqlConfigured(process.env)) {
    throw new Error('MySQL env vars are missing. Set MYSQL_HOST, MYSQL_USER and MYSQL_DATABASE in backend/.env first.');
  }

  const lines = readLines();
  const topics = parse(lines);
  console.log('Parsed topics count:', topics.length);

  const pool = createMysqlPool(process.env);
  const result = await upsertTopics(pool, topics.map(t => ({
    id: t.id,
    facultatea: t.facultatea,
    profesor: t.profesor,
    nivel_studii: t.nivel_studii,
    specializari: t.specializari,
    titlu_tema: t.titlu_tema,
    descriere: t.descriere,
    sursa: t.sursa
  })));

  console.log(`Imported ${result.inserted} FIM topics into MySQL.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Import failed:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
