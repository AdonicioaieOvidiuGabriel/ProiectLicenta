import crypto from 'crypto';
import { createMysqlPool } from './mysqlTopics.js';

const PASSWORD_HASH_ALGORITHM = 'scrypt';

export function normalizeAccountRow(row) {
  return {
    id: Number(row.id),
    account_code: String(row.account_code || '').trim(),
    role: String(row.role || '').trim(),
    full_name: String(row.full_name || '').trim(),
    email: String(row.email || '').trim(),
    password_hash: String(row.password_hash || '').trim(),
    faculty: row.faculty ? String(row.faculty).trim() : null,
    specialization: row.specialization ? String(row.specialization).trim() : null,
    study_level: row.study_level ? String(row.study_level).trim() : null,
    employee_title: row.employee_title ? String(row.employee_title).trim() : null,
    is_active: Boolean(row.is_active),
    approval_status: String(row.approval_status || 'approved').trim() || 'approved',
    approval_reviewed_at: row.approval_reviewed_at || null,
    email_verified_at: row.email_verified_at || null,
    email_verification_pin_hash: row.email_verification_pin_hash || null,
    email_verification_expires_at: row.email_verification_expires_at || null,
    email_verification_sent_at: row.email_verification_sent_at || null,
    password_reset_token_hash: row.password_reset_token_hash || null,
    password_reset_expires_at: row.password_reset_expires_at || null,
    password_reset_sent_at: row.password_reset_sent_at || null,
    last_login_at: row.last_login_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

export function formatAccountForClient(account) {
  if (!account) {
    return null;
  }

  return {
    id: Number(account.id),
    accountCode: String(account.account_code || '').trim(),
    role: String(account.role || '').trim(),
    fullName: String(account.full_name || '').trim(),
    email: String(account.email || '').trim(),
    faculty: account.faculty ? String(account.faculty).trim() : null,
    specialization: account.specialization ? String(account.specialization).trim() : null,
    studyLevel: account.study_level ? String(account.study_level).trim() : null,
    employeeTitle: account.employee_title ? String(account.employee_title).trim() : null,
    isActive: Boolean(account.is_active),
    approvalStatus: String(account.approval_status || 'approved').trim() || 'approved',
    approvalReviewedAt: account.approval_reviewed_at || null,
    emailVerifiedAt: account.email_verified_at || null,
    mustChangePassword: Boolean(account.must_change_password),
    lastLoginAt: account.last_login_at || null,
    createdAt: account.created_at || null,
    updatedAt: account.updated_at || null
  };
}

export function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return [PASSWORD_HASH_ALGORITHM, salt, derivedKey].join('$');
}

export function verifyPasswordHash(password, passwordHash) {
  const [algorithm, salt, expectedKey] = String(passwordHash || '').split('$');

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !expectedKey) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedKey, 'hex');
  const derivedBuffer = Buffer.from(crypto.scryptSync(String(password || ''), salt, expectedBuffer.length));

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

export async function fetchAccounts(pool) {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, account_code, role, full_name, email, password_hash, faculty, specialization, study_level, employee_title, is_active, approval_status, approval_reviewed_at, email_verified_at, email_verification_pin_hash, email_verification_expires_at, email_verification_sent_at, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, last_login_at, created_at, updated_at
      FROM accounts
     ORDER BY role, full_name, account_code`
  );

  return rows.map(normalizeAccountRow);
}

export async function fetchAccountByEmail(pool, email) {
  if (!pool || !email) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, account_code, role, full_name, email, password_hash, faculty, specialization, study_level, employee_title, is_active, approval_status, approval_reviewed_at, email_verified_at, email_verification_pin_hash, email_verification_expires_at, email_verification_sent_at, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, last_login_at, created_at, updated_at
     FROM accounts
     WHERE email = ?
     LIMIT 1`,
    [String(email).trim()]
  );

  return rows.length > 0 ? normalizeAccountRow(rows[0]) : null;
}

export async function fetchAccountByCode(pool, accountCode) {
  if (!pool || !accountCode) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, account_code, role, full_name, email, password_hash, faculty, specialization, study_level, employee_title, is_active, approval_status, approval_reviewed_at, email_verified_at, email_verification_pin_hash, email_verification_expires_at, email_verification_sent_at, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, last_login_at, created_at, updated_at
     FROM accounts
     WHERE account_code = ?
     LIMIT 1`,
    [String(accountCode).trim()]
  );

  return rows.length > 0 ? normalizeAccountRow(rows[0]) : null;
}

export async function fetchAccountById(pool, accountId) {
  if (!pool || !accountId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, account_code, role, full_name, email, password_hash, faculty, specialization, study_level, employee_title, is_active, approval_status, approval_reviewed_at, email_verified_at, email_verification_pin_hash, email_verification_expires_at, email_verification_sent_at, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, must_change_password, last_login_at, created_at, updated_at
     FROM accounts
     WHERE id = ?
     LIMIT 1`,
    [Number(accountId)]
  );

  return rows.length > 0 ? normalizeAccountRow(rows[0]) : null;
}

export async function updateLastLogin(pool, accountId) {
  if (!pool || !accountId) {
    return { affectedRows: 0 };
  }

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(
      'UPDATE accounts SET last_login_at = NOW() WHERE id = ?',
      [Number(accountId)]
    );
    return result;
  } finally {
    connection.release();
  }
}

export { createMysqlPool };
