import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env') })

async function ensure() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || undefined,
  })

  try {
    const [cols] = await conn.query("SHOW COLUMNS FROM accounts")
    console.log('Existing columns:', cols.map(c => c.Field).join(', '))
    const existing = new Set(cols.map(c => c.Field))

    const alters = []

    if (!existing.has('approval_status')) {
      alters.push("ALTER TABLE accounts ADD COLUMN approval_status ENUM('approved','pending','rejected') NOT NULL DEFAULT 'approved' AFTER is_active")
    }
    if (!existing.has('approval_reviewed_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN approval_reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER approval_status")
    }
    if (!existing.has('email_verified_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL AFTER approval_reviewed_at")
    }
    if (!existing.has('email_verification_pin_hash')) {
      alters.push("ALTER TABLE accounts ADD COLUMN email_verification_pin_hash VARCHAR(255) NULL AFTER email_verified_at")
    }
    if (!existing.has('email_verification_expires_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN email_verification_expires_at TIMESTAMP NULL DEFAULT NULL AFTER email_verification_pin_hash")
    }
    if (!existing.has('email_verification_sent_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN email_verification_sent_at TIMESTAMP NULL DEFAULT NULL AFTER email_verification_expires_at")
    }
    if (!existing.has('password_reset_token_hash')) {
      alters.push("ALTER TABLE accounts ADD COLUMN password_reset_token_hash VARCHAR(255) NULL AFTER email_verification_sent_at")
    }
    if (!existing.has('password_reset_expires_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN password_reset_expires_at TIMESTAMP NULL DEFAULT NULL AFTER password_reset_token_hash")
    }
    if (!existing.has('password_reset_sent_at')) {
      alters.push("ALTER TABLE accounts ADD COLUMN password_reset_sent_at TIMESTAMP NULL DEFAULT NULL AFTER password_reset_expires_at")
    }

    if (alters.length === 0) {
      console.log('No schema changes needed for accounts table.')
      await conn.end()
      return
    }

    console.log('Applying schema changes to accounts table:')
    for (const sql of alters) {
      try {
        console.log('Running:', sql)
        await conn.query(sql)
        console.log('OK')
      } catch (err) {
        console.error('Failed to run:', sql)
        console.error(err)
      }
    }
  } finally {
    await conn.end()
  }
}

ensure().then(() => {
  console.log('Done')
}).catch(err => {
  console.error('Migration error:', err)
  process.exit(1)
})
