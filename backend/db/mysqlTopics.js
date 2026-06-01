import mysql from 'mysql2/promise';

export function isMysqlConfigured(env = process.env) {
  return Boolean(env.MYSQL_HOST && env.MYSQL_USER && env.MYSQL_DATABASE);
}

export function createMysqlPool(env = process.env) {
  if (!isMysqlConfigured(env)) {
    return null;
  }

  return mysql.createPool({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE,
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
