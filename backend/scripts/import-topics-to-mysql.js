import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { createMysqlPool, isMysqlConfigured, upsertTopics } from '../db/mysqlTopics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

async function loadTopicsFromSourceFiles() {
  const dataDir = join(__dirname, '../../src/data');
  const topicFiles = fs.readdirSync(dataDir).filter((fileName) => fileName.endsWith('Topics.js'));

  const loaded = [];
  for (const fileName of topicFiles) {
    const absoluteFile = join(dataDir, fileName);
    const moduleUrl = pathToFileURL(absoluteFile).href;
    const module = await import(moduleUrl);

    const topicArrays = Object.entries(module)
      .filter(([exportName, value]) => exportName.endsWith('Topics') && Array.isArray(value))
      .flatMap(([, value]) => value);

    loaded.push(...topicArrays);
  }

  return loaded;
}

async function main() {
  if (!isMysqlConfigured(process.env)) {
    throw new Error('MySQL env vars are missing. Set MYSQL_HOST, MYSQL_USER and MYSQL_DATABASE in backend/.env first.');
  }

  const pool = createMysqlPool(process.env);
  const topics = await loadTopicsFromSourceFiles();
  const result = await upsertTopics(pool, topics);

  console.log(`Imported ${result.inserted} topics into MySQL.`);
  await pool.end();
}

main().catch(async (error) => {
  console.error('Import failed:', error.message);
  process.exitCode = 1;
});
