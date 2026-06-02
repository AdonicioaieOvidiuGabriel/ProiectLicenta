import mysql from 'mysql2/promise';

function pickEnv(env, ...keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function isMysqlConfigured(env = process.env) {
  return Boolean(
    pickEnv(env, 'MYSQL_HOST', 'DB_HOST')
      && pickEnv(env, 'MYSQL_USER', 'DB_USER')
      && pickEnv(env, 'MYSQL_DATABASE', 'DB_NAME')
  );
}

export function createMysqlPool(env = process.env) {
  if (!isMysqlConfigured(env)) {
    return null;
  }

  const host = String(pickEnv(env, 'MYSQL_HOST', 'DB_HOST') || '').trim();
  const isAzureMysqlHost = host.includes('.mysql.database.azure.com');
  const useSsl = parseBoolean(pickEnv(env, 'MYSQL_SSL', 'DB_SSL'), isAzureMysqlHost);
  const rejectUnauthorized = parseBoolean(
    pickEnv(env, 'MYSQL_SSL_REJECT_UNAUTHORIZED', 'DB_SSL_REJECT_UNAUTHORIZED'),
    true
  );

  return mysql.createPool({
    host,
    port: Number(pickEnv(env, 'MYSQL_PORT', 'DB_PORT') || 3306),
    user: pickEnv(env, 'MYSQL_USER', 'DB_USER'),
    password: pickEnv(env, 'MYSQL_PASSWORD', 'DB_PASSWORD') || '',
    database: pickEnv(env, 'MYSQL_DATABASE', 'DB_NAME'),
    ssl: useSsl ? { rejectUnauthorized } : undefined,
    waitForConnections: true,
    connectionLimit: Number(env.MYSQL_CONNECTION_LIMIT || 10),
    namedPlaceholders: true,
    charset: env.MYSQL_CHARSET || 'utf8mb4'
  });
}

function parseSpecializations(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (value && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function normalizeTopicRow(row) {
  return {
    id: String(row.id || '').trim(),
    facultatea: String(row.facultatea || row.faculty || '').trim(),
    profesor: String(row.profesor || row.professor || '').trim(),
    nivel_studii: String(row.nivel_studii || row.study_level || '').trim(),
    specializari: parseSpecializations(row.specializari ?? row.specializations_json ?? row.specializations),
    titlu_tema: String(row.titlu_tema || row.title || '').trim(),
    descriere: String(row.descriere || row.description || '').trim(),
    sursa: String(row.sursa || row.source_file || '').trim(),
    creatorAccountId: row.creator_account_id ? Number(row.creator_account_id) : null,
    creatorEmail: row.creator_email ? String(row.creator_email).trim() : null
  };
}

export async function fetchTopicsFromMysql(pool) {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, facultatea, profesor, nivel_studii, specializari, titlu_tema, descriere, source_file, creator_account_id, creator_email
     FROM topics
     ORDER BY facultatea, profesor, nivel_studii, titlu_tema`
  );

  return rows.map(normalizeTopicRow).filter((topic) => topic.id && topic.facultatea && topic.profesor && topic.nivel_studii && topic.titlu_tema);
}

export async function upsertTopics(pool, topics) {
  if (!pool) {
    throw new Error('MySQL pool is not configured');
  }

  const normalizedTopics = Array.isArray(topics)
    ? topics.map(normalizeTopicRow).filter((topic) => topic.id && topic.facultatea && topic.profesor && topic.nivel_studii && topic.titlu_tema)
    : [];

  if (normalizedTopics.length === 0) {
    return { inserted: 0 };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const topic of normalizedTopics) {
      await connection.execute(
        `INSERT INTO topics (id, facultatea, profesor, nivel_studii, specializari, titlu_tema, descriere, source_file)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           facultatea = VALUES(facultatea),
           profesor = VALUES(profesor),
           nivel_studii = VALUES(nivel_studii),
           specializari = VALUES(specializari),
           titlu_tema = VALUES(titlu_tema),
           descriere = VALUES(descriere),
           source_file = VALUES(source_file)`,
        [
          topic.id,
          topic.facultatea,
          topic.profesor,
          topic.nivel_studii,
          JSON.stringify(topic.specializari || []),
          topic.titlu_tema,
          topic.descriere || null,
          topic.sursa || null
        ]
      );
    }

    await connection.commit();
    return { inserted: normalizedTopics.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
