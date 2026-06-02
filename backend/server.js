import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from '@google/generative-ai';
import { AzureOpenAI } from 'openai';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createMysqlPool, fetchTopicsFromMysql, isMysqlConfigured, upsertTopics } from './db/mysqlTopics.js';
import { createPasswordHash, fetchAccountByCode, fetchAccountByEmail, fetchAccountById, fetchAccounts, formatAccountForClient, updateLastLogin, verifyPasswordHash } from './db/mysqlAccounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDistPath = join(__dirname, '..', 'dist');
const allowedCorsOrigins = String(process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

function createAccountsPool() {
  if (!isMysqlConfigured(process.env)) {
    return null;
  }

  return createMysqlPool(process.env);
}

function buildAccountCode(role) {
  const prefix = role === 'professor' ? 'PRF' : role === 'admin' ? 'ADM' : 'STU';
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

function buildTopicId(faculty) {
  const prefix = String(faculty || 'TOP')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'TOP';

  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

function generateVerificationPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function createPinHash(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(pin || ''), salt, 64).toString('hex');
  return ['pin', salt, derivedKey].join('$');
}

function verifyPinHash(pin, pinHash) {
  const [algorithm, salt, expectedKey] = String(pinHash || '').split('$');

  if (algorithm !== 'pin' || !salt || !expectedKey) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedKey, 'hex');
  const derivedBuffer = Buffer.from(crypto.scryptSync(String(pin || ''), salt, expectedBuffer.length));

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

async function buildEmailTransporter() {
  const sendgridKey = process.env.SENDGRID_API_KEY && String(process.env.SENDGRID_API_KEY).trim();
  const smtpHostConfigured = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS;
  const useEmailTestMode = String(process.env.EMAIL_TEST_MODE || '').toLowerCase() === 'true';

  if (useEmailTestMode) {
    const testAccount = await nodemailer.createTestAccount();
    return {
      transportMode: 'ethereal',
      transporter: nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      })
    };
  }

  if (!sendgridKey && !smtpHostConfigured) {
    throw new Error('Email delivery not configured');
  }

  if (sendgridKey) {
    return {
      transportMode: 'sendgrid',
      transporter: nodemailer.createTransport({
        host: process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net',
        port: Number(process.env.SENDGRID_SMTP_PORT || 587),
        secure: String(process.env.SENDGRID_SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
          user: process.env.SENDGRID_SMTP_USER || 'apikey',
          pass: sendgridKey
        }
      })
    };
  }

  if (smtpHostConfigured) {
    return {
      transportMode: 'smtp',
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
    };
  }

  const testAccount = await nodemailer.createTestAccount();
  return {
    transportMode: 'ethereal',
    transporter: nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    })
  };
}

async function sendConfiguredEmail({ to, subject, text, html, replyTo }) {
  const { transporter, transportMode } = await buildEmailTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SENDGRID_FROM || process.env.SMTP_USER || replyTo;
  const info = await transporter.sendMail({
    from: `"LicentaConnect" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
    replyTo
  });

  return {
    transportMode,
    info,
    previewUrl: transportMode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null,
    fromAddress
  };
}

function buildVerificationEmail(fullName, pin) {
  const safeName = String(fullName || '').trim() || 'utilizator';
  return {
    subject: 'Codul tău de verificare LicentaConnect',
    text: `Salut, ${safeName}!\n\nCodul tău de verificare este: ${pin}\n\nCodul expiră în 15 minute.`,
    html: `<p>Salut, ${safeName}!</p><p>Codul tău de verificare este: <strong>${pin}</strong></p><p>Codul expiră în 15 minute.</p>`
  };
}

function buildProfessorApprovalEmail(fullName, isApproved) {
  const safeName = String(fullName || '').trim() || 'utilizator';
  if (isApproved) {
    return {
      subject: 'Contul tău de profesor a fost aprobat',
      text: `Salut, ${safeName}!\n\nContul tău de profesor a fost aprobat. Te poți autentifica acum în LicentaConnect.`,
      html: `<p>Salut, ${safeName}!</p><p>Contul tău de profesor a fost aprobat. Te poți autentifica acum în LicentaConnect.</p>`
    };
  }

  return {
    subject: 'Cererea ta de profesor a fost respinsă',
    text: `Salut, ${safeName}!\n\nCererea ta de creare a contului de profesor a fost respinsă. Dacă este cazul, poți încerca din nou sau poți contacta administratorul.`,
    html: `<p>Salut, ${safeName}!</p><p>Cererea ta de creare a contului de profesor a fost respinsă. Dacă este cazul, poți încerca din nou sau poți contacta administratorul.</p>`
  };
}

function buildPasswordResetEmail(fullName, resetLink) {
  const safeName = String(fullName || '').trim() || 'utilizator';
  return {
    subject: 'Resetare parolă LicentaConnect',
    text: `Salut, ${safeName}!

Am primit o solicitare de resetare a parolei. Poți reseta parola apăsând pe link-ul următor:
${resetLink}

Dacă nu ai solicitat această acțiune, ignoră acest email. Link-ul este valabil 1 oră.`,
    html: `<p>Salut, ${safeName}!</p><p>Am primit o solicitare de resetare a parolei. Poți reseta parola apăsând pe link-ul următor:</p><p><a href="${resetLink}">Resetează parola</a></p><p>Dacă nu ai solicitat această acțiune, ignoră acest email. Link-ul este valabil 1 oră.</p>`
  };
}

function normalizeStoredEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeParseJson(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function safeStringifyJson(value) {
  return JSON.stringify(value ?? null);
}

async function ensureStudentActivitySchema() {
  if (!isMysqlConfigured(process.env)) {
    return;
  }

  await withAccountsPool(async (pool) => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS student_quiz_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        account_id BIGINT UNSIGNED NULL,
        account_email VARCHAR(255) NOT NULL,
        student_name VARCHAR(255) NULL,
        recommendation_session_id VARCHAR(64) NOT NULL,
        form_data_json LONGTEXT NOT NULL,
        recommendations_json LONGTEXT NOT NULL,
        ai_response_json LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_recommendation_session_id (recommendation_session_id),
        KEY idx_student_quiz_sessions_account_email (account_email),
        KEY idx_student_quiz_sessions_account_id (account_id),
        KEY idx_student_quiz_sessions_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sent_emails (
        id VARCHAR(36) NOT NULL,
        account_id BIGINT UNSIGNED NULL,
        account_email VARCHAR(255) NOT NULL,
        recommendation_session_id VARCHAR(64) NULL,
        student_name VARCHAR(255) NULL,
        profesor_email VARCHAR(255) NOT NULL,
        topic_json LONGTEXT NOT NULL,
        student_profile_json LONGTEXT NULL,
        email_text LONGTEXT NOT NULL,
        sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(32) NOT NULL DEFAULT 'sent',
        responses_json LONGTEXT NULL,
        preview_url TEXT NULL,
        transport_mode VARCHAR(32) NULL,
        delivered_to VARCHAR(255) NULL,
        PRIMARY KEY (id),
        KEY idx_sent_emails_account_email (account_email),
        KEY idx_sent_emails_account_id (account_id),
        KEY idx_sent_emails_recommendation_session_id (recommendation_session_id),
        KEY idx_sent_emails_sent_at (sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  });
}

async function saveQuizSessionRecord(pool, { accountId = null, accountEmail, studentName = null, recommendationSessionId, formData, recommendations, aiResponse }) {
  if (!pool || !accountEmail || !recommendationSessionId) {
    return null;
  }

  const payload = [
    accountId || null,
    normalizeStoredEmail(accountEmail),
    studentName ? String(studentName).trim() : null,
    String(recommendationSessionId).trim(),
    safeStringifyJson(formData || {}),
    safeStringifyJson(Array.isArray(recommendations) ? recommendations : []),
    safeStringifyJson(aiResponse ?? null)
  ];

  await pool.execute(
    `INSERT INTO student_quiz_sessions (
      account_id,
      account_email,
      student_name,
      recommendation_session_id,
      form_data_json,
      recommendations_json,
      ai_response_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      account_id = VALUES(account_id),
      account_email = VALUES(account_email),
      student_name = VALUES(student_name),
      form_data_json = VALUES(form_data_json),
      recommendations_json = VALUES(recommendations_json),
      ai_response_json = VALUES(ai_response_json),
      updated_at = CURRENT_TIMESTAMP`,
    payload
  );

  return true;
}

async function fetchQuizSessionsForEmail(pool, accountEmail) {
  if (!pool || !accountEmail) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, account_id, account_email, student_name, recommendation_session_id, form_data_json, recommendations_json, ai_response_json, created_at, updated_at
       FROM student_quiz_sessions
      WHERE account_email = ?
      ORDER BY created_at DESC, id DESC`,
    [normalizeStoredEmail(accountEmail)]
  );

  return rows.map((row) => ({
    id: String(row.id),
    accountId: row.account_id ? Number(row.account_id) : null,
    accountEmail: normalizeStoredEmail(row.account_email),
    studentName: row.student_name ? String(row.student_name).trim() : '',
    recommendationSessionId: String(row.recommendation_session_id || '').trim(),
    formData: safeParseJson(row.form_data_json, {}),
    recommendations: Array.isArray(safeParseJson(row.recommendations_json, [])) ? safeParseJson(row.recommendations_json, []) : [],
    aiResponse: safeParseJson(row.ai_response_json, null),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  }));
}

async function saveSentEmailRecord(pool, emailRecord) {
  if (!pool || !emailRecord?.id || !emailRecord?.studentEmail) {
    return null;
  }

  await pool.execute(
    `INSERT INTO sent_emails (
      id,
      account_id,
      account_email,
      recommendation_session_id,
      student_name,
      profesor_email,
      topic_json,
      student_profile_json,
      email_text,
      sent_at,
      status,
      responses_json,
      preview_url,
      transport_mode,
      delivered_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      account_id = VALUES(account_id),
      account_email = VALUES(account_email),
      recommendation_session_id = VALUES(recommendation_session_id),
      student_name = VALUES(student_name),
      profesor_email = VALUES(profesor_email),
      topic_json = VALUES(topic_json),
      student_profile_json = VALUES(student_profile_json),
      email_text = VALUES(email_text),
      sent_at = VALUES(sent_at),
      status = VALUES(status),
      responses_json = VALUES(responses_json),
      preview_url = VALUES(preview_url),
      transport_mode = VALUES(transport_mode),
      delivered_to = VALUES(delivered_to)`,
    [
      emailRecord.id,
      emailRecord.accountId || null,
      normalizeStoredEmail(emailRecord.studentEmail),
      emailRecord.recommendationSessionId || null,
      emailRecord.studentName ? String(emailRecord.studentName).trim() : null,
      String(emailRecord.profesorEmail || '').trim(),
      safeStringifyJson(emailRecord.topic || {}),
      safeStringifyJson(emailRecord.studentProfile || {}),
      String(emailRecord.emailText || ''),
      emailRecord.timestamp ? new Date(emailRecord.timestamp) : new Date(),
      String(emailRecord.status || 'sent'),
      safeStringifyJson(emailRecord.responses || []),
      emailRecord.previewUrl || null,
      emailRecord.transportMode || null,
      emailRecord.deliveredTo || null
    ]
  );

  return true;
}

async function fetchSentEmailsForEmail(pool, studentEmail) {
  if (!pool || !studentEmail) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, account_id, account_email, recommendation_session_id, student_name, profesor_email, topic_json, student_profile_json, email_text, sent_at, status, responses_json, preview_url, transport_mode, delivered_to
       FROM sent_emails
      WHERE account_email = ?
      ORDER BY sent_at DESC, id DESC`,
    [normalizeStoredEmail(studentEmail)]
  );

  return rows.map((row) => ({
    id: String(row.id),
    accountId: row.account_id ? Number(row.account_id) : null,
    studentEmail: normalizeStoredEmail(row.account_email),
    recommendationSessionId: row.recommendation_session_id || null,
    studentName: row.student_name || '',
    profesorEmail: row.profesor_email || '',
    topic: safeParseJson(row.topic_json, {}),
    studentProfile: safeParseJson(row.student_profile_json, {}),
    emailText: row.email_text || '',
    timestamp: row.sent_at || null,
    status: row.status || 'sent',
    responses: safeParseJson(row.responses_json, []),
    previewUrl: row.preview_url || null,
    transportMode: row.transport_mode || null,
    deliveredTo: row.delivered_to || null
  }));
}

app.post('/api/auth/password-reset/request', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Emailul este obligatoriu.' });
    }

    const pool = createAccountsPool();
    if (!pool) {
      return res.status(500).json({ error: 'Baza de date nu este configurată.' });
    }

    const account = await fetchAccountByEmail(pool, email);
    if (!account) {
      // Don't reveal whether account exists
      return res.json({ message: 'Dacă există un cont asociat acestui email, vei primi instrucțiuni pentru resetarea parolei.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = createPinHash(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await withAccountsPool(async (poolToUse) => {
      await poolToUse.execute('UPDATE accounts SET password_reset_token_hash = ?, password_reset_expires_at = ?, password_reset_sent_at = NOW() WHERE id = ?', [tokenHash, expiresAt, account.id]);
    });

    const frontendRoot = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendRoot.replace(/\/$/, '')}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    const emailObj = buildPasswordResetEmail(account.full_name, resetLink);

    try {
      const sent = await sendConfiguredEmail({ to: email, subject: emailObj.subject, text: emailObj.text, html: emailObj.html, replyTo: process.env.SENDGRID_FROM });
      return res.json({ message: 'Dacă există un cont asociat acestui email, vei primi un link pentru resetarea parolei.', previewUrl: sent.previewUrl });
    } catch (err) {
      console.error('Password reset email error:', err);
      return res.status(500).json({ error: 'Nu am putut trimite emailul de resetare.', details: err.message });
    }
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({ error: 'Eroare la procesarea cererii de resetare.' });
  }
});

app.post('/api/auth/password-reset/confirm', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token și parola nouă sunt obligatorii.' });
    }

    const pool = createAccountsPool();
    if (!pool) {
      return res.status(500).json({ error: 'Baza de date nu este configurată.' });
    }

    const account = await fetchAccountByEmail(pool, email);
    if (!account) {
      return res.status(400).json({ error: 'Token invalid sau email necunoscut.' });
    }

    if (!account.password_reset_token_hash || !account.password_reset_expires_at) {
      return res.status(400).json({ error: 'Nu există o cerere de resetare activă pentru acest cont.' });
    }

    const expires = new Date(account.password_reset_expires_at);
    if (expires.getTime() < Date.now()) {
      return res.status(410).json({ error: 'Link-ul de resetare a expirat. Cere unul nou.' });
    }

    if (!verifyPinHash(token, account.password_reset_token_hash)) {
      return res.status(400).json({ error: 'Token invalid.' });
    }

    const newHash = createPasswordHash(newPassword);
    await withAccountsPool(async (poolToUse) => {
      await poolToUse.execute('UPDATE accounts SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL, password_reset_sent_at = NULL, is_active = 1 WHERE id = ?', [newHash, account.id]);
    });

    return res.json({ message: 'Parola a fost resetată cu succes. Te poți autentifica acum.' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return res.status(500).json({ error: 'Eroare la resetarea parolei.' });
  }
});

async function ensureAccountsSchema() {
  if (!isMysqlConfigured(process.env)) {
    return;
  }

  await withAccountsPool(async (pool) => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'accounts'
         AND COLUMN_NAME IN (
           'approval_status',
           'approval_reviewed_at',
           'email_verified_at',
           'email_verification_pin_hash',
           'email_verification_expires_at',
           'email_verification_sent_at',
           'password_reset_token_hash',
           'password_reset_expires_at',
           'password_reset_sent_at'
         )`
    );

    const existingColumns = new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim()));
    if (!existingColumns.has('approval_status')) {
      await pool.execute("ALTER TABLE accounts ADD COLUMN approval_status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved' AFTER is_active");
    }

    if (!existingColumns.has('approval_reviewed_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN approval_reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER approval_status');
    }

    if (!existingColumns.has('email_verified_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL AFTER approval_reviewed_at');
    }

    if (!existingColumns.has('email_verification_pin_hash')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN email_verification_pin_hash VARCHAR(255) NULL AFTER email_verified_at');
    }

    if (!existingColumns.has('email_verification_expires_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN email_verification_expires_at TIMESTAMP NULL DEFAULT NULL AFTER email_verification_pin_hash');
    }

    if (!existingColumns.has('email_verification_sent_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN email_verification_sent_at TIMESTAMP NULL DEFAULT NULL AFTER email_verification_expires_at');
    }

    if (!existingColumns.has('password_reset_token_hash')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN password_reset_token_hash VARCHAR(255) NULL AFTER email_verification_sent_at');
    }

    if (!existingColumns.has('password_reset_expires_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN password_reset_expires_at TIMESTAMP NULL DEFAULT NULL AFTER password_reset_token_hash');
    }

    if (!existingColumns.has('password_reset_sent_at')) {
      await pool.execute('ALTER TABLE accounts ADD COLUMN password_reset_sent_at TIMESTAMP NULL DEFAULT NULL AFTER password_reset_expires_at');
    }
  });
}

async function ensureTopicsOwnershipSchema() {
  if (!isMysqlConfigured(process.env)) {
    return;
  }

  await withTopicsPool(async (pool) => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'topics'
         AND COLUMN_NAME IN ('creator_account_id', 'creator_email')`
    );

    const existingColumns = new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim()));

    if (!existingColumns.has('creator_account_id')) {
      await pool.execute('ALTER TABLE topics ADD COLUMN creator_account_id BIGINT NULL AFTER source_file');
      await pool.execute('ALTER TABLE topics ADD INDEX idx_topics_creator_account (creator_account_id)');
    }

    if (!existingColumns.has('creator_email')) {
      await pool.execute('ALTER TABLE topics ADD COLUMN creator_email VARCHAR(255) NULL AFTER creator_account_id');
    }
  });
}

function createTopicsPool() {
  if (!isMysqlConfigured(process.env)) {
    return null;
  }

  return createMysqlPool(process.env);
}

async function withTopicsPool(handler) {
  const pool = createTopicsPool();
  if (!pool) {
    throw new Error('MySQL is not configured for topics');
  }

  try {
    return await handler(pool);
  } finally {
    await pool.end();
  }
}

async function refreshTopicsCache(pool) {
  allTopics = await fetchTopicsFromMysql(pool);
  return allTopics;
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

function parseSpecializationList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  return [];
}

function buildTopicPayload(body, fallbackId = '') {
  const id = String(body?.id || fallbackId || '').trim();

  return {
    id,
    facultatea: String(body?.facultatea || '').trim(),
    profesor: String(body?.profesor || '').trim(),
    nivel_studii: String(body?.nivel_studii || '').trim(),
    specializari: parseSpecializationList(body?.specializari ?? body?.specializations ?? body?.specializations_json),
    titlu_tema: String(body?.titlu_tema || '').trim(),
    descriere: body?.descriere !== undefined ? String(body.descriere || '').trim() : '',
    source_file: body?.source_file !== undefined ? String(body.source_file || '').trim() : ''
  };
}

async function resolveTopicManager(req, pool) {
  const rawAccountId = req.body?.accountId ?? req.query?.accountId;
  const accountId = Number(rawAccountId);
  const email = String(req.body?.email ?? req.query?.email ?? '').trim().toLowerCase();

  if (!Number.isFinite(accountId) || accountId <= 0 || !email) {
    return { status: 400, error: 'Lipsesc datele contului pentru administrarea temelor.' };
  }

  const account = await fetchAccountById(pool, accountId);
  if (!account || !account.is_active || String(account.email || '').trim().toLowerCase() !== email) {
    return { status: 403, error: 'Nu ai permisiunea să administrezi teme din acest cont.' };
  }

  if (account.role === 'admin') {
    return { account, isAdmin: true, isProfessor: false };
  }

  if (account.role === 'professor') {
    if (account.approval_status === 'pending') {
      return { status: 403, error: 'Contul de profesor este încă în așteptare și nu poate administra teme.' };
    }

    if (account.approval_status === 'rejected') {
      return { status: 403, error: 'Contul de profesor a fost respins și nu poate administra teme.' };
    }

    return { account, isAdmin: false, isProfessor: true };
  }

  return { status: 403, error: 'Doar administratorii și profesorii aprobați pot administra teme.' };
}

async function fetchTopicOwnership(pool, topicId) {
  const [rows] = await pool.execute(
    'SELECT id, creator_account_id, creator_email FROM topics WHERE id = ? LIMIT 1',
    [topicId]
  );

  return rows[0] || null;
}

function canManageTopic(manager, topic) {
  if (manager?.isAdmin) {
    return true;
  }

  return Number(topic?.creator_account_id || topic?.creatorAccountId || 0) === Number(manager?.account?.id || 0);
}

async function withAccountsPool(handler) {
  const pool = createAccountsPool();
  if (!pool) {
    throw new Error('MySQL is not configured for accounts');
  }

  try {
    return await handler(pool);
  } finally {
    await pool.end();
  }
}

app.get('/api/admin/accounts', async (req, res) => {
  try {
    const accounts = await withAccountsPool(async (pool) => fetchAccounts(pool));
    return res.json({
      success: true,
      count: accounts.length,
      accounts: accounts.map((account) => formatAccountForClient(account))
    });
  } catch (error) {
    console.error('Admin accounts list error:', error);
    return res.status(500).json({ error: 'Nu am putut încărca conturile.', details: error.message });
  }
});

app.post('/api/admin/accounts', async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || 'student').trim().toLowerCase();
    const faculty = req.body?.faculty ? String(req.body.faculty).trim() : null;
    const specialization = req.body?.specialization ? String(req.body.specialization).trim() : null;
    const studyLevel = req.body?.studyLevel ? String(req.body.studyLevel).trim() : null;
    const employeeTitle = req.body?.employeeTitle ? String(req.body.employeeTitle).trim() : null;
    const isProfessorRequest = role === 'professor';
    const isActive = parseBoolean(req.body?.isActive, true);
    const mustChangePassword = parseBoolean(req.body?.mustChangePassword, false);

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Numele, emailul și parola sunt obligatorii.' });
    }

    if (!['student', 'professor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rolul selectat nu este valid.' });
    }

    const account = await withAccountsPool(async (pool) => {
      const existingAccount = await fetchAccountByEmail(pool, email);
      if (existingAccount) {
        throw new Error('EMAIL_EXISTS');
      }

      let accountCode = buildAccountCode(role);
      while (await fetchAccountByCode(pool, accountCode)) {
        accountCode = buildAccountCode(role);
      }

      const passwordHash = createPasswordHash(password);
      const [result] = await pool.execute(
        `INSERT INTO accounts (
          account_code,
          role,
          full_name,
          email,
          password_hash,
          faculty,
          specialization,
          study_level,
          employee_title,
          is_active,
          approval_status,
          approval_reviewed_at,
          email_verified_at,
          must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?, ?)`,
        [
          accountCode,
          role,
          fullName,
          email,
          passwordHash,
          faculty,
          specialization,
          studyLevel,
          employeeTitle,
          isActive ? 1 : 0,
          isActive ? new Date() : null,
          mustChangePassword ? 1 : 0
        ]
      );

      return fetchAccountById(pool, result.insertId);
    }).catch((error) => {
      if (error.message === 'EMAIL_EXISTS') {
        return { emailExists: true };
      }
      throw error;
    });

    if (account?.emailExists) {
      return res.status(409).json({ error: 'Există deja un cont cu acest email.' });
    }

    return res.status(201).json({ account: formatAccountForClient(account) });
  } catch (error) {
    console.error('Admin account create error:', error);
    return res.status(500).json({ error: 'Nu am putut crea contul.', details: error.message });
  }
});

app.put('/api/admin/accounts/:id', async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'ID-ul contului este invalid.' });
    }

    const updatedAccount = await withAccountsPool(async (pool) => {
      const currentAccount = await fetchAccountById(pool, accountId);
      if (!currentAccount) {
        return null;
      }

      const nextFullName = req.body?.fullName !== undefined ? String(req.body.fullName || '').trim() : currentAccount.full_name;
      const nextEmail = req.body?.email !== undefined ? String(req.body.email || '').trim().toLowerCase() : currentAccount.email;
      const nextRole = req.body?.role !== undefined ? String(req.body.role || '').trim().toLowerCase() : currentAccount.role;
      const nextFaculty = req.body?.faculty !== undefined ? String(req.body.faculty || '').trim() || null : currentAccount.faculty;
      const nextSpecialization = req.body?.specialization !== undefined ? String(req.body.specialization || '').trim() || null : currentAccount.specialization;
      const nextStudyLevel = req.body?.studyLevel !== undefined ? String(req.body.studyLevel || '').trim() || null : currentAccount.study_level;
      const nextEmployeeTitle = req.body?.employeeTitle !== undefined ? String(req.body.employeeTitle || '').trim() || null : currentAccount.employee_title;
      const nextIsActive = req.body?.isActive !== undefined ? parseBoolean(req.body.isActive, currentAccount.is_active) : currentAccount.is_active;
      const nextMustChangePassword = req.body?.mustChangePassword !== undefined ? parseBoolean(req.body.mustChangePassword, currentAccount.must_change_password) : currentAccount.must_change_password;
      const nextPassword = req.body?.password !== undefined ? String(req.body.password || '').trim() : '';

      if (!nextFullName || !nextEmail || !nextRole) {
        throw new Error('INVALID_ACCOUNT_PAYLOAD');
      }

      if (!['student', 'professor', 'admin'].includes(nextRole)) {
        throw new Error('INVALID_ROLE');
      }

      const duplicateEmail = await fetchAccountByEmail(pool, nextEmail);
      if (duplicateEmail && duplicateEmail.id !== currentAccount.id) {
        throw new Error('EMAIL_EXISTS');
      }

      let nextAccountCode = currentAccount.account_code;
      if (nextRole !== currentAccount.role) {
        nextAccountCode = buildAccountCode(nextRole);
        while (true) {
          const duplicateCode = await fetchAccountByCode(pool, nextAccountCode);
          if (!duplicateCode || duplicateCode.id === currentAccount.id) {
            break;
          }
          nextAccountCode = buildAccountCode(nextRole);
        }
      }

      const nextPasswordHash = nextPassword ? createPasswordHash(nextPassword) : currentAccount.password_hash;

      await pool.execute(
        `UPDATE accounts
         SET account_code = ?, role = ?, full_name = ?, email = ?, password_hash = ?, faculty = ?, specialization = ?, study_level = ?, employee_title = ?, is_active = ?, approval_status = 'approved', approval_reviewed_at = CURRENT_TIMESTAMP, must_change_password = ?
         WHERE id = ?`,
        [
          nextAccountCode,
          nextRole,
          nextFullName,
          nextEmail,
          nextPasswordHash,
          nextFaculty,
          nextSpecialization,
          nextStudyLevel,
          nextEmployeeTitle,
          nextIsActive ? 1 : 0,
          nextMustChangePassword ? 1 : 0,
          accountId
        ]
      );

      return fetchAccountById(pool, accountId);
    }).catch((error) => {
      if (error.message === 'EMAIL_EXISTS') {
        return { emailExists: true };
      }
      if (error.message === 'INVALID_ACCOUNT_PAYLOAD' || error.message === 'INVALID_ROLE') {
        return { validationError: error.message };
      }
      throw error;
    });

    if (updatedAccount?.emailExists) {
      return res.status(409).json({ error: 'Există deja un cont cu acest email.' });
    }

    if (updatedAccount?.validationError === 'INVALID_ACCOUNT_PAYLOAD') {
      return res.status(400).json({ error: 'Numele, emailul și rolul sunt obligatorii.' });
    }

    if (updatedAccount?.validationError === 'INVALID_ROLE') {
      return res.status(400).json({ error: 'Rolul selectat nu este valid.' });
    }

    if (!updatedAccount) {
      return res.status(404).json({ error: 'Contul nu a fost găsit.' });
    }

    return res.json({ account: formatAccountForClient(updatedAccount) });
  } catch (error) {
    console.error('Admin account update error:', error);
    return res.status(500).json({ error: 'Nu am putut actualiza contul.', details: error.message });
  }
});

app.delete('/api/admin/accounts/:id', async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'ID-ul contului este invalid.' });
    }

    const result = await withAccountsPool(async (pool) => {
      const [deleteResult] = await pool.execute('DELETE FROM accounts WHERE id = ?', [accountId]);
      return deleteResult;
    });

    return res.json({ success: true, deleted: result.affectedRows > 0 });
  } catch (error) {
    console.error('Admin account delete error:', error);
    return res.status(500).json({ error: 'Nu am putut șterge contul.', details: error.message });
  }
});

app.get('/api/admin/professor-requests', async (req, res) => {
  try {
    const requests = await withAccountsPool(async (pool) => {
      const accounts = await fetchAccounts(pool);
      return accounts.filter((account) => account.role === 'professor' && account.approval_status === 'pending');
    });

    return res.json({
      success: true,
      count: requests.length,
      requests: requests.map((account) => formatAccountForClient(account))
    });
  } catch (error) {
    console.error('Professor requests list error:', error);
    return res.status(500).json({ error: 'Nu am putut încărca cererile de profesori.', details: error.message });
  }
});

async function processProfessorRequestDecision(req, res, isApproved) {
  try {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'ID-ul cererii este invalid.' });
    }

    const result = await withAccountsPool(async (pool) => {
      const currentAccount = await fetchAccountById(pool, accountId);
      if (!currentAccount || currentAccount.role !== 'professor') {
        throw new Error('REQUEST_NOT_FOUND');
      }

      if (currentAccount.approval_status !== 'pending') {
        throw new Error('REQUEST_NOT_PENDING');
      }

      await pool.execute(
        `UPDATE accounts
         SET approval_status = ?, approval_reviewed_at = CURRENT_TIMESTAMP, is_active = ?
         WHERE id = ?`,
        [isApproved ? 'approved' : 'rejected', isApproved ? 1 : 0, accountId]
      );

      return fetchAccountById(pool, accountId);
    }).catch((error) => {
      if (error.message === 'REQUEST_NOT_FOUND') {
        return { notFound: true };
      }
      if (error.message === 'REQUEST_NOT_PENDING') {
        return { notPending: true };
      }
      throw error;
    });

    if (result?.notFound) {
      return res.status(404).json({ error: 'Cererea nu există.' });
    }

    if (result?.notPending) {
      return res.status(409).json({ error: 'Cererea nu mai este în pending.' });
    }

    try {
      const decisionEmail = buildProfessorApprovalEmail(result.fullName, isApproved);
      await sendConfiguredEmail({
        to: result.email,
        subject: decisionEmail.subject,
        text: decisionEmail.text,
        html: decisionEmail.html,
        replyTo: result.email
      });
    } catch (emailError) {
      console.warn('Could not send professor decision email:', emailError && (emailError.message || emailError));
    }

    return res.json({ success: true, account: formatAccountForClient(result) });
  } catch (error) {
    console.error('Professor request decision error:', error);
    return res.status(500).json({ error: 'Nu am putut procesa cererea.', details: error.message });
  }
}

app.post('/api/admin/professor-requests/:id/approve', async (req, res) => processProfessorRequestDecision(req, res, true));

app.post('/api/admin/professor-requests/:id/reject', async (req, res) => processProfessorRequestDecision(req, res, false));

app.get('/api/admin/topics', async (req, res) => {
  try {
    const topics = await withTopicsPool(async (pool) => {
      const manager = await resolveTopicManager(req, pool);
      if (manager.error) {
        return manager;
      }

      const allManagedTopics = await fetchTopicsFromMysql(pool);
      return manager.isAdmin ? allManagedTopics : allManagedTopics.filter((topic) => canManageTopic(manager, topic));
    });

    if (topics?.error) {
      return res.status(topics.status || 403).json({ error: topics.error });
    }

    return res.json({
      success: true,
      count: topics.length,
      topics
    });
  } catch (error) {
    console.error('Admin topics list error:', error);
    return res.status(500).json({ error: 'Nu am putut încărca temele.', details: error.message });
  }
});

app.post('/api/admin/topics', async (req, res) => {
  try {
    const createdTopic = await withTopicsPool(async (pool) => {
      const manager = await resolveTopicManager(req, pool);
      if (manager.error) {
        return manager;
      }

      const topic = buildTopicPayload(req.body);
      if (!topic.facultatea || !topic.profesor || !topic.nivel_studii || !topic.titlu_tema) {
        return { status: 400, error: 'Facultatea, profesorul, nivelul și titlul sunt obligatorii.' };
      }

      topic.id = topic.id || buildTopicId(topic.facultatea);

      if (manager.isProfessor) {
        topic.profesor = String(manager.account.full_name || '').trim();
      }

      const existingTopic = await fetchTopicOwnership(pool, topic.id);
      if (existingTopic && !canManageTopic(manager, existingTopic)) {
        return { status: 403, error: 'Poți crea sau suprascrie doar temele tale.' };
      }

      await pool.execute(
        `INSERT INTO topics (id, facultatea, profesor, nivel_studii, specializari, titlu_tema, descriere, source_file, creator_account_id, creator_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           facultatea = VALUES(facultatea),
           profesor = VALUES(profesor),
           nivel_studii = VALUES(nivel_studii),
           specializari = VALUES(specializari),
           titlu_tema = VALUES(titlu_tema),
           descriere = VALUES(descriere),
           source_file = VALUES(source_file),
           creator_account_id = COALESCE(topics.creator_account_id, VALUES(creator_account_id)),
           creator_email = COALESCE(topics.creator_email, VALUES(creator_email))`,
        [
          topic.id,
          topic.facultatea,
          topic.profesor,
          topic.nivel_studii,
          JSON.stringify(topic.specializari),
          topic.titlu_tema,
          topic.descriere || null,
          topic.source_file || null,
          manager.isProfessor ? manager.account.id : null,
          manager.isProfessor ? String(manager.account.email || '').trim().toLowerCase() : null
        ]
      );

      await refreshTopicsCache(pool);
      return allTopics.find((item) => item.id === topic.id) || topic;
    });

    if (createdTopic?.error) {
      return res.status(createdTopic.status || 403).json({ error: createdTopic.error });
    }

    return res.status(201).json({ topic: createdTopic });
  } catch (error) {
    console.error('Admin topic create error:', error);
    return res.status(500).json({ error: 'Nu am putut crea tema.', details: error.message });
  }
});

app.put('/api/admin/topics/:id', async (req, res) => {
  try {
    const updatedTopic = await withTopicsPool(async (pool) => {
      const manager = await resolveTopicManager(req, pool);
      if (manager.error) {
        return manager;
      }

      const topicId = String(req.params.id || '').trim();
      if (!topicId) {
        return { status: 400, error: 'ID-ul temei este obligatoriu.' };
      }

      const existingTopic = await fetchTopicOwnership(pool, topicId);
      if (!existingTopic) {
        return { status: 404, error: 'Tema nu există.' };
      }

      if (!canManageTopic(manager, existingTopic)) {
        return { status: 403, error: 'Poți edita doar temele pe care le-ai creat.' };
      }

      const topic = buildTopicPayload(req.body, topicId);
      if (!topic.facultatea || !topic.profesor || !topic.nivel_studii || !topic.titlu_tema) {
        return { status: 400, error: 'Facultatea, profesorul, nivelul și titlul sunt obligatorii.' };
      }

      if (manager.isProfessor) {
        topic.profesor = String(manager.account.full_name || '').trim();
      }

      await pool.execute(
        `UPDATE topics
         SET facultatea = ?, profesor = ?, nivel_studii = ?, specializari = ?, titlu_tema = ?, descriere = ?, source_file = ?
         WHERE id = ?`,
        [
          topic.facultatea,
          topic.profesor,
          topic.nivel_studii,
          JSON.stringify(topic.specializari),
          topic.titlu_tema,
          topic.descriere || null,
          topic.source_file || null,
          topic.id
        ]
      );

      await refreshTopicsCache(pool);
      return allTopics.find((item) => item.id === topic.id) || topic;
    });

    if (updatedTopic?.error) {
      return res.status(updatedTopic.status || 403).json({ error: updatedTopic.error });
    }

    return res.json({ topic: updatedTopic });
  } catch (error) {
    console.error('Admin topic update error:', error);
    return res.status(500).json({ error: 'Nu am putut actualiza tema.', details: error.message });
  }
});

app.delete('/api/admin/topics/:id', async (req, res) => {
  try {
    const deleted = await withTopicsPool(async (pool) => {
      const manager = await resolveTopicManager(req, pool);
      if (manager.error) {
        return manager;
      }

      const topicId = String(req.params.id || '').trim();
      if (!topicId) {
        return { status: 400, error: 'ID-ul temei este obligatoriu.' };
      }

      const existingTopic = await fetchTopicOwnership(pool, topicId);
      if (!existingTopic) {
        return { status: 404, error: 'Tema nu există.' };
      }

      if (!canManageTopic(manager, existingTopic)) {
        return { status: 403, error: 'Poți șterge doar temele pe care le-ai creat.' };
      }

      const [result] = await pool.execute('DELETE FROM topics WHERE id = ?', [topicId]);
      await refreshTopicsCache(pool);
      return result.affectedRows > 0;
    });

    if (deleted?.error) {
      return res.status(deleted.status || 403).json({ error: deleted.error });
    }

    return res.json({ success: true, deleted });
  } catch (error) {
    console.error('Admin topic delete error:', error);
    return res.status(500).json({ error: 'Nu am putut șterge tema.', details: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Emailul și parola sunt obligatorii.' });
    }

    const account = await withAccountsPool(async (pool) => fetchAccountByEmail(pool, email));

    if (!account || !account.is_active) {
      if (account?.email_verification_pin_hash) {
        return res.status(401).json({ error: 'Contul nu este încă verificat. Introdu PIN-ul primit pe email.' });
      }
      if (account?.role === 'professor' && account?.approval_status === 'pending') {
        return res.status(403).json({ error: 'Cererea ta de cont de profesor este încă în pending. Vei primi un email când este aprobată.' });
      }
      if (account?.role === 'professor' && account?.approval_status === 'rejected') {
        return res.status(403).json({ error: 'Cererea ta de cont de profesor a fost respinsă.' });
      }
      return res.status(401).json({ error: 'Datele de autentificare sunt invalide.' });
    }

    if (account?.role === 'professor' && account?.approval_status === 'pending') {
      return res.status(403).json({ error: 'Cererea ta de cont de profesor este încă în pending. Vei primi un email când este aprobată.' });
    }

    if (account?.role === 'professor' && account?.approval_status === 'rejected') {
      return res.status(403).json({ error: 'Cererea ta de cont de profesor a fost respinsă.' });
    }

    if (!account.password_hash || !verifyPasswordHash(password, account.password_hash)) {
      return res.status(401).json({ error: 'Datele de autentificare sunt invalide.' });
    }

    await withAccountsPool(async (pool) => updateLastLogin(pool, account.id));

    return res.json({ account: formatAccountForClient({ ...account, password_hash: undefined }) });
  } catch (error) {
    console.error('Auth login error:', error);
    return res.status(500).json({ error: 'Nu am putut autentifica utilizatorul.' });
  }
});

app.put('/api/account/profile', async (req, res) => {
  try {
    const accountId = Number(req.body?.accountId);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const faculty = req.body?.faculty !== undefined ? String(req.body.faculty || '').trim() || null : null;
    const specialization = req.body?.specialization !== undefined ? String(req.body.specialization || '').trim() || null : null;
    const studyLevel = req.body?.studyLevel !== undefined ? String(req.body.studyLevel || '').trim() || null : null;

    if (!Number.isFinite(accountId) || accountId <= 0 || !email) {
      return res.status(400).json({ error: 'Date invalide pentru actualizarea profilului.' });
    }

    const updatedAccount = await withAccountsPool(async (pool) => {
      const currentAccount = await fetchAccountById(pool, accountId);
      if (!currentAccount) {
        return null;
      }

      if (String(currentAccount.email || '').trim().toLowerCase() !== email) {
        throw new Error('ACCOUNT_MISMATCH');
      }

      await pool.execute(
        `UPDATE accounts
         SET faculty = ?, specialization = ?, study_level = ?
         WHERE id = ?`,
        [faculty, specialization, studyLevel, accountId]
      );

      return fetchAccountById(pool, accountId);
    });

    if (!updatedAccount) {
      return res.status(404).json({ error: 'Contul nu a fost găsit.' });
    }

    return res.json({
      success: true,
      account: formatAccountForClient(updatedAccount)
    });
  } catch (error) {
    if (error.message === 'ACCOUNT_MISMATCH') {
      return res.status(403).json({ error: 'Contul nu corespunde datelor trimise.' });
    }

    console.error('Self profile update error:', error);
    return res.status(500).json({ error: 'Nu am putut actualiza profilul.', details: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || 'student').trim().toLowerCase();
    const faculty = req.body?.faculty ? String(req.body.faculty).trim() : null;
    const specialization = req.body?.specialization ? String(req.body.specialization).trim() : null;
    const studyLevel = req.body?.studyLevel ? String(req.body.studyLevel).trim() : null;
    const employeeTitle = req.body?.employeeTitle ? String(req.body.employeeTitle).trim() : null;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Numele, emailul și parola sunt obligatorii.' });
    }

    if (!['student', 'professor'].includes(role)) {
      return res.status(400).json({ error: 'Rolul selectat nu este valid.' });
    }

    // Check for existing account first and return helpful messages
    const existingAccount = await withAccountsPool(async (pool) => await fetchAccountByEmail(pool, email));

    if (existingAccount) {
      // Account already active -> email in use
      if (existingAccount.is_active) {
        return res.status(409).json({ error: 'EMAIL_IN_USE', message: 'Adresa de email este deja folosită. Dacă este contul tău, autentifică-te pentru a continua.' });
      }

      // Account exists but not active
      if (existingAccount.role === 'professor') {
        const status = String(existingAccount.approval_status || '').toLowerCase();
        if (status === 'pending') {
          return res.status(409).json({ error: 'PROFESSOR_PENDING', message: 'Am primit cererea ta de cont de profesor. Verifică emailul pentru PIN; după verificare, cererea va rămâne în așteptare până la aprobare.' });
        }

        if (status === 'rejected') {
          return res.status(409).json({ error: 'PROFESSOR_REJECTED', message: 'Cererea ta de cont de profesor a fost respinsă. Dacă crezi că este o greșeală, contactează administratorul sau încearcă din nou.' });
        }
      }

      // Generic not-active case (e.g., student awaiting verification)
      return res.status(409).json({ error: 'EMAIL_PENDING_VERIFICATION', message: 'Există deja un cont pentru acest email, dar nu a fost activat încă. Verifică PIN-ul trimis sau solicită trimiterea unuia nou.' });
    }

    const pendingAccount = await withAccountsPool(async (pool) => {
      const passwordHash = createPasswordHash(password);
      const pin = generateVerificationPin();
      const pinHash = createPinHash(pin);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      let accountCode = buildAccountCode(role);
      while (await fetchAccountByCode(pool, accountCode)) {
        accountCode = buildAccountCode(role);
      }

      const [result] = await pool.execute(
        `INSERT INTO accounts (
          account_code,
          role,
          full_name,
          email,
          password_hash,
          faculty,
          specialization,
          study_level,
          employee_title,
          is_active,
          approval_status,
          approval_reviewed_at,
          email_verified_at,
          email_verification_pin_hash,
          email_verification_expires_at,
          email_verification_sent_at,
          must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', NULL, NULL, ?, ?, NULL, 0)`,
        [
          accountCode,
          role,
          fullName,
          email,
          passwordHash,
          faculty,
          specialization,
          studyLevel,
          employeeTitle,
          pinHash,
          expiresAt
        ]
      );

      return { accountId: result.insertId, fullName, email, pin, role };
    });

    const verificationEmail = buildVerificationEmail(pendingAccount.fullName, pendingAccount.pin);
    const isProfessorRequest = role === 'professor';

    try {
      const sentEmail = await sendConfiguredEmail({
        to: pendingAccount.email,
        subject: verificationEmail.subject,
        text: verificationEmail.text,
        html: verificationEmail.html,
        replyTo: pendingAccount.email
      });

      await withAccountsPool(async (pool) => {
        await pool.execute('UPDATE accounts SET email_verification_sent_at = NOW() WHERE id = ?', [pendingAccount.accountId]);
      });

      return res.status(202).json({
        verificationRequired: true,
        pendingApproval: isProfessorRequest,
        role: pendingAccount.role,
        message: isProfessorRequest
          ? 'Ți-am trimis un PIN pe email. După verificare, cererea ta va rămâne în pending până la aprobarea administratorului.'
          : 'Ți-am trimis un PIN pe email. Verifică-l ca să activezi contul.',
        previewUrl: sentEmail.previewUrl
      });
    } catch (error) {
      console.error('Signup verification email error:', error);
      return res.status(500).json({
        error: 'Nu am putut trimite PIN-ul pe email.',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Auth signup error:', error);
    return res.status(500).json({
      error: 'Nu am putut crea contul.',
      details: error?.message || 'Eroare necunoscută la crearea contului.'
    });
  }
});

app.post('/api/auth/signup/verify-pin', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const pin = String(req.body?.pin || '').trim();

    if (!email || !pin) {
      return res.status(400).json({ error: 'Emailul și PIN-ul sunt obligatorii.' });
    }

    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN-ul trebuie să aibă 6 cifre.' });
    }

    const account = await withAccountsPool(async (pool) => {
      const currentAccount = await fetchAccountByEmail(pool, email);

      if (!currentAccount) {
        throw new Error('ACCOUNT_NOT_FOUND');
      }

      if (currentAccount.is_active && currentAccount.approval_status === 'approved') {
        return currentAccount;
      }

      if (!currentAccount.email_verification_pin_hash || !currentAccount.email_verification_expires_at) {
        throw new Error('PIN_NOT_READY');
      }

      const expiresAt = new Date(currentAccount.email_verification_expires_at);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        throw new Error('PIN_EXPIRED');
      }

      if (!verifyPinHash(pin, currentAccount.email_verification_pin_hash)) {
        throw new Error('PIN_INVALID');
      }

      await pool.execute(
        `UPDATE accounts
         SET is_active = CASE WHEN role = 'student' THEN 1 ELSE 0 END,
             approval_status = CASE WHEN role = 'student' THEN 'approved' ELSE 'pending' END,
             approval_reviewed_at = CASE WHEN role = 'student' THEN CURRENT_TIMESTAMP ELSE approval_reviewed_at END,
             email_verified_at = NOW(),
             email_verification_pin_hash = NULL,
             email_verification_expires_at = NULL,
             email_verification_sent_at = NULL
         WHERE id = ?`,
        [currentAccount.id]
      );

      return fetchAccountById(pool, currentAccount.id);
    }).catch((error) => {
      if (error.message === 'ACCOUNT_NOT_FOUND') {
        return { notFound: true };
      }
      if (error.message === 'PIN_NOT_READY') {
        return { notReady: true };
      }
      if (error.message === 'PIN_EXPIRED') {
        return { expired: true };
      }
      if (error.message === 'PIN_INVALID') {
        return { invalidPin: true };
      }
      throw error;
    });

    if (account?.notFound) {
      return res.status(404).json({ error: 'Contul nu există.' });
    }

    if (account?.notReady) {
      return res.status(409).json({ error: 'Contul nu așteaptă verificare.' });
    }

    if (account?.expired) {
      return res.status(410).json({ error: 'PIN-ul a expirat. Cere un cod nou.' });
    }

    if (account?.invalidPin) {
      return res.status(401).json({ error: 'PIN-ul introdus este invalid.' });
    }

    if (account?.role === 'professor') {
      return res.status(202).json({
        pendingApproval: true,
        message: 'Cererea ta de creare a contului de profesor este în pending. Vei primi un email când este aprobată.'
      });
    }

    return res.json({ account: formatAccountForClient(account) });
  } catch (error) {
    console.error('Auth signup verify pin error:', error);
    return res.status(500).json({
      error: 'Nu am putut verifica PIN-ul.',
      details: error?.message || 'Eroare necunoscută la verificarea PIN-ului.'
    });
  }
});

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;

let azureOpenAIClient = null;
if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
  azureOpenAIClient = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    apiVersion: process.env.AZURE_API_VERSION || '2024-04-01-preview'
  });
}

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

async function callAzureOpenAI(prompt, { temperature = 0.7, maxTokens = 1500, topP = 0.9 } = {}) {
  if (!azureOpenAIClient || !process.env.AZURE_OPENAI_API_KEY) {
    throw new Error('Missing AZURE_OPENAI_API_KEY environment variable or azureOpenAIClient not initialized');
  }

  try {
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const response = await azureOpenAIClient.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: Number(maxTokens) || 1500,
      temperature: Number(temperature) || 0.7,
      top_p: Number(topP) || 0.9,
      model: deployment
    });

    const text = response.choices?.[0]?.message?.content || '';
    return String(text || '').trim();
  } catch (err) {
    console.error('Azure OpenAI SDK request failed', err && (err.stack || err.message || err));
    throw new Error(String(err && (err.message || err) || 'Azure OpenAI API call failed'));
  }
}

const recommendationSessions = new Map();
const RECOMMENDATION_SESSION_TTL_MS = 30 * 60 * 1000;
const INITIAL_TOPIC_POOL_SIZE = 6;
const DEFAULT_INTENT_RULES = [
  {
    id: 'software_general',
    weight: 1,
    profileTokens: ['software', 'aplicatie', 'aplicatii', 'web', 'mobile', 'platforma', 'platforme', 'sistem informatic'],
    topicPositiveTokens: ['software', 'aplicatie', 'aplicatii', 'web', 'platforma', 'platforme', 'sistem informatic', 'online'],
    topicNegativeTokens: ['firmware', 'microcontroler', 'microcontroller', 'senzor', 'rfid', 'scada', 'plc']
  }
];

// In-memory storage for sent emails (will be moved to DB later)
const sentEmails = [];

function cleanupExpiredRecommendationSessions() {
  const now = Date.now();
  for (const [sessionId, session] of recommendationSessions.entries()) {
    if (now - session.createdAt > RECOMMENDATION_SESSION_TTL_MS) {
      recommendationSessions.delete(sessionId);
    }
  }
}

let allTopics = [];
let intentRules = DEFAULT_INTENT_RULES;

async function loadTopicsFromFiles() {
  const fallbackTopics = [
    {
      id: 'FIESC-001',
      facultatea: 'FIESC',
      profesor: 'Prof.univ.dr.ing. Laureniu Dan MILICI',
      nivel_studii: 'Licenta',
      specializari: ['SE'],
      titlu_tema: 'Studiul caracteristicilor panourilor fotovoltaice flexibile'
    },
    {
      id: 'FIESC-002',
      facultatea: 'FIESC',
      profesor: 'Prof.univ.dr.ing. Adrian GRAUR',
      nivel_studii: 'Licenta',
      specializari: ['AIA'],
      titlu_tema: 'Sistem IoT de monitorizare a temperaturii'
    }
  ];

  const dataDir = join(__dirname, '../src/data');
  if (!fs.existsSync(dataDir)) {
    throw new Error('Data directory not found: src/data');
  }

  const topicFiles = fs
    .readdirSync(dataDir)
    .filter((fileName) => fileName.endsWith('Topics.js'));

  if (topicFiles.length === 0) {
    throw new Error('No *Topics.js files found in src/data');
  }

  console.log(`📂 Loading topic datasets from ${topicFiles.length} files...`);

  try {
    const loaded = [];
    for (const fileName of topicFiles) {
      const absoluteFile = join(dataDir, fileName);
      const moduleUrl = pathToFileURL(absoluteFile).href;
      const module = await import(moduleUrl);
      const topicArrays = Object.entries(module)
        .filter(([exportName, value]) => exportName.endsWith('Topics') && Array.isArray(value))
        .flatMap(([, value]) => value);

      if (topicArrays.length > 0) {
        loaded.push(...topicArrays);
        console.log(`   ✅ ${fileName}: ${topicArrays.length} topics`);
      } else {
        console.log(`   ⚠️ ${fileName}: no exported *Topics array found`);
      }
    }

    if (loaded.length === 0) {
      throw new Error('Topic files were found but no topics were loaded');
    }

    return loaded;
  } catch (error) {
    console.error('⚠️ Error loading topics from files:', error.message);
    console.log(`⚠️ Using fallback topics: ${fallbackTopics.length}`);
    return fallbackTopics;
  }
}

const FACULTY_ALIAS_MAP = {
  fiesc: 'FIESC',
  feaa: 'FEEA',
  feea: 'FEEA',
  fseap: 'FEEA',
  facultateadeeconomieadministratiesiafaceri: 'FEEA',
  facultateadestiinteeconomicesiadministratiepublica: 'FEEA',
  fdsa: 'FDSA',
  facultateadedreptsistiinteadministrative: 'FDSA',
  flsc: 'FLSC'
};

function normalizeFacultyToken(value) {
  return normalizeDiacritics(value).replace(/[^a-z0-9]/g, '');
}

function mapFacultyCode(rawFaculty) {
  const normalizedFaculty = normalizeFacultyToken(rawFaculty);
  return FACULTY_ALIAS_MAP[normalizedFaculty] || String(rawFaculty || '').trim().toUpperCase();
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function loadTopics() {
  let pool = null;
  try {
    if (isMysqlConfigured(process.env)) {
      pool = createMysqlPool(process.env);
      const mysqlTopics = await fetchTopicsFromMysql(pool);
      if (mysqlTopics.length > 0) {
        allTopics = mysqlTopics;
        console.log(`🗄️ Loaded ${allTopics.length} topics from MySQL`);
        return;
      }

      console.warn('⚠️ MySQL is configured, but the topics table is empty. Seeding from source files.');
      const fileTopics = await loadTopicsFromFiles();
      if (fileTopics.length > 0) {
        await upsertTopics(pool, fileTopics);
        allTopics = await fetchTopicsFromMysql(pool);
        console.log(`🗄️ Seeded ${allTopics.length} topics into MySQL from source files`);
        return;
      }
    }

    allTopics = await loadTopicsFromFiles();
    console.log(`✅ Total loaded topics: ${allTopics.length}`);
  } catch (error) {
    console.error('⚠️ Error loading topics:', error.message);
    allTopics = [
      {
        id: 'FIESC-001',
        facultatea: 'FIESC',
        profesor: 'Prof.univ.dr.ing. Laureniu Dan MILICI',
        nivel_studii: 'Licenta',
        specializari: ['SE'],
        titlu_tema: 'Studiul caracteristicilor panourilor fotovoltaice flexibile'
      },
      {
        id: 'FIESC-002',
        facultatea: 'FIESC',
        profesor: 'Prof.univ.dr.ing. Adrian GRAUR',
        nivel_studii: 'Licenta',
        specializari: ['AIA'],
        titlu_tema: 'Sistem IoT de monitorizare a temperaturii'
      }
    ];
    console.log(`⚠️ Using fallback topics: ${allTopics.length}`);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

function safeJsonParse(text) {
  const normalizedText = String(text || '').trim();

  try {
    return JSON.parse(normalizedText);
  } catch {
    const strippedFenceStart = normalizedText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(strippedFenceStart);
    } catch {
      // Continue with additional extraction strategies.
    }

    const jsonBlock = normalizedText.match(/```json\s*([\s\S]*?)```/i);
    if (jsonBlock && jsonBlock[1]) {
      try {
        return JSON.parse(jsonBlock[1]);
      } catch {
        return null;
      }
    }

    const arrayStart = normalizedText.indexOf('[');
    const arrayEnd = normalizedText.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(normalizedText.slice(arrayStart, arrayEnd + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

function formatCandidateTopicsForContext(candidateTopics) {
  return candidateTopics
    .map((topic, index) => {
      return `${index + 1}. ID: ${topic.id} | Titlu: ${topic.titlu_tema}`;
    })
    .join('\n');
}

function trimField(value, maxLen = 260) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Nespecificat';
  }
  return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen)}...`;
}

function normalizeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeSpecializations(specializations) {
  if (!Array.isArray(specializations)) {
    return [];
  }

  return specializations
    .map((spec) => String(spec || '').trim())
    .filter((spec) => spec && !/[0-9]/.test(spec));
}

function isStudentProposedTopic(topic) {
  const normalizedTitle = normalizeDiacritics(topic?.titlu_tema);
  return normalizedTitle.includes('teme propuse de studenti');
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAnyToken(text, tokens) {
  const normalizedText = normalizeDiacritics(text || '');
  return tokens.some((token) => {
    const normalizedToken = normalizeDiacritics(token || '').trim();
    if (!normalizedToken) {
      return false;
    }

    if (normalizedToken.includes(' ')) {
      return normalizedText.includes(normalizedToken);
    }

    const wordRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedToken)}([^a-z0-9]|$)`);
    return wordRegex.test(normalizedText);
  });
}

function countTokenMatches(text, tokens) {
  const normalizedText = normalizeDiacritics(text || '');
  let matches = 0;
  for (const token of tokens || []) {
    const normalizedToken = normalizeDiacritics(token || '').trim();
    if (!normalizedToken) {
      continue;
    }

    let isMatch = false;
    if (normalizedToken.includes(' ')) {
      isMatch = normalizedText.includes(normalizedToken);
    } else {
      const wordRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedToken)}([^a-z0-9]|$)`);
      isMatch = wordRegex.test(normalizedText);
    }

    if (isMatch) {
      matches += 1;
    }
  }
  return matches;
}

function loadIntentRules() {
  try {
    const rulesPath = join(__dirname, 'intent-rules.json');
    if (!fs.existsSync(rulesPath)) {
      intentRules = DEFAULT_INTENT_RULES;
      console.log('⚠️ intent-rules.json missing, using default in-code intent rules');
      return;
    }

    const raw = fs.readFileSync(rulesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('intent-rules.json must contain a non-empty array');
    }

    intentRules = parsed
      .map((rule) => ({
        id: String(rule.id || '').trim(),
        weight: Number(rule.weight) || 1,
        profileTokens: Array.isArray(rule.profileTokens) ? rule.profileTokens.map((v) => String(v || '')) : [],
        topicPositiveTokens: Array.isArray(rule.topicPositiveTokens) ? rule.topicPositiveTokens.map((v) => String(v || '')) : [],
        topicNegativeTokens: Array.isArray(rule.topicNegativeTokens) ? rule.topicNegativeTokens.map((v) => String(v || '')) : []
      }))
      .filter((rule) => rule.id && rule.profileTokens.length > 0);

    if (intentRules.length === 0) {
      throw new Error('No valid intent rules after validation');
    }

    console.log(`🧭 Loaded ${intentRules.length} intent rules from intent-rules.json`);
  } catch (error) {
    console.warn(`⚠️ Failed to load intent rules: ${error.message}`);
    intentRules = DEFAULT_INTENT_RULES;
  }
}

function detectProfileIntentSignals(studentProfile) {
  const profileText = normalizeDiacritics([
    studentProfile?.projectType,
    studentProfile?.applicationDomain,
    studentProfile?.skills,
    studentProfile?.interests,
    studentProfile?.careerGoals,
    studentProfile?.specialization
  ]
    .filter(Boolean)
    .join(' '));

  const detected = [];
  for (const rule of intentRules) {
    const profileHits = countTokenMatches(profileText, rule.profileTokens);
    if (profileHits <= 0) {
      continue;
    }

    detected.push({
      id: rule.id,
      weight: Number(rule.weight) || 1,
      profileHits,
      topicPositiveTokens: rule.topicPositiveTokens,
      topicNegativeTokens: rule.topicNegativeTokens
    });
  }

  return detected.sort((a, b) => (b.profileHits * b.weight) - (a.profileHits * a.weight));
}

function scoreTopicIntentAlignment(studentProfile, topic) {
  const detectedIntents = detectProfileIntentSignals(studentProfile);
  if (detectedIntents.length === 0) {
    return 0;
  }

  const title = normalizeDiacritics(topic?.titlu_tema || '');
  let alignmentScore = 0;

  for (const intent of detectedIntents) {
    const positiveHits = countTokenMatches(title, intent.topicPositiveTokens);
    const negativeHits = countTokenMatches(title, intent.topicNegativeTokens);
    const weighted = (positiveHits * 2.2 - negativeHits * 2.8) * intent.weight;
    alignmentScore += weighted;
  }

  return Math.max(-12, Math.min(12, Math.round(alignmentScore)));
}

function isHardwareEmbeddedTopic(topic) {
  const normalizedTitle = normalizeDiacritics(topic?.titlu_tema || '');
  const hardwareTokens = [
    'esp32', 'arduino', 'firmware', 'embedded', 'microcontroler', 'microcontroller',
    'senzor', 'sensor', 'rfid', 'scada', 'plc', 'trifazat', 'monofazat',
    'electric', 'electrica', 'electrice', 'contor', 'contoare', 'tablou distributie'
  ];
  return hasAnyToken(normalizedTitle, hardwareTokens);
}

function profileNeedsSoftwareOnly(studentProfile) {
  const profileText = normalizeDiacritics([
    studentProfile?.projectType,
    studentProfile?.applicationDomain,
    studentProfile?.skills,
    studentProfile?.interests,
    studentProfile?.careerGoals
  ]
    .filter(Boolean)
    .join(' '));

  const softwareTokens = [
    'software', 'web', 'mobile', 'backend', 'frontend', 'api',
    'baze de date', 'baza de date', 'database', 'sql', 'nosql', 'big data', 'cloud'
  ];

  return hasAnyToken(profileText, softwareTokens);
}

function topicMatchesSpecialization(topic, targetSpecialization) {
  const normalizedTarget = normalizeDiacritics(targetSpecialization);
  const topicSpecializations = Array.isArray(topic?.specializari) ? topic.specializari : [];

  return topicSpecializations.some((specialization) => {
    const normalizedSpec = normalizeDiacritics(specialization);
    return (
      normalizedSpec === normalizedTarget ||
      normalizedSpec === 'toateprogramele' ||
      normalizedSpec === 'toateprogramelesauprograme'
    );
  });
}

function extractLeanItemsFromText(rawText, allowedIds, requestedCount) {
  const text = String(rawText || '');
  const objectMatches = text.match(/\{[\s\S]*?\}/g) || [];
  const seen = new Set();
  const recovered = [];

  for (const objText of objectMatches) {
    const idMatch = objText.match(/"id"\s*:\s*"([^"]+)"/i);
    const explanationMatch = objText.match(/"matchExplanation"\s*:\s*"([\s\S]*?)(?:"\s*(?:,|\}|\]|$)|$)/i);
    if (!idMatch || !explanationMatch) {
      continue;
    }

    const id = String(idMatch[1] || '').trim();
    if (!id || seen.has(id) || (allowedIds && !allowedIds.has(id))) {
      continue;
    }

    const matchExplanation = String(explanationMatch[1] || '')
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    if (!matchExplanation) {
      continue;
    }

    seen.add(id);
    recovered.push({ id, matchExplanation });
    if (recovered.length >= requestedCount) {
      break;
    }
  }

  return recovered;
}

function parseGeminiError(error) {
  const message = String(error?.message || '');
  const isQuotaExceeded = /\[429 Too Many Requests\]|quota exceeded|rate[- ]?limit/i.test(message);
  const isServiceUnavailable = /\[503 Service Unavailable\]/i.test(message);

  let retryAfterSeconds = null;
  const retryInMatch = message.match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"([0-9]+)s"/i);
  const retryValue = retryInMatch?.[1] || retryDelayMatch?.[1];
  if (retryValue && Number.isFinite(Number(retryValue))) {
    retryAfterSeconds = Math.max(1, Math.ceil(Number(retryValue)));
  }

  return {
    isQuotaExceeded,
    isServiceUnavailable,
    retryAfterSeconds,
    message
  };
}

async function scoreTopicsWithDirectContext(studentProfile, candidateTopics, retries = 3) {
  if (!Array.isArray(candidateTopics) || candidateTopics.length === 0) {
    return [];
  }

  const topicsContext = formatCandidateTopicsForContext(candidateTopics);
  console.log(`\n🧠 Unified scoring: sending ${candidateTopics.length} candidate topics to ${AI_PROVIDER.toUpperCase()}`);
  console.log(`   Context size: ${topicsContext.length} chars`);

  const requestedCount = Math.min(6, candidateTopics.length);
  const allowedIds = new Set(candidateTopics.map((topic) => topic.id));
  const safeRetries = Math.max(3, Number(retries) || 3);

  for (let attempt = 1; attempt <= safeRetries; attempt++) {
    try {
      const prompt = `Esti un evaluator academic EXTREM DE STRICT.

PROFIL STUDENT:
- Specializare: ${trimField(studentProfile.specialization, 80)}
- Nivel studii: ${trimField(studentProfile.studyLevel, 40)}
- Competente: ${trimField(studentProfile.skills)}
- Domeniu aplicare: ${trimField(studentProfile.applicationDomain)} ⭐⭐⭐ FILTRU PRIMAR - TREBUIE MATCH EXACT
- Tip proiect dorit: ${trimField(studentProfile.projectType)} ⭐⭐⭐ FILTRU PRIMAR - TREBUIE MATCH EXACT
- Interese: ${trimField(studentProfile.interests)}
- Obiective de cariera: ${trimField(studentProfile.careerGoals)}

LISTA COMPLETA DE TEME DISPONIBILE:
${topicsContext}

CLARIFICARI CRITICE - CE INSEAMNA "APLICATIE PRACTICA (SOFTWARE/WEB/MOBILE)":
- ✅ Software applications: app-uri desktop/mobile, website-uri, platforme web, tool-uri software, API-uri, dashboard-uri, sistem de recomandare
- ✅ Web/mobile: aplicații React/Vue/Angular, backend API REST, mobile apps, progressive web apps
- ❌ Embedded systems: microcontrolere, firmware, IoT hardware monitoring, senzori, sisteme embedded (EXCLUZIUNE)
- ❌ Hardware projects: proiecte cu placi electronice, circuite, monitorizare hardware, sisteme electrice (EXCLUZIUNE)
- ❌ Pure monitoring: sisteme de monitorizare senzori, sisteme SCADA cu hardware (EXCLUZIUNE)

CLARIFICARI CRITICE - CE INSEAMNA "AI/DATA SCIENCE":
- ✅ Machine learning, image processing, NLP, predictive models, data analysis, neural networks
- ❌ Simple monitoring IoT with sensors (EXCLUZIUNE - asta e embedded, nu AI)
- ❌ Hardware + data (EXCLUZIUNE - data science trebuie fara hardware)

SARCINA STRICTA:
1. FILTRARE AGRESIVA: Elimina INSTANT orice tema care e hardware/embedded/IoT/monitoring - chiar daca are cuvinte "inteligent"
2. APOI: Din teme-le ramase DOAR software/app/web, alege exact ${requestedCount} cele mai bune
3. Ordoneaza de cea mai relevanta (1) la cea mai putin relevanta (${requestedCount})
4. Returneaza EXCLUSIV JSON array, fara markdown

Fiecare obiect: 2 chei doar
- id: string tema
- matchExplanation: explicație detaliată de 3-4 propoziții care se exprimă DIRECT către student (ex: "Aceasta tema ti se potriveste deoarece..."). Fiecare motivație trebuie să menționeze clar și concret: (1) cum tema se aliniază exact cu domeniul de aplicare declarat, (2) cum valorifică competențele si interesele specificate de student, (3) cum contribuie la obiectivele de carieră ale acestuia. Exprimă-te ca și cum vorbești cu studentul personal, explicând beneficiile concrete pentru évoluția lui.

REGULI ABSOLUTE:
- Daca tema are hardware/senzori/embedded/IoT in titlu sau descriere → EXCLUDE DIN START
- Daca tema nu match domeniu → NU o incerca sa o retrofitezi
- RETURNEAZA EXACT ${requestedCount} teme
- Daca ai mai putin de ${requestedCount} teme BUNE, returneaza cat ai (nu compensa cu rele)
- Fara markdown, fara comentarii`;

      console.log(`   🔄 LLM attempt ${attempt}/${safeRetries}`);

      let rawText;
      let finishReason = 'unknown';
      if (AI_PROVIDER === 'azure') {
        rawText = await callAzureOpenAI(prompt, { temperature: 0.2, maxTokens: 2000, topP: 0.9 });
        console.log(`   🧾 Raw Azure OpenAI response preview: ${rawText.slice(0, 280)}${rawText.length > 280 ? '...' : ''}`);
      } else if (AI_PROVIDER === 'groq') {
        // Groq fallback (legacy)
        throw new Error('Groq provider is no longer available; please use Azure OpenAI or Gemini');
      } else {
        if (!genAI) {
          throw new Error('Google Gemini provider selected but GOOGLE_API_KEY is missing');
        }
        const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
            topP: 0.9,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0
            },
            responseSchema: {
              type: FunctionDeclarationSchemaType.ARRAY,
              items: {
                type: FunctionDeclarationSchemaType.OBJECT,
                properties: {
                  id: { type: FunctionDeclarationSchemaType.STRING },
                  matchExplanation: { type: FunctionDeclarationSchemaType.STRING }
                },
                required: ['id', 'matchExplanation']
              }
            }
          }
        });
        rawText = result.response.text().trim();
        finishReason = result?.response?.candidates?.[0]?.finishReason || 'unknown';
        console.log(`   🧾 Finish reason: ${finishReason}`);
        console.log(`   🧾 Raw LLM response preview: ${rawText.slice(0, 280)}${rawText.length > 280 ? '...' : ''}`);
      }
      const parsed = safeJsonParse(rawText);

      const parsedItems = Array.isArray(parsed)
        ? parsed
        : extractLeanItemsFromText(rawText, allowedIds, requestedCount);

      if (!Array.isArray(parsedItems)) {
        throw new Error('Unified scoring response is not a valid JSON array');
      }

      if (parsedItems.length === 0) {
        throw new Error('Unified scoring response contained no valid items');
      }

      if (parsedItems.length < requestedCount) {
        console.warn(`   ⚠️ Partial LLM output detected: got ${parsedItems.length}/${requestedCount} items before deduplication`);
      }

      const invalidShape = parsedItems.find((item) =>
        !item ||
        typeof item.id !== 'string' ||
        !item.id.trim() ||
        !allowedIds.has(item.id.trim()) ||
        typeof item.matchExplanation !== 'string' ||
        !item.matchExplanation.trim()
      );

      if (invalidShape) {
        throw new Error('Unified scoring response contains invalid items (id/matchExplanation missing)');
      }

      const uniqueOrdered = [];
      const seen = new Set();
      for (const item of parsedItems) {
        const id = item.id.trim();
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        uniqueOrdered.push({
          id,
          matchExplanation: String(item.matchExplanation).trim()
        });
        if (uniqueOrdered.length >= requestedCount) {
          break;
        }
      }

      if (uniqueOrdered.length === 0) {
        throw new Error('Unified scoring response has no usable unique valid ids');
      }

      if (uniqueOrdered.length < requestedCount) {
        console.warn(`   ⚠️ Returning partial recommendation batch: ${uniqueOrdered.length}/${requestedCount} valid unique items`);
      }

      if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY' || finishReason === 'OTHER') {
        console.warn(`   ⚠️ LLM finished with ${finishReason}; partial output may be expected`);
      }

      console.log(`   ✅ Parsed ${uniqueOrdered.length} scored topics from LLM`);

      return uniqueOrdered;
    } catch (error) {
      const providerError = parseGeminiError(error);
      if (providerError.isQuotaExceeded) {
        const retryInfo = providerError.retryAfterSeconds
          ? ` Retry after approximately ${providerError.retryAfterSeconds} seconds.`
          : '';
        const quotaError = new Error(`LLM quota exceeded.${retryInfo}`);
        quotaError.statusCode = 429;
        quotaError.retryAfterSeconds = providerError.retryAfterSeconds;
        throw quotaError;
      }

      const delay = 1200 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
      console.warn(`⚠️ Unified scoring attempt ${attempt}/${safeRetries} failed: ${error.message}`);
      if (attempt < safeRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error('LLM could not generate valid lean recommendations after retries');
}

function scoreTextOverlap(studentProfile, topic) {
  const title = normalizeDiacritics(topic?.titlu_tema);
  if (!title) {
    return 0;
  }

  const profileText = [
    studentProfile?.skills,
    studentProfile?.interests,
    studentProfile?.applicationDomain,
    studentProfile?.projectType,
    studentProfile?.careerGoals,
    studentProfile?.specialization
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedProfile = normalizeDiacritics(profileText);

  // Extract explicit skill tokens (from skills field) and keep short tech tokens too
  const rawSkills = String(studentProfile?.skills || '')
    .split(/[,;\/\\|]+|\s+/)
    .map((s) => normalizeDiacritics(s).trim())
    .filter(Boolean);

  const techTokens = new Set();
  for (const s of rawSkills) {
    if (s.length >= 2) techTokens.add(s);
    // split camelCase/compound like "javaScript" handled by normalizeDiacritics
    const parts = s.split(/[^a-z0-9]+/).filter(Boolean);
    for (const p of parts) {
      if (p.length >= 2) techTokens.add(p);
    }
  }

  // Also include tokens from projectType and applicationDomain
  const extraTokens = (String(studentProfile?.projectType || '') + ' ' + String(studentProfile?.applicationDomain || ''))
    .split(/[^a-z0-9]+/)
    .map((t) => normalizeDiacritics(t).trim())
    .filter(Boolean);
  for (const t of extraTokens) {
    if (t.length >= 2) techTokens.add(t);
  }

  if (techTokens.size === 0 && normalizedProfile.split(/[^a-z0-9]+/).filter(Boolean).length === 0) {
    return 0;
  }

  // Map common synonyms / shortenings to improve matches
  const synonymMap = {
    js: 'javascript',
    javascript: 'javascript',
    react: 'react',
    node: 'node',
    nodejs: 'node',
    frontend: 'frontend',
    'front-end': 'frontend',
    backend: 'backend',
    'back-end': 'backend',
    web: 'web',
    android: 'android',
    mobile: 'mobile'
  };

  let skillMatches = 0;
  for (const token of techTokens) {
    const mapped = synonymMap[token] || token;
    if (title.includes(mapped)) {
      skillMatches += 1;
    }
  }

  // Also check for broader overlap tokens (words length >=4) from the whole profile text
  const stopwords = new Set([
    'pentru', 'care', 'este', 'sunt', 'sau', 'din', 'prin', 'fara', 'doar', 'foarte', 'mai',
    'the', 'and', 'with', 'from', 'this', 'that', 'your', 'mine', 'dorit', 'dorita', 'dorită',
    'proiect', 'tema', 'teme', 'sistem', 'aplicatie', 'aplicatii', 'aplicație', 'aplicații'
  ]);

  const profileTokens = normalizedProfile
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stopwords.has(t));

  const uniqueProfileTokens = [...new Set(profileTokens)];
  let overlapHits = 0;
  for (const token of uniqueProfileTokens) {
    if (title.includes(token)) {
      overlapHits += 1;
    }
    if (overlapHits >= 2) break;
  }

  // Compose bonus: skillMatches are stronger than generic overlap
  let bonus = 0;
  if (skillMatches >= 2) bonus += 4;
  else if (skillMatches === 1) bonus += 2;

  if (overlapHits >= 2) bonus += 3;
  else if (overlapHits === 1) bonus += 1;

  // Penalize obvious contradiction: backend/db oriented profile vs pure frontend topic.
  const wantsBackendData = hasAnyToken(normalizedProfile, [
    'backend', 'baze de date', 'baza de date', 'database', 'sql', 'nosql',
    'postgres', 'mysql', 'mongodb', 'big data', 'data', 'arhitectura software', 'server', 'api'
  ]);
  const wantsFrontend = hasAnyToken(normalizedProfile, ['frontend', 'front-end', 'ui', 'ux', 'interfata']);

  const topicFrontend = hasAnyToken(title, ['frontend', 'front-end', 'ui', 'ux', 'interfata']);
  const topicBackend = hasAnyToken(title, ['backend', 'back-end', 'api', 'server', 'baza de date', 'database', 'sql']);

  if (wantsBackendData && !wantsFrontend && topicFrontend && !topicBackend) {
    bonus -= 14;
  }

  if (wantsBackendData && topicBackend) {
    bonus += 6;
  }

  if (wantsBackendData && isHardwareEmbeddedTopic(topic)) {
    bonus -= 12;
  }

  // Global intent alignment from configurable rule set (cross-faculty).
  bonus += scoreTopicIntentAlignment(studentProfile, topic);

  return Math.max(-16, Math.min(16, bonus));
}

function calculateLocalMatchScore(topic, studentProfile, rankIndex) {
  const baseScore = 72;

  const overlapBonus = scoreTextOverlap(studentProfile, topic);
  const rawScore = Math.min(99, Math.max(0, baseScore + overlapBonus));
  return isStudentProposedTopic(topic) ? Math.min(rawScore, 15) : rawScore;
}

function buildLocalRankedItems(topics, studentProfile, requestedCount = 6) {
  const safeCount = Math.max(1, Math.min(Number(requestedCount) || 6, topics.length));
  const ranked = [...topics]
    .map((topic) => ({
      topic,
      score: calculateLocalMatchScore(topic, studentProfile, 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, safeCount)
    .map(({ topic }) => ({
      id: topic.id,
      matchExplanation: `Tema are o potrivire bună cu profilul declarat (competențe, domeniu și tip de proiect). Se recomandă verificarea detaliilor tematice pentru validarea finală cu coordonatorul.`
    }));

  return ranked;
}

function calculateLlmRankScore(rankIndex, listSize) {
  const safeRank = Math.max(0, Number(rankIndex) || 0);
  // Use an absolute session position so later batches always score below earlier ones.
  const maxScore = 98;
  const decayPerPosition = 2;
  return Math.max(40, maxScore - safeRank * decayPerPosition);
}

function calculateFinalMatchScore({ localScore, llmRankScore, alpha = 0.7 }) {
  const safeAlpha = Math.max(0.0, Math.min(1.0, Number(alpha) || 0.7));
  const finalScore = safeAlpha * llmRankScore + (1 - safeAlpha) * localScore;
  return Math.max(0, Math.min(99, Math.round(finalScore)));
}

function mapLeanRecommendation(topic, llmItem, studentProfile, rankIndex, llmListSize, options = {}) {
  const explanation = String(llmItem?.matchExplanation || '').trim();

  if (!explanation) {
    throw new Error(`Missing matchExplanation from LLM for topic ${topic?.id || 'unknown'}`);
  }

  const localScore = calculateLocalMatchScore(topic, studentProfile, 0);
  const llmRankScore = calculateLlmRankScore(rankIndex, llmListSize);
  const finalScore = calculateFinalMatchScore({
    localScore,
    llmRankScore,
    alpha: options.alpha
  });

  return {
    id: topic.id,
    title: topic.titlu_tema,
    professor: topic.profesor,
    matchExplanation: explanation,
    specialization: topic.specializari,
    level: topic.nivel_studii,
    matchScore: finalScore,
    debugScores: {
      llmRankScore,
      localScore,
      alpha: Number.isFinite(Number(options.alpha)) ? Number(options.alpha) : 0.7
    }
  };
}

function sortByMatchScoreDesc(items) {
  return [...items].sort((a, b) => {
    const scoreA = Number.isFinite(Number(a?.matchScore)) ? Number(a.matchScore) : 0;
    const scoreB = Number.isFinite(Number(b?.matchScore)) ? Number(b.matchScore) : 0;
    return scoreB - scoreA;
  });
}

function buildFallbackEmailText({ studentProfile, topic, profesorEmail, rewriteMode = false }) {
  const faculty = trimField(studentProfile?.faculty || 'facultatea dumneavoastră', 80);
  const specialization = trimField(studentProfile?.specialization || 'specializarea mea', 80);
  const studyLevel = trimField(studentProfile?.studyLevel || 'licență', 40);
  const topicTitle = trimField(topic?.title || 'tema propusă', 200);
  const professor = trimField(topic?.professor || 'domnul profesor', 100);
  const contactEmail = trimField(profesorEmail || 'adresa dumneavoastră de email', 100);
  const projectType = trimField(studentProfile?.projectType || 'lucrare de licență', 80);
  const applicationDomain = trimField(studentProfile?.applicationDomain || 'domeniul ales', 80);
  const interests = trimField(studentProfile?.interests || '', 160);
  const skills = trimField(studentProfile?.skills || '', 200);
  const additionalSkills = trimField(studentProfile?.additionalSkills || '', 200);

  const interestSentence = interests
    ? `În plus, sunt interesat(ă) de ${interests}.`
    : '';

  const skillsSentence = [skills, additionalSkills].filter(Boolean).join(' ');
  const variantIntro = rewriteMode
    ? 'Revin cu interesul meu pentru această temă și vă transmit o variantă reformulată, clară și respectuoasă a mesajului.'
    : 'Vă contactez pentru a-mi exprima interesul de a lucra la această temă.';

  return [
    `Stimate Domnule Profesor ${professor},`,
    '',
    `Sunt student(ă) la Facultatea de ${faculty}, specializarea ${specialization}, nivel ${studyLevel}. ${variantIntro}`,
    `Tema "${topicTitle}" mi se pare deosebit de potrivită pentru ${projectType}, deoarece se aliniază cu direcția mea de studiu și cu interesul pentru ${applicationDomain}.`,
    skillsSentence ? `Consider că pot valorifica în cadrul acestei lucrări cunoștințele și competențele acumulate până acum. ${skillsSentence}` : 'Consider că pot valorifica în cadrul acestei lucrări cunoștințele și competențele acumulate până acum.',
    interestSentence,
    `Dacă există disponibilitate, aș fi onorat(ă) să îmi confirmați posibilitatea de a coordona această temă.`,
    `Vă mulțumesc pentru timpul acordat și vă stau la dispoziție la adresa ${contactEmail} pentru orice detalii suplimentare.`,
    '',
    'Cu respect,'
  ]
    .filter(Boolean)
    .join('\n\n');
}



app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LICENTACONNECT Backend is running',
    engine: AI_PROVIDER === 'azure' ? 'Azure OpenAI (gpt-4o)' : AI_PROVIDER === 'groq' ? 'Groq LPU (legacy)' : 'Google Gemini AI',
    aiProvider: AI_PROVIDER
  });
});

app.get('/api/topics', (req, res) => {
  try {
    const { facultatea, nivel_studii: nivelStudii, q } = req.query;

    let topics = Array.isArray(allTopics) ? [...allTopics] : [];

    topics = topics.map((topic) => ({
      ...topic,
      specializari: sanitizeSpecializations(topic.specializari)
    }));

    if (facultatea) {
      const facultyFilter = String(facultatea).trim().toUpperCase();
      topics = topics.filter((topic) => String(topic.facultatea || '').trim().toUpperCase() === facultyFilter);
    }

    if (nivelStudii) {
      const levelFilter = String(nivelStudii).trim().toLowerCase();
      topics = topics.filter((topic) => String(topic.nivel_studii || '').trim().toLowerCase() === levelFilter);
    }

    if (q) {
      const query = String(q).trim().toLowerCase();
      if (query) {
        topics = topics.filter((topic) => {
          const haystack = [
            topic.id,
            topic.facultatea,
            topic.profesor,
            topic.nivel_studii,
            topic.titlu_tema,
            ...(Array.isArray(topic.specializari) ? topic.specializari : [])
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(query);
        });
      }
    }

    return res.json({
      success: true,
      count: topics.length,
      topics
    });
  } catch (error) {
    console.error('❌ Error in /api/topics:', error.message);
    return res.status(500).json({
      error: 'Failed to load topics',
      details: error.message
    });
  }
});

app.post('/api/recommend', async (req, res) => {
  try {
    cleanupExpiredRecommendationSessions();

    const studentProfile = req.body;
    const studentEmail = normalizeStoredEmail(studentProfile?.email || studentProfile?.studentEmail || '');
    const studentName = String(studentProfile?.studentName || studentProfile?.fullName || '').trim();
    console.log('\n🎯 /api/recommend called');
    console.log(`   Faculty: ${studentProfile.faculty || '-'}`);
    console.log(`   Specialization: ${studentProfile.specialization}`);
    console.log(`   Study level: ${studentProfile.studyLevel}`);
    console.log(`   Domain: ${studentProfile.applicationDomain || '-'}`);
    console.log(`   Project type: ${studentProfile.projectType || '-'}`);

    if (!studentProfile.faculty || !studentProfile.specialization || !studentProfile.studyLevel) {
      return res.status(400).json({
        error: 'Missing required fields: faculty, specialization and studyLevel'
      });
    }

    const studyLevelMap = {
      licenta: 'Licență',
      disertatie: 'Masterat',
      masterat: 'Masterat',
      conversie: 'Conversie profesională'
    };

    const specializationMap = {
      calculatoare: 'C',
      c: 'C',
      'automatica si informatica aplicata': 'AIA',
      'automatică și informatică aplicată': 'AIA',
      aia: 'AIA',
      'retele si software de telecomunicatii': 'RST',
      'rețele și software de telecomunicații': 'RST',
      rst: 'RST',
      'sisteme electrice': 'SE',
      se: 'SE',
      'energetica si tehnologii informatice': 'ETI',
      'energetică și tehnologii informatice': 'ETI',
      eti: 'ETI',
      'echipamente si sisteme medicale': 'ESM',
      'echipamente și sisteme medicale': 'ESM',
      esm: 'ESM',
      'echipamente si sisteme de comanda si control pentru autovehicule': 'ESCCA',
      'echipamente și sisteme de comandă și control pentru autovehicule': 'ESCCA',
      escca: 'ESCCA',
      'managementul energiei': 'ME',
      me: 'ME',
      'stiinta si ingineria calculatoarelor': 'SIC',
      'știința și ingineria calculatoarelor': 'SIC',
      sic: 'SIC',
      'retele de comunicatii si calculatoare': 'RCC',
      'rețele de comunicații și calculatoare': 'RCC',
      rcc: 'RCC',
      'securitate cibernetica': 'SC',
      'securitate cibernetică': 'SC',
      sc: 'SC',
      'sisteme moderne pentru conducerea proceselor energetice': 'SMCPE',
      smcpe: 'SMCPE',
      'tehnici avansate in masini si actionari electrice': 'TAMAE',
      'tehnici avansate în mașini și acționări electrice': 'TAMAE',
      tamae: 'TAMAE',
      'tehnologia informatiei si a comunicatiilor': 'TIC',
      'tehnologia informației și a comunicațiilor': 'TIC',
      tic: 'TIC'
    };

    const normalizedStudyLevel = String(studentProfile.studyLevel || '').toLowerCase();
    const normalizedSpecialization = String(studentProfile.specialization || '').toLowerCase();

    const targetFaculty = mapFacultyCode(studentProfile.faculty);
    const targetStudyLevel = studyLevelMap[normalizedStudyLevel] || studentProfile.studyLevel;
    const targetSpecialization = specializationMap[normalizedSpecialization] || studentProfile.specialization;

    console.log(`   Mapped faculty: ${targetFaculty}`);
    console.log(`   Mapped specialization: ${targetSpecialization}`);
    console.log(`   Mapped level: ${targetStudyLevel}`);

    const candidateTopics = allTopics.filter((topic) =>
      mapFacultyCode(topic.facultatea) === targetFaculty &&
      normalizeDiacritics(topic.nivel_studii) === normalizeDiacritics(targetStudyLevel) &&
      topicMatchesSpecialization(topic, targetSpecialization)
    );

    console.log(`📚 Candidate topics after filtering: ${candidateTopics.length}`);
    if (candidateTopics.length > 0) {
      candidateTopics.slice(0, 3).forEach((topic, idx) => {
        console.log(`   ${idx + 1}. ${topic.id} | ${topic.titlu_tema}`);
      });
    }

    if (candidateTopics.length === 0) {
      return res.json({
        success: true,
        studentProfile,
        recommendations: [],
        hasMoreRecommendations: false,
        nextOffset: 0,
        totalCandidates: 0,
        totalRankedTopics: 0,
        message: 'No topics found for this specialization and study level'
      });
    }

    const regularTopics = candidateTopics.filter((topic) => !isStudentProposedTopic(topic));
    const studentProposedTopics = candidateTopics.filter((topic) => isStudentProposedTopic(topic));
    const basePoolTopics = regularTopics.length > 0 ? regularTopics : studentProposedTopics;
    const shouldApplySoftwareOnlyFilter = profileNeedsSoftwareOnly(studentProfile);

    let softwareFilteredBasePool = basePoolTopics;
    if (shouldApplySoftwareOnlyFilter) {
      const filtered = basePoolTopics.filter((topic) => !isHardwareEmbeddedTopic(topic));
      // Keep strict filter only when enough candidates remain.
      if (filtered.length >= 6) {
        softwareFilteredBasePool = filtered;
      }
      console.log(`   Software-only filter: ${basePoolTopics.length} -> ${softwareFilteredBasePool.length}`);
    }

    const candidatePoolForInitial = softwareFilteredBasePool;
    const targetInitialCount = Math.max(1, Math.min(6, candidatePoolForInitial.length));

    const llmRankedItems = await scoreTopicsWithDirectContext(studentProfile, candidatePoolForInitial, 6);
    const fallbackRankingUsed = false;
    console.log(`🧠 LLM returned ${llmRankedItems.length} lean ranked entries for initial pool`);

    const candidateById = new Map(candidatePoolForInitial.map((topic) => [topic.id, topic]));
    const seenIds = new Set();
    const rankedTopicsByAi = llmRankedItems
      .map((item, index) => {
        if (seenIds.has(item.id)) {
          return null;
        }

        const topic = candidateById.get(item.id);
        if (!topic) {
          return null;
        }

        seenIds.add(item.id);
        return mapLeanRecommendation(topic, item, studentProfile, index, llmRankedItems.length, { alpha: 0.7 });
      })
      .filter(Boolean);

    if (rankedTopicsByAi.length === 0) {
      throw new Error('LLM did not return valid recommendations for the initial pool');
    }

    const llmExhaustedInitial = rankedTopicsByAi.length < targetInitialCount;

    const sortedInitialPool = sortByMatchScoreDesc(rankedTopicsByAi);
    console.log(`✅ Built initial ranking from pool of ${sortedInitialPool.length} topics (LLM-first blend alpha=0.7)`);

    const initialBatch = sortedInitialPool.slice(0, Math.min(6, sortedInitialPool.length));
    const initialBatchSize = initialBatch.length;

    const initialIds = new Set(initialBatch.map((item) => item.id));

    let remainingTopics = [];
    if (!llmExhaustedInitial) {
      const scoredInitialRemainder = sortedInitialPool
        .slice(initialBatchSize)
        .map((item) => candidateById.get(item.id))
        .filter(Boolean);

      let remainderRegularBase = shouldApplySoftwareOnlyFilter
        ? regularTopics.filter((topic) => !isHardwareEmbeddedTopic(topic))
        : regularTopics;
      // IMPORTANT: keep all topics that were not part of the initial batch,
      // otherwise pagination can collapse to only "student proposed" placeholders.
      const unscoredRegularRemainder = remainderRegularBase.filter((topic) => !initialIds.has(topic.id));
      const studentProposedRemainder = studentProposedTopics.filter((topic) => !initialIds.has(topic.id));
      remainingTopics = [...scoredInitialRemainder, ...unscoredRegularRemainder, ...studentProposedRemainder]
        .filter((topic, index, arr) => arr.findIndex((item) => item.id === topic.id) === index);
    }

    console.log(`📦 Initial batch: ${initialBatch.length}, remaining for load-more: ${remainingTopics.length}`);

    initialBatch.forEach((topic, idx) => {
      const llmRankScore = topic?.debugScores?.llmRankScore;
      const localScore = topic?.debugScores?.localScore;
      console.log(`   ${idx + 1}. [${topic.matchScore}%] ${topic.id} | ${topic.title} (llm=${llmRankScore}, local=${localScore})`);
    });

    const recommendationSessionId = crypto.randomUUID();
    recommendationSessions.set(recommendationSessionId, {
      createdAt: Date.now(),
      studentProfile,
      initialBatchSize,
      remainingTopics,
      nextRankIndex: initialBatchSize,
      llmExhausted: llmExhaustedInitial,
      recommendations: initialBatch,
      combinedRecommendations: [...initialBatch],
      studentEmail,
      studentName
    });

    if (studentEmail) {
      try {
        await withAccountsPool(async (pool) => {
          const account = await fetchAccountByEmail(pool, studentEmail);
          await saveQuizSessionRecord(pool, {
            accountId: account?.id || null,
            accountEmail: studentEmail,
            studentName: studentName || account?.full_name || '',
            recommendationSessionId,
            formData: studentProfile,
            recommendations: initialBatch,
            aiResponse: {
              recommendationSessionId,
              hasMoreRecommendations: !llmExhaustedInitial && remainingTopics.length > 0,
              nextOffset: initialBatch.length,
              totalCandidates: candidateTopics.length,
              totalRankedTopics: candidateTopics.length
            }
          });
        });
      } catch (persistError) {
        console.error('⚠️ Failed to persist quiz session:', persistError.message);
      }
    }

    return res.json({
      success: true,
      studentProfile,
      recommendations: initialBatch,
      fallbackRankingUsed,
      hasMoreRecommendations: !llmExhaustedInitial && remainingTopics.length > 0,
      nextOffset: initialBatch.length,
      recommendationSessionId,
      totalCandidates: candidateTopics.length,
      totalRankedTopics: candidateTopics.length,
      engine: AI_PROVIDER === 'azure' 
        ? 'Azure OpenAI (gpt-4o lean output ranking)' 
        : AI_PROVIDER === 'groq'
          ? 'Groq LPU (legacy, no longer supported)'
          : 'Google Gemini (gemini-2.5-flash lean output ranking)',
      message: 'Recommendations generated successfully using Lean Output ranking'
    });
  } catch (error) {
    console.error('❌ Error in /api/recommend:', error.message);
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode === 429 && Number.isFinite(Number(error?.retryAfterSeconds))) {
      res.setHeader('Retry-After', String(Math.max(1, Math.round(Number(error.retryAfterSeconds)))));
    }

    return res.status(statusCode).json({
      error: 'Failed to generate recommendations',
      details: error.message,
      retryAfterSeconds: Number.isFinite(Number(error?.retryAfterSeconds))
        ? Math.max(1, Math.round(Number(error.retryAfterSeconds)))
        : undefined
    });
  }
});

app.post('/api/recommend/more', async (req, res) => {
  try {
    cleanupExpiredRecommendationSessions();

    const { recommendationSessionId, offset = 0, limit = 6 } = req.body || {};

    if (!recommendationSessionId) {
      return res.status(400).json({ error: 'Missing recommendationSessionId' });
    }

    const session = recommendationSessions.get(recommendationSessionId);
    if (!session) {
      return res.status(404).json({ error: 'Recommendation session expired or not found' });
    }

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.max(1, Math.min(10, Number(limit) || 6));
    const initialBatchSize = Number(session.initialBatchSize) || 6;

    if (!Array.isArray(session.remainingTopics)) {
      return res.status(409).json({ error: 'Recommendation session is missing remaining topics data' });
    }

    if (session.llmExhausted) {
      return res.json({
        success: true,
        recommendations: [],
        fallbackRankingUsed: false,
        hasMoreRecommendations: false,
        nextOffset: safeOffset,
        totalRankedTopics: initialBatchSize + session.remainingTopics.length,
        recommendationSessionId
      });
    }

    const deferredOffset = Math.max(0, safeOffset - initialBatchSize);
    const nextTopics = session.remainingTopics.slice(deferredOffset, deferredOffset + safeLimit);
    const targetBatchCount = Math.max(1, Math.min(safeLimit, nextTopics.length));

    let deferredLlmScores = [];
    let fallbackRankingUsed = false;
    try {
      deferredLlmScores = await scoreTopicsWithDirectContext(session.studentProfile, nextTopics, 5);
    } catch (rankingError) {
      const exhausted = /no valid items|could not generate valid/i.test(String(rankingError?.message || ''));
      if (!exhausted) {
        throw rankingError;
      }

      session.llmExhausted = true;
      recommendationSessions.set(recommendationSessionId, session);
      console.warn(`⚠️ LLM indicates no more relevant topics for load-more (${rankingError.message}); stopping pagination.`);

      return res.json({
        success: true,
        recommendations: [],
        fallbackRankingUsed,
        hasMoreRecommendations: false,
        nextOffset: safeOffset,
        totalRankedTopics: initialBatchSize + session.remainingTopics.length,
        recommendationSessionId
      });
    }
    const deferredTopicById = new Map(nextTopics.map((topic) => [topic.id, topic]));
    const deferredSeenIds = new Set();
    const batchRecommendations = deferredLlmScores
      .map((item, localIndex) => {
        if (deferredSeenIds.has(item.id)) {
          return null;
        }

        const topic = deferredTopicById.get(item.id);
        if (!topic) {
          return null;
        }

        deferredSeenIds.add(item.id);
        const absoluteRankIndex = session.nextRankIndex + localIndex;
        return mapLeanRecommendation(topic, item, session.studentProfile, absoluteRankIndex, deferredLlmScores.length, { alpha: 0.7 });
      })
      .filter(Boolean);

    if (batchRecommendations.length === 0) {
      session.llmExhausted = true;
      recommendationSessions.set(recommendationSessionId, session);

      return res.json({
        success: true,
        recommendations: [],
        fallbackRankingUsed,
        hasMoreRecommendations: false,
        nextOffset: safeOffset,
        totalRankedTopics: initialBatchSize + session.remainingTopics.length,
        recommendationSessionId
      });
    }

    const llmExhaustedLoadMore = batchRecommendations.length < targetBatchCount;
    if (llmExhaustedLoadMore) {
      session.llmExhausted = true;
      console.warn(`⚠️ LLM returned only ${batchRecommendations.length}/${targetBatchCount} load-more items; stopping pagination.`);
    }

    const regularBatch = batchRecommendations.filter((item) => !isStudentProposedTopic({ titlu_tema: item.title }));
    const studentProposedBatch = batchRecommendations.filter((item) => isStudentProposedTopic({ titlu_tema: item.title }));
    const nextRecommendations = [...sortByMatchScoreDesc(regularBatch), ...sortByMatchScoreDesc(studentProposedBatch)];

    session.nextRankIndex += nextRecommendations.length;
    session.combinedRecommendations = Array.isArray(session.combinedRecommendations)
      ? [...session.combinedRecommendations, ...nextRecommendations]
      : [...nextRecommendations];
    recommendationSessions.set(recommendationSessionId, session);

    if (session.studentEmail) {
      try {
        await withAccountsPool(async (pool) => {
          const account = await fetchAccountByEmail(pool, session.studentEmail);
          await saveQuizSessionRecord(pool, {
            accountId: account?.id || null,
            accountEmail: session.studentEmail,
            studentName: session.studentName || account?.full_name || '',
            recommendationSessionId,
            formData: session.studentProfile,
            recommendations: session.combinedRecommendations,
            aiResponse: {
              recommendationSessionId,
              hasMoreRecommendations: !session.llmExhausted && deferredNextOffset < session.remainingTopics.length,
              nextOffset,
              totalRankedTopics
            }
          });
        });
      } catch (persistError) {
        console.error('⚠️ Failed to update quiz session:', persistError.message);
      }
    }

    console.log(`📥 /api/recommend/more -> offset=${safeOffset}, deferredOffset=${deferredOffset}, limit=${safeLimit}, returned=${nextRecommendations.length}, blend=LLM-first(alpha=0.7)`);

    const deferredNextOffset = deferredOffset + nextRecommendations.length;
    const nextOffset = initialBatchSize + deferredNextOffset;
    const totalRankedTopics = initialBatchSize + session.remainingTopics.length;

    return res.json({
      success: true,
      recommendations: nextRecommendations,
      fallbackRankingUsed,
      hasMoreRecommendations: !session.llmExhausted && deferredNextOffset < session.remainingTopics.length,
      nextOffset,
      totalRankedTopics,
      recommendationSessionId
    });
  } catch (error) {
    console.error('❌ Error in /api/recommend/more:', error.message);
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode === 429 && Number.isFinite(Number(error?.retryAfterSeconds))) {
      res.setHeader('Retry-After', String(Math.max(1, Math.round(Number(error.retryAfterSeconds)))));
    }

    return res.status(statusCode).json({
      error: 'Failed to load more recommendations',
      details: error.message,
      retryAfterSeconds: Number.isFinite(Number(error?.retryAfterSeconds))
        ? Math.max(1, Math.round(Number(error.retryAfterSeconds)))
        : undefined
    });
  }
});

app.post('/api/generate-email-text', async (req, res) => {
  let resolvedStudentProfile = null;
  let resolvedTopic = null;

  try {
    const {
      studentProfile,
      topic,
      profesorEmail,
      rewriteMode,
      studentFaculty,
      studentSpecialization,
      studentStudyLevel,
      studentEmail,
      studentName,
      studentApplicationDomain,
      studentProjectType,
      studentSkills,
      studentAdditionalSkills,
      studentInterests,
      topicId,
      topicTitle,
      topicProfessor,
      topicSpecialization
    } = req.body || {};

    resolvedStudentProfile = studentProfile || {
      faculty: studentFaculty,
      specialization: studentSpecialization,
      studyLevel: studentStudyLevel,
      email: studentEmail,
      studentName,
      applicationDomain: studentApplicationDomain,
      projectType: studentProjectType,
      skills: studentSkills,
      additionalSkills: studentAdditionalSkills,
      interests: studentInterests
    };

    resolvedTopic = topic || {
      id: topicId,
      title: topicTitle,
      professor: topicProfessor,
      specialization: topicSpecialization
    };

    if (!resolvedStudentProfile || !resolvedTopic || !profesorEmail) {
      return res.status(400).json({
        error: 'Missing required fields: studentProfile, topic, profesorEmail'
      });
    }

    const prompt = `Ești o asistență AI pentru studenți care doresc să contacteze profesorii coordonatori pentru a lucra la o temă de licență.

INFORMAȚII STUDENT:
- Facultate: ${trimField(resolvedStudentProfile.faculty, 80)}
- Specializare: ${trimField(resolvedStudentProfile.specialization, 80)}
- Nivel: ${trimField(resolvedStudentProfile.studyLevel, 40)}
- Nume student: ${trimField(resolvedStudentProfile.studentName || 'Nespecificat', 80)}
- Email: ${trimField(resolvedStudentProfile.email || 'N/A', 100)}

INFORMAȚII TEMĂ:
- Titlu: ${trimField(resolvedTopic.title, 200)}
- Profesor Coordonator: ${trimField(resolvedTopic.professor, 100)}
- Email Profesor: ${trimField(profesorEmail, 100)}

SARCINA:
Generează un email **FORMAL, RESPECTUOS ȘI PROFESIONAL** în limba română pe care studentul îl poate trimite profesorului pentru a-și exprima interesul de a lucra la această temă.

${rewriteMode ? 'Aceasta este o cerere de REFORMULARE. Generează o variantă nouă, diferită față de cea anterioară, cu formulare mai naturală și mai clară, dar păstrează aceleași informații esențiale.' : ''}

Emailul trebuie să:
1. Salute formal profesorul folosind numele studentului dacă este disponibil
2. Specifice tema dorită (DOAR TITLUL, fără ID-ul temei)
3. Explice scurt de ce tema l-a atras (pe bază de competențe, interese, domeniu de aplicare)
4. Solicit confirmarea disponibilității pentru a fi profesor coordonator
5. Mulțumească și ofere o cale de contact

IMPORTANT:
- Text în limba română, FĂRĂ markdown
- Ton profesional și respectuos (profesor-student)
- Lungime: 150-250 de cuvinte
- NU include ID-ul temei în text (NU scrie "FIESC-071" sau ID-ul), DOAR titlul temei
- RETURNEAZA NUMAI CORPUL EMAILULUI (fără "Subject:", "Dear..:" etc., doar textul gata de copiat)`;

    let emailText;
    let fallbackUsed = false;
      if (AI_PROVIDER === 'azure') {
        try {
          emailText = await callAzureOpenAI(prompt, { temperature: rewriteMode ? 0.9 : 0.7, maxTokens: 1500, topP: 0.9 });
        } catch (err) {
          console.warn('⚠️ Azure OpenAI generation failed, using local fallback:', err && (err.message || err));
          emailText = buildFallbackEmailText({ studentProfile: resolvedStudentProfile, topic: resolvedTopic, profesorEmail, rewriteMode });
          fallbackUsed = true;
        }
      } else if (AI_PROVIDER === 'groq') {
        // Groq fallback (legacy)
        throw new Error('Groq provider is no longer available; please use Azure OpenAI or Gemini');
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: rewriteMode ? 0.9 : 0.7,
          maxOutputTokens: 1500,
          topP: 0.9
        }
      });

      emailText = result.response.text().trim();
    }

    console.log(`📧 Generated email for topic ${resolvedTopic.id || 'unknown'} to ${profesorEmail} (provider=${AI_PROVIDER})`);

    const respPayload = {
      success: true,
      emailText,
      topic: resolvedTopic,
      profesorEmail
    };
    if (fallbackUsed) {
      respPayload.fallbackUsed = true;
      respPayload.message = 'Groq generation failed; returned local fallback email text';
    }

    return res.json(respPayload);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || Number(error?.status) || 500;

    if (statusCode === 429 || String(error?.message || '').includes('quota')) {
      const fallbackEmailText = buildFallbackEmailText({
        studentProfile: resolvedStudentProfile,
        topic: resolvedTopic,
        profesorEmail,
        rewriteMode
      });

      console.warn(`⚠️ Gemini quota reached, using local fallback for topic ${resolvedTopic.id || 'unknown'}`);

      return res.json({
        success: true,
        emailText: fallbackEmailText,
        topic: resolvedTopic,
        profesorEmail,
        fallbackUsed: true,
        message: 'Gemini quota reached; returned local fallback email text'
      });
    }

    console.error('❌ Error in /api/generate-email-text:', error.message);

    return res.status(statusCode).json({
      error: 'Failed to generate email text',
      details: error.message
    });
  }
});

app.post('/api/send-email', async (req, res) => {
  try {
    const { studentEmail, studentName, profesorEmail, topic, emailText, studentProfile } = req.body || {};

    console.log(`📨 /api/send-email called -> student=${String(studentEmail || '').trim()}, profesor=${String(profesorEmail || '').trim()}, topic=${String(topic?.id || topic?.title || 'unknown')}`);

    if (!studentEmail || !profesorEmail || !topic || !emailText) {
      console.warn('⚠️ /api/send-email rejected: missing required fields');
      return res.status(400).json({
        error: 'Missing required fields: studentEmail, profesorEmail, topic, emailText'
      });
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail) || !emailRegex.test(profesorEmail)) {
      console.warn(`⚠️ /api/send-email rejected: invalid email format -> student=${studentEmail}, profesor=${profesorEmail}`);
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    const sendgridKey = process.env.SENDGRID_API_KEY && String(process.env.SENDGRID_API_KEY).trim();
    const smtpHostConfigured = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS;
    const useEmailTestMode = String(process.env.EMAIL_TEST_MODE || '').toLowerCase() === 'true';

    if (!sendgridKey && !smtpHostConfigured && !useEmailTestMode) {
      console.error('❌ /api/send-email blocked: no SendGrid or SMTP configuration and EMAIL_TEST_MODE=false');
      return res.status(500).json({
        error: 'Email delivery not configured',
        details: 'Set SENDGRID_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS and SMTP_FROM (or SENDGRID_FROM). Use EMAIL_TEST_MODE=true only for local testing.'
      });
    }

    let transporter;
    let transportMode = 'unknown';

    if (sendgridKey) {
      // Use SendGrid SMTP relay (no extra dependency required) — auth user is 'apikey'
      transporter = nodemailer.createTransport({
        host: process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net',
        port: Number(process.env.SENDGRID_SMTP_PORT || 587),
        secure: String(process.env.SENDGRID_SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
          user: process.env.SENDGRID_SMTP_USER || 'apikey',
          pass: sendgridKey
        }
      });
      transportMode = 'sendgrid';
    } else if (smtpHostConfigured) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      transportMode = 'smtp';
    } else {
      transportMode = 'ethereal';
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const envelopeTo = useEmailTestMode && studentEmail ? studentEmail : profesorEmail;
    const fromAddress = process.env.SMTP_FROM || process.env.SENDGRID_FROM || process.env.SMTP_USER || studentEmail;
    const normalizedStudentName = String(studentName || '').trim();
    const subjectStudentName = normalizedStudentName || 'studentul';
    const normalizedStudentEmail = normalizeStoredEmail(studentEmail);
    let accountId = null;

    if (normalizedStudentEmail) {
      try {
        await withAccountsPool(async (pool) => {
          const account = await fetchAccountByEmail(pool, normalizedStudentEmail);
          accountId = account?.id || null;
        });
      } catch (lookupError) {
        console.warn('⚠️ Could not resolve account for sent email:', lookupError.message);
      }
    }

    // Prepare email content
    const emailSubject = `Mesaj nou de la ${subjectStudentName}`;
    const emailHtml = `<p>${emailText.replace(/\n/g, '<br>')}</p>`;

    console.log(`📤 /api/send-email sending via ${transportMode} -> from=${process.env.SMTP_FROM || process.env.SMTP_USER || studentEmail}, to=${envelopeTo}, replyTo=${studentEmail}`);

    // Send the email
    const info = await transporter.sendMail({
      from: `"LicentaConnect" <${fromAddress}>`,
      to: envelopeTo,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      replyTo: studentEmail
    });

    // Save email record for tracking
    const emailRecord = {
      id: crypto.randomUUID(),
      accountId,
      studentEmail: normalizedStudentEmail,
      profesorEmail: profesorEmail.trim(),
      studentName: normalizedStudentName,
      recommendationSessionId: String(req.body?.recommendationSessionId || '').trim() || null,
      topic: {
        id: topic.id,
        title: topic.title,
        professor: topic.professor
      },
      studentProfile: {
        faculty: studentProfile?.faculty,
        specialization: studentProfile?.specialization,
        studyLevel: studentProfile?.studyLevel
      },
      emailText,
      timestamp: new Date().toISOString(),
      status: 'sent',
      responses: [],
      previewUrl: transportMode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null,
      transportMode,
      deliveredTo: envelopeTo
    };

    sentEmails.push(emailRecord);

    try {
      await withAccountsPool(async (pool) => {
        await saveSentEmailRecord(pool, emailRecord);
      });
    } catch (persistError) {
      console.error('⚠️ Failed to persist sent email:', persistError.message);
    }

    console.log(`📧 Email SENT! From: ${fromAddress} To: ${envelopeTo}, Subject: ${emailSubject}, Topic: ${topic.id}, mode=${transportMode}`);
    if (emailRecord.previewUrl) {
      console.log(`📱 Preview at: ${emailRecord.previewUrl}`);
    }

    return res.json({
      success: true,
      message: 'Email sent successfully!',
      emailId: emailRecord.id,
      studentEmail,
      profesorEmail: envelopeTo,
      sentAt: emailRecord.timestamp,
      previewUrl: emailRecord.previewUrl,
      transportMode,
      deliveredTo: envelopeTo,
      usedRealSmtp: transportMode === 'smtp'
    });
  } catch (error) {
    console.error('❌ Error in /api/send-email:', error && (error.stack || error.message || error));
    
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

app.get('/api/sent-emails', (req, res) => {
  try {
    const { studentEmail } = req.query;

    if (!studentEmail) {
      return res.status(400).json({
        error: 'Missing studentEmail query parameter'
      });
    }

    const normalizedStudentEmail = normalizeStoredEmail(studentEmail);

    if (isMysqlConfigured(process.env)) {
      return withAccountsPool(async (pool) => {
        const studentEmails = await fetchSentEmailsForEmail(pool, normalizedStudentEmail);
        return res.json({
          success: true,
          count: studentEmails.length,
          emails: studentEmails
        });
      }).catch((error) => {
        console.error('❌ Error in /api/sent-emails (DB):', error.message);
        return res.status(500).json({
          error: 'Failed to retrieve sent emails',
          details: error.message
        });
      });
    }

    const studentEmails = sentEmails.filter(
      (email) => normalizeStoredEmail(email.studentEmail) === normalizedStudentEmail
    );

    return res.json({
      success: true,
      count: studentEmails.length,
      emails: studentEmails
    });
  } catch (error) {
    console.error('❌ Error in /api/sent-emails:', error.message);
    
    return res.status(500).json({
      error: 'Failed to retrieve sent emails',
      details: error.message
    });
  }
});

app.get('/api/student/activity', async (req, res) => {
  try {
    const email = normalizeStoredEmail(req.query?.email || req.query?.studentEmail || '');
    if (!email) {
      return res.status(400).json({ error: 'Missing email query parameter' });
    }

    const hasMysql = isMysqlConfigured(process.env);
    if (hasMysql) {
      const [quizSessions, sentEmailRows] = await withAccountsPool(async (pool) => Promise.all([
        fetchQuizSessionsForEmail(pool, email),
        fetchSentEmailsForEmail(pool, email)
      ]));

      return res.json({
        success: true,
        email,
        quizSessions,
        sentEmails: sentEmailRows
      });
    }

    return res.json({
      success: true,
      email,
      quizSessions: [],
      sentEmails: sentEmails.filter((item) => normalizeStoredEmail(item.studentEmail) === email)
    });
  } catch (error) {
    console.error('❌ Error in /api/student/activity:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve student activity',
      details: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (fs.existsSync(frontendDistPath)) {
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(join(frontendDistPath, 'index.html'));
  });
}

async function startServer() {
  loadIntentRules();
  await ensureAccountsSchema();
  await ensureTopicsOwnershipSchema();
  await ensureStudentActivitySchema();
  await loadTopics();

  app.listen(PORT, () => {
    const engineLabel = AI_PROVIDER === 'azure' 
      ? 'Azure OpenAI (gpt-4o)' 
      : AI_PROVIDER === 'groq' 
        ? 'Groq LPU (legacy, no longer supported)' 
        : 'Google Gemini (gemini-2.5-flash)';
    console.log(`
╔════════════════════════════════════════════════════════╗
║   LICENTACONNECT Backend Server                        ║
║   Direct Context Matching Engine                       ║
║                                                        ║
║   Server running on: http://localhost:${PORT}          ║
║   Frontend: http://localhost:5173                      ║
║   AI Engine: ${engineLabel}                            ║
║                                                        ║
║   Endpoints:                                           ║
║   • GET  /health                                       ║
║   • POST /api/recommend                                ║
║   • POST /api/recommend/more                           ║
╚════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
